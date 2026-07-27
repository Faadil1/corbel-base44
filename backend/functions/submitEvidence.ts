// CORBEL: submitEvidence() - Only the accountable owner can submit evidence
// PROTECTED: Only the current owner can submit evidence for their requirement

import { createClientFromRequest } from 'base44/sdk';

export async function submitEvidence(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.getCurrentUser();

    const body = await req.json();
    const { requirementId, operationId, evidenceType, note, fileUrl } = body;

    if (!requirementId || !operationId || !evidenceType || !note) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'requirementId, operationId, evidenceType, note required' }),
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

    // SECURITY: Only the current owner can submit evidence
    if (requirement.ownerUserId !== user.id) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          reason: 'Only the accountable owner can submit evidence for this requirement'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Requirement must be in OWNED state
    if (requirement.status !== 'OWNED') {
      return new Response(
        JSON.stringify({
          error: 'Conflict',
          reason: 'Requirement must be in OWNED state to submit evidence'
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Evidence record
    const evidence = await client.entities.create('Evidence', {
      requirementId,
      submittedBy: user.id,
      evidenceType,
      note,
      fileUrl: fileUrl || null
    });

    // Update requirement status to EVIDENCE_SUBMITTED
    await client.entities.update('ReadinessRequirement', requirementId, {
      status: 'EVIDENCE_SUBMITTED'
    });

    // Create operational event
    await client.entities.create('OperationalEvent', {
      operationId,
      eventType: 'EVIDENCE_SUBMITTED',
      actorUserId: user.id,
      previousState: 'OWNED',
      newState: 'EVIDENCE_SUBMITTED',
      message: `${user.name} submitted evidence for "${requirement.label}"`
    });

    // Recalculate readiness (will move to VERIFYING)
    const recalcResponse = await fetch(new URL('../functions/recalculateReadiness', import.meta.url).href, {
      method: 'POST',
      body: JSON.stringify({ operationId }),
      headers: { 'Content-Type': 'application/json' }
    });

    const recalcResult = await recalcResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        evidence,
        stateRecalculation: recalcResult
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('submitEvidence error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
