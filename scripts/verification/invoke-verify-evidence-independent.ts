const operationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";
const evidenceId = "6a6867aac519c2014ff43088";
const ownerUserId = "6a67a87fb27a05cbd4672d8e";

const authUser = await base44.auth.me();
const corbelUser =
  await base44.entities.User.get(authUser.id);

const evidence =
  await base44.entities.Evidence.get(evidenceId);

const beforeOperation =
  await base44.entities.Operation.get(operationId);

const beforeRequirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const beforeVerifications =
  await base44.entities.Verification.filter({
    requirementId
  });

const beforeEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "VERIFICATION_APPROVED"
  });

const preconditions = {
  verifierRoleCorrect:
    corbelUser.corbel_role ===
    "INDEPENDENT_VERIFIER",

  distinctFromOwner:
    authUser.id !== ownerUserId,

  distinctFromRequirementOwner:
    authUser.id !==
    beforeRequirement.ownerUserId,

  distinctFromSubmitter:
    authUser.id !== evidence.submittedBy,

  operationIsVerifying:
    beforeOperation.currentState ===
    "VERIFYING",

  requirementAwaitsVerification:
    beforeRequirement.status ===
    "EVIDENCE_SUBMITTED",

  evidenceMatchesRequirement:
    evidence.requirementId ===
    requirementId,

  noExistingVerification:
    beforeVerifications.length === 0
};

const preconditionsPassed =
  Object.values(preconditions).every(
    (value) => value === true
  );

let invocationResult;

if (!preconditionsPassed) {
  invocationResult = {
    succeeded: false,
    invocationSkipped: true,
    code: "PRECONDITION_FAILED",
    reason:
      "verify-evidence was not invoked because one or more E-026 preconditions failed"
  };
} else {
  const request = {
    operationId,
    requirementId,
    evidenceId,
    decision: "APPROVED",
    note:
      "Independent review confirms that the fall protection anchor was reconnected, mechanically secured, and is ready for operation."
  };

  try {
    const response =
      await base44.functions.invoke(
        "verify-evidence",
        request
      );

    invocationResult = {
      succeeded: true,
      data: response.data
    };
  } catch (error) {
    invocationResult = {
      succeeded: false,
      invocationSkipped: false,
      name:
        error?.name ?? null,
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
}

const result =
  invocationResult?.data?.result ??
  null;

const afterOperation =
  await base44.entities.Operation.get(
    operationId
  );

const afterRequirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const afterVerifications =
  await base44.entities.Verification.filter({
    requirementId
  });

const afterEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "VERIFICATION_APPROVED"
  });

const createdVerification =
  result?.verificationId
    ? await base44.entities.Verification.get(
        result.verificationId
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
    "E-026 - Independent verifier approves evidence",
  authenticatedUser: {
    id: authUser.id,
    email:
      authUser.email ?? null,
    corbelRole:
      corbelUser.corbel_role ?? null
  },
  independenceCheck: {
    ownerUserId,
    requirementOwnerUserId:
      beforeRequirement.ownerUserId ??
      null,
    evidenceSubmittedBy:
      evidence.submittedBy,
    verifierUserId:
      authUser.id
  },
  preconditions,
  preconditionsPassed,
  before: {
    operationState:
      beforeOperation.currentState,
    requirementStatus:
      beforeRequirement.status,
    verificationCount:
      beforeVerifications.length,
    approvedEventCount:
      beforeEvents.length
  },
  invocationResult,
  after: {
    operationState:
      afterOperation.currentState,
    requirementStatus:
      afterRequirement.status,
    verificationCount:
      afterVerifications.length,
    approvedEventCount:
      afterEvents.length
  },
  createdVerification:
    createdVerification
      ? {
          id:
            createdVerification.id,
          requirementId:
            createdVerification.requirementId,
          verifierUserId:
            createdVerification.verifierUserId,
          decision:
            createdVerification.decision,
          note:
            createdVerification.note,
          verifiedAt:
            createdVerification.verifiedAt
        }
      : null,
  createdEvent:
    createdEvent
      ? {
          id:
            createdEvent.id,
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
