const operationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";
const evidenceId = "6a6867aac519c2014ff43088";

const request = {
  operationId,
  requirementId,
  evidenceId,
  decision: "APPROVED",
  note:
    "Evidence confirms that the fall protection anchor is reconnected and secured."
};

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

let invocationResult;

try {
  const response = await base44.functions.invoke(
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

const afterOperation =
  await base44.entities.Operation.get(operationId);

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

console.log(JSON.stringify({
  test:
    "E-025 - A verifier cannot approve evidence they submitted",
  authenticatedUser: {
    id: authUser.id,
    email: authUser.email ?? null,
    corbelRole:
      corbelUser.corbel_role ?? null
  },
  independenceCheck: {
    evidenceSubmittedBy:
      evidence.submittedBy,
    requirementOwnerUserId:
      beforeRequirement.ownerUserId ?? null,
    verifierUserId:
      authUser.id,
    sameAsSubmitter:
      evidence.submittedBy === authUser.id,
    sameAsOwner:
      beforeRequirement.ownerUserId === authUser.id
  },
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
  }
}, null, 2));
