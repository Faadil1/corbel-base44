const operationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";

const authUser = await base44.auth.me();
const corbelUser =
  await base44.entities.User.get(authUser.id);

const beforeOperation =
  await base44.entities.Operation.get(operationId);

const beforeRequirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const beforeAcceptances =
  await base44.entities.OwnershipAcceptance.filter({
    requirementId
  });

const beforeEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "OWNERSHIP_ACCEPTED"
  });

let invocationResult;

try {
  const response = await base44.functions.invoke(
    "accept-ownership",
    {
      operationId,
      requirementId
    }
  );

  invocationResult = {
    succeeded: true,
    data: response.data
  };
} catch (error) {
  invocationResult = {
    succeeded: false,
    name: error?.name ?? null,
    message: error?.message ?? String(error),
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

const afterAcceptances =
  await base44.entities.OwnershipAcceptance.filter({
    requirementId
  });

const afterEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "OWNERSHIP_ACCEPTED"
  });

console.log(JSON.stringify({
  test:
    "E-021 - accept-ownership rejects the wrong CORBEL role",
  authenticatedUser: {
    id: authUser.id,
    email: authUser.email ?? null,
    corbelRole: corbelUser.corbel_role ?? null
  },
  before: {
    operationState: beforeOperation.currentState,
    requirementStatus: beforeRequirement.status,
    ownerUserId:
      beforeRequirement.ownerUserId ?? null,
    acceptanceCount: beforeAcceptances.length,
    ownershipEventCount: beforeEvents.length
  },
  invocationResult,
  after: {
    operationState: afterOperation.currentState,
    requirementStatus: afterRequirement.status,
    ownerUserId:
      afterRequirement.ownerUserId ?? null,
    acceptanceCount: afterAcceptances.length,
    ownershipEventCount: afterEvents.length
  }
}, null, 2));
