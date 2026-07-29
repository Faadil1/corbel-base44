import React from "react";


function normalizeRole(value) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function statusClass(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("_", "-");
}

export default function RequirementDetail({
  requirement,
  role,
  currentUserId,
  busy,
  onAcceptOwnership,
  onSubmitEvidence,
  onApproveEvidence,
  onRejectEvidence,
}) {
  if (!requirement) {
    return (
      <div className="corbel-detail corbel-detail--empty">
        SELECT A REQUIREMENT TO INSPECT
      </div>
    );
  }

  const normalizedRole = normalizeRole(role);
  const unowned = requirement.status === "UNOWNED";
  const canSubmit =
    normalizedRole === "ACCOUNTABLE_OWNER" &&
    ["OWNED", "REJECTED"].includes(requirement.status) &&
    requirement.ownerUserId === currentUserId;

  const canVerify =
    normalizedRole === "INDEPENDENT_VERIFIER" &&
    requirement.status === "EVIDENCE_SUBMITTED" &&
    requirement.latestEvidenceId;

  return (
    <div className={`corbel-detail ${unowned ? "corbel-detail--unowned" : ""}`}>
      <div className="corbel-detail-head">
        <span className="corbel-detail-id">
          {requirement.displayId ?? requirement.id}
        </span>

        {requirement.critical && (
          <span className="corbel-tag corbel-tag--critical">CRITICAL</span>
        )}

        <span
          className={`corbel-tag corbel-tag--${statusClass(
            requirement.status
          )}`}
        >
          {requirement.status}
        </span>
      </div>

      <div className="corbel-detail-label">{requirement.label}</div>

      <div className="corbel-detail-meta">
        <div>
          <span className="corbel-meta-k">CATEGORY</span>
          <span className="corbel-meta-v">{requirement.category}</span>
        </div>

        <div>
          <span className="corbel-meta-k">OWNER</span>
          <span className={unowned ? "corbel-owner-unowned" : "corbel-meta-v"}>
            {unowned ? "UNOWNED" : requirement.owner ?? "NOT REQUIRED"}
          </span>
        </div>

        <div>
          <span className="corbel-meta-k">VERIFICATION</span>
          <span className="corbel-meta-v">{requirement.decision}</span>
        </div>
      </div>

      <div className="corbel-detail-evidence">
        <div className="corbel-detail-evidence-head">
          EVIDENCE · {requirement.evidence.length}
        </div>

        <ul className="corbel-evidence-list">
          {requirement.evidence.map((evidence) => (
            <li key={evidence.id} className="corbel-evidence-item">
              <span className="corbel-evidence-title">{evidence.title}</span>
              <span className="corbel-evidence-by">{evidence.submittedBy}</span>
              <span
                className={`corbel-evidence-status corbel-evidence-status--${statusClass(
                  evidence.status
                )}`}
              >
                {evidence.status}
              </span>
            </li>
          ))}

          {requirement.evidence.length === 0 && (
            <li className="corbel-evidence-empty">NO EVIDENCE SUBMITTED</li>
          )}
        </ul>
      </div>

      <div className="corbel-detail-actions">
        {normalizedRole === "ACCOUNTABLE_OWNER" && unowned && (
          <button
            type="button"
            className="corbel-btn corbel-btn--green"
            onClick={() => onAcceptOwnership(requirement.id)}
            disabled={busy}
          >
            ASSUME OWNERSHIP
          </button>
        )}

        {canSubmit && (
          <button
            type="button"
            className="corbel-btn corbel-btn--blue"
            onClick={() => onSubmitEvidence(requirement.id)}
            disabled={busy}
          >
            SUBMIT EVIDENCE
          </button>
        )}

        {canVerify && (
          <>
            <button
              type="button"
              className="corbel-btn corbel-btn--green"
              onClick={() => onApproveEvidence(requirement.id)}
              disabled={busy}
            >
              APPROVE EVIDENCE
            </button>

            <button
              type="button"
              className="corbel-btn corbel-btn--orange"
              onClick={() => onRejectEvidence(requirement.id)}
              disabled={busy}
            >
              REJECT EVIDENCE
            </button>
          </>
        )}
      </div>
    </div>
  );
}
