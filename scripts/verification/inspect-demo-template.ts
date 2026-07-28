const operationId = "6a6811142f9771f10680fed0";

const operation =
  await base44.entities.Operation.get(
    operationId
  );

const requirements =
  await base44.entities.ReadinessRequirement.filter({
    operationId
  });

function removeSystemFields(record) {
  if (!record) {
    return null;
  }

  const {
    id,
    created_date,
    updated_date,
    created_by,
    ...businessFields
  } = record;

  return {
    sourceId: id ?? null,
    businessFields
  };
}

console.log(JSON.stringify({
  test:
    "E-027 - Inspect canonical demo template",
  operation:
    removeSystemFields(operation),
  requirements:
    requirements.map(
      removeSystemFields
    ),
  requirementCount:
    requirements.length
}, null, 2));
