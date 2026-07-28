// CORBEL: Shared authorization helper
// Verifies authenticated user and authorizes by corbel_role
// Never trusts role, userId, email from request body

export interface AuthorizedUser {
  id: string;
  email: string;
  corbel_role: 'OPERATIONS_LEAD' | 'ACCOUNTABLE_OWNER' | 'INDEPENDENT_VERIFIER';
}

export interface ErrorResponse {
  error: string;
  reason: string;
  status: number;
}

export async function getAuthorizedUser(
  client: any,
  requiredRole?: 'OPERATIONS_LEAD' | 'ACCOUNTABLE_OWNER' | 'INDEPENDENT_VERIFIER'
): Promise<AuthorizedUser | ErrorResponse> {
  try {
    // Get authenticated user from auth context (trusted)
    const authUser = await client.auth.me();

    if (!authUser || !authUser.id) {
      return {
        error: 'UNAUTHENTICATED',
        reason: 'No authenticated user in request context',
        status: 401
      };
    }

    // Load authoritative User record from remote (never trust request body)
    let user: any;
    try {
      user = await client.asServiceRole.entities.User.get(authUser.id);
    } catch (e) {
      // User record not found in corbel
      return {
        error: 'NOT_FOUND',
        reason: 'User record not found in system',
        status: 404
      };
    }

    if (!user.corbel_role) {
      return {
        error: 'ROLE_FORBIDDEN',
        reason: 'User has no assigned corbel_role',
        status: 403
      };
    }

    // Validate corbel_role is one of the approved values
    const validRoles = ['OPERATIONS_LEAD', 'ACCOUNTABLE_OWNER', 'INDEPENDENT_VERIFIER'];
    if (!validRoles.includes(user.corbel_role)) {
      return {
        error: 'ROLE_FORBIDDEN',
        reason: `Invalid corbel_role: ${user.corbel_role}`,
        status: 403
      };
    }

    // Check specific role requirement if provided
    if (requiredRole && user.corbel_role !== requiredRole) {
      return {
        error: 'ROLE_FORBIDDEN',
        reason: `This operation requires ${requiredRole} role, user has ${user.corbel_role}`,
        status: 403
      };
    }

    return {
      id: user.id,
      email: authUser.email || user.email,
      corbel_role: user.corbel_role
    };
  } catch (error) {
    console.error('Auth helper error:', error);
    return {
      error: 'Internal Server Error',
      reason: String(error),
      status: 500
    };
  }
}

export function isErrorResponse(obj: any): obj is ErrorResponse {
  return obj && obj.status && obj.error;
}

export function errorResponse(error: string, reason: string, status: number): Response {
  return new Response(
    JSON.stringify({ error, reason }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

export function successResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
