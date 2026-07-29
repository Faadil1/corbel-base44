import React from "react";

/**
 * OwnershipConnectionNode — ~18px ownership socket on the load path.
 * Renders every state variant persistently; visibility is driven by the
 * `op` opacity channels (no remounting between states).
 *
 * Props:
 *  - x, y: socket center (on the load path)
 *  - owner: { name, role } | null  (next/target identity)
 *  - prevOwner: { name, role } | null  (previous identity, for fade-out)
 *  - op: { seated, joint, cavity, ownerName, unowned, inactive }
 */
export default function OwnershipConnectionNode({ x, y, owner, prevOwner, op }) {
  const s = 18;
  const labelX = x - 16;
  const left = x - s / 2;
  const top = y - s / 2;
  const o = op || {};

  const OwnerGroup = ({ who }) => (
    <g>
      <text className="fl-svg-owner" x={labelX} y={y - 2} textAnchor="end">{who.name}</text>
      <text className="fl-svg-role" x={labelX} y={y + 12} textAnchor="end">{who.role.replace(/_/g, " ")}</text>
    </g>
  );

  return (
    <g>
      <line x1={labelX} y1={y} x2={left} y2={y} stroke="#8A9096" strokeWidth={1} />

      {/* transfer joint between load path and socket */}
      <rect className="fl-anim-opacity" x={x - 2} y={y - 16} width={4} height={7} fill="#0F1317" style={{ opacity: o.joint ?? 1 }} />

      {/* seated solid socket */}
      <rect className="fl-anim-opacity" x={left} y={top} width={s} height={s} fill="#0F1317" style={{ opacity: o.seated ?? 1 }} />

      {/* empty cavity — hollow + inner dashed */}
      <g className="fl-anim-opacity" style={{ opacity: o.cavity ?? 0 }}>
        <rect x={left} y={top} width={s} height={s} fill="none" stroke="#A8331C" strokeWidth={2} />
        <rect x={x - 5} y={y - 5} width={10} height={10} fill="none" stroke="#A8331C" strokeWidth={1} strokeDasharray="2 2" />
      </g>

      {/* inactive (ghosted downstream) */}
      <rect className="fl-anim-opacity" x={left} y={top} width={s} height={s} fill="none" stroke="#8A9096" strokeWidth={1.5} strokeDasharray="2 2" style={{ opacity: o.inactive ?? 0 }} />

      {/* owner identities (prev fades out, next fades in) */}
      {prevOwner ? (
        <g className="fl-anim-opacity" style={{ opacity: o.ownerName ?? 1 }}>
          <OwnerGroup who={prevOwner} />
        </g>
      ) : null}
      {owner ? (
        <g className="fl-anim-opacity" style={{ opacity: o.ownerName ?? 1 }}>
          <OwnerGroup who={owner} />
        </g>
      ) : null}

      {/* NO ACCOUNTABLE OWNER — anchored to the failed socket */}
      <text className="fl-svg-unowned fl-anim-opacity" x={labelX} y={y + 3} textAnchor="end" style={{ opacity: o.unowned ?? 0 }}>
        NO ACCOUNTABLE OWNER
      </text>

      {/* INACTIVE — downstream */}
      <text className="fl-svg-role fl-anim-opacity" x={labelX} y={y + 3} textAnchor="end" fill="#8A9096" style={{ opacity: o.inactive ?? 0 }}>
        INACTIVE
      </text>
    </g>
  );
}
