// CORBEL: recommendAction() - Agent can recommend actions but cannot execute them
// The system enforces authorization - agent cannot release if there are unowned requirements
// This creates an AgentRecommendation record showing what was proposed and what was blocked

import { createClientFromRequest } from 'base44/sdk';

export async function recommendAction(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId, recommendationType, reasoning } = body;

    if (!operationId || !recommendationType || !reasoning) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'operationId, recommendationType, reasoning required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['RELEASE', 'HOLD', 'ESCALATE'].includes(recommendationType)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'recommendationType must be RELEASE, HOLD, or ESCALATE' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify operation exists
    const operation = await client.entities.read('Operation', operationId);

    // CRITICAL SECURITY: Check if recommendation is authorized
    let blocked = false;
    let blockReason = '';

    if (recommendationType === 'RELEASE') {
      // Can only release if operation is READY
      if (operation.currentState !== 'READY') {
        blocked = true;
        blockReason = `RELEASE DENIED — Operation is in ${operation.currentState}, not READY`;
      } else {
        // Even if READY, check for any unowned requirements
        const requirements = await client.entities.filter('ReadinessRequirement', {
          operationId,
          criticality: 'CRITICAL'
        });

        const unownedReqs = requirements.filter((r: any) => r.status === 'UNOWNED');
        if (unownedReqs.length > 0) {
          blocked = true;
          blockReason = `RELEASE DENIED — ${unownedReqs.length} critical requirement(s) have no accountable owner`;
        }

        const unverifiedReqs = requirements.filter((r: any) => r.status !== 'VERIFIED' && r.status !== 'SATISFIED');
        if (unverifiedReqs.length > 0) {
          blocked = true;
          blockReason = `RELEASE DENIED — ${unverifiedReqs.length} critical requirement(s) awaiting verification`;
        }
      }
    }

    // Create AgentRecommendation record
    const recommendation = await client.entities.create('AgentRecommendation', {
      operationId,
      recommendationType,
      reasoning,
      blocked,
      blockReason: blockReason || null
    });

    // Create operational event
    await client.entities.create('OperationalEvent', {
      operationId,
      eventType: 'AGENT_RECOMMENDATION',
      actorUserId: 'agent-coordinator',
      message: blocked
        ? `Agent recommended ${recommendationType} but was denied: ${blockReason}`
        : `Agent recommended ${recommendationType}: ${reasoning}`
    });

    return new Response(
      JSON.stringify({
        success: true,
        recommendation,
        decision: blocked ? 'DENIED' : 'ALLOWED',
        reason: blockReason || 'Agent recommendation accepted'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('recommendAction error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
