import { createClientFromRequest } from "npm:@base44/sdk";

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
  const encoded = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
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
     * Authoritative CORBEL role lookup.
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
            "accept-ownership requires the ACCOUNTABLE_OWNER role"
        },
        403
      );
    }

    /*
     * Parse and validate request body.
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
      "requirementId"
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
      requirementId
    } = body;

    const missingFields = [
      ["operationId", operationId],
      ["requirementId", requirementId]
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

    /*
     * Load Operation.
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

    if (requirement.status !== "UNOWNED") {
      return jsonResponse(
        {
          error: "Conflict",
          code: "REQUIREMENT_NOT_UNOWNED",
          reason:
            `Current requirement status: ${requirement.status}`
        },
        409
      );
    }

    /*
     * Prevent contradictory active ownership records.
     */
    const activeAcceptances =
      await client.asServiceRole.entities.OwnershipAcceptance.filter(
        {
          requirementId,
          status: "ACTIVE"
        }
      );

    if (activeAcceptances.length > 0) {
      return jsonResponse(
        {
          error: "Conflict",
          code: "ACTIVE_OWNERSHIP_ALREADY_EXISTS"
        },
        409
      );
    }

    const acceptedAt = new Date().toISOString();

    /*
     * Create authoritative ownership record.
     */
    const acceptance =
      await client.asServiceRole.entities.OwnershipAcceptance.create(
        {
          requirementId,
          acceptedBy: authUser.id,
          acceptedAt,
          status: "ACTIVE"
        }
      );

    /*
     * Update only the requirement.
     * Never write Operation.currentState here.
     */
    await client.asServiceRole.entities.ReadinessRequirement.update(
      requirementId,
      {
        status: "OWNED",
        ownerUserId: authUser.id
      }
    );

    /*
     * Delegate operation-state calculation.
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
        "accept-ownership readiness recalculation failed:",
        error
      );

      return jsonResponse(
        {
          error: "Readiness recalculation failed",
          code: "READINESS_RECALCULATION_FAILED",
          ownershipAcceptanceId: acceptance.id,
          operationId,
          requirementId,
          requirementStatus: "OWNED"
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
          eventType: "OWNERSHIP_ACCEPTED",
          actorUserId: authUser.id,
          previousState:
            transition?.previousState ??
            operation.currentState,
          newState:
            transition?.newState ??
            operation.currentState,
          message:
            `${authUser.email ?? authUser.id} accepted accountability for "${requirement.label}"`,
          metadata: {
            ownershipAcceptanceId: acceptance.id,
            requirementId,
            requirementLabel: requirement.label,
            acceptedBy: authUser.id,
            previousRequirementStatus:
              requirement.status,
            newRequirementStatus: "OWNED"
          },
          createdAt: acceptedAt
        }
      );

    return jsonResponse(
      {
        success: true,
        result: {
          ownershipAcceptanceId:
            acceptance.id,
          operationalEventId:
            operationalEvent.id,
          operationId,
          requirementId,
          acceptedBy: authUser.id,
          acceptedAt,
          previousRequirementStatus:
            requirement.status,
          newRequirementStatus: "OWNED",
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
      "accept-ownership error:",
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
