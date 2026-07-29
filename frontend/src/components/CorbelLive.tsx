import React, { useEffect, useRef, useState } from "react";
import CorbelDashboard from "./CorbelDashboard";
import { base44 } from "../base44";

type AnyRecord = Record<string, any>;

type Snapshot = {
  operation: AnyRecord;
  requirements: AnyRecord[];
  events: AnyRecord[];
  receipt: AnyRecord | null;
};

type RealtimeStatus =
  | "CONNECTING"
  | "LIVE"
  | "SYNCING"
  | "DEGRADED";

type RealtimeEvent = {
  type: "create" | "update" | "delete";
  data?: AnyRecord;
  id: string;
  timestamp?: string;
};

type RealtimeEntityName =
  | "Operation"
  | "ReadinessRequirement"
  | "Evidence"
  | "Verification"
  | "OperationalEvent"
  | "ReleaseReceipt";

function normalizeRole(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function shortId(value?: string | null): string {
  if (!value) {
    return "SYSTEM";
  }

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function dateValue(record: AnyRecord, field: string): number {
  const raw = record?.[field] ?? record?.created_date ?? "";
  const value = Date.parse(raw);
  return Number.isNaN(value) ? 0 : value;
}

function safeError(error: any): string {
  const data =
    error?.data ??
    error?.response?.data ??
    null;

  return (
    data?.reason ??
    data?.code ??
    error?.message ??
    String(error)
  );
}

function titleForEvidence(evidence: AnyRecord): string {
  const type = evidence.evidenceType ?? "EVIDENCE";
  const note = String(evidence.note ?? "").replace(/\s+/g, " ").trim();

  if (!note) {
    return type;
  }

  return `${type} · ${note.length > 72 ? `${note.slice(0, 72)}…` : note}`;
}

export default function CorbelLive() {
  const [user, setUser] = useState<AnyRecord | null>(null);
  const [operations, setOperations] = useState<AnyRecord[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("CONNECTING");
  const [lastRealtimeSync, setLastRealtimeSync] =
    useState<Date | null>(null);

  const mountedRef = useRef(true);
  const activeUserRef = useRef<AnyRecord | null>(null);
  const selectedOperationIdRef = useRef("");
  const requirementIdsRef = useRef<Set<string>>(new Set());
  const realtimeTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRefreshInFlightRef = useRef(false);
  const realtimeRefreshQueuedRef = useRef(false);

  useEffect(() => {
    activeUserRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedOperationIdRef.current = selectedOperationId;
  }, [selectedOperationId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
      }
    };
  }, []);

  function identityLabel(userId?: string | null): string | null {
    if (!userId) {
      return null;
    }

    if (userId === user?.id) {
      return (
        user?.full_name ??
        user?.name ??
        user?.email ??
        shortId(userId)
      );
    }

    return shortId(userId);
  }

  async function loadSnapshot(
    operationId: string,
    activeUser: AnyRecord
  ): Promise<void> {
    const [
      operation,
      requirements,
      events,
      receipts,
    ] = await Promise.all([
      base44.entities.Operation.get(operationId),
      base44.entities.ReadinessRequirement.filter(
        { operationId },
        "label",
        200
      ),
      base44.entities.OperationalEvent.filter(
        { operationId },
        "-createdAt",
        500
      ),
      base44.entities.ReleaseReceipt.filter(
        { operationId },
        "-generatedAt",
        20
      ),
    ]);

    requirementIdsRef.current = new Set(
      requirements.map((requirement: AnyRecord) => requirement.id)
    );

    const requirementViewModels = await Promise.all(
      requirements.map(async (requirement: AnyRecord, index: number) => {
        const [evidenceRecords, verificationRecords] = await Promise.all([
          base44.entities.Evidence.filter(
            { requirementId: requirement.id },
            "-submittedAt",
            100
          ),
          base44.entities.Verification.filter(
            { requirementId: requirement.id },
            "-verifiedAt",
            100
          ),
        ]);

        const evidence = [...evidenceRecords].sort(
          (left, right) =>
            dateValue(right, "submittedAt") -
            dateValue(left, "submittedAt")
        );

        const verifications = [...verificationRecords].sort(
          (left, right) =>
            dateValue(right, "verifiedAt") -
            dateValue(left, "verifiedAt")
        );

        const latestVerification = verifications[0] ?? null;
        const latestEvidence = evidence[0] ?? null;

        const evidenceViewModels = evidence.map(
          (record: AnyRecord, evidenceIndex: number) => ({
            id: record.id,
            title: titleForEvidence(record),
            submittedBy:
              record.submittedBy === activeUser.id
                ? activeUser.full_name ??
                  activeUser.name ??
                  activeUser.email ??
                  shortId(record.submittedBy)
                : shortId(record.submittedBy),
            status:
              evidenceIndex === 0 && latestVerification
                ? latestVerification.decision
                : requirement.status === "REJECTED"
                  ? "REJECTED"
                  : requirement.status === "VERIFIED"
                    ? "APPROVED"
                    : "PENDING",
          })
        );

        let decision = latestVerification?.decision ?? "PENDING";

        if (
          requirement.status === "SATISFIED" &&
          requirement.verificationRequired !== true
        ) {
          decision = "NOT REQUIRED";
        }

        return {
          id: requirement.id,
          displayId: `R-${String(index + 1).padStart(2, "0")}`,
          label: requirement.label,
          category: requirement.category,
          status: requirement.status,
          ownerUserId: requirement.ownerUserId || null,
          owner:
            requirement.status === "UNOWNED"
              ? null
              : requirement.ownerUserId
                ? requirement.ownerUserId === activeUser.id
                  ? activeUser.full_name ??
                    activeUser.name ??
                    activeUser.email ??
                    shortId(requirement.ownerUserId)
                  : shortId(requirement.ownerUserId)
                : null,
          decision,
          critical: requirement.criticality === "CRITICAL",
          evidence: evidenceViewModels,
          latestEvidenceId: latestEvidence?.id ?? null,
        };
      })
    );

    const eventViewModels = [...events]
      .sort(
        (left, right) =>
          dateValue(right, "createdAt") -
          dateValue(left, "createdAt")
      )
      .map((event: AnyRecord) => ({
        id: event.id,
        type: event.eventType,
        actor:
          event.actorUserId === activeUser.id
            ? activeUser.full_name ??
              activeUser.name ??
              activeUser.email ??
              shortId(event.actorUserId)
            : identityLabel(event.actorUserId) ?? "SYSTEM",
        timestamp:
          event.createdAt ??
          event.created_date ??
          new Date(0).toISOString(),
        prev: event.previousState || "—",
        next: event.newState || event.previousState || "—",
        hash: event.eventHash
          ? shortId(event.eventHash)
          : "NOT-RECORDED",
        message: event.message ?? "",
      }));

    const receiptRecord = receipts[0] ?? null;
    const releasedByEvent = eventViewModels.find(
      (event) => event.type === "VERIFICATION_APPROVED"
    );

    const receipt = receiptRecord
      ? {
          runId: shortId(operation.id),
          operation: operation.name,
          location: operation.location,
          releasedBy: releasedByEvent?.actor ?? "CORBEL",
          releasedAt:
            receiptRecord.generatedAt ??
            operation.updatedAt ??
            operation.createdAt,
          requirementsTotal: requirementViewModels.length,
          requirementsSatisfied: requirementViewModels.filter(
            (requirement) =>
              ["SATISFIED", "VERIFIED"].includes(requirement.status)
          ).length,
          eventCount:
            receiptRecord.eventChain?.length ??
            eventViewModels.length,
          finalHash:
            receiptRecord.receiptHash ??
            receiptRecord.eventChainHeadHash ??
            "NOT-RECORDED",
        }
      : null;

    setSnapshot({
      operation: {
        id: operation.id,
        runId: shortId(operation.id),
        name: operation.name,
        location: operation.location,
        currentState: operation.currentState,
      },
      requirements: requirementViewModels,
      events: eventViewModels,
      receipt,
    });
  }

  async function loadOperationList(): Promise<AnyRecord[]> {
    const records = await base44.entities.Operation.list();

    const sorted = [...records].sort(
      (left, right) =>
        dateValue(right, "createdAt") -
        dateValue(left, "createdAt")
    );

    if (mountedRef.current) {
      setOperations(sorted);
    }

    return sorted;
  }

  async function loadOperationsAndSnapshot(
    activeUser: AnyRecord,
    preferredOperationId?: string
  ): Promise<void> {
    const sorted = await loadOperationList();

    const preferred = preferredOperationId
      ? sorted.find((operation) => operation.id === preferredOperationId)
      : null;

    const latestDemo = sorted.find((operation) =>
      String(operation.name ?? "").startsWith("CORBEL DEMO - ")
    );

    const chosen = preferred ?? latestDemo ?? sorted[0];

    if (!chosen) {
      throw new Error(
        "No CORBEL operation is readable for the authenticated user."
      );
    }

    setSelectedOperationId(chosen.id);
    await loadSnapshot(chosen.id, activeUser);
  }

  function isRealtimeEventRelevant(
    entityName: RealtimeEntityName,
    event: RealtimeEvent
  ): boolean {
    const operationId = selectedOperationIdRef.current;
    const data = event?.data ?? {};

    if (!operationId) {
      return false;
    }

    switch (entityName) {
      case "Operation":
        return (
          event.id === operationId ||
          event.type === "create"
        );

      case "ReadinessRequirement":
        return (
          data.operationId === operationId ||
          requirementIdsRef.current.has(event.id)
        );

      case "OperationalEvent":
      case "ReleaseReceipt":
        return data.operationId === operationId;

      case "Evidence":
      case "Verification":
        return requirementIdsRef.current.has(
          data.requirementId
        );

      default:
        return false;
    }
  }

  async function performRealtimeRefresh(): Promise<void> {
    const activeUser = activeUserRef.current;
    const operationId = selectedOperationIdRef.current;

    if (!activeUser || !operationId) {
      return;
    }

    if (realtimeRefreshInFlightRef.current) {
      realtimeRefreshQueuedRef.current = true;
      return;
    }

    realtimeRefreshInFlightRef.current = true;

    if (mountedRef.current) {
      setRealtimeStatus("SYNCING");
    }

    try {
      await Promise.all([
        loadOperationList(),
        loadSnapshot(operationId, activeUser),
      ]);

      if (mountedRef.current) {
        setRealtimeStatus("LIVE");
        setLastRealtimeSync(new Date());
      }
    } catch (caughtError) {
      if (mountedRef.current) {
        setRealtimeStatus("DEGRADED");
        setError(
          `Realtime sync failed: ${safeError(caughtError)}`
        );
      }
    } finally {
      realtimeRefreshInFlightRef.current = false;

      if (realtimeRefreshQueuedRef.current) {
        realtimeRefreshQueuedRef.current = false;
        scheduleRealtimeRefresh(80);
      }
    }
  }

  function scheduleRealtimeRefresh(delay = 180): void {
    if (realtimeTimerRef.current) {
      clearTimeout(realtimeTimerRef.current);
    }

    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      void performRealtimeRefresh();
    }, delay);
  }

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    setRealtimeStatus("CONNECTING");

    const entitySubscriptions: Array<{
      name: RealtimeEntityName;
      handler: {
        subscribe: (
          callback: (event: RealtimeEvent) => void
        ) => () => void;
      };
    }> = [
      {
        name: "Operation",
        handler: base44.entities.Operation,
      },
      {
        name: "ReadinessRequirement",
        handler: base44.entities.ReadinessRequirement,
      },
      {
        name: "Evidence",
        handler: base44.entities.Evidence,
      },
      {
        name: "Verification",
        handler: base44.entities.Verification,
      },
      {
        name: "OperationalEvent",
        handler: base44.entities.OperationalEvent,
      },
      {
        name: "ReleaseReceipt",
        handler: base44.entities.ReleaseReceipt,
      },
    ];

    const unsubscribers: Array<() => void> = [];

    try {
      for (const subscription of entitySubscriptions) {
        const unsubscribe =
          subscription.handler.subscribe((event) => {
            if (
              isRealtimeEventRelevant(
                subscription.name,
                event
              )
            ) {
              scheduleRealtimeRefresh();
            }
          });

        unsubscribers.push(unsubscribe);
      }

      setRealtimeStatus("LIVE");
      setLastRealtimeSync(new Date());
    } catch (caughtError) {
      setRealtimeStatus("DEGRADED");
      setError(
        `Realtime connection failed: ${safeError(caughtError)}`
      );
    }

    return () => {
      for (const unsubscribe of unsubscribers) {
        try {
          unsubscribe();
        } catch {
          // Cleanup must never block component unmount.
        }
      }
    };
  }, [user?.id]);

  async function initialize(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const authenticated = await base44.auth.isAuthenticated();

      if (!authenticated) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      const authUser = await base44.auth.me();

      let corbelUser: AnyRecord = authUser;

      try {
        const userRecord = await base44.entities.User.get(authUser.id);
        corbelUser = {
          ...authUser,
          ...userRecord,
        };
      } catch {
        corbelUser = authUser;
      }

      setUser(corbelUser);
      await loadOperationsAndSnapshot(corbelUser);
      setRealtimeStatus("LIVE");
      setLastRealtimeSync(new Date());
    } catch (caughtError) {
      setError(safeError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void initialize();
  }, []);

  async function refresh(operationId = selectedOperationId): Promise<void> {
    if (!user || !operationId) {
      return;
    }

    setError("");

    try {
      setRealtimeStatus("SYNCING");

      await Promise.all([
        loadOperationList(),
        loadSnapshot(operationId, user),
      ]);

      setRealtimeStatus("LIVE");
      setLastRealtimeSync(new Date());
    } catch (caughtError) {
      setRealtimeStatus("DEGRADED");
      setError(safeError(caughtError));
    }
  }

  async function runMutation(
    actionName: string,
    callback: () => Promise<void>
  ): Promise<void> {
    if (busyAction) {
      return;
    }

    setBusyAction(actionName);
    setError("");

    try {
      await callback();
    } catch (caughtError) {
      setError(safeError(caughtError));
    } finally {
      setBusyAction("");
    }
  }

  function requirementById(requirementId: string): AnyRecord {
    const requirement = snapshot?.requirements.find(
      (candidate) => candidate.id === requirementId
    );

    if (!requirement) {
      throw new Error("The selected requirement is no longer available.");
    }

    return requirement;
  }

  async function detectHazard(requirementId: string): Promise<void> {
    await runMutation("detect-hazard", async () => {
      const requirement = requirementById(requirementId);

      const title = window.prompt(
        "Hazard title",
        `${requirement.label} requires intervention`
      );

      if (!title?.trim()) {
        return;
      }

      const description = window.prompt(
        "Describe the observed hazard",
        `The critical control "${requirement.label}" can no longer be treated as satisfied.`
      );

      if (!description?.trim()) {
        return;
      }

      const severityInput = (
        window.prompt("Severity: LOW, MEDIUM or HIGH", "HIGH") ?? "HIGH"
      ).toUpperCase();

      const severity = ["LOW", "MEDIUM", "HIGH"].includes(severityInput)
        ? severityInput
        : "HIGH";

      await base44.functions.invoke("detect-hazard", {
        operationId: selectedOperationId,
        requirementId,
        title: title.trim(),
        description: description.trim(),
        severity,
      });

      await refresh();
    });
  }

  async function acceptOwnership(requirementId: string): Promise<void> {
    await runMutation("accept-ownership", async () => {
      await base44.functions.invoke("accept-ownership", {
        operationId: selectedOperationId,
        requirementId,
      });

      await refresh();
    });
  }

  async function submitEvidence(requirementId: string): Promise<void> {
    await runMutation("submit-evidence", async () => {
      const evidenceTypeInput = (
        window.prompt(
          "Evidence type: PHOTO, DOCUMENT, REPORT or NOTE",
          "NOTE"
        ) ?? "NOTE"
      ).toUpperCase();

      const evidenceType = [
        "PHOTO",
        "DOCUMENT",
        "REPORT",
        "NOTE",
      ].includes(evidenceTypeInput)
        ? evidenceTypeInput
        : "NOTE";

      const note = window.prompt(
        "Describe the evidence being submitted",
        ""
      );

      if (!note?.trim()) {
        return;
      }

      const fileUrl =
        evidenceType === "NOTE"
          ? null
          : window.prompt(
              "Optional evidence file URL. Leave empty when unavailable.",
              ""
            );

      await base44.functions.invoke("submit-evidence", {
        operationId: selectedOperationId,
        requirementId,
        evidenceType,
        note: note.trim(),
        ...(fileUrl?.trim() ? { fileUrl: fileUrl.trim() } : {}),
      });

      await refresh();
    });
  }

  async function verifyEvidence(
    requirementId: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<void> {
    await runMutation("verify-evidence", async () => {
      const requirement = requirementById(requirementId);

      if (!requirement.latestEvidenceId) {
        throw new Error(
          "No submitted evidence exists for this requirement."
        );
      }

      const note = window.prompt(
        decision === "APPROVED"
          ? "Independent approval note"
          : "Independent rejection reason",
        ""
      );

      if (!note?.trim()) {
        return;
      }

      await base44.functions.invoke("verify-evidence", {
        operationId: selectedOperationId,
        requirementId,
        evidenceId: requirement.latestEvidenceId,
        decision,
        note: note.trim(),
      });

      await refresh();
    });
  }

  async function resetDemo(): Promise<void> {
    await runMutation("reset-demo", async () => {
      const confirmed = window.confirm(
        "Create a fresh append-only demo run? The current run will remain unchanged."
      );

      if (!confirmed) {
        return;
      }

      const response = await base44.functions.invoke("reset-demo", {
        sourceOperationId: selectedOperationId,
        reason:
          "Prepare a fresh append-only run from the connected CORBEL frontend.",
      });

      const newOperationId =
        response?.data?.result?.newOperationId ?? null;

      if (!newOperationId || !user) {
        throw new Error(
          "reset-demo succeeded but did not return the new operation ID."
        );
      }

      await loadOperationsAndSnapshot(user, newOperationId);
    });
  }

  async function changeOperation(operationId: string): Promise<void> {
    if (!user || busyAction) {
      return;
    }

    setSelectedOperationId(operationId);
    setLoading(true);
    setError("");

    try {
      await loadSnapshot(operationId, user);
    } catch (caughtError) {
      setError(safeError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  if (loading || !user || !snapshot) {
    return (
      <div className="corbel-live-loading">
        ESTABLISHING CORBEL BACKEND LINK…
      </div>
    );
  }

  const displayName =
    user.full_name ??
    user.name ??
    user.email ??
    shortId(user.id);

  const corbelRole = normalizeRole(user.corbel_role);

  return (
    <div className="corbel-live-shell">
      <div className="corbel-live-toolbar">
        <select
          aria-label="Select CORBEL operation"
          value={selectedOperationId}
          onChange={(event) => void changeOperation(event.target.value)}
          disabled={Boolean(busyAction)}
        >
          {operations.map((operation) => (
            <option key={operation.id} value={operation.id}>
              {operation.name} · {operation.currentState}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={Boolean(busyAction)}
        >
          REFRESH
        </button>

        <span className="corbel-live-status">
          BASE44 REALTIME ·{" "}
          {busyAction
            ? busyAction.toUpperCase()
            : realtimeStatus}
          {lastRealtimeSync && !busyAction
            ? ` · ${lastRealtimeSync.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : ""}
        </span>
      </div>

      {error && <div className="corbel-live-error">{error}</div>}

      <CorbelDashboard
        operation={snapshot.operation}
        state={snapshot.operation.currentState}
        user={{
          id: user.id,
          name: displayName,
          role: corbelRole || "ROLE_NOT_ASSIGNED",
          canResetDemo:
            user.role === "admin" &&
            corbelRole === "ACCOUNTABLE_OWNER",
        }}
        requirements={snapshot.requirements}
        events={snapshot.events}
        receipt={snapshot.receipt}
        busy={Boolean(busyAction)}
        onDetectHazard={detectHazard}
        onAcceptOwnership={acceptOwnership}
        onSubmitEvidence={submitEvidence}
        onApproveEvidence={(requirementId: string) =>
          verifyEvidence(requirementId, "APPROVED")
        }
        onRejectEvidence={(requirementId: string) =>
          verifyEvidence(requirementId, "REJECTED")
        }
        onResetDemo={resetDemo}
      />
    </div>
  );
}
