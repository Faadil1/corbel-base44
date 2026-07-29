import React, { useEffect, useState } from "react";
import ForensicLoadSection from "./ForensicLoadSection";
import RequirementDetail from "./RequirementDetail";
import EventTape from "./EventTape";
import ReleaseReceipt from "./ReleaseReceipt";
import "./corbel-handoff.css";

function statusClass(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("_", "-");
}

export default function CorbelDashboard({
  operation,
  state,
  user,
  requirements,
  events,
  receipt,
  busy = false,
  onDetectHazard,
  onAcceptOwnership,
  onSubmitEvidence,
  onApproveEvidence,
  onRejectEvidence,
  onResetDemo,
}) {
  const [selectedId, setSelectedId] = useState(requirements[0]?.id ?? null);

  useEffect(() => {
    if (!requirements.some((requirement) => requirement.id === selectedId)) {
      setSelectedId(requirements[0]?.id ?? null);
    }
  }, [requirements, selectedId]);

  const selected =
    requirements.find((requirement) => requirement.id === selectedId) ?? null;

  const unownedCount = requirements.filter(
    (requirement) => requirement.status === "UNOWNED"
  ).length;

  const canDetectHazard = Boolean(
    selected?.critical &&
      ["SATISFIED", "VERIFIED"].includes(selected.status) &&
      state !== "HOLD"
  );

  return (
    <div className={`corbel-root ${busy ? "is-busy" : ""}`}>
      <header className="corbel-header">
        <div className="corbel-header-brand">CORBEL</div>

        <div className="corbel-header-cells">
          <div className="corbel-cell">
            <span className="corbel-cell-k">OPERATION</span>
            <span className="corbel-cell-v">{operation.name}</span>
          </div>

          <div className="corbel-cell">
            <span className="corbel-cell-k">LOCATION</span>
            <span className="corbel-cell-v">{operation.location}</span>
          </div>

          <div className="corbel-cell">
            <span className="corbel-cell-k">USER</span>
            <span className="corbel-cell-v">{user.name}</span>
          </div>

          <div className="corbel-cell">
            <span className="corbel-cell-k">ROLE</span>
            <span className="corbel-cell-v">{user.role}</span>
          </div>

          <div className="corbel-cell">
            <span className="corbel-cell-k">LINK</span>
            <span className="corbel-cell-v corbel-link">LIVE</span>
          </div>
        </div>
      </header>

      <ForensicLoadSection
        runId={operation.runId}
        state={state}
        unownedCount={unownedCount}
        role={user.role}
        selectedRequirement={selected}
        canDetectHazard={canDetectHazard}
        canResetDemo={user.canResetDemo === true}
        busy={busy}
        onDetectHazard={() => selected && onDetectHazard(selected.id)}
        onResetDemo={onResetDemo}
      />

      <main className="corbel-main">
        <div className="corbel-main-left">
          <section className="corbel-register">
            <div className="corbel-register-head">
              <span>CRITICAL READINESS REGISTER</span>
              <span className="corbel-register-sub">
                {requirements.length} ITEMS · {unownedCount} UNOWNED
              </span>
            </div>

            <div className="corbel-register-scroll">
              <table className="corbel-register-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>REQUIREMENT</th>
                    <th>CATEGORY</th>
                    <th>STATUS</th>
                    <th>OWNER</th>
                    <th>EVIDENCE</th>
                    <th>VERIFICATION</th>
                  </tr>
                </thead>

                <tbody>
                  {requirements.map((requirement) => {
                    const unowned = requirement.status === "UNOWNED";
                    const ownerLabel = unowned
                      ? "UNOWNED"
                      : requirement.owner ?? "NOT REQUIRED";

                    return (
                      <tr
                        key={requirement.id}
                        className={`corbel-req-row ${
                          unowned ? "corbel-req-row--unowned" : ""
                        } ${requirement.id === selectedId ? "is-selected" : ""}`}
                        onClick={() => setSelectedId(requirement.id)}
                      >
                        <td className="corbel-cell-id">
                          {requirement.displayId ?? requirement.id}
                        </td>

                        <td>
                          {requirement.critical && <span className="corbel-dot" />}
                          {requirement.label}
                        </td>

                        <td className="corbel-cell-mono">
                          {requirement.category}
                        </td>

                        <td>
                          <span
                            className={`corbel-badge corbel-badge--${statusClass(
                              requirement.status
                            )}`}
                          >
                            {requirement.status}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              unowned
                                ? "corbel-owner-unowned"
                                : "corbel-owner"
                            }
                          >
                            {ownerLabel}
                          </span>
                        </td>

                        <td className="corbel-cell-num">
                          {requirement.evidence.length}
                        </td>

                        <td className="corbel-cell-mono">
                          {requirement.decision}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <RequirementDetail
            requirement={selected}
            role={user.role}
            currentUserId={user.id}
            busy={busy}
            onAcceptOwnership={onAcceptOwnership}
            onSubmitEvidence={onSubmitEvidence}
            onApproveEvidence={onApproveEvidence}
            onRejectEvidence={onRejectEvidence}
          />
        </div>

        <div className="corbel-main-right">
          <EventTape events={events} />
          <ReleaseReceipt receipt={receipt} />
        </div>
      </main>
    </div>
  );
}
