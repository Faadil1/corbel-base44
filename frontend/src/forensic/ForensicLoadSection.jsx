import React from "react";
import OperationalLoadPath from "./OperationalLoadPath";
import LoadBearingMember from "./LoadBearingMember";

/**
 * ForensicLoadSection — the dominant orthographic forensic elevation.
 * Transition motion is driven by the `channels` prop (see transition.js).
 *
 * Props:
 *  - state, requirements, channels, prevAffected
 *  - selectedRequirementId, onSelectRequirement, announcement
 */
const VB_W = 1000;
const VB_H = 780;
const PATH_X = 220;
const MEMBER_X0 = 220;
const MEMBER_X1 = 940;
const BEAM_YS = [150, 300, 450, 600];
const PATH_TOP = 96;
const PATH_BOTTOM = 730;

export default function ForensicLoadSection({
  requirements,
  channels,
  prevAffected,
  selectedRequirementId,
  onSelectRequirement,
  announcement,
}) {
  const selectedId = selectedRequirementId;

  return (
    <section className="fl-section" aria-label="Forensic load section">
      <div className="fl-visually-hidden" aria-live="polite">{announcement}</div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Orthographic forensic load section elevation">
        <defs>
          <pattern id="fl-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#C9C4B8" strokeWidth={0.5} />
          </pattern>
          <pattern id="fl-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#A8331C" strokeWidth={1} />
          </pattern>
        </defs>

        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#fl-grid)" />
        <rect x={8} y={8} width={VB_W - 16} height={VB_H - 16} fill="none" stroke="#14181C" strokeWidth={1} />
        <text className="fl-svg-id" x={16} y={28}>ELEVATION · 1:1 · ORTHOGRAPHIC</text>

        <OperationalLoadPath x={PATH_X} top={PATH_TOP} bottom={PATH_BOTTOM} nodeYs={BEAM_YS} ch={channels} />

        {requirements.map((m, i) => {
          const variant = i === 2 ? "affected" : i === 3 ? "downstream" : "stable";
          return (
            <LoadBearingMember
              key={m.id}
              member={m}
              x0={MEMBER_X0}
              x1={MEMBER_X1}
              beamY={BEAM_YS[i]}
              variant={variant}
              channels={channels}
              prevMember={variant === "affected" ? prevAffected : undefined}
              selected={m.id === selectedId}
              onSelect={onSelectRequirement}
            />
          );
        })}
      </svg>
    </section>
  );
}
