const operationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";

const request = {
  operationId,
  requirementId,
  title: "Fall protection anchor disconnected",
  description:
    "Visual inspection found the fall protection anchor disconnected at Floor 12 - Bay C.",
  severity: "HIGH"
};

const beforeOperation =
  await base44.entities.Operation.get(operationId);

const beforeRequirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const beforeHazards =
  await base44.entities.HazardReport.filter({
    operationId,
    requirementId
  });

const beforeEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "HAZARD_DETECTED"
  });

let invocationResult;

try {
  const response = await base44.functions.invoke(
    "detect-hazard",
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

const afterHazards =
  await base44.entities.HazardReport.filter({
    operationId,
    requirementId
  });

const afterEvents =
  await base44.entities.OperationalEvent.filter({
    operationId,
    eventType: "HAZARD_DETECTED"
  });

console.log(JSON.stringify({
  test: "E-020 - Hazard detection causes operational HOLD",
  request,
  before: {
    operationState: beforeOperation.currentState,
    requirementStatus: beforeRequirement.status,
    ownerUserId: beforeRequirement.ownerUserId ?? null,
    hazardCount: beforeHazards.length,
    hazardEventCount: beforeEvents.length
  },
  invocationResult,
  after: {
    operationState: afterOperation.currentState,
    requirementStatus: afterRequirement.status,
    ownerUserId: afterRequirement.ownerUserId ?? null,
    hazardCount: afterHazards.length,
    hazardEventCount: afterEvents.length
  }
}, null, 2));
