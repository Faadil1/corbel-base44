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

const DEMO_ROLES = {
  'alex@corbel.local': 'OPERATIONS_LEAD',
  'maya@corbel.local': 'ACCOUNTABLE_OWNER',
  'jordan@corbel.local': 'INDEPENDENT_VERIFIER'
};

export async function handler(req: Request): Promise<Response> {
  try {
    if (isProduction()) {
      return errorResponse('Forbidden', 'Demo role assignment is disabled in production', 403);
    }

    const client = createClientFromRequest(req);
    const user = await getAuthorizedUser(client, 'OPERATIONS_LEAD');
    if (isErrorResponse(user)) {
      return errorResponse(user.error, user.reason || 'Auth failed', user.status);
    }

    const body = await req.json();
    const targetEmails = body.emails || Object.keys(DEMO_ROLES);
    const roles = body.roles || DEMO_ROLES;

    const results = { assigned: [] as any[], skipped: [] as any[], errors: [] as any[] };

    for (const email of targetEmails) {
      try {
        const role = roles[email];
        if (!role) {
          results.skipped.push({ email, reason: 'No role mapping' });
          continue;
        }

        const users = await client.asServiceRole.entities.User.filter({});
        const userRecord = users.find((u: any) => u.email === email);

        if (!userRecord) {
          results.errors.push({ email, reason: 'User not found (must be registered first)' });
          continue;
        }

        await client.asServiceRole.entities.User.update(userRecord.id, { corbel_role: role });
        results.assigned.push({ email, userId: userRecord.id, role });
        console.log(`Assigned ${role} to ${email}`);

      } catch (e) {
        results.errors.push({ email, reason: String(e) });
      }
    }

    return successResponse({
      success: results.errors.length === 0,
      message: `Role assignment: ${results.assigned.length} assigned, ${results.skipped.length} skipped, ${results.errors.length} errors`,
      results,
      notes: ['Demo users must be registered through auth system first', 'This assigns corbel_role to existing User records']
    });

  } catch (error) {
    console.error('assignDemoRoles error:', error);
    return errorResponse('Internal Server Error', String(error), 500);
  }
}
