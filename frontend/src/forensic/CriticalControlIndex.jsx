import React from "react";

const STATUS_LABEL = {
  SATISFIED: "SATISFIED",
  UNOWNED: "UNOWNED",
  OWNED: "OWNED",
  EVIDENCE_SUBMITTED: "EVIDENCE SUB",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
};

const STATUS_CLASS = {
  SATISFIED: "fl-index-status--verified",
  VERIFIED: "fl-index-status--verified",
  UNOWNED: "fl-index-status--unowned",
  OWNED: "",
  EVIDENCE_SUBMITTED: "fl-index-status--evidence_submitted",
  REJECTED: "fl-index-status--rejected",
};

/**
 * CriticalControlIndex — compact critical-control index (left rail).
 *
 * Props:
 *  - requirements: Requirement[]
 *  - selectedId: string | null
 *  - onSelectRequirement: (id) => void
 */
export default function CriticalControlIndex({ requirements, selectedId, onSelectRequirement }) {
  return (
    <nav className="fl-index" aria-label="Critical control index">
      <div className="fl-index-title">Critical control index</div>
      {requirements.map((r) => {
        const st = STATUS_LABEL[r.status] || r.status;
        const cls = STATUS_CLASS[r.status] || "";
        const selected = r.id === selectedId;
        return (
          <button
            key={r.id}
            type="button"
            className={`fl-index-item ${selected ? "is-selected" : ""}`}
            onClick={() => onSelectRequirement(r.id)}
            aria-pressed={selected}
            aria-label={`${r.label}, status ${st}${!r.owner ? ", unowned" : ""}`}
          >
            <div className="fl-index-row">
              <span className="fl-index-id">{r.id}</span>
              <span className={`fl-index-status ${cls}`}>{st}</span>
            </div>
            <div className="fl-index-label">{r.label}</div>
          </button>
        );
      })}
    </nav>
  );
}
