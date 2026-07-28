// CORBEL: recalculateReadiness() - Internal state machine
// This is the ONLY place where Operation.currentState can be changed
// Called after every action that might affect readiness

// Inline event helper for SHA256 hashing
async function computeEventHash(previousHash: string | null, payload: any): Promise<string> {
  const canonical = {
    operationId: payload.operationId,
    eventType: payload.eventType,
    actorUserId: payload.actorUserId,
    previousState: payload.previousState || '',
    newState: payload.newState || '',
    message: payload.message,
    metadata: payload.metadata || {},
    createdAt: payload.createdAt
  };
  const canonicalPayload = JSON.stringify(canonical);
  const chainData = previousHash ? previousHash + canonicalPayload : canonicalPayload;
  const encoder = new TextEncoder();
  const data = encoder.encode(chainData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function appendEvent(
  client: any,
  operationId: string,
  eventType: string,
  actorUserId: string,
  message: string,
  previousState?: string,
  newState?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  try {
    const lastEvents = await client.asServiceRole.entities.OperationalEvent.filter(
      { operationId },
      '-createdAt',
      1
    );
    const previousEventHash = lastEvents.length > 0 ? lastEvents[0].eventHash : null;
    const now = new Date().toISOString();
    const payload = {
      operationId,
      eventType,
      actorUserId,
      previousState,
      newState,
      message,
      metadata: metadata || {},
      createdAt: now
    };
    const eventHash = await computeEventHash(previousEventHash, payload);
    return await client.asServiceRole.entities.OperationalEvent.create({
      operationId,
      eventType,
      actorUserId,
      previousState,
      newState,
      message,
      metadata,
      previousEventHash,
      eventHash,
      createdAt: now
    });
  } catch (error) {
    console.error('Error appending event:', error);
    return null;
  }
}

interface RecalculateInput {
  client: any;
  operationId: string;
}

interface StateTransitionResult {
  operationId: string;
  previousState: string;
  newState: string;
  stateChanged: boolean;
  reason: string;
}

// Internal shared function - exported for other backend functions to call
export async function recalculateReadiness(input: RecalculateInput): Promise<StateTransitionResult> {
  const { client, operationId } = input;

  try {
    // Fetch current operation state
    const operation = await client.asServiceRole.entities.Operation.get(operationId);
    const previousState = operation.currentState;

    // Fetch all critical requirements for this operation
    const requirements = await client.asServiceRole.entities.ReadinessRequirement.filter({
      operationId,
      criticality: 'CRITICAL'
    });

    // STATE TRANSITION RULES
    // Apply in priority order (most restrictive first)

    // 1. Any REJECTED critical requirement → HOLD
    const hasRejected = requirements.some((r: any) => r.status === 'REJECTED');
    if (hasRejected) {
      const newState = 'HOLD';
      if (previousState !== newState) {
        await updateOperationState(client, operationId, previousState, newState, 'Rejected evidence detected');
      }
      return {
        operationId,
        previousState,
        newState,
        stateChanged: previousState !== newState,
        reason: 'One or more critical requirements rejected'
      };
    }

    // 2. Any UNOWNED critical requirement → HOLD
    const hasUnowned = requirements.some((r: any) => r.status === 'UNOWNED');
    if (hasUnowned) {
      const newState = 'HOLD';
      if (previousState !== newState) {
        await updateOperationState(client, operationId, previousState, newState, 'Unowned critical requirement');
      }
      return {
        operationId,
        previousState,
        newState,
        stateChanged: previousState !== newState,
        reason: 'Critical requirement has no accountable owner'
      };
    }

    // 3. Any OWNED requirement missing evidence → HOLD
    const hasOwnedNoEvidence = requirements.some((r: any) =>
      r.status === 'OWNED' && r.evidenceRequired
    );
    if (hasOwnedNoEvidence) {
      const newState = 'HOLD';
      if (previousState !== newState) {
        await updateOperationState(client, operationId, previousState, newState, 'Evidence required but not submitted');
      }
      return {
        operationId,
        previousState,
        newState,
        stateChanged: previousState !== newState,
        reason: 'Owned critical requirement awaiting evidence'
      };
    }

    // 4. Any EVIDENCE_SUBMITTED awaiting verification → VERIFYING
    const hasAwaitingVerification = requirements.some((r: any) =>
      r.status === 'EVIDENCE_SUBMITTED' && r.verificationRequired
    );
    if (hasAwaitingVerification) {
      const newState = 'VERIFYING';
      if (previousState !== newState) {
        await updateOperationState(client, operationId, previousState, newState, 'Evidence submitted, awaiting verification');
      }
      return {
        operationId,
        previousState,
        newState,
        stateChanged: previousState !== newState,
        reason: 'Critical evidence awaiting independent verification'
      };
    }

    // 5. All critical requirements VERIFIED or SATISFIED → RELEASED
    const allVerified = requirements.every((r: any) =>
      r.status === 'VERIFIED' || r.status === 'SATISFIED'
    );
    if (allVerified) {
      const newState = 'RELEASED';
      if (previousState !== newState) {
        await updateOperationState(client, operationId, previousState, newState, 'All critical requirements verified');
      }
      return {
        operationId,
        previousState,
        newState,
        stateChanged: previousState !== newState,
        reason: 'All critical requirements satisfied and verified'
      };
    }

    // No state change needed
    return {
      operationId,
      previousState,
      newState: previousState,
      stateChanged: false,
      reason: 'No state change required'
    };
  } catch (error) {
    console.error('recalculateReadiness error:', error);
    throw error;
  }
}

async function updateOperationState(
  client: any,
  operationId: string,
  previousState: string,
  newState: string,
  message: string
): Promise<void> {
  // Update operation state
  await client.asServiceRole.entities.Operation.update(operationId, {
    currentState: newState
  });

  // Create immutable operational event with hash chain
  await appendEvent(
    client,
    operationId,
    'STATE_CHANGED',
    'system', // System-initiated state changes
    message,
    previousState,
    newState,
    { automatic: true }
  );
}

// Public endpoint for testing/debugging (optional)
export async function handler(req: Request): Promise<Response> {
  try {
    const { createClientFromRequest } = await import('npm:@base44/sdk');
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId } = body;

    if (!operationId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'operationId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await recalculateReadiness({ client, operationId });

    return new Response(
      JSON.stringify({
        success: true,
        result
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('recalculateReadiness handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
