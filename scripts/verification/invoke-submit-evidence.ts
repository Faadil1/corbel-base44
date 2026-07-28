const operationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";

const request = {
  operationId,
  requirementId,
  evidenceType: "NOTE",
  note:
    "Fall protection anchor was reconnected, mechanically secured, and visually inspected by the accountable owner."
};

const authUser = await base44.auth.me();

const corbelUser =
  await base44.entities.User.get(authUser.id);

const beforeOperation =
  await base44.entities.Operation.get(operationId);

const beforeRequirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const beforeEvidence =
  await base44.entities.Evidence.filter({
    requirementId
  });

const beforeEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "EVIDENCE_SUBMITTED"
  });

let invocationResult;

try {
  const response = await base44.functions.invoke(
    "submit-evidence",
    request
  );

  invocationResult = {
    succeeded: true,
    data: response.data
  };
} catch (error) {
  invocationResult = {
    succeeded: false,
    name: error?.name ?? null,
    message:
      error?.message ??
      String(error),
    status:
      error?.status ??
      error?.response?.status ??
      null,
    code:
      error?.data?.code ??
      error?.response?.data?.code ??
      null,
    responseData:
      error?.data ??
      error?.response?.data ??
      null
  };
}

const result =
  invocationResult?.data?.result ??
  null;

const afterOperation =
  await base44.entities.Operation.get(operationId);

const afterRequirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const afterEvidence =
  await base44.entities.Evidence.filter({
    requirementId
  });

const afterEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "EVIDENCE_SUBMITTED"
  });

const createdEvidence =
  result?.evidenceId
    ? await base44.entities.Evidence.get(
        result.evidenceId
      )
    : null;

const createdEvent =
  result?.operationalEventId
    ? await base44.entities.OperationalEvent.get(
        result.operationalEventId
      )
    : null;

console.log(JSON.stringify({
  test:
    "E-023 - Accountable owner submits evidence and operation enters VERIFYING",
  authenticatedUser: {
    id: authUser.id,
    email: authUser.email ?? null,
    corbelRole:
      corbelUser.corbel_role ?? null
  },
  request,
  before: {
    operationState:
      beforeOperation.currentState,
    requirementStatus:
      beforeRequirement.status,
    ownerUserId:
      beforeRequirement.ownerUserId ?? null,
    evidenceCount:
      beforeEvidence.length,
    evidenceEventCount:
      beforeEvents.length
  },
  invocationResult,
  after: {
    operationState:
      afterOperation.currentState,
    requirementStatus:
      afterRequirement.status,
    ownerUserId:
      afterRequirement.ownerUserId ?? null,
    evidenceCount:
      afterEvidence.length,
    evidenceEventCount:
      afterEvents.length
  },
  createdEvidence: createdEvidence
    ? {
        id: createdEvidence.id,
        requirementId:
          createdEvidence.requirementId,
        submittedBy:
          createdEvidence.submittedBy,
        evidenceType:
          createdEvidence.evidenceType,
        note:
          createdEvidence.note,
        fileUrl:
          createdEvidence.fileUrl ?? null,
        submittedAt:
          createdEvidence.submittedAt
      }
    : null,
  createdEvent: createdEvent
    ? {
        id: createdEvent.id,
        eventType:
          createdEvent.eventType,
        actorUserId:
          createdEvent.actorUserId,
        previousState:
          createdEvent.previousState,
        newState:
          createdEvent.newState,
        metadata:
          createdEvent.metadata,
        createdAt:
          createdEvent.createdAt
      }
    : null
}, null, 2));
