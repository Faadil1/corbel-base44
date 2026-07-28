const runLabel =
  "RUN-001";

const expectedOperationName =
  `CORBEL DEMO - ${runLabel}`;

const beforeOperations =
  await base44.entities.Operation.filter({
    name: expectedOperationName
  });

let invocationResult;

try {
  const response =
    await base44.functions.invoke(
      "setup-demo",
      {
        runLabel
      }
    );

  invocationResult = {
    succeeded: true,
    data: response.data
  };
} catch (error) {
  invocationResult = {
    succeeded: false,
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

const result =
  invocationResult?.data?.result ??
  null;

const createdOperation =
  result?.operationId
    ? await base44.entities.Operation.get(
        result.operationId
      )
    : null;

const createdRequirements =
  result?.operationId
    ? await base44.entities.ReadinessRequirement.filter({
        operationId:
          result.operationId
      })
    : [];

const createdEvents =
  result?.operationId
    ? await base44.entities.OperationalEvent.filter({
        operationId:
          result.operationId,
        eventType:
          "DEMO_SETUP"
      })
    : [];

const afterOperations =
  await base44.entities.Operation.filter({
    name: expectedOperationName
  });

const expectedLabels = [
  "Crew assigned",
  "Equipment inspection",
  "Fall protection anchor",
  "Supervisor present"
];

const actualLabels =
  createdRequirements
    .map(
      (requirement) =>
        requirement.label
    )
    .sort();

const assertions = {
  invocationSucceeded:
    invocationResult.succeeded === true,

  oneNewOperationCreated:
    beforeOperations.length === 0 &&
    afterOperations.length === 1,

  operationIsReady:
    createdOperation?.currentState ===
    "READY",

  fourRequirementsCreated:
    createdRequirements.length === 4,

  expectedLabelsPresent:
    JSON.stringify(actualLabels) ===
    JSON.stringify(
      [...expectedLabels].sort()
    ),

  allRequirementsCritical:
    createdRequirements.every(
      (requirement) =>
        requirement.criticality ===
        "CRITICAL"
    ),

  allRequirementsSatisfied:
    createdRequirements.every(
      (requirement) =>
        requirement.status ===
        "SATISFIED"
    ),

  allRequireEvidence:
    createdRequirements.every(
      (requirement) =>
        requirement.evidenceRequired ===
        true
    ),

  allRequireVerification:
    createdRequirements.every(
      (requirement) =>
        requirement.verificationRequired ===
        true
    ),

  oneSetupEventCreated:
    createdEvents.length === 1
};

const assertionsPassed =
  Object.values(assertions).every(
    (value) => value === true
  );

console.log(JSON.stringify({
  test:
    "E-028 - setup-demo creates an append-only READY run",
  authenticatedUser:
    await base44.auth.me(),
  before: {
    matchingOperationCount:
      beforeOperations.length
  },
  invocationResult,
  after: {
    matchingOperationCount:
      afterOperations.length,
    operation:
      createdOperation
        ? {
            id:
              createdOperation.id,
            name:
              createdOperation.name,
            location:
              createdOperation.location,
            currentState:
              createdOperation.currentState,
            createdAt:
              createdOperation.createdAt
          }
        : null,
    requirements:
      createdRequirements.map(
        (requirement) => ({
          id:
            requirement.id,
          label:
            requirement.label,
          category:
            requirement.category,
          criticality:
            requirement.criticality,
          status:
            requirement.status,
          evidenceRequired:
            requirement.evidenceRequired,
          verificationRequired:
            requirement.verificationRequired
        })
      ),
    setupEventCount:
      createdEvents.length
  },
  assertions,
  assertionsPassed
}, null, 2));
