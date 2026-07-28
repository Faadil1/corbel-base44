import { createClientFromRequest } from "npm:@base44/sdk";

type VerificationDecision =
  | "APPROVED"
  | "REJECTED";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: JSON_HEADERS
    }
  );
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isNotFoundError(error: any): boolean {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    null;

  const code =
    error?.code ??
    error?.data?.code ??
    error?.response?.data?.code ??
    null;

  const message = String(
    error?.message ?? ""
  );

  return (
    status === 404 ||
    code === "NOT_FOUND" ||
    code === "ENTITY_NOT_FOUND" ||
    /\b404\b|not found/i.test(message)
  );
}

function normalizeFunctionResult(response: any): any {
  return (
    response?.data?.result ??
    response?.result ??
    response?.data ??
    response
  );
}

async function sha256(
  value: string
): Promise<string> {
  const encoded =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function appendOperationalEvent(
  client: any,
  input: {
    operationId: string;
    eventType: string;
    actorUserId: string;
    previousState: string;
    newState: string;
    message: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }
): Promise<any> {
  const previousEvents =
    await client.asServiceRole.entities.OperationalEvent.filter(
      {
        operationId: input.operationId
      },
      "-createdAt",
      1
    );

  const previousEventHash =
    previousEvents?.[0]?.eventHash ?? "";

  const canonicalPayload = {
    operationId: input.operationId,
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    previousState: input.previousState,
    newState: input.newState,
    message: input.message,
    metadata: input.metadata,
    createdAt: input.createdAt
  };

  const eventHash = await sha256(
    previousEventHash +
      JSON.stringify(canonicalPayload)
  );

  return await client.asServiceRole.entities.OperationalEvent.create(
    {
      ...canonicalPayload,
      previousEventHash,
      eventHash
    }
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const client = createClientFromRequest(req);

    /*
     * Authentication
     */
    const authUser = await client.auth.me();

    if (!authUser?.id) {
      return jsonResponse(
        {
          error: "Unauthorized",
          code: "UNAUTHENTICATED"
        },
        401
      );
    }

    /*
     * Authoritative CORBEL role.
     */
    let corbelUser: any;

    try {
      corbelUser =
        await client.asServiceRole.entities.User.get(
          authUser.id
        );
    } catch (error) {
      if (isNotFoundError(error)) {
        return jsonResponse(
          {
            error: "Forbidden",
            code: "ROLE_FORBIDDEN",
            reason:
              "Authenticated user has no CORBEL user record"
          },
          403
        );
      }

      throw error;
    }

    if (
      corbelUser?.corbel_role !==
      "INDEPENDENT_VERIFIER"
    ) {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "ROLE_FORBIDDEN",
          reason:
            "verify-evidence requires the INDEPENDENT_VERIFIER role"
        },
        403
      );
    }

    /*
     * Parse request body.
     */
    let body: any;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_JSON"
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_BODY"
        },
        400
      );
    }

    const allowedKeys = [
      "operationId",
      "requirementId",
      "evidenceId",
      "decision",
      "note"
    ];

    const extraKeys = Object.keys(body).filter(
      (key) => !allowedKeys.includes(key)
    );

    if (extraKeys.length > 0) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "UNEXPECTED_FIELDS",
          reason:
            `Unexpected fields: ${extraKeys.join(", ")}`
        },
        400
      );
    }

    const {
      operationId,
      requirementId,
      evidenceId,
      decision,
      note
    } = body;

    const missingFields = [
      ["operationId", operationId],
      ["requirementId", requirementId],
      ["evidenceId", evidenceId],
      ["decision", decision],
      ["note", note]
    ]
      .filter(([, value]) =>
        !isNonEmptyString(value)
      )
      .map(([field]) => field);

    if (missingFields.length > 0) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "MISSING_REQUIRED_FIELDS",
          reason:
            `Missing or empty fields: ${missingFields.join(", ")}`
        },
        400
      );
    }

    const allowedDecisions:
      VerificationDecision[] = [
        "APPROVED",
        "REJECTED"
      ];

    if (
      !allowedDecisions.includes(
        decision as VerificationDecision
      )
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_DECISION",
          reason:
            "decision must be APPROVED or REJECTED"
        },
        400
      );
    }

    /*
     * Load operation.
     */
    let operation: any;

    try {
      operation =
        await client.asServiceRole.entities.Operation.get(
          operationId
        );
    } catch (error) {
      if (isNotFoundError(error)) {
        return jsonResponse(
          {
            error: "Not found",
            code: "OPERATION_NOT_FOUND"
          },
          404
        );
      }

      throw error;
    }

    /*
     * Load requirement.
     */
    let requirement: any;

    try {
      requirement =
        await client.asServiceRole.entities.ReadinessRequirement.get(
          requirementId
        );
    } catch (error) {
      if (isNotFoundError(error)) {
        return jsonResponse(
          {
            error: "Not found",
            code: "REQUIREMENT_NOT_FOUND"
          },
          404
        );
      }

      throw error;
    }

    if (requirement.operationId !== operationId) {
      return jsonResponse(
        {
          error: "Conflict",
          code: "REQUIREMENT_OPERATION_MISMATCH"
        },
        409
      );
    }

    /*
     * Load the exact submitted evidence.
     */
    let evidence: any;

    try {
      evidence =
        await client.asServiceRole.entities.Evidence.get(
          evidenceId
        );
    } catch (error) {
      if (isNotFoundError(error)) {
        return jsonResponse(
          {
            error: "Not found",
            code: "EVIDENCE_NOT_FOUND"
          },
          404
        );
      }

      throw error;
    }

    if (evidence.requirementId !== requirementId) {
      return jsonResponse(
        {
          error: "Conflict",
          code: "EVIDENCE_REQUIREMENT_MISMATCH"
        },
        409
      );
    }

    if (
      requirement.status !==
      "EVIDENCE_SUBMITTED"
    ) {
      return jsonResponse(
        {
          error: "Conflict",
          code:
            "REQUIREMENT_NOT_AWAITING_VERIFICATION",
          reason:
            `Current requirement status: ${requirement.status}`
        },
        409
      );
    }

    /*
     * Independence is enforced by identity, not role alone.
     */
    if (
      evidence.submittedBy === authUser.id ||
      requirement.ownerUserId === authUser.id
    ) {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "VERIFIER_NOT_INDEPENDENT",
          reason:
            "The verifier cannot own the requirement or have submitted its evidence"
        },
        403
      );
    }

    const verifiedAt =
      new Date().toISOString();

    const newRequirementStatus =
      decision === "APPROVED"
        ? "VERIFIED"
        : "REJECTED";

    /*
     * Create verification decision.
     */
    const verification =
      await client.asServiceRole.entities.Verification.create(
        {
          requirementId,
          verifierUserId: authUser.id,
          decision,
          note: note.trim(),
          verifiedAt
        }
      );

    /*
     * Update only the requirement.
     */
    await client.asServiceRole.entities.ReadinessRequirement.update(
      requirementId,
      {
        status: newRequirementStatus
      }
    );

    /*
     * Only recalculate-readiness writes
     * Operation.currentState.
     */
    let transition: any;

    try {
      const recalculationResponse =
        await client.functions.invoke(
          "recalculate-readiness",
          {
            operationId
          }
        );

      transition = normalizeFunctionResult(
        recalculationResponse
      );
    } catch (error) {
      console.error(
        "verify-evidence readiness recalculation failed:",
        error
      );

      return jsonResponse(
        {
          error: "Readiness recalculation failed",
          code: "READINESS_RECALCULATION_FAILED",
          verificationId: verification.id,
          operationId,
          requirementId,
          requirementStatus:
            newRequirementStatus
        },
        500
      );
    }

    const eventType =
      decision === "APPROVED"
        ? "VERIFICATION_APPROVED"
        : "VERIFICATION_REJECTED";

    /*
     * Append audit event.
     */
    const operationalEvent =
      await appendOperationalEvent(
        client,
        {
          operationId,
          eventType,
          actorUserId: authUser.id,
          previousState:
            transition?.previousState ??
            operation.currentState,
          newState:
            transition?.newState ??
            operation.currentState,
          message:
            `${authUser.email ?? authUser.id} ${decision === "APPROVED" ? "approved" : "rejected"} evidence for "${requirement.label}"`,
          metadata: {
            verificationId:
              verification.id,
            evidenceId,
            requirementId,
            requirementLabel:
              requirement.label,
            verifierUserId:
              authUser.id,
            evidenceSubmittedBy:
              evidence.submittedBy,
            decision,
            previousRequirementStatus:
              requirement.status,
            newRequirementStatus
          },
          createdAt: verifiedAt
        }
      );

    return jsonResponse(
      {
        success: true,
        result: {
          verificationId:
            verification.id,
          operationalEventId:
            operationalEvent.id,
          evidenceId,
          operationId,
          requirementId,
          verifierUserId:
            authUser.id,
          verifiedAt,
          decision,
          previousRequirementStatus:
            requirement.status,
          newRequirementStatus,
          previousState:
            transition?.previousState ??
            operation.currentState,
          newState:
            transition?.newState ??
            operation.currentState,
          stateChanged:
            transition?.stateChanged === true
        }
      },
      200
    );
  } catch (error) {
    console.error(
      "verify-evidence error:",
      error
    );

    return jsonResponse(
      {
        error: "Internal server error"
      },
      500
    );
  }
});
