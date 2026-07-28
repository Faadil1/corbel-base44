// CORBEL: detectHazard() - Report hazards and trigger readiness hold
// Authorization: OPERATIONS_LEAD role only
// This is typically called by the coordination agent or operations team

import { createClientFromRequest } from 'npm:@base44/sdk';

// Inline auth helper
async function getAuthorizedUser(client: any, requiredRole?: string): Promise<any> {
  try {
    const authUser = await client.auth.me();
    if (!authUser?.id) return { status: 401, error: 'UNAUTHENTICATED', reason: 'No authenticated user' };
    let user;
    try {
      user = await client.asServiceRole.entities.User.get(authUser.id);
    } catch (e) {
      return { status: 404, error: 'NOT_FOUND', reason: 'User record not found' };
    }
    if (!user.corbel_role) return { status: 403, error: 'ROLE_FORBIDDEN', reason: 'No corbel_role assigned' };
    if (requiredRole && user.corbel_role !== requiredRole) {
      return { status: 403, error: 'ROLE_FORBIDDEN', reason: `Requires ${requiredRole}, has ${user.corbel_role}` };
    }
    return { id: user.id, email: authUser.email, corbel_role: user.corbel_role };
  } catch (error) {
    return { status: 500, error: 'Internal Server Error', reason: String(error) };
  }
}

function isErrorResponse(obj: any): boolean {
  return obj && obj.status && obj.error;
}

function errorResponse(error: string, reason: string, status: number): Response {
  return new Response(JSON.stringify({ error, reason }), { status, headers: { 'Content-Type': 'application/json' } });
}

function successResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// Inline event helper
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
  const chainData = previousHash ? previousHash + JSON.stringify(canonical) : JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(chainData));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function appendEvent(client: any, operationId: string, eventType: string, actorUserId: string,
  message: string, previousState?: string, newState?: string, metadata?: Record<string, any>): Promise<any | null> {
  try {
    const lastEvents = await client.asServiceRole.entities.OperationalEvent.filter({ operationId }, '-createdAt', 1);
    const previousEventHash = lastEvents.length > 0 ? lastEvents[0].eventHash : null;
    const now = new Date().toISOString();
    const payload = { operationId, eventType, actorUserId, previousState, newState, message, metadata: metadata || {}, createdAt: now };
    const eventHash = await computeEventHash(previousEventHash, payload);
    return await client.asServiceRole.entities.OperationalEvent.create({
      operationId, eventType, actorUserId, previousState, newState, message, metadata,
      previousEventHash, eventHash, createdAt: now
    });
  } catch (error) {
    console.error('Error appending event:', error);
    return null;
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId, requirementId, title, description, severity, photoUrl } = body;

    // Validate required input
    if (!operationId || !requirementId || !title || !severity) {
      return errorResponse(
        'Bad Request',
        'operationId, requirementId, title, severity required',
        400
      );
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(severity)) {
      return errorResponse(
        'Bad Request',
        'severity must be LOW, MEDIUM, or HIGH',
        400
      );
    }

    // Authorization check: OPERATIONS_LEAD role required
    const user = await getAuthorizedUser(client, 'OPERATIONS_LEAD');
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

    // Verify operation exists
    let operation: any;
    try {
      operation = await client.asServiceRole.entities.Operation.get(operationId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'Operation not found', 404);
    }

    // Create Hazard record via service role
    const hazard = await client.asServiceRole.entities.HazardReport.create({
      operationId,
      requirementId,
      reportedBy: user.id, // Authenticated user, not from request body
      title,
      description: description || '',
      severity,
      photoUrl: photoUrl || null
    });

    // Mark requirement as UNOWNED (loss of owner or reassignment needed)
    await client.asServiceRole.entities.ReadinessRequirement.update(requirementId, {
      status: 'UNOWNED',
      ownerUserId: null
    });

    // Create operational event with hash chain
    const previousRequirementStatus = requirement.status;
    await appendEvent(
      client,
      operationId,
      'HAZARD_DETECTED',
      user.id,
      `Hazard detected on "${requirement.label}": ${title} (severity: ${severity})`,
      previousRequirementStatus,
      'UNOWNED',
      {
        hazardId: hazard.id,
        requirementLabel: requirement.label,
        severity,
        reportedBy: user.id
      }
    );

    // Recalculate readiness - this will move operation to HOLD if needed
    let recalcResult;
    try {
      const res = await client.functions.invoke('recalculate-readiness', { operationId });
      recalcResult = res.data?.result || res.data;
    } catch (e) {
      console.error('recalculate error:', e);
      recalcResult = { operationId, stateChanged: false };
    }

    return successResponse({
      success: true,
      hazard,
      stateRecalculation: recalcResult,
      note: 'Hazard detected. Requirement marked as UNOWNED. A human must accept ownership to proceed.'
    });

  } catch (error) {
    console.error('detectHazard error:', error);
    return errorResponse(
      'Internal Server Error',
      String(error),
      500
    );
  }
}
