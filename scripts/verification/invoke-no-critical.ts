const operationId = "6a6843feb79b7c2fdf3260d8";

const before =
  await base44.entities.Operation.get(operationId);

let invocationResult;

try {
  const response = await base44.functions.invoke(
    "recalculate-readiness",
    { operationId }
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

const after =
  await base44.entities.Operation.get(operationId);

console.log(JSON.stringify({
  test: "TEST 6 - Zero critical requirements cannot release",
  request: {
    operationId
  },
  before: {
    currentState: before.currentState
  },
  invocationResult,
  after: {
    currentState: after.currentState
  }
}, null, 2));
