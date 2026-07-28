const operationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";
const evidenceId = "6a6867aac519c2014ff43088";

const request = {
  operationId,
  requirementId,
  evidenceId,
  decision: "APPROVED",
  note:
    "Evidence confirms that the anchor is reconnected and secured."
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

const beforeVerifications =
  await base44.entities.Verification.filter({
    requirementId
  });

const beforeApprovedEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "VERIFICATION_APPROVED"
  });

const beforeRejectedEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "VERIFICATION_REJECTED"
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

const afterApprovedEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "VERIFICATION_APPROVED"
  });

const afterRejectedEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "VERIFICATION_REJECTED"
  });

console.log(JSON.stringify({
  test:
    "E-024 - verify-evidence rejects a non-verifier role",
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
    verificationCount:
      beforeVerifications.length,
    approvedEventCount:
      beforeApprovedEvents.length,
    rejectedEventCount:
      beforeRejectedEvents.length
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
      afterApprovedEvents.length,
    rejectedEventCount:
      afterRejectedEvents.length
  }
}, null, 2));
