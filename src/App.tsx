import {
  useEffect,
  useMemo,
  useState
} from "react";

import { base44 } from "./base44";
import "./styles.css";

type CurrentUser = {
  id?: string;
  email?: string;
};

type EvidenceOutput =
  | Record<string, unknown>
  | null;

const operationId =
  "6a6811142f9771f10680fed0";

const requirementId =
  "6a68365aa6236618b481752c";

const evidenceId =
  "6a6867aac519c2014ff43088";

const ownerUserId =
  "6a67a87fb27a05cbd4672d8e";

export default function App() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [output, setOutput] =
    useState<EvidenceOutput>(null);

  const [copied, setCopied] =
    useState(false);

  useEffect(() => {
    async function initialize() {
      const authenticated =
        await base44.auth.isAuthenticated();

      if (!authenticated) {
        base44.auth.redirectToLogin(
          window.location.href
        );

        return;
      }

      const authenticatedUser =
        await base44.auth.me();

      setUser(authenticatedUser);
      setLoading(false);
    }

    initialize().catch((error) => {
      setOutput({
        test:
          "E-026 - Frontend initialization",
        succeeded: false,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      });

      setLoading(false);
    });
  }, []);

  const identityIsDistinct =
    useMemo(
      () =>
        Boolean(
          user?.id &&
          user.id !== ownerUserId
        ),
      [user]
    );

  async function approveEvidence() {
    if (!user?.id || !user?.email) {
      return;
    }

    if (!identityIsDistinct) {
      setOutput({
        test:
          "E-026 - Independent verification",
        succeeded: false,
        code:
          "FRONTEND_IDENTITY_NOT_DISTINCT",
        authenticatedUser: {
          id: user.id,
          email: user.email
        }
      });

      return;
    }

    setSubmitting(true);
    setCopied(false);

    const request = {
      operationId,
      requirementId,
      evidenceId,
      decision: "APPROVED",
      note:
        "Independent review confirms that the fall protection anchor was reconnected, mechanically secured, and is ready for operation."
    };

    try {
      const response =
        await base44.functions.invoke(
          "verify-evidence",
          request
        );

      setOutput({
        test:
          "E-026 - Independent verifier approves evidence",
        executedAt:
          new Date().toISOString(),
        authenticatedUser: {
          id: user.id,
          email: user.email,
          distinctFromOwner:
            user.id !== ownerUserId
        },
        request,
        invocationResult: {
          succeeded: true,
          data: response.data
        }
      });
    } catch (error: any) {
      setOutput({
        test:
          "E-026 - Independent verifier approves evidence",
        executedAt:
          new Date().toISOString(),
        authenticatedUser: {
          id: user.id,
          email: user.email,
          distinctFromOwner:
            user.id !== ownerUserId
        },
        request,
        invocationResult: {
          succeeded: false,
          name:
            error?.name ?? null,
          message:
            error?.message ??
            String(error),
          status:
            error?.status ?? null,
          code:
            error?.code ??
            error?.data?.code ??
            null,
          responseData:
            error?.data ?? null
        }
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyEvidence() {
    if (!output) {
      return;
    }

    await navigator.clipboard.writeText(
      JSON.stringify(output, null, 2)
    );

    setCopied(true);
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">
            CORBEL
          </p>

          <h1>
            Establishing secure access…
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">
          CORBEL · E-026
        </p>

        <h1>
          Independent verification
        </h1>

        <dl>
          <div>
            <dt>Email</dt>
            <dd>
              {user?.email ?? "Unknown"}
            </dd>
          </div>

          <div>
            <dt>User ID</dt>
            <dd>
              {user?.id ?? "Unknown"}
            </dd>
          </div>

          <div>
            <dt>Distinct from owner</dt>
            <dd>
              {identityIsDistinct
                ? "true"
                : "false"}
            </dd>
          </div>
        </dl>

        {!identityIsDistinct && (
          <p className="notice">
            Do not continue. This browser is
            authenticated as the requirement
            owner.
          </p>
        )}

        <button
          type="button"
          disabled={
            submitting ||
            !identityIsDistinct ||
            Boolean(output)
          }
          onClick={approveEvidence}
        >
          {submitting
            ? "Verifying…"
            : "Approve submitted evidence"}
        </button>

        {output && (
          <>
            <pre>
              {JSON.stringify(
                output,
                null,
                2
              )}
            </pre>

            <button
              type="button"
              onClick={copyEvidence}
            >
              {copied
                ? "Evidence copied"
                : "Copy evidence JSON"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
