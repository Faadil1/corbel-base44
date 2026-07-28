const operationId = "6a6811142f9771f10680fed0";

const before =
  await base44.entities.Operation.get(operationId);

let invocationResult;

try {
  const response = await base44.functions.invoke(
    "recalculate-readiness",
    {
      operationId,
      currentState: "RELEASED"
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

const after =
  await base44.entities.Operation.get(operationId);

console.log(JSON.stringify({
  test: "TEST 8 - Request cannot inject currentState",
  request: {
    operationId,
    currentState: "RELEASED"
  },
  before: {
    currentState: before.currentState
  },
  invocationResult,
  after: {
    currentState: after.currentState
  }
}, null, 2));
