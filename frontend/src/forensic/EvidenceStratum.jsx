import React from "react";

/**
 * EvidenceStratum — inspection stratum beneath a member.
 * All variants render persistently; visibility driven by `op` opacity channels.
 *
 * Props:
 *  - x0, x1, y, h: geometry (full slot; compact slot is derived)
 *  - evidence: next/target evidence | null
 *  - prevEvidence: previous evidence (for fade-out) | null
 *  - op: { compact, full, void, dimmed, rejected, ghosted }
 */
const STATUS_FILL = { VERIFIED: "#2C6349", PENDING: "#1F4F8F", REJECTED: "#A8331C" };
const STATUS_LABEL = { VERIFIED: "VERIFIED", PENDING: "PENDING INDEPENDENT VERIFICATION", REJECTED: "REJECTED" };

function CompactStratum({ x0, y, h, w, evidence }) {
  const plateX = x0 + 8;
  const plateW = 36;
  const textX = plateX + plateW + 10;
  return (
    <g>
      <rect x={x0} y={y} width={w} height={h} fill="#E8E5DD" stroke="#8A9096" strokeWidth={1} />
      <rect x={plateX} y={y + 4} width={plateW} height={h - 8} fill="#F2F0EA" stroke="#8A9096" strokeWidth={1} />
      <text className="fl-svg-evidence-title" x={textX} y={y + 15} style={{ fontSize: 12 }}>{evidence.title}</text>
      <text className="fl-svg-evidence-meta" x={textX} y={y + 24} style={{ fontSize: 9 }}>
        {evidence.submittedBy} · {evidence.captureTimestamp.slice(11, 16)}
      </text>
    </g>
  );
}

function FullStratum({ x0, y, h, w, evidence }) {
  const plateX = x0 + 10;
  const plateW = 54;
  const textX = plateX + plateW + 14;
  const rejected = evidence.status === "REJECTED";
  const pH = rejected ? 28 : h - 12;
  const plateY = y + 6;
  return (
    <g>
      <rect x={x0} y={y} width={w} height={h} fill="#E8E5DD" stroke="#8A9096" strokeWidth={1} />
      <rect x={plateX} y={plateY} width={plateW} height={pH} fill="#F2F0EA" stroke="#8A9096" strokeWidth={1} />
      {[[plateX, plateY], [plateX + plateW, plateY], [plateX, plateY + pH], [plateX + plateW, plateY + pH]].map((p, i) => (
        <g key={i} stroke="#4A5158" strokeWidth={1}>
          <line x1={p[0] - 4} y1={p[1]} x2={p[0] + 4} y2={p[1]} />
          <line x1={p[0]} y1={p[1] - 4} x2={p[0]} y2={p[1] + 4} />
        </g>
      ))}
      <text className="fl-svg-evidence-title" x={textX} y={y + 20}>{evidence.title}</text>
      <text className="fl-svg-evidence-meta" x={textX} y={y + 35}>{evidence.type} · {evidence.submittedBy}</text>
      {!rejected && <text className="fl-svg-evidence-meta" x={textX} y={y + 47}>{evidence.captureTimestamp}</text>}
      <text className="fl-svg-state-mark" x={x0 + w - 8} y={y + 20} textAnchor="end" fill={STATUS_FILL[evidence.status] || "#4A5158"}>
        {STATUS_LABEL[evidence.status] || evidence.status}
      </text>
    </g>
  );
}

export default function EvidenceStratum({ x0, x1, y, h, evidence, prevEvidence, op }) {
  const w = x1 - x0;
  const o = op || {};
  const fullY = y;
  const fullH = h;
  const compY = y - 4;
  const compH = 26;

  return (
    <g>
      {/* dimmed (ownership failed) */}
      <rect className="fl-anim-opacity" x={x0} y={fullY} width={w} height={fullH} fill="none" stroke="#8A9096" strokeWidth={1} strokeDasharray="2 3" style={{ opacity: o.dimmed ?? 0 }} />

      {/* ochre evidence void */}
      <g className="fl-anim-opacity" style={{ opacity: o.void ?? 0 }}>
        <rect x={x0} y={fullY} width={w} height={fullH} fill="none" stroke="#7E6412" strokeWidth={4} />
        <text className="fl-svg-label" x={x0 + w / 2} y={fullY + fullH / 2 + 4} textAnchor="middle" fill="#7E6412">EVIDENCE REQUIRED</text>
      </g>

      {/* ghosted (downstream inactive) */}
      <rect className="fl-anim-opacity" x={x0} y={fullY} width={w} height={fullH} fill="none" stroke="#8A9096" strokeWidth={1} strokeDasharray="2 3" style={{ opacity: (o.ghosted ?? 0) * 0.5 }} />

      {/* compact present — previous (fade-out) */}
      {prevEvidence ? (
        <g className="fl-anim-opacity" style={{ opacity: o.compact ?? 0 }}>
          <CompactStratum x0={x0} y={compY} h={compH} w={w} evidence={prevEvidence} />
        </g>
      ) : null}

      {/* compact present — next */}
      {evidence ? (
        <g className="fl-anim-opacity" style={{ opacity: o.compact ?? 0 }}>
          <CompactStratum x0={x0} y={compY} h={compH} w={w} evidence={evidence} />
        </g>
      ) : null}

      {/* full present (affected detailed) + rejection overprint */}
      {evidence ? (
        <g className="fl-anim-opacity" style={{ opacity: o.full ?? 0 }}>
          <FullStratum x0={x0} y={fullY} h={fullH} w={w} evidence={evidence} />
          {evidence.status === "REJECTED" && (
            <g className="fl-anim-opacity" style={{ opacity: o.rejected ?? 0 }}>
              <line x1={x0 + 8} y1={fullY + 38} x2={x1 - 8} y2={fullY + 38} stroke="#A8331C" strokeWidth={1} />
              <text className="fl-svg-evidence-reason" x={x0 + 78} y={fullY + 49}>REJECTED — {evidence.rejectionReason}</text>
            </g>
          )}
        </g>
      ) : null}
    </g>
  );
}
