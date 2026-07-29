import React, { useCallback, useState } from "react";
import CorbelDashboard from "../handoff/CorbelDashboard";
import {
  CORBEL_ROLES,
  makeSampleRun,
} from "../handoff/sampleData";

let eventCounter = 0;

function makeEvent(type, actor, prev, next, message) {
  eventCounter += 1;

  return {
    id: `preview-event-${eventCounter}`,
    type,
    actor,
    timestamp: new Date().toISOString(),
    prev,
    next,
    hash: `preview${String(eventCounter).padStart(4, "0")}`,
    message,
  };
}

export default function CorbelPreview() {
  const [run, setRun] = useState(() => makeSampleRun());
  const [busy] = useState(false);

  const setRole = useCallback((role) => {
    setRun((current) => ({
      ...current,
      user: {
        ...current.user,
        id: `preview-${role.toLowerCase()}`,
        name: role.replaceAll("_", " "),
        role,
      },
    }));
  }, []);

  const onDetectHazard = useCallback((requirementId) => {
    setRun((current) => ({
      ...current,
      state: "HOLD",
      requirements: current.requirements.map((requirement) =>
        requirement.id === requirementId
          ? {
              ...requirement,
              status: "UNOWNED",
              owner: null,
              ownerUserId: null,
              decision: "PENDING",
            }
          : requirement
      ),
      events: [
        makeEvent(
          "HAZARD_DETECTED",
          current.user.name,
          current.state,
          "HOLD",
          "A critical control lost its accountable owner."
        ),
        ...current.events,
      ],
    }));
  }, []);

  const onAcceptOwnership = useCallback((requirementId) => {
    setRun((current) => ({
      ...current,
      requirements: current.requirements.map((requirement) =>
        requirement.id === requirementId
          ? {
              ...requirement,
              status: "OWNED",
              owner: current.user.name,
              ownerUserId: current.user.id,
              decision: "PENDING",
            }
          : requirement
      ),
      events: [
        makeEvent(
          "OWNERSHIP_ACCEPTED",
          current.user.name,
          current.state,
          current.state,
          "An accountable owner accepted the critical control."
        ),
        ...current.events,
      ],
    }));
  }, []);

  const onSubmitEvidence = useCallback((requirementId) => {
    setRun((current) => ({
      ...current,
      state: "VERIFYING",
      requirements: current.requirements.map((requirement) =>
        requirement.id === requirementId
          ? {
              ...requirement,
              status: "EVIDENCE_SUBMITTED",
              latestEvidenceId: `preview-evidence-${Date.now()}`,
              evidence: [
                ...requirement.evidence,
                {
                  id: `preview-evidence-${Date.now()}`,
                  title: "Operator evidence note",
                  submittedBy: current.user.name,
                  status: "PENDING",
                },
              ],
            }
          : requirement
      ),
      events: [
        makeEvent(
          "EVIDENCE_SUBMITTED",
          current.user.name,
          current.state,
          "VERIFYING",
          "Evidence was submitted for independent review."
        ),
        ...current.events,
      ],
    }));
  }, []);

  const verify = useCallback((requirementId, decision) => {
    setRun((current) => {
      const requirements = current.requirements.map((requirement) =>
        requirement.id === requirementId
          ? {
              ...requirement,
              status: decision === "APPROVED" ? "VERIFIED" : "REJECTED",
              decision,
              evidence: requirement.evidence.map((evidence) => ({
                ...evidence,
                status: decision,
              })),
            }
          : requirement
      );

      const released =
        decision === "APPROVED" &&
        requirements.every((requirement) =>
          ["SATISFIED", "VERIFIED"].includes(requirement.status)
        );

      const nextState = decision === "REJECTED"
        ? "HOLD"
        : released
          ? "RELEASED"
          : "VERIFYING";

      const event = makeEvent(
        decision === "APPROVED"
          ? "VERIFICATION_APPROVED"
          : "VERIFICATION_REJECTED",
        current.user.name,
        current.state,
        nextState,
        `Independent verification ${decision.toLowerCase()}.`
      );

      return {
        ...current,
        state: nextState,
        requirements,
        events: [event, ...current.events],
        receipt: released
          ? {
              runId: current.operation.runId,
              operation: current.operation.name,
              location: current.operation.location,
              releasedBy: current.user.name,
              releasedAt: new Date().toISOString(),
              requirementsTotal: requirements.length,
              requirementsSatisfied: requirements.length,
              eventCount: current.events.length + 1,
              finalHash: event.hash,
            }
          : null,
      };
    });
  }, []);

  const onResetDemo = useCallback(() => {
    setRun((current) => makeSampleRun(current.lineage + 1));
  }, []);

  return (
    <div className="corbel-live-shell">
      <div className="corbel-preview-bar">
        <span>PREVIEW ROLE</span>

        {CORBEL_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className={run.user.role === role ? "is-active" : ""}
            onClick={() => setRole(role)}
          >
            {role}
          </button>
        ))}
      </div>

      <CorbelDashboard
        operation={run.operation}
        state={run.state}
        user={run.user}
        requirements={run.requirements}
        events={run.events}
        receipt={run.receipt}
        busy={busy}
        onDetectHazard={onDetectHazard}
        onAcceptOwnership={onAcceptOwnership}
        onSubmitEvidence={onSubmitEvidence}
        onApproveEvidence={(id) => verify(id, "APPROVED")}
        onRejectEvidence={(id) => verify(id, "REJECTED")}
        onResetDemo={onResetDemo}
      />
    </div>
  );
}
