import { createClientFromRequest } from "npm:@base44/sdk";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const DEMO_ADMIN_USER_ID =
  "6a67a87fb27a05cbd4672d8d";

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: JSON_HEADERS
    }
  );
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isNotFoundError(
  error: any
): boolean {
  const status =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    null;

  const code =
    error?.code ??
    error?.data?.code ??
    error?.response?.data?.code ??
    null;

  const message =
    String(error?.message ?? "");

  return (
    status === 404 ||
    code === "NOT_FOUND" ||
    code === "ENTITY_NOT_FOUND" ||
    /\b404\b|not found/i.test(message)
  );
}

function normalizeFunctionResult(
  response: any
): any {
  return (
    response?.data?.result ??
    response?.result ??
    response?.data ??
    response
  );
}

function safeError(
  error: any
) {
  return {
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
      error?.code ??
      error?.data?.code ??
      error?.response?.data?.code ??
      null
  };
}

function createResetLabel(): string {
  const timestamp =
    new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const suffix =
    crypto
      .randomUUID()
      .slice(0, 6)
      .toUpperCase();

  return (
    `RESET-${timestamp}-${suffix}`
  );
}

async function sha256(
  value: string
): Promise<string> {
  const encoded =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

async function appendOperationalEvent(
  client: any,
  input: {
    operationId: string;
    eventType: string;
    actorUserId: string;
    previousState: string;
    newState: string;
    message: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }
): Promise<any> {
  const previousEvents =
    await client
      .asServiceRole
      .entities
      .OperationalEvent
      .filter(
        {
          operationId:
            input.operationId
        },
        "-createdAt",
        1
      );

  const previousEventHash =
    previousEvents?.[0]?.eventHash ??
    "";

  const canonicalPayload = {
    operationId:
      input.operationId,

    eventType:
      input.eventType,

    actorUserId:
      input.actorUserId,

    previousState:
      input.previousState,

    newState:
      input.newState,

    message:
      input.message,

    metadata:
      input.metadata,

    createdAt:
      input.createdAt
  };

  const eventHash =
    await sha256(
      previousEventHash +
      JSON.stringify(
        canonicalPayload
      )
    );

  return await client
    .asServiceRole
    .entities
    .OperationalEvent
    .create({
      ...canonicalPayload,
      previousEventHash,
      eventHash
    });
}

Deno.serve(async (
  req: Request
): Promise<Response> => {
  try {
    const client =
      createClientFromRequest(req);

    const authUser =
      await client.auth.me();

    if (!authUser?.id) {
      return jsonResponse(
        {
          error: "Unauthorized",
          code: "UNAUTHENTICATED"
        },
        401
      );
    }

    let corbelUser: any;

    try {
      corbelUser =
        await client
          .asServiceRole
          .entities
          .User
          .get(authUser.id);
    } catch {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "DEMO_ADMIN_ONLY",
          reason:
            "Authenticated user has no CORBEL user record"
        },
        403
      );
    }

    const isApplicationAdmin =
      corbelUser?.role === "admin" ||
      corbelUser?._app_role === "admin";

    if (
      !isApplicationAdmin ||
      corbelUser?.corbel_role !==
        "ACCOUNTABLE_OWNER"
    ) {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "DEMO_ADMIN_ONLY",
          reason:
            "reset-demo requires an app administrator with the ACCOUNTABLE_OWNER role"
        },
        403
      );
    }

    let body: any;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_JSON"
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_BODY"
        },
        400
      );
    }

    const allowedKeys = [
      "sourceOperationId",
      "reason"
    ];

    const extraKeys =
      Object.keys(body).filter(
        (key) =>
          !allowedKeys.includes(key)
      );

    if (extraKeys.length > 0) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "UNEXPECTED_FIELDS",
          reason:
            `Unexpected fields: ${extraKeys.join(", ")}`
        },
        400
      );
    }

    const {
      sourceOperationId,
      reason
    } = body;

    if (
      !isNonEmptyString(
        sourceOperationId
      )
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code:
            "MISSING_SOURCE_OPERATION_ID"
        },
        400
      );
    }

    if (
      reason !== undefined &&
      (
        typeof reason !== "string" ||
        reason.trim().length === 0 ||
        reason.trim().length > 200
      )
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_REASON",
          reason:
            "reason must be a non-empty string of at most 200 characters"
        },
        400
      );
    }

    let sourceOperation: any;

    try {
      sourceOperation =
        await client
          .asServiceRole
          .entities
          .Operation
          .get(
            sourceOperationId.trim()
          );
    } catch (error) {
      if (isNotFoundError(error)) {
        return jsonResponse(
          {
            error: "Not found",
            code:
              "SOURCE_OPERATION_NOT_FOUND"
          },
          404
        );
      }

      throw error;
    }

    if (
      typeof sourceOperation.name !==
        "string" ||
      !sourceOperation.name.startsWith(
        "CORBEL DEMO - "
      )
    ) {
      return jsonResponse(
        {
          error: "Conflict",
          code:
            "SOURCE_NOT_DEMO_RUN",
          reason:
            "reset-demo may only originate from a CORBEL demo run"
        },
        409
      );
    }

    const resetRunLabel =
      createResetLabel();

    let setupResult: any;

    try {
      const setupResponse =
        await client.functions.invoke(
          "setup-demo",
          {
            runLabel:
              resetRunLabel
          }
        );

      setupResult =
        normalizeFunctionResult(
          setupResponse
        );
    } catch (error) {
      return jsonResponse(
        {
          error:
            "Unable to create the new demo run",
          code:
            "RESET_SETUP_FAILED",
          sourceOperationId:
            sourceOperation.id,
          failure:
            safeError(error)
        },
        500
      );
    }

    if (
      !setupResult?.operationId
    ) {
      return jsonResponse(
        {
          error:
            "setup-demo returned an invalid result",
          code:
            "INVALID_SETUP_RESULT",
          sourceOperationId:
            sourceOperation.id
        },
        500
      );
    }

    const createdAt =
      new Date().toISOString();

    let resetEvent: any;

    try {
      resetEvent =
        await appendOperationalEvent(
          client,
          {
            operationId:
              setupResult.operationId,

            eventType:
              "DEMO_RESET",

            actorUserId:
              authUser.id,

            previousState:
              setupResult.operationState ??
              "READY",

            newState:
              setupResult.operationState ??
              "READY",

            message:
              `Fresh demo run created from "${sourceOperation.name}"`,

            metadata: {
              sourceOperationId:
                sourceOperation.id,

              sourceOperationName:
                sourceOperation.name,

              sourceOperationState:
                sourceOperation.currentState,

              resetRunLabel,

              reason:
                typeof reason ===
                  "string"
                  ? reason.trim()
                  : null,

              setupEventId:
                setupResult.operationalEventId ??
                null,

              templateVersion:
                "CORBEL_DEMO_V1"
            },

            createdAt
          }
        );
    } catch (error) {
      return jsonResponse(
        {
          error:
            "New demo run was created, but its reset audit event failed",
          code:
            "RESET_EVENT_FAILED",
          sourceOperationId:
            sourceOperation.id,
          newOperationId:
            setupResult.operationId,
          failure:
            safeError(error)
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,
        result: {
          sourceOperationId:
            sourceOperation.id,

          sourceOperationName:
            sourceOperation.name,

          sourceOperationState:
            sourceOperation.currentState,

          resetRunLabel,

          newOperationId:
            setupResult.operationId,

          newOperationName:
            setupResult.operationName,

          newOperationState:
            setupResult.operationState,

          requirementIds:
            setupResult.requirementIds,

          requirements:
            setupResult.requirements,

          setupEventId:
            setupResult.operationalEventId,

          resetEventId:
            resetEvent.id,

          createdAt
        }
      },
      201
    );
  } catch (error) {
    console.error(
      "reset-demo error:",
      safeError(error)
    );

    return jsonResponse(
      {
        error:
          "Internal server error",
        code:
          "RESET_DEMO_FAILED"
      },
      500
    );
  }
});
