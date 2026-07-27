// CORBEL: acceptOwnership() - Only ACCOUNTABLE_OWNER role can accept responsibility
// PROTECTED: Requires authenticated user with ACCOUNTABLE_OWNER role

import { createClientFromRequest } from 'base44/sdk';

export async function acceptOwnership(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.getCurrentUser();

    // SECURITY: Only ACCOUNTABLE_OWNER role can accept ownership
    if (user.role !== 'ACCOUNTABLE_OWNER') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', reason: 'Only ACCOUNTABLE_OWNER role can accept ownership' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { requirementId, operationId } = body;

    if (!requirementId || !operationId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'requirementId and operationId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify requirement exists and belongs to the operation
    const requirement = await client.entities.read('ReadinessRequirement', requirementId);
    if (requirement.operationId !== operationId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'Requirement does not belong to operation' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create OwnershipAcceptance record
    const acceptance = await client.entities.create('OwnershipAcceptance', {
      requirementId,
      acceptedBy: user.id,
      status: 'ACTIVE'
    });

    // Update requirement status to OWNED
    await client.entities.update('ReadinessRequirement', requirementId, {
      status: 'OWNED',
      ownerUserId: user.id
    });

    // Create operational event
    await client.entities.create('OperationalEvent', {
      operationId,
      eventType: 'OWNERSHIP_ACCEPTED',
      actorUserId: user.id,
      previousState: requirement.status,
      newState: 'OWNED',
      message: `${user.name} accepted ownership of "${requirement.label}"`
    });

    // Recalculate readiness (will move to HOLD_OWNED if no evidence yet)
    const recalcResponse = await fetch(new URL('../functions/recalculateReadiness', import.meta.url).href, {
      method: 'POST',
      body: JSON.stringify({ operationId }),
      headers: { 'Content-Type': 'application/json' }
    });

    const recalcResult = await recalcResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        acceptance,
        stateRecalculation: recalcResult
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('acceptOwnership error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
