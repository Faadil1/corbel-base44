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

const DEMO_OPERATION = {
  id: 'op-floor12-bayc',
  name: 'FLOOR 12 — BAY C',
  location: 'Construction Site East, Level 12, Bay C'
};

const DEMO_REQUIREMENTS = [
  { id: 'req-crew', label: 'Crew assigned', category: 'staffing', criticality: 'CRITICAL', status: 'SATISFIED' },
  { id: 'req-equipment', label: 'Equipment inspection', category: 'safety', criticality: 'CRITICAL', status: 'SATISFIED' },
  { id: 'req-fallprotection', label: 'Fall protection anchor', category: 'safety', criticality: 'CRITICAL', status: 'SATISFIED' },
  { id: 'req-supervisor', label: 'Supervisor present', category: 'oversight', criticality: 'CRITICAL', status: 'SATISFIED' }
];

export async function handler(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const user = await getAuthorizedUser(client, 'OPERATIONS_LEAD');
    if (isErrorResponse(user)) {
      return errorResponse(user.error, user.reason || 'Auth failed', user.status);
    }

    let operation: any;
    try {
      operation = await client.asServiceRole.entities.Operation.get(DEMO_OPERATION.id);
      console.log('Demo operation already exists');
    } catch (e) {
      operation = await client.asServiceRole.entities.Operation.create({
        ...DEMO_OPERATION,
        currentState: 'READY'
      });
      console.log(`Created demo operation: ${operation.id}`);
    }

    let createdCount = 0;
    for (const req of DEMO_REQUIREMENTS) {
      try {
        await client.asServiceRole.entities.ReadinessRequirement.get(req.id);
        console.log(`Requirement ${req.id} already exists`);
      } catch (e) {
        await client.asServiceRole.entities.ReadinessRequirement.create({
          id: req.id,
          operationId: DEMO_OPERATION.id,
          label: req.label,
          category: req.category,
          criticality: req.criticality,
          status: req.status,
          evidenceRequired: true,
          verificationRequired: true,
          ownerUserId: null
        });
        createdCount++;
        console.log(`Created requirement: ${req.id}`);
      }
    }

    return successResponse({
      success: true,
      message: 'Demo data seeded successfully',
      operation: {
        id: DEMO_OPERATION.id,
        name: DEMO_OPERATION.name,
        location: DEMO_OPERATION.location,
        currentState: 'READY'
      },
      requirementsCreated: createdCount,
      totalRequirements: DEMO_REQUIREMENTS.length,
      notes: [
        'Demo operation FLOOR 12 — BAY C is ready',
        'All 4 critical requirements start in SATISFIED state',
        'Demo users must be registered through auth system separately',
        'Run assign-demo-roles to assign corbel_role to demo users'
      ]
    });

  } catch (error) {
    console.error('setupDemoData error:', error);
    return errorResponse('Internal Server Error', String(error), 500);
  }
}
