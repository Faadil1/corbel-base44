import { createClientFromRequest } from 'npm:@base44/sdk';

async function getAuthorizedUser(client: any, requiredRole?: string): Promise<any> {
  try {
    const authUser = await client.auth.me();
    if (!authUser?.id) return { status: 401, error: 'UNAUTHENTICATED' };
    let user;
    try { user = await client.asServiceRole.entities.User.get(authUser.id); }
    catch (e) { return { status: 404, error: 'NOT_FOUND' }; }
    if (!user.corbel_role) return { status: 403, error: 'ROLE_FORBIDDEN' };
    if (requiredRole && user.corbel_role !== requiredRole) return { status: 403, error: 'ROLE_FORBIDDEN' };
    return { id: user.id, email: authUser.email, corbel_role: user.corbel_role };
  } catch (error) { return { status: 500, error: 'Internal Server Error' }; }
}
function isErrorResponse(obj: any): boolean { return obj?.status && obj?.error; }
function errorResponse(e: string, r: string, s: number): Response { return new Response(JSON.stringify({ error: e, reason: r }), { status: s, headers: { 'Content-Type': 'application/json' } }); }
function successResponse(d: any, s: number = 200): Response { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }

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

async function invokeRecalculate(client: any, opId: string): Promise<any> {
  try {
    const res = await client.functions.invoke('recalculate-readiness', { operationId: opId });
    return res.data?.result || res.data;
  } catch (e) {
    console.error('recalculate error:', e);
    return { operationId: opId, stateChanged: false };
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { requirementId, operationId, decision, note } = body;

    if (!requirementId || !operationId || !decision || !note) {
      return errorResponse('Bad Request', 'requirementId, operationId, decision, note required', 400);
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return errorResponse('Bad Request', 'decision must be APPROVED or REJECTED', 400);
    }

    const user = await getAuthorizedUser(client, 'INDEPENDENT_VERIFIER');
    if (isErrorResponse(user)) {
      return errorResponse(user.error, user.reason || 'Authorization failed', user.status);
    }

    let requirement: any;
    try {
      requirement = await client.asServiceRole.entities.ReadinessRequirement.get(requirementId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'ReadinessRequirement not found', 404);
    }

    if (requirement.operationId !== operationId) {
      return errorResponse('Bad Request', 'Requirement does not belong to operation', 400);
    }

    if (requirement.ownerUserId === user.id) {
      return errorResponse('Forbidden', 'Verifier cannot verify evidence for requirements they own (independence required)', 403);
    }

    if (requirement.status !== 'EVIDENCE_SUBMITTED') {
      return errorResponse('Conflict', `Requirement must be in EVIDENCE_SUBMITTED state. Current status: ${requirement.status}`, 409);
    }

    let operation: any;
    try {
      operation = await client.asServiceRole.entities.Operation.get(operationId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'Operation not found', 404);
    }

    const verification = await client.asServiceRole.entities.Verification.create({
      requirementId,
      verifierUserId: user.id,
      decision,
      note
    });

    const newStatus = decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
    await client.asServiceRole.entities.ReadinessRequirement.update(requirementId, {
      status: newStatus
    });

    const eventType = decision === 'APPROVED' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED';
    await appendEvent(
      client,
      operationId,
      eventType,
      user.id,
      `${user.email} verified evidence for "${requirement.label}" as ${decision}`,
      'EVIDENCE_SUBMITTED',
      newStatus,
      { requirementId, decision, verificationId: verification.id }
    );

    const recalcResult = await invokeRecalculate(client, operationId);

    return successResponse({
      success: true,
      verification,
      stateRecalculation: recalcResult,
      note: decision === 'APPROVED'
        ? 'Evidence approved. Operation may be released if all requirements verified.'
        : 'Evidence rejected. Requirement returned to owner for resubmission.'
    });

  } catch (error) {
    console.error('verifyEvidence error:', error);
    return errorResponse('Internal Server Error', String(error), 500);
  }
}
