// CORBEL: verifyEvidence() - Only INDEPENDENT_VERIFIER role, and must not be the owner
// PROTECTED: Requires INDEPENDENT_VERIFIER role; user cannot be the accountable owner

import { createClientFromRequest } from 'base44/sdk';

export async function verifyEvidence(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.getCurrentUser();

    // SECURITY: Only INDEPENDENT_VERIFIER role can verify
    if (user.role !== 'INDEPENDENT_VERIFIER') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', reason: 'Only INDEPENDENT_VERIFIER role can verify evidence' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { requirementId, operationId, decision, note } = body;

    if (!requirementId || !operationId || !decision || !note) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'requirementId, operationId, decision, note required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'decision must be APPROVED or REJECTED' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify requirement exists
    const requirement = await client.entities.read('ReadinessRequirement', requirementId);
    if (requirement.operationId !== operationId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'Requirement does not belong to operation' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL SECURITY: Verifier cannot be the accountable owner
    if (requirement.ownerUserId === user.id) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          reason: 'Verifier cannot verify evidence for requirements they own'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Requirement must be in EVIDENCE_SUBMITTED state
    if (requirement.status !== 'EVIDENCE_SUBMITTED') {
      return new Response(
        JSON.stringify({
          error: 'Conflict',
          reason: 'Requirement must be in EVIDENCE_SUBMITTED state to verify'
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Verification record
    const verification = await client.entities.create('Verification', {
      requirementId,
      verifierUserId: user.id,
      decision,
      note
    });

    // Update requirement status based on decision
    const newStatus = decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
    await client.entities.update('ReadinessRequirement', requirementId, {
      status: newStatus
    });

    // Create operational event
    await client.entities.create('OperationalEvent', {
      operationId,
      eventType: 'EVIDENCE_VERIFIED',
      actorUserId: user.id,
      previousState: 'EVIDENCE_SUBMITTED',
      newState: newStatus,
      message: `${user.name} verified evidence for "${requirement.label}" as ${decision}`
    });

    // Recalculate readiness
    // If APPROVED: may move to READY if all other requirements are verified
    // If REJECTED: moves back to HOLD_OWNED
    const recalcResponse = await fetch(new URL('../functions/recalculateReadiness', import.meta.url).href, {
      method: 'POST',
      body: JSON.stringify({ operationId }),
      headers: { 'Content-Type': 'application/json' }
    });

    const recalcResult = await recalcResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        verification,
        stateRecalculation: recalcResult
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('verifyEvidence error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
