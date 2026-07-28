// CORBEL: acceptOwnership() - Take ownership of an unowned requirement
// Authorization: ACCOUNTABLE_OWNER role only
// Requirement must be UNOWNED before accepting

import { createClientFromRequest } from 'npm:@base44/sdk';

// Inline helpers
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

// Placeholder for recalculateReadiness - to be invoked via SDK
async function invokeRecalculate(client: any, opId: string): Promise<any> {
  try {
    const res = await client.functions.invoke('recalculate-readiness', { operationId: opId });
    return res.data?.result || res.data;
  } catch (e) {
    console.error('recalculate error:', e);
    return { operationId: opId, stateChanged: false, reason: String(e) };
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { requirementId, operationId } = body;

    // Validate input
    if (!requirementId || !operationId) {
      return errorResponse(
        'Bad Request',
        'requirementId and operationId required',
        400
      );
    }

    // Authorization check: ACCOUNTABLE_OWNER role required
    const user = await getAuthorizedUser(client, 'ACCOUNTABLE_OWNER');
    if (isErrorResponse(user)) {
      return errorResponse(user.error, user.reason, user.status);
    }

    // Verify requirement exists and belongs to operation
    let requirement: any;
    try {
      requirement = await client.asServiceRole.entities.ReadinessRequirement.get(requirementId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'ReadinessRequirement not found', 404);
    }

    if (requirement.operationId !== operationId) {
      return errorResponse(
        'Bad Request',
        'Requirement does not belong to operation',
        400
      );
    }

    // Verify requirement is UNOWNED before accepting
    if (requirement.status !== 'UNOWNED') {
      return errorResponse(
        'Conflict',
        `Requirement must be UNOWNED to accept ownership. Current status: ${requirement.status}`,
        409
      );
    }

    // Verify operation exists
    let operation: any;
    try {
      operation = await client.asServiceRole.entities.Operation.get(operationId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'Operation not found', 404);
    }

    // Create OwnershipAcceptance record via service role
    const acceptance = await client.asServiceRole.entities.OwnershipAcceptance.create({
      requirementId,
      acceptedBy: user.id,
      status: 'ACTIVE'
    });

    // Update requirement status to OWNED with this user as owner
    await client.asServiceRole.entities.ReadinessRequirement.update(requirementId, {
      status: 'OWNED',
      ownerUserId: user.id
    });

    // Create operational event with hash chain
    await appendEvent(
      client,
      operationId,
      'OWNERSHIP_ACCEPTED',
      user.id,
      `${user.email} accepted accountability for "${requirement.label}"`,
      'UNOWNED',
      'OWNED',
      {
        requirementId,
        requirementLabel: requirement.label,
        acceptedBy: user.id
      }
    );

    // Recalculate readiness - will remain in HOLD until evidence submitted
    const recalcResult = await invokeRecalculate(client, operationId);

    return successResponse({
      success: true,
      acceptance,
      stateRecalculation: recalcResult,
      note: `${user.email} is now accountable for this requirement. Evidence must be submitted to proceed.`
    });

  } catch (error) {
    console.error('acceptOwnership error:', error);
    return errorResponse(
      'Internal Server Error',
      String(error),
      500
    );
  }
}
