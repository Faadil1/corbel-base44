const sourceOperationId =
  "6a68f0da41047426f264151f";

const expectedLabels = [
  "Crew assigned",
  "Equipment inspection",
  "Fall protection anchor",
  "Supervisor present"
];

const authUser =
  await base44.auth.me();

const sourceBefore =
  await base44.entities.Operation.get(
    sourceOperationId
  );

const sourceRequirementsBefore =
  await base44.entities.ReadinessRequirement.filter({
    operationId:
      sourceOperationId
  });

function requirementSnapshot(
  requirements
) {
  return requirements
    .map(
      (requirement) => ({
        id:
          requirement.id,

        label:
          requirement.label,

        status:
          requirement.status,

        ownerUserId:
          requirement.ownerUserId ??
          null
      })
    )
    .sort(
      (left, right) =>
        left.id.localeCompare(
          right.id
        )
    );
}

const sourceSnapshotBefore =
  requirementSnapshot(
    sourceRequirementsBefore
  );

let invocationResult;

try {
  const response =
    await base44.functions.invoke(
      "reset-demo",
      {
        sourceOperationId,

        reason:
          "Prepare a fresh append-only run for the next CORBEL demonstration."
      }
    );

  invocationResult = {
    succeeded: true,
    data:
      response.data
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

const sourceAfter =
  await base44.entities.Operation.get(
    sourceOperationId
  );

const sourceRequirementsAfter =
  await base44.entities.ReadinessRequirement.filter({
    operationId:
      sourceOperationId
  });

const sourceSnapshotAfter =
  requirementSnapshot(
    sourceRequirementsAfter
  );

const newOperation =
  result?.newOperationId
    ? await base44.entities.Operation.get(
        result.newOperationId
      )
    : null;

const newRequirements =
  result?.newOperationId
    ? await base44.entities.ReadinessRequirement.filter({
        operationId:
          result.newOperationId
      })
    : [];

const setupEvents =
  result?.newOperationId
    ? await base44.entities.OperationalEvent.filter({
        operationId:
          result.newOperationId,
        eventType:
          "DEMO_SETUP"
      })
    : [];

const resetEvents =
  result?.newOperationId
    ? await base44.entities.OperationalEvent.filter({
        operationId:
          result.newOperationId,
        eventType:
          "DEMO_RESET"
      })
    : [];

const actualLabels =
  newRequirements
    .map(
      (requirement) =>
        requirement.label
    )
    .sort();

const expectedLabelsSorted =
  [...expectedLabels].sort();

const resetEvent =
  resetEvents[0] ??
  null;

const assertions = {
  invocationSucceeded:
    invocationResult.succeeded ===
    true,

  newOperationCreated:
    Boolean(
      newOperation?.id
    ),

  newOperationIsDistinct:
    Boolean(
      newOperation?.id &&
      newOperation.id !==
        sourceOperationId
    ),

  sourceStateUnchanged:
    sourceBefore.currentState ===
    sourceAfter.currentState,

  sourceNameUnchanged:
    sourceBefore.name ===
    sourceAfter.name,

  sourceRequirementsUnchanged:
    JSON.stringify(
      sourceSnapshotBefore
    ) ===
    JSON.stringify(
      sourceSnapshotAfter
    ),

  newOperationIsReady:
    newOperation?.currentState ===
    "READY",

  fourRequirementsCreated:
    newRequirements.length === 4,

  expectedLabelsPresent:
    JSON.stringify(
      actualLabels
    ) ===
    JSON.stringify(
      expectedLabelsSorted
    ),

  allRequirementsCritical:
    newRequirements.every(
      (requirement) =>
        requirement.criticality ===
        "CRITICAL"
    ),

  allRequirementsSatisfied:
    newRequirements.every(
      (requirement) =>
        requirement.status ===
        "SATISFIED"
    ),

  allRequireEvidence:
    newRequirements.every(
      (requirement) =>
        requirement.evidenceRequired ===
        true
    ),

  allRequireVerification:
    newRequirements.every(
      (requirement) =>
        requirement.verificationRequired ===
        true
    ),

  oneSetupEventCreated:
    setupEvents.length === 1,

  oneResetEventCreated:
    resetEvents.length === 1,

  resetEventLinksSource:
    resetEvent?.metadata
      ?.sourceOperationId ===
      sourceOperationId
};

const assertionsPassed =
  Object.values(assertions).every(
    (value) =>
      value === true
  );

console.log(JSON.stringify({
  test:
    "E-029 - reset-demo creates a fresh append-only run",

  authenticatedUser: {
    id:
      authUser.id,

    email:
      authUser.email ??
      null,

    corbelRole:
      authUser.corbel_role ??
      null
  },

  before: {
    sourceOperation: {
      id:
        sourceBefore.id,

      name:
        sourceBefore.name,

      currentState:
        sourceBefore.currentState
    },

    sourceRequirements:
      sourceSnapshotBefore
  },

  invocationResult,

  after: {
    sourceOperation: {
      id:
        sourceAfter.id,

      name:
        sourceAfter.name,

      currentState:
        sourceAfter.currentState
    },

    sourceRequirements:
      sourceSnapshotAfter,

    newOperation:
      newOperation
        ? {
            id:
              newOperation.id,

            name:
              newOperation.name,

            location:
              newOperation.location,

            currentState:
              newOperation.currentState,

            createdAt:
              newOperation.createdAt
          }
        : null,

    newRequirements:
      newRequirements.map(
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
      setupEvents.length,

    resetEventCount:
      resetEvents.length,

    resetEvent:
      resetEvent
        ? {
            id:
              resetEvent.id,

            eventType:
              resetEvent.eventType,

            actorUserId:
              resetEvent.actorUserId,

            previousState:
              resetEvent.previousState,

            newState:
              resetEvent.newState,

            metadata:
              resetEvent.metadata,

            previousEventHash:
              resetEvent.previousEventHash,

            eventHash:
              resetEvent.eventHash,

            createdAt:
              resetEvent.createdAt
          }
        : null
  },

  assertions,
  assertionsPassed
}, null, 2));
