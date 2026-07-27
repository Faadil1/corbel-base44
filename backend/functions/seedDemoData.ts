// CORBEL: seedDemoData() & devReset() - Initialize and reset demo environment
// This is a development-only endpoint for testing and demos

import { createClientFromRequest } from 'base44/sdk';

const DEMO_USERS = [
  {
    id: 'user-alex',
    email: 'alex@corbel.local',
    name: 'Alex Morgan',
    role: 'OPERATIONS_LEAD'
  },
  {
    id: 'user-maya',
    email: 'maya@corbel.local',
    name: 'Maya Chen',
    role: 'ACCOUNTABLE_OWNER'
  },
  {
    id: 'user-jordan',
    email: 'jordan@corbel.local',
    name: 'Jordan Lee',
    role: 'INDEPENDENT_VERIFIER'
  },
  {
    id: 'agent-coordinator',
    email: 'agent@corbel.local',
    name: 'Coordinator Agent',
    role: 'COORDINATION_AGENT'
  }
];

const DEMO_OPERATION = {
  id: 'op-floor12-bayc',
  name: 'FLOOR 12 — BAY C',
  location: 'Construction Site East, Level 12, Bay C'
};

const DEMO_REQUIREMENTS = [
  {
    id: 'req-crew',
    label: 'Crew assigned',
    category: 'staffing',
    criticality: 'CRITICAL',
    status: 'SATISFIED'
  },
  {
    id: 'req-equipment',
    label: 'Equipment inspection',
    category: 'safety',
    criticality: 'CRITICAL',
    status: 'SATISFIED'
  },
  {
    id: 'req-fallprotection',
    label: 'Fall protection anchor',
    category: 'safety',
    criticality: 'CRITICAL',
    status: 'SATISFIED'
  },
  {
    id: 'req-supervisor',
    label: 'Supervisor present',
    category: 'oversight',
    criticality: 'CRITICAL',
    status: 'SATISFIED'
  }
];

export async function seedDemoData(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);

    // Create users
    for (const user of DEMO_USERS) {
      try {
        await client.entities.create('User', user);
      } catch (e) {
        // User may already exist
        console.log(`User ${user.id} already exists or error creating`);
      }
    }

    // Create operation
    try {
      await client.entities.create('Operation', {
        ...DEMO_OPERATION,
        currentState: 'READY'
      });
    } catch (e) {
      console.log(`Operation ${DEMO_OPERATION.id} already exists or error creating`);
    }

    // Create requirements
    for (const req of DEMO_REQUIREMENTS) {
      try {
        await client.entities.create('ReadinessRequirement', {
          operationId: DEMO_OPERATION.id,
          ...req,
          evidenceRequired: req.criticality === 'CRITICAL',
          verificationRequired: req.criticality === 'CRITICAL'
        });
      } catch (e) {
        console.log(`Requirement ${req.id} already exists or error creating`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Demo data seeded successfully',
        users: DEMO_USERS.length,
        operation: DEMO_OPERATION,
        requirements: DEMO_REQUIREMENTS.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('seedDemoData error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function devReset(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);

    // Delete all entities for the demo operation (development only!)
    const operationId = DEMO_OPERATION.id;

    // Delete related records (order matters due to foreign keys)
    await deleteByFilter(client, 'ReleaseReceipt', { operationId });
    await deleteByFilter(client, 'AgentRecommendation', { operationId });
    await deleteByFilter(client, 'OperationalEvent', { operationId });
    await deleteByFilter(client, 'Verification', { requirementId: { $in: DEMO_REQUIREMENTS.map(r => r.id) } });
    await deleteByFilter(client, 'Evidence', { requirementId: { $in: DEMO_REQUIREMENTS.map(r => r.id) } });
    await deleteByFilter(client, 'OwnershipAcceptance', { requirementId: { $in: DEMO_REQUIREMENTS.map(r => r.id) } });
    await deleteByFilter(client, 'Hazard', { operationId });
    await deleteByFilter(client, 'ReadinessRequirement', { operationId });
    await deleteByFilter(client, 'Operation', { id: operationId });

    // Recreate demo state
    return seedDemoData(req);

  } catch (error) {
    console.error('devReset error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function deleteByFilter(client: any, entity: string, filter: any): Promise<void> {
  try {
    const records = await client.entities.filter(entity, filter);
    for (const record of records) {
      await client.entities.delete(entity, record.id);
    }
  } catch (e) {
    console.log(`Error deleting ${entity}:`, e);
  }
}
