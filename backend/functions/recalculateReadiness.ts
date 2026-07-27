// CORBEL: recalculateReadiness() - Server-side state machine
// This is the ONLY place where Operation.currentState can be changed
// Called by every state-changing backend function

import { OperationState, RequirementStatus } from '../entities/types';

interface RecalculateInput {
  operationId: string;
  client: any; // Base44 client from createClientFromRequest
}

interface RecalculateOutput {
  operationId: string;
  previousState: OperationState;
  newState: OperationState;
  stateChanged: boolean;
  reason: string;
}

export async function recalculateReadiness(
  input: RecalculateInput
): Promise<RecalculateOutput> {
  const { operationId, client } = input;

  // Fetch current operation state
  const operation = await client.entities.read('Operation', operationId);
  const previousState = operation.currentState as OperationState;

  // Fetch all critical requirements for this operation
  const requirements = await client.entities.filter('ReadinessRequirement', {
    operationId,
    criticality: 'CRITICAL'
  });

  // PRIORITY RECALCULATION RULES
  // 1. Any rejected critical requirement → HOLD_OWNED
  const hasRejected = requirements.some((r: any) => r.status === 'REJECTED');
  if (hasRejected) {
    const newState = 'HOLD_OWNED' as OperationState;
    if (previousState !== newState) {
      await updateOperationState(client, operationId, previousState, newState, 'Rejected evidence detected');
    }
    return {
      operationId,
      previousState,
      newState,
      stateChanged: previousState !== newState,
      reason: 'Rejected critical requirement exists'
    };
  }

  // 2. Any unowned critical requirement → HOLD_UNOWNED
  const hasUnowned = requirements.some((r: any) => r.status === 'UNOWNED');
  if (hasUnowned) {
    const newState = 'HOLD_UNOWNED' as OperationState;
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

  // 3. Any owned requirement missing evidence → HOLD_OWNED
  const hasOwnedNoEvidence = requirements.some((r: any) =>
    (r.status === 'OWNED' || r.status === 'EVIDENCE_SUBMITTED') && r.evidenceRequired
  );
  if (hasOwnedNoEvidence) {
    const newState = 'HOLD_OWNED' as OperationState;
    if (previousState !== newState) {
      await updateOperationState(client, operationId, previousState, newState, 'Evidence required but not yet submitted');
    }
    return {
      operationId,
      previousState,
      newState,
      stateChanged: previousState !== newState,
      reason: 'Owned critical requirement awaiting evidence'
    };
  }

  // 4. Any submitted evidence awaiting verification → VERIFYING
  const hasAwaitingVerification = requirements.some((r: any) =>
    r.status === 'EVIDENCE_SUBMITTED' && r.verificationRequired
  );
  if (hasAwaitingVerification) {
    const newState = 'VERIFYING' as OperationState;
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

  // 5. All critical requirements verified or satisfied → READY
  const allVerified = requirements.every((r: any) =>
    r.status === 'VERIFIED' || r.status === 'SATISFIED'
  );
  if (allVerified) {
    const newState = 'READY' as OperationState;
    if (previousState !== newState) {
      await updateOperationState(client, operationId, previousState, newState, 'All critical requirements verified');
    }
    return {
      operationId,
      previousState,
      newState,
      stateChanged: previousState !== newState,
      reason: 'All critical requirements satisfied'
    };
  }

  // No state change
  return {
    operationId,
    previousState,
    newState: previousState,
    stateChanged: false,
    reason: 'No state change required'
  };
}

async function updateOperationState(
  client: any,
  operationId: string,
  previousState: OperationState,
  newState: OperationState,
  message: string
): Promise<void> {
  // Update operation state
  await client.entities.update('Operation', operationId, {
    currentState: newState,
    updatedAt: new Date()
  });

  // Create immutable operational event BEFORE confirming the transition
  await client.entities.create('OperationalEvent', {
    operationId,
    eventType: 'STATE_CHANGE',
    actorUserId: 'system', // System function, not a human
    previousState,
    newState,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
      automatic: true
    }
  });
}
