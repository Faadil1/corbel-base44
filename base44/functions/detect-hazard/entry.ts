import { createClientFromRequest } from "npm:@base44/sdk";

type Severity = "LOW" | "MEDIUM" | "HIGH";

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

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
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
     * Authoritative role lookup.
     * Never trust userId, email, or role from the request body.
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
            reason: "Authenticated user has no CORBEL user record"
          },
          403
        );
      }

      throw error;
    }

    if (corbelUser?.corbel_role !== "OPERATIONS_LEAD") {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "ROLE_FORBIDDEN",
          reason:
            "detect-hazard requires the OPERATIONS_LEAD role"
        },
        403
      );
    }

    /*
     * Parse body
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
      "title",
      "description",
      "severity",
      "photoUrl"
    ];

    const extraKeys = Object.keys(body).filter(
      (key) => !allowedKeys.includes(key)
    );

    if (extraKeys.length > 0) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "UNEXPECTED_FIELDS",
          reason: `Unexpected fields: ${extraKeys.join(", ")}`
        },
        400
      );
    }

    const {
      operationId,
      requirementId,
      title,
      description,
      severity,
      photoUrl
    } = body;

    /*
     * Required field validation
     */
    const missingFields = [
      ["operationId", operationId],
      ["requirementId", requirementId],
      ["title", title],
      ["description", description],
      ["severity", severity]
    ]
      .filter(([, value]) => !isNonEmptyString(value))
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

    const allowedSeverities: Severity[] = [
      "LOW",
      "MEDIUM",
      "HIGH"
    ];

    if (!allowedSeverities.includes(severity as Severity)) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_SEVERITY",
          reason: "severity must be LOW, MEDIUM, or HIGH"
        },
        400
      );
    }

    if (
      photoUrl !== undefined &&
      photoUrl !== null &&
      photoUrl !== ""
    ) {
      if (typeof photoUrl !== "string") {
        return jsonResponse(
          {
            error: "Invalid request",
            code: "INVALID_PHOTO_URL"
          },
          400
        );
      }

      try {
        new URL(photoUrl);
      } catch {
        return jsonResponse(
          {
            error: "Invalid request",
            code: "INVALID_PHOTO_URL"
          },
          400
        );
      }
    }

    /*
     * Load operation
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
     * Load requirement
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

    if (requirement.criticality !== "CRITICAL") {
      return jsonResponse(
        {
          error: "Conflict",
          code: "REQUIREMENT_NOT_CRITICAL",
          reason:
            "detect-hazard can trigger an operational hold only through a critical requirement"
        },
        409
      );
    }

    const createdAt = new Date().toISOString();
    const previousRequirementStatus = requirement.status;

    /*
     * Record the detected hazard.
     */
    const hazardPayload: Record<string, unknown> = {
      operationId,
      requirementId,
      reportedBy: authUser.id,
      title: title.trim(),
      description: description.trim(),
      severity,
      createdAt
    };

    if (isNonEmptyString(photoUrl)) {
      hazardPayload.photoUrl = photoUrl.trim();
    }

    const hazardReport =
      await client.asServiceRole.entities.HazardReport.create(
        hazardPayload
      );

    /*
     * Hazard detection removes any previous ownership.
     * The requirement becomes UNOWNED.
     */
    await client.asServiceRole.entities.ReadinessRequirement.update(
      requirementId,
      {
        status: "UNOWNED",
        ownerUserId: ""
      }
    );

    /*
     * Only recalculate-readiness may write Operation.currentState.
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
        "detect-hazard readiness recalculation failed:",
        error
      );

      return jsonResponse(
        {
          error: "Readiness recalculation failed",
          code: "READINESS_RECALCULATION_FAILED",
          hazardReportId: hazardReport.id,
          operationId,
          requirementId,
          requirementStatus: "UNOWNED"
        },
        500
      );
    }

    /*
     * Append operational evidence of the action and transition.
     */
    const operationalEvent =
      await client.asServiceRole.entities.OperationalEvent.create(
        {
          operationId,
          eventType: "HAZARD_DETECTED",
          actorUserId: authUser.id,
          previousState:
            transition?.previousState ??
            operation.currentState,
          newState:
            transition?.newState ??
            operation.currentState,
          message:
            `Hazard detected: ${title.trim()}`,
          metadata: {
            hazardReportId: hazardReport.id,
            requirementId,
            severity,
            previousRequirementStatus,
            newRequirementStatus: "UNOWNED"
          },
          createdAt
        }
      );

    return jsonResponse(
      {
        success: true,
        result: {
          hazardReportId: hazardReport.id,
          operationalEventId: operationalEvent.id,
          operationId,
          requirementId,
          reportedBy: authUser.id,
          previousRequirementStatus,
          newRequirementStatus: "UNOWNED",
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
    console.error("detect-hazard error:", error);

    return jsonResponse(
      {
        error: "Internal server error"
      },
      500
    );
  }
});
