import { createClientFromRequest } from "npm:@base44/sdk";

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

async function recalculateReadiness(
  client: any,
  operationId: string,
  operation: any,
  requirements: any[]
): Promise<Record<string, any>> {
  const previousState = operation.currentState;

  let newState: string;

  // Rule 1: Any UNOWNED, OWNED, or REJECTED -> HOLD
  const hasUnowned = requirements.some(
    (requirement: any) => requirement.status === "UNOWNED"
  );
  const hasOwned = requirements.some(
    (requirement: any) => requirement.status === "OWNED"
  );
  const hasRejected = requirements.some(
    (requirement: any) => requirement.status === "REJECTED"
  );

  if (hasUnowned || hasOwned || hasRejected) {
    newState = "HOLD";
  } else {
    // Rule 2: Any EVIDENCE_SUBMITTED -> VERIFYING
    const hasEvidenceSubmitted = requirements.some(
      (requirement: any) =>
        requirement.status === "EVIDENCE_SUBMITTED"
    );

    if (hasEvidenceSubmitted) {
      newState = "VERIFYING";
    } else {
      const allSatisfied = requirements.every(
        (requirement: any) =>
          requirement.status === "SATISFIED"
      );

      const allSatisfiedOrVerified = requirements.every(
        (requirement: any) =>
          requirement.status === "SATISFIED" ||
          requirement.status === "VERIFIED"
      );

      if (previousState === "READY" && allSatisfied) {
        newState = "READY";
      } else if (
        previousState === "VERIFYING" &&
        allSatisfiedOrVerified
      ) {
        newState = "RELEASED";
      } else if (
        previousState === "RELEASED" &&
        allSatisfiedOrVerified
      ) {
        newState = "RELEASED";
      } else {
        newState = previousState;
      }
    }
  }

  if (previousState !== newState) {
    await client.asServiceRole.entities.Operation.update(
      operationId,
      {
        currentState: newState
      }
    );
  }

  return {
    operationId,
    previousState,
    newState,
    stateChanged: previousState !== newState
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const client = createClientFromRequest(req);

    const user = await client.auth.me();

    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized"
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const body = await req.json();
    const { operationId } = body;

    if (!operationId || typeof operationId !== "string") {
      return new Response(
        JSON.stringify({
          error: "operationId is required"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const allowedKeys = ["operationId"];

    const extraKeys = Object.keys(body).filter(
      (key) => !allowedKeys.includes(key)
    );

    if (extraKeys.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid request",
          reason: `Unexpected fields: ${extraKeys.join(", ")}`
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    let operation;

    try {
      operation =
        await client.asServiceRole.entities.Operation.get(
          operationId
        );
    } catch (error) {
      if (isNotFoundError(error)) {
        return new Response(
          JSON.stringify({
            error: "Not found",
            code: "OPERATION_NOT_FOUND"
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }

      throw error;
    }

    if (!operation) {
      return new Response(
        JSON.stringify({
          error: "Not found",
          code: "OPERATION_NOT_FOUND"
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const requirements =
      await client.asServiceRole.entities.ReadinessRequirement.filter(
        {
          operationId,
          criticality: "CRITICAL"
        }
      );

    if (requirements.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Conflict",
          code: "NO_CRITICAL_REQUIREMENTS"
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const result = await recalculateReadiness(
      client,
      operationId,
      operation,
      requirements
    );

    return new Response(
      JSON.stringify({
        success: true,
        result
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("recalculate-readiness error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
});
