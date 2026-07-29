import React, { useState, useCallback, useRef } from "react";
import EngineeringTitleBlock from "./EngineeringTitleBlock";
import CriticalControlIndex from "./CriticalControlIndex";
import ForensicLoadSection from "./ForensicLoadSection";
import ForensicStateAnnotation from "./ForensicStateAnnotation";
import CustodyRail from "./CustodyRail";
import ReleaseReceiptRegister from "./ReleaseReceiptRegister";
import { getForensicState, FORENSIC_STATE_KEYS, FORENSIC_ROLES } from "./forensicSampleData";
import { useForensicTransition } from "./transition";
import "./forensic-load-section.css";

/**
 * Integration example — design-lab preview harness.
 *
 * NOTE: This is a verbatim copy of the approved `src/pages/ForensicPreview.jsx`
 * with one portability change: imports that used the Base44 `@/forensic/...`
 * alias have been remapped to relative `./...` paths so the package is
 * self-contained. No component logic, props, or markup was changed.
 *
 * In the destination project you will replace `getForensicState(...)` with
 * real production props from the CORBEL backend (see the handoff document,
 * §9 "Replacing sample props with production props").
 */
export default function ForensicPreview() {
  const [stateKey, setStateKey] = useState("READY");
  const [role, setRole] = useState(null); // null = use state default

  const data = getForensicState(stateKey, role || undefined);
  const [selectedId, setSelectedId] = useState(null);
  const onSelectRequirement = useCallback((id) => setSelectedId(id), []);

  const { channels, text, prevKey } = useForensicTransition(stateKey);
  const prevAffected = getForensicState(prevKey, role || undefined).requirements[2];

  // Retain the last release receipt so it can fade out when leaving RELEASED.
  const lastReceiptRef = useRef(null);
  if (data.receipt) lastReceiptRef.current = data.receipt;
  const receipt = lastReceiptRef.current;

  return (
    <div className="fl-root">
      <EngineeringTitleBlock operation={data.operation} user={data.user} />

      <div className="fl-layout">
        <CriticalControlIndex
          requirements={data.requirements}
          selectedId={selectedId}
          onSelectRequirement={onSelectRequirement}
        />

        <ForensicLoadSection
          requirements={data.requirements}
          channels={channels}
          prevAffected={prevAffected}
          selectedRequirementId={selectedId}
          onSelectRequirement={onSelectRequirement}
          announcement={data.announcement}
        />

        <aside className="fl-right-rail">
          <ForensicStateAnnotation
            prevText={text.prev}
            nextText={text.next}
            annoPrev={channels.annoPrev}
            annoNext={channels.annoNext}
          />
          <CustodyRail events={data.events} />
          <ReleaseReceiptRegister receipt={receipt} opacity={channels.receipt} />
        </aside>
      </div>

      <div className="fl-controls" role="group" aria-label="Design preview controls — not production">
        <span className="fl-controls-title">Design preview controls — not production</span>
        <div className="fl-controls-group">
          <span className="fl-controls-label">State</span>
          {FORENSIC_STATE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`fl-controls-btn ${k === stateKey ? "is-active" : ""}`}
              onClick={() => setStateKey(k)}
              aria-pressed={k === stateKey}
            >
              {k.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="fl-controls-group">
          <span className="fl-controls-label">Role</span>
          <button
            type="button"
            className={`fl-controls-btn ${role === null ? "is-active" : ""}`}
            onClick={() => setRole(null)}
            aria-pressed={role === null}
          >
            AUTO
          </button>
          {FORENSIC_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`fl-controls-btn ${role === r ? "is-active" : ""}`}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
            >
              {r.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
