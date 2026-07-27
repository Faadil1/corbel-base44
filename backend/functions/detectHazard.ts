// CORBEL: detectHazard() - Agent can detect hazards but cannot accept ownership or release
// This creates a Hazard record and marks a requirement as UNOWNED
// It does NOT directly change operation state - recalculateReadiness() does that

import { createClientFromRequest } from 'base44/sdk';

export async function detectHazard(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId, requirementId, title, description, severity } = body;

    if (!operationId || !requirementId || !title || !severity) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'operationId, requirementId, title, severity required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(severity)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'severity must be LOW, MEDIUM, or HIGH' }),
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

    // Create Hazard record
    const hazard = await client.entities.create('Hazard', {
      operationId,
      requirementId,
      reportedBy: 'agent-coordinator', // Agent is the reporter
      title,
      description: description || '',
      severity
    });

    // Mark requirement as UNOWNED (loss of existing owner or no owner assigned)
    await client.entities.update('ReadinessRequirement', requirementId, {
      status: 'UNOWNED',
      ownerUserId: null
    });

    // Create operational event
    await client.entities.create('OperationalEvent', {
      operationId,
      eventType: 'HAZARD_DETECTED',
      actorUserId: 'agent-coordinator',
      previousState: requirement.status,
      newState: 'UNOWNED',
      message: `Agent detected hazard: ${title} (severity: ${severity})`,
      metadata: {
        hazardId: hazard.id,
        requirementLabel: requirement.label
      }
    });

    // Recalculate readiness - this will move operation to HOLD_UNOWNED
    const recalcResponse = await fetch(new URL('../functions/recalculateReadiness', import.meta.url).href, {
      method: 'POST',
      body: JSON.stringify({ operationId }),
      headers: { 'Content-Type': 'application/json' }
    });

    const recalcResult = await recalcResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        hazard,
        stateRecalculation: recalcResult,
        note: 'Hazard detected. Operation now in HOLD state. A human must accept ownership to proceed.'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('detectHazard error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
