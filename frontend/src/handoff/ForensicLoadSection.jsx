import React from "react";

const PRINCIPLE = "NOTHING PROCEEDS UNOWNED";
const STATES = ["READY", "HOLD", "VERIFYING", "RELEASED"];

export default function ForensicLoadSection({
  runId,
  state,
  unownedCount,
  role,
  selectedRequirement,
  canDetectHazard,
  canResetDemo,
  busy,
  onDetectHazard,
  onResetDemo,
}) {
  const alarm = state === "HOLD" && unownedCount > 0;

  return (
    <section className={`corbel-forensic corbel-forensic--${state}`}>
      {alarm && <div className="corbel-alarm" aria-hidden="true" />}

      <div className="corbel-forensic-inner">
        <div className="corbel-forensic-head">
          <span className="corbel-forensic-principle">{PRINCIPLE}</span>
          <span className="corbel-forensic-runid">RUN {runId}</span>
        </div>

        <div className="corbel-forensic-body">
          <div>
            <div className="corbel-forensic-label">CURRENT STATE</div>

            <div key={state} className={`corbel-state corbel-state--${state}`}>
              {state}
            </div>

            {alarm && (
              <div className="corbel-unowned-alert">
                {unownedCount} REQUIREMENT{unownedCount > 1 ? "S" : ""} UNOWNED
                {" — "}RELEASE BLOCKED
              </div>
            )}
          </div>

          <div className="corbel-state-rail">
            {STATES.map((railState) => (
              <div
                key={railState}
                className={`corbel-state-rail-item corbel-state-rail--${railState} ${
                  railState === state ? "is-active" : ""
                }`}
              >
                {railState}
              </div>
            ))}
          </div>
        </div>

        <div className="corbel-forensic-context">
          <span>SELECTED CONTROL</span>
          <strong>{selectedRequirement?.label ?? "NONE"}</strong>
        </div>

        <div className="corbel-forensic-actions">
          {role === "OPERATIONS_LEAD" && (
            <button
              type="button"
              className="corbel-btn corbel-btn--orange"
              onClick={onDetectHazard}
              disabled={!canDetectHazard || busy}
            >
              RAISE CRITICAL HAZARD
            </button>
          )}

          {canResetDemo && (
            <button
              type="button"
              className="corbel-btn corbel-btn--neutral"
              onClick={onResetDemo}
              disabled={busy}
            >
              CREATE FRESH APPEND-ONLY RUN
            </button>
          )}
        </div>
      </div>

      <div className={`corbel-forensic-bar corbel-forensic-bar--${state}`} />
    </section>
  );
}
