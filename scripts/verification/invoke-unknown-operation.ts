const operationId = "000000000000000000000000";

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

console.log(JSON.stringify({
  test: "TEST 9 - Unknown operation is rejected",
  request: {
    operationId
  },
  invocationResult
}, null, 2));
