const requestedOperationId = "6a6811142f9771f10680fed0";
const requirementId = "6a68365aa6236618b481752c";

const operation =
  await base44.entities.Operation.get(
    requestedOperationId
  );

const requirement =
  await base44.entities.ReadinessRequirement.get(
    requirementId
  );

const hazards =
  await base44.entities.HazardReport.filter({
    requirementId
  });

const events =
  await base44.entities.OperationalEvent.filter({
    eventType: "HAZARD_DETECTED"
  });

console.log(JSON.stringify({
  test: "E-020 precondition inspection",
  requestedOperation: {
    id: operation.id,
    name: operation.name,
    currentState: operation.currentState
  },
  requirement: {
    id: requirement.id,
    label: requirement.label,
    operationId: requirement.operationId,
    status: requirement.status,
    criticality: requirement.criticality,
    ownerUserId: requirement.ownerUserId ?? null
  },
  relationshipMatches:
    requirement.operationId === requestedOperationId,
  existingHazardsForRequirement:
    hazards.length,
  totalHazardDetectedEvents:
    events.length
}, null, 2));
