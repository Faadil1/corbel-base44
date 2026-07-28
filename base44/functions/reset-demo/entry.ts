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

function isProduction(): boolean {
  const env = Deno.env.get('ENVIRONMENT') || Deno.env.get('NODE_ENV') || '';
  return env.toLowerCase() === 'production' || env.toLowerCase() === 'prod';
}

const DEMO_OP_ID = 'op-floor12-bayc';
const DEMO_REQ_IDS = ['req-crew', 'req-equipment', 'req-fallprotection', 'req-supervisor'];

export async function handler(req: Request): Promise<Response> {
  try {
    if (isProduction()) {
      return errorResponse('Forbidden', 'Demo reset is disabled in production', 403);
    }

    const client = createClientFromRequest(req);
    const user = await getAuthorizedUser(client, 'OPERATIONS_LEAD');
    if (isErrorResponse(user)) {
      return errorResponse(user.error, user.reason || 'Auth failed', user.status);
    }

    console.log(`${user.email} initiated demo reset`);

    // Delete in reverse dependency order
    const delete_entities = [
      ['ReleaseReceipt', { operationId: DEMO_OP_ID }],
      ['AgentRecommendation', { operationId: DEMO_OP_ID }],
      ['OperationalEvent', { operationId: DEMO_OP_ID }],
      ['HazardReport', { operationId: DEMO_OP_ID }],
      ['ReadinessRequirement', { operationId: DEMO_OP_ID }],
      ['Operation', { id: DEMO_OP_ID }]
    ];

    for (const [entity, filter] of delete_entities) {
      try {
        const records = await client.asServiceRole.entities[entity].filter(filter);
        for (const rec of records) {
          await client.asServiceRole.entities[entity].delete(rec.id);
        }
        console.log(`Deleted ${records.length} ${entity} records`);
      } catch (e) {
        console.log(`No ${entity} to delete`);
      }
    }

    // Handle Verification, Evidence, OwnershipAcceptance (cross-requirement)
    try {
      const v = await client.asServiceRole.entities.Verification.filter({});
      const dv = v.filter((x: any) => DEMO_REQ_IDS.includes(x.requirementId));
      for (const x of dv) await client.asServiceRole.entities.Verification.delete(x.id);
      console.log(`Deleted ${dv.length} verifications`);
    } catch (e) { console.log('No verifications'); }

    try {
      const e = await client.asServiceRole.entities.Evidence.filter({});
      const de = e.filter((x: any) => DEMO_REQ_IDS.includes(x.requirementId));
      for (const x of de) await client.asServiceRole.entities.Evidence.delete(x.id);
      console.log(`Deleted ${de.length} evidence`);
    } catch (e) { console.log('No evidence'); }

    try {
      const a = await client.asServiceRole.entities.OwnershipAcceptance.filter({});
      const da = a.filter((x: any) => DEMO_REQ_IDS.includes(x.requirementId));
      for (const x of da) await client.asServiceRole.entities.OwnershipAcceptance.delete(x.id);
      console.log(`Deleted ${da.length} acceptances`);
    } catch (e) { console.log('No acceptances'); }

    // Reseed
    const DEMO_OP = {
      id: 'op-floor12-bayc',
      name: 'FLOOR 12 — BAY C',
      location: 'Construction Site East, Level 12, Bay C'
    };

    const DEMO_REQS = [
      { id: 'req-crew', label: 'Crew assigned', category: 'staffing', criticality: 'CRITICAL' },
      { id: 'req-equipment', label: 'Equipment inspection', category: 'safety', criticality: 'CRITICAL' },
      { id: 'req-fallprotection', label: 'Fall protection anchor', category: 'safety', criticality: 'CRITICAL' },
      { id: 'req-supervisor', label: 'Supervisor present', category: 'oversight', criticality: 'CRITICAL' }
    ];

    await client.asServiceRole.entities.Operation.create({
      ...DEMO_OP,
      currentState: 'READY'
    });

    for (const req of DEMO_REQS) {
      await client.asServiceRole.entities.ReadinessRequirement.create({
        id: req.id,
        operationId: DEMO_OP.id,
        label: req.label,
        category: req.category,
        criticality: req.criticality,
        status: 'SATISFIED',
        evidenceRequired: true,
        verificationRequired: true,
        ownerUserId: null
      });
    }

    return successResponse({
      success: true,
      message: 'Demo environment reset successfully',
      recreatedRecords: { operation: 1, requirements: DEMO_REQS.length },
      readyForTesting: true
    });

  } catch (error) {
    console.error('resetDemoData error:', error);
    return errorResponse('Internal Server Error', String(error), 500);
  }
}
