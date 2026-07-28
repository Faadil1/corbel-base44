import { createClientFromRequest } from 'npm:@base44/sdk';

function errorResponse(e: string, r: string, s: number): Response {
  return new Response(JSON.stringify({ error: e, reason: r }), { status: s, headers: { 'Content-Type': 'application/json' } });
}

function successResponse(d: any, s: number = 200): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
}

async function computeEventHash(ph: string | null, p: any): Promise<string> {
  const c = { operationId: p.operationId, eventType: p.eventType, actorUserId: p.actorUserId, previousState: p.previousState || '', newState: p.newState || '', message: p.message, metadata: p.metadata || {}, createdAt: p.createdAt };
  const cd = ph ? ph + JSON.stringify(c) : JSON.stringify(c);
  const e = new TextEncoder();
  const h = await crypto.subtle.digest('SHA-256', e.encode(cd));
  const ha = Array.from(new Uint8Array(h));
  return ha.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function appendEvent(client: any, opId: string, et: string, au: string, msg: string, ps?: string, ns?: string, md?: any): Promise<any> {
  try {
    const le = await client.asServiceRole.entities.OperationalEvent.filter({ operationId: opId }, '-createdAt', 1);
    const ph = le.length > 0 ? le[0].eventHash : null;
    const now = new Date().toISOString();
    const p = { operationId: opId, eventType: et, actorUserId: au, previousState: ps, newState: ns, message: msg, metadata: md || {}, createdAt: now };
    const eh = await computeEventHash(ph, p);
    return await client.asServiceRole.entities.OperationalEvent.create({ operationId: opId, eventType: et, actorUserId: au, previousState: ps, newState: ns, message: msg, metadata: md, previousEventHash: ph, eventHash: eh, createdAt: now });
  } catch (e) { console.error('appendEvent error:', e); return null; }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId, recommendationType, reasoning } = body;

    if (!operationId || !recommendationType || !reasoning) {
      return errorResponse('Bad Request', 'operationId, recommendationType, reasoning required', 400);
    }

    if (!['RELEASE', 'HOLD', 'ESCALATE'].includes(recommendationType)) {
      return errorResponse('Bad Request', 'recommendationType must be RELEASE, HOLD, or ESCALATE', 400);
    }

    let operation: any;
    try {
      operation = await client.asServiceRole.entities.Operation.get(operationId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'Operation not found', 404);
    }

    let blocked = false;
    let blockReason = '';

    if (recommendationType === 'RELEASE') {
      if (operation.currentState !== 'RELEASED') {
        blocked = true;
        blockReason = `Operation is in ${operation.currentState}, not RELEASED`;
      } else {
        const requirements = await client.asServiceRole.entities.ReadinessRequirement.filter({
          operationId,
          criticality: 'CRITICAL'
        });

        const unownedReqs = requirements.filter((r: any) => r.status === 'UNOWNED');
        if (unownedReqs.length > 0) {
          blocked = true;
          blockReason = `${unownedReqs.length} critical requirement(s) have no accountable owner`;
        }

        const unverifiedReqs = requirements.filter((r: any) => r.status !== 'VERIFIED' && r.status !== 'SATISFIED');
        if (unverifiedReqs.length > 0) {
          blocked = true;
          blockReason = `${unverifiedReqs.length} critical requirement(s) not yet verified`;
        }
      }
    }

    const recommendation = await client.asServiceRole.entities.AgentRecommendation.create({
      operationId,
      recommendationType,
      reasoning,
      blocked,
      blockReason: blockReason || null
    });

    await appendEvent(
      client,
      operationId,
      'AGENT_RECOMMENDATION',
      'agent-coordinator',
      blocked ? `Agent recommended ${recommendationType} but was blocked: ${blockReason}` : `Agent recommended ${recommendationType}: ${reasoning}`,
      undefined,
      undefined,
      { recommendationType, blocked, reasoning }
    );

    return successResponse({
      success: true,
      recommendation,
      decision: blocked ? 'DENIED' : 'ALLOWED',
      reason: blockReason || 'Agent recommendation can proceed'
    });

  } catch (error) {
    console.error('recommendAction error:', error);
    return errorResponse('Internal Server Error', String(error), 500);
  }
}
