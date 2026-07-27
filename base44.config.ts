import { defineConfig } from 'base44/config';

export default defineConfig({
  projectId: process.env.BASE44_PROJECT_ID || 'corbel-dev',
  apiKey: process.env.BASE44_API_KEY || '',

  entities: {
    User: {
      fields: {
        id: { type: 'string', pk: true },
        email: { type: 'string', required: true, unique: true },
        name: { type: 'string', required: true },
        role: {
          type: 'enum',
          values: ['OPERATIONS_LEAD', 'ACCOUNTABLE_OWNER', 'INDEPENDENT_VERIFIER', 'COORDINATION_AGENT'],
          required: true
        },
      },
    },

    Operation: {
      fields: {
        id: { type: 'string', pk: true },
        name: { type: 'string', required: true },
        location: { type: 'string', required: true },
        currentState: {
          type: 'enum',
          values: ['READY', 'HOLD_UNOWNED', 'HOLD_OWNED', 'VERIFYING'],
          required: true,
          default: 'READY'
        },
        createdAt: { type: 'timestamp', required: true, autoCreate: true },
        updatedAt: { type: 'timestamp', required: true, autoUpdate: true },
      },
    },

    ReadinessRequirement: {
      fields: {
        id: { type: 'string', pk: true },
        operationId: { type: 'string', fk: 'Operation', required: true },
        label: { type: 'string', required: true },
        category: { type: 'string', required: true },
        criticality: { type: 'enum', values: ['CRITICAL', 'STANDARD'], required: true },
        status: {
          type: 'enum',
          values: ['SATISFIED', 'UNOWNED', 'OWNED', 'EVIDENCE_SUBMITTED', 'VERIFIED', 'REJECTED'],
          required: true,
          default: 'SATISFIED'
        },
        ownerUserId: { type: 'string', fk: 'User', nullable: true },
        evidenceRequired: { type: 'boolean', default: true },
        verificationRequired: { type: 'boolean', default: true },
        createdAt: { type: 'timestamp', autoCreate: true },
      },
    },

    Hazard: {
      fields: {
        id: { type: 'string', pk: true },
        operationId: { type: 'string', fk: 'Operation', required: true },
        requirementId: { type: 'string', fk: 'ReadinessRequirement', required: true },
        reportedBy: { type: 'string', fk: 'User', required: true },
        title: { type: 'string', required: true },
        description: { type: 'string' },
        severity: { type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH'], required: true },
        photoUrl: { type: 'string', nullable: true },
        createdAt: { type: 'timestamp', autoCreate: true },
      },
    },

    OwnershipAcceptance: {
      fields: {
        id: { type: 'string', pk: true },
        requirementId: { type: 'string', fk: 'ReadinessRequirement', required: true },
        acceptedBy: { type: 'string', fk: 'User', required: true },
        acceptedAt: { type: 'timestamp', autoCreate: true },
        status: { type: 'enum', values: ['ACTIVE', 'SUPERSEDED'], default: 'ACTIVE' },
      },
    },

    Evidence: {
      fields: {
        id: { type: 'string', pk: true },
        requirementId: { type: 'string', fk: 'ReadinessRequirement', required: true },
        submittedBy: { type: 'string', fk: 'User', required: true },
        evidenceType: { type: 'enum', values: ['PHOTO', 'DOCUMENT', 'REPORT', 'NOTE'], required: true },
        fileUrl: { type: 'string', nullable: true },
        note: { type: 'string' },
        submittedAt: { type: 'timestamp', autoCreate: true },
      },
    },

    Verification: {
      fields: {
        id: { type: 'string', pk: true },
        requirementId: { type: 'string', fk: 'ReadinessRequirement', required: true },
        verifierUserId: { type: 'string', fk: 'User', required: true },
        decision: { type: 'enum', values: ['APPROVED', 'REJECTED'], required: true },
        note: { type: 'string' },
        verifiedAt: { type: 'timestamp', autoCreate: true },
      },
    },

    OperationalEvent: {
      fields: {
        id: { type: 'string', pk: true },
        operationId: { type: 'string', fk: 'Operation', required: true },
        eventType: { type: 'string', required: true },
        actorUserId: { type: 'string', fk: 'User', required: true },
        previousState: { type: 'string' },
        newState: { type: 'string' },
        message: { type: 'string' },
        metadata: { type: 'json', nullable: true },
        createdAt: { type: 'timestamp', autoCreate: true },
      },
    },

    ReleaseReceipt: {
      fields: {
        id: { type: 'string', pk: true },
        operationId: { type: 'string', fk: 'Operation', required: true },
        releaseStatus: { type: 'enum', values: ['RELEASED'], required: true },
        eventChain: { type: 'json', required: true },
        receiptHash: { type: 'string', required: true },
        generatedAt: { type: 'timestamp', autoCreate: true },
      },
    },

    AgentRecommendation: {
      fields: {
        id: { type: 'string', pk: true },
        operationId: { type: 'string', fk: 'Operation', required: true },
        recommendationType: { type: 'enum', values: ['RELEASE', 'HOLD', 'ESCALATE'], required: true },
        reasoning: { type: 'string' },
        blocked: { type: 'boolean', default: false },
        blockReason: { type: 'string', nullable: true },
        createdAt: { type: 'timestamp', autoCreate: true },
      },
    },
  },

  agents: {
    coordinator: {
      name: 'coordinator',
      description: 'Detects hazards and recommends operations without authority to execute',
      instructions: 'You are a coordination agent. You can detect missing owners and recommend actions, but you cannot accept ownership, verify evidence, or release operations. Only suggest actions for human review.',
      model: 'claude-3-5-sonnet-20241022',
      tools: [
        { type: 'function', name: 'detectHazard' },
        { type: 'function', name: 'recommendAction' },
      ],
    },
  },
});
