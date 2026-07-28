import { createClientFromRequest } from "npm:@base44/sdk";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const DEMO_ADMIN_USER_ID =
  "6a67a87fb27a05cbd4672d8e";

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

function safeError(error: any) {
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

    if (
      authUser.id !==
        DEMO_ADMIN_USER_ID ||
      corbelUser?.corbel_role !==
        "ACCOUNTABLE_OWNER"
    ) {
      return jsonResponse(
        {
          error: "Forbidden",
          code: "DEMO_ADMIN_ONLY",
          reason:
            "setup-demo is restricted to the CORBEL demo administrator"
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
      "runLabel"
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
      runLabel
    } = body;

    if (!isNonEmptyString(runLabel)) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "MISSING_RUN_LABEL"
        },
        400
      );
    }

    const normalizedRunLabel =
      runLabel.trim();

    if (
      !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(
        normalizedRunLabel
      )
    ) {
      return jsonResponse(
        {
          error: "Invalid request",
          code: "INVALID_RUN_LABEL",
          reason:
            "runLabel must contain only letters, numbers, spaces, underscores, or hyphens and be at most 40 characters"
        },
        400
      );
    }

    const operationName =
      `CORBEL DEMO - ${normalizedRunLabel}`;

    const existingOperations =
      await client
        .asServiceRole
        .entities
        .Operation
        .filter({
          name: operationName
        });

    if (existingOperations.length > 0) {
      return jsonResponse(
        {
          error: "Conflict",
          code:
            "DEMO_RUN_ALREADY_EXISTS",
          operationName,
          existingOperationIds:
            existingOperations.map(
              (operation: any) =>
                operation.id
            )
        },
        409
      );
    }

    const now =
      new Date().toISOString();

    const operation =
      await client
        .asServiceRole
        .entities
        .Operation
        .create({
          name: operationName,
          location:
            "North elevation - Roof access",
          currentState: "READY",
          createdAt: now,
          updatedAt: now
        });

    const requirementTemplate = [
      {
        label:
          "Crew assigned",
        category:
          "STAFFING"
      },
      {
        label:
          "Equipment inspection",
        category:
          "SAFETY"
      },
      {
        label:
          "Fall protection anchor",
        category:
          "SAFETY"
      },
      {
        label:
          "Supervisor present",
        category:
          "OVERSIGHT"
      }
    ];

    const requirements: any[] = [];

    for (
      const template of
      requirementTemplate
    ) {
      const requirement =
        await client
          .asServiceRole
          .entities
          .ReadinessRequirement
          .create({
            operationId:
              operation.id,
            label:
              template.label,
            category:
              template.category,
            criticality:
              "CRITICAL",
            status:
              "SATISFIED",
            evidenceRequired:
              true,
            verificationRequired:
              true,
            createdAt:
              now
          });

      requirements.push(
        requirement
      );
    }

    let transition: any;

    try {
      const recalculationResponse =
        await client.functions.invoke(
          "recalculate-readiness",
          {
            operationId:
              operation.id
          }
        );

      transition =
        normalizeFunctionResult(
          recalculationResponse
        );
    } catch (error) {
      return jsonResponse(
        {
          error:
            "Demo created but readiness recalculation failed",
          code:
            "DEMO_RECALCULATION_FAILED",
          operationId:
            operation.id,
          requirementIds:
            requirements.map(
              (requirement) =>
                requirement.id
            ),
          failure:
            safeError(error)
        },
        500
      );
    }

    const metadata = {
      runLabel:
        normalizedRunLabel,
      requirementIds:
        requirements.map(
          (requirement) =>
            requirement.id
        ),
      requirementCount:
        requirements.length,
      templateVersion:
        "CORBEL_DEMO_V1"
    };

    const canonicalPayload = {
      operationId:
        operation.id,
      eventType:
        "DEMO_SETUP",
      actorUserId:
        authUser.id,
      previousState:
        "READY",
      newState:
        transition?.newState ??
        "READY",
      message:
        `Demo run "${operationName}" created`,
      metadata,
      createdAt:
        now
    };

    const eventHash =
      await sha256(
        JSON.stringify(
          canonicalPayload
        )
      );

    const operationalEvent =
      await client
        .asServiceRole
        .entities
        .OperationalEvent
        .create({
          ...canonicalPayload,
          previousEventHash:
            "",
          eventHash
        });

    return jsonResponse(
      {
        success: true,
        result: {
          operationId:
            operation.id,
          operationName:
            operation.name,
          operationState:
            transition?.newState ??
            operation.currentState,
          requirementIds:
            requirements.map(
              (requirement) =>
                requirement.id
            ),
          requirements:
            requirements.map(
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
          operationalEventId:
            operationalEvent.id,
          stateChanged:
            transition?.stateChanged ===
            true,
          createdAt:
            now
        }
      },
      201
    );
  } catch (error) {
    console.error(
      "setup-demo error:",
      safeError(error)
    );

    return jsonResponse(
      {
        error:
          "Internal server error",
        code:
          "SETUP_DEMO_FAILED"
      },
      500
    );
  }
});
