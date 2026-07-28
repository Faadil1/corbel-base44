import { createClientFromRequest } from "npm:@base44/sdk";

type EvidenceType =
  | "PHOTO"
  | "DOCUMENT"
  | "REPORT"
  | "NOTE";

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

  const message = String(error?.message ?? "");

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

async function sha256(value: string): Promise<string> {
  const encoded =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array.from(new Uint8Array(digest))
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
      "ACCOUNTABLE_OWNER"
    ) {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "ROLE_FORBIDDEN",
          reason:
            "submit-evidence requires the ACCOUNTABLE_OWNER role"
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
      "evidenceType",
      "note",
      "fileUrl"
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
      evidenceType,
      note,
      fileUrl
    } = body;

    const missingFields = [
      ["operationId", operationId],
      ["requirementId", requirementId],
      ["evidenceType", evidenceType],
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

    const allowedEvidenceTypes: EvidenceType[] = [
      "PHOTO",
      "DOCUMENT",
      "REPORT",
      "NOTE"
    ];

    if (
      !allowedEvidenceTypes.includes(
        evidenceType as EvidenceType
      )
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_EVIDENCE_TYPE",
          reason:
            "evidenceType must be PHOTO, DOCUMENT, REPORT, or NOTE"
        },
        400
      );
    }

    if (
      fileUrl !== undefined &&
      fileUrl !== null &&
      fileUrl !== ""
    ) {
      if (typeof fileUrl !== "string") {
        return jsonResponse(
          {
            error: "Invalid request",
            code: "INVALID_FILE_URL"
          },
          400
        );
      }

      try {
        new URL(fileUrl);
      } catch {
        return jsonResponse(
          {
            error: "Invalid request",
            code: "INVALID_FILE_URL"
          },
          400
        );
      }
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
     * Role is not enough: the authenticated user must
     * be the actual owner of this requirement.
     */
    if (requirement.ownerUserId !== authUser.id) {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "NOT_REQUIREMENT_OWNER",
          reason:
            "Only the current accountable owner may submit evidence"
        },
        403
      );
    }

    if (
      requirement.status !== "OWNED" &&
      requirement.status !== "REJECTED"
    ) {
      return jsonResponse(
        {
          error: "Conflict",
          code: "REQUIREMENT_NOT_EVIDENCE_ELIGIBLE",
          reason:
            `Current requirement status: ${requirement.status}`
        },
        409
      );
    }

    /*
     * Confirm an active ownership acceptance exists.
     */
    const activeAcceptances =
      await client.asServiceRole.entities.OwnershipAcceptance.filter(
        {
          requirementId,
          acceptedBy: authUser.id,
          status: "ACTIVE"
        }
      );

    if (activeAcceptances.length === 0) {
      return jsonResponse(
        {
          error: "Conflict",
          code: "ACTIVE_OWNERSHIP_NOT_FOUND"
        },
        409
      );
    }

    const submittedAt = new Date().toISOString();
    const previousRequirementStatus =
      requirement.status;

    /*
     * Create evidence.
     */
    const evidencePayload:
      Record<string, unknown> = {
        requirementId,
        submittedBy: authUser.id,
        evidenceType,
        note: note.trim(),
        submittedAt
      };

    if (isNonEmptyString(fileUrl)) {
      evidencePayload.fileUrl =
        fileUrl.trim();
    }

    const evidence =
      await client.asServiceRole.entities.Evidence.create(
        evidencePayload
      );

    /*
     * Update only requirement state.
     */
    await client.asServiceRole.entities.ReadinessRequirement.update(
      requirementId,
      {
        status: "EVIDENCE_SUBMITTED"
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
        "submit-evidence readiness recalculation failed:",
        error
      );

      return jsonResponse(
        {
          error: "Readiness recalculation failed",
          code: "READINESS_RECALCULATION_FAILED",
          evidenceId: evidence.id,
          operationId,
          requirementId,
          requirementStatus:
            "EVIDENCE_SUBMITTED"
        },
        500
      );
    }

    /*
     * Append audit event.
     */
    const operationalEvent =
      await appendOperationalEvent(
        client,
        {
          operationId,
          eventType: "EVIDENCE_SUBMITTED",
          actorUserId: authUser.id,
          previousState:
            transition?.previousState ??
            operation.currentState,
          newState:
            transition?.newState ??
            operation.currentState,
          message:
            `${authUser.email ?? authUser.id} submitted ${String(evidenceType).toLowerCase()} evidence for "${requirement.label}"`,
          metadata: {
            evidenceId: evidence.id,
            requirementId,
            requirementLabel:
              requirement.label,
            evidenceType,
            submittedBy: authUser.id,
            ownershipAcceptanceId:
              activeAcceptances[0].id,
            previousRequirementStatus,
            newRequirementStatus:
              "EVIDENCE_SUBMITTED",
            hasFileUrl:
              isNonEmptyString(fileUrl)
          },
          createdAt: submittedAt
        }
      );

    return jsonResponse(
      {
        success: true,
        result: {
          evidenceId: evidence.id,
          operationalEventId:
            operationalEvent.id,
          operationId,
          requirementId,
          submittedBy: authUser.id,
          submittedAt,
          evidenceType,
          previousRequirementStatus,
          newRequirementStatus:
            "EVIDENCE_SUBMITTED",
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
      "submit-evidence error:",
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
