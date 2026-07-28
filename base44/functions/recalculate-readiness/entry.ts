import { createClientFromRequest } from "npm:@base44/sdk";

async function recalculateReadiness(
  client: any,
  operationId: string,
  requirements: any[]
): Promise<Record<string, any>> {
  // Load the Operation
  const operation = await client.asServiceRole.entities.Operation.get(operationId);
  const previousState = operation.currentState;

  // Determine new state based on mandatory rules
  let newState: string;

  // Rule 1: Any UNOWNED, OWNED, or REJECTED → HOLD
  const hasUnowned = requirements.some((r: any) => r.status === "UNOWNED");
  const hasOwned = requirements.some((r: any) => r.status === "OWNED");
  const hasRejected = requirements.some((r: any) => r.status === "REJECTED");

  if (hasUnowned || hasOwned || hasRejected) {
    newState = "HOLD";
  } else {
    // Rule 2: Any EVIDENCE_SUBMITTED → VERIFYING
    const hasEvidenceSubmitted = requirements.some(
      (r: any) => r.status === "EVIDENCE_SUBMITTED"
    );

    if (hasEvidenceSubmitted) {
      newState = "VERIFYING";
    } else {
      // Rules 3-5: State-specific transitions with fallback
      const allSatisfied = requirements.every(
        (r: any) => r.status === "SATISFIED"
      );
      const allSatisfiedOrVerified = requirements.every(
        (r: any) => r.status === "SATISFIED" || r.status === "VERIFIED"
      );

      if (previousState === "READY" && allSatisfied) {
        // Rule 3: previousState === READY and every critical requirement is SATISFIED → READY
        newState = "READY";
      } else if (previousState === "VERIFYING" && allSatisfiedOrVerified) {
        // Rule 4: previousState === VERIFYING and every critical requirement is SATISFIED or VERIFIED → RELEASED
        newState = "RELEASED";
      } else if (previousState === "RELEASED" && allSatisfiedOrVerified) {
        // Rule 5: previousState === RELEASED and every critical requirement is SATISFIED or VERIFIED → RELEASED
        newState = "RELEASED";
      } else {
        // Fallback: every other combination → preserve previousState
        newState = previousState;
      }
    }
  }

  // Update operation state if changed
  if (previousState !== newState) {
    await client.asServiceRole.entities.Operation.update(operationId, {
      currentState: newState
    });
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
    // Require authenticated user
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body = await req.json();
    const { operationId } = body;

    // Validate: operationId must be present
    if (!operationId || typeof operationId !== "string") {
      return new Response(
        JSON.stringify({ error: "operationId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate: no extra fields allowed (reject currentState, targetState, etc.)
    const allowedKeys = ["operationId"];
    const extraKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid request",
          reason: `Unexpected fields: ${extraKeys.join(", ")}`
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate: operation exists
    const operation = await client.asServiceRole.entities.Operation.get(operationId);
    if (!operation) {
      return new Response(
        JSON.stringify({ error: "Operation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Load critical requirements
    const requirements = await client.asServiceRole.entities.ReadinessRequirement.filter({
      operationId,
      criticality: "CRITICAL"
    });

    // Check for zero critical requirements
    if (requirements.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Conflict",
          code: "NO_CRITICAL_REQUIREMENTS"
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Recalculate
    const result = await recalculateReadiness(client, operationId, requirements);

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("recalculate-readiness error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
