const operationId = "6a6811142f9771f10680fed0";

const before =
  await base44.entities.Operation.get(operationId);

const requirements =
  await base44.entities.ReadinessRequirement.filter({
    operationId,
    criticality: "CRITICAL"
  });

const response = await base44.functions.invoke(
  "recalculate-readiness",
  { operationId }
);

const after =
  await base44.entities.Operation.get(operationId);

console.log(JSON.stringify({
  test: "TEST 7 - HOLD cannot return directly to READY",
  request: {
    operationId
  },
  before: {
    currentState: before.currentState,
    requirementCount: requirements.length,
    requirements: requirements.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status
    }))
  },
  functionResponse: response.data,
  after: {
    currentState: after.currentState
  }
}, null, 2));
