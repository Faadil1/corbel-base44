// CORBEL Entity Type Definitions for Base44

export type UserRole = 'OPERATIONS_LEAD' | 'ACCOUNTABLE_OWNER' | 'INDEPENDENT_VERIFIER' | 'COORDINATION_AGENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type OperationState = 'READY' | 'HOLD_UNOWNED' | 'HOLD_OWNED' | 'VERIFYING';

export interface Operation {
  id: string;
  name: string;
  location: string;
  currentState: OperationState;
  createdAt: Date;
  updatedAt: Date;
}

export type RequirementStatus = 'SATISFIED' | 'UNOWNED' | 'OWNED' | 'EVIDENCE_SUBMITTED' | 'VERIFIED' | 'REJECTED';
export type Criticality = 'CRITICAL' | 'STANDARD';

export interface ReadinessRequirement {
  id: string;
  operationId: string;
  label: string;
  category: string;
  criticality: Criticality;
  status: RequirementStatus;
  ownerUserId: string | null;
  evidenceRequired: boolean;
  verificationRequired: boolean;
  createdAt: Date;
}

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Hazard {
  id: string;
  operationId: string;
  requirementId: string;
  reportedBy: string;
  title: string;
  description: string;
  severity: Severity;
  photoUrl?: string;
  createdAt: Date;
}

export interface OwnershipAcceptance {
  id: string;
  requirementId: string;
  acceptedBy: string;
  acceptedAt: Date;
  status: 'ACTIVE' | 'SUPERSEDED';
}

export type EvidenceType = 'PHOTO' | 'DOCUMENT' | 'REPORT' | 'NOTE';

export interface Evidence {
  id: string;
  requirementId: string;
  submittedBy: string;
  evidenceType: EvidenceType;
  fileUrl?: string;
  note: string;
  submittedAt: Date;
}

export interface Verification {
  id: string;
  requirementId: string;
  verifierUserId: string;
  decision: 'APPROVED' | 'REJECTED';
  note: string;
  verifiedAt: Date;
}

export interface OperationalEvent {
  id: string;
  operationId: string;
  eventType: string;
  actorUserId: string;
  previousState?: string;
  newState?: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ReleaseReceipt {
  id: string;
  operationId: string;
  releaseStatus: 'RELEASED';
  eventChain: string[];
  receiptHash: string;
  generatedAt: Date;
}

export interface AgentRecommendation {
  id: string;
  operationId: string;
  recommendationType: 'RELEASE' | 'HOLD' | 'ESCALATE';
  reasoning: string;
  blocked: boolean;
  blockReason?: string;
  createdAt: Date;
}
