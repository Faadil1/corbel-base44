import React from "react";

/**
 * IndependentRestraint — morphing restraint representing independent verification.
 * restraint: 0 = open, 0.5 = half-closed, 1 = closed. ghosted: 0..1 (downstream).
 *
 * Props:
 *  - x0, x1, y: geometry
 *  - restraint: 0..1
 *  - ghosted: 0..1
 *  - verifier: { name, role } | null
 */
function segBounds(r) {
  if (r <= 0.5) {
    const p = r / 0.5;
    return [0.24 + (0.62 - 0.24) * p, 0.76 + (0.78 - 0.76) * p];
  }
  const p = (r - 0.5) / 0.5;
  return [0.62 + (1.0 - 0.62) * p, 0.78 + (1.0 - 0.78) * p];
}

export default function IndependentRestraint({ x0, x1, y, restraint, ghosted, verifier }) {
  const w = x1 - x0;
  const thick = 4;
  const r = restraint ?? 0;
  const g = ghosted ?? 0;
  const [leftEnd, rightStart] = segBounds(r);
  const color = r > 0.25 && r < 0.75 ? "#1F4F8F" : "#2C6349";

  let attr;
  if (g > 0.5) attr = "INACTIVE";
  else if (r < 0.25) attr = "OPEN — NOT VERIFIED";
  else if (r < 0.75) attr = `${verifier?.name ?? ""} · VERIFICATION PENDING`;
  else attr = `${verifier?.name ?? ""} · INDEPENDENT VERIFIER`;

  return (
    <g>
      <text className="fl-svg-dim" x={x0} y={y + 18}>INDEPENDENT RESTRAINT</text>

      {/* active restraint segments + attribution */}
      <g className="fl-anim-opacity" style={{ opacity: 1 - g }}>
        <rect x={x0} y={y - thick / 2} width={Math.max(0, leftEnd * w)} height={thick} fill={color} />
        <rect x={x0 + rightStart * w} y={y - thick / 2} width={Math.max(0, w - rightStart * w)} height={thick} fill={color} />
        <text className="fl-svg-attr" x={x1} y={y + 18} textAnchor="end">{attr}</text>
      </g>

      {/* ghosted (downstream inactive) */}
      <rect className="fl-anim-opacity" x={x0} y={y - thick / 2} width={w} height={thick} fill="none" stroke="#8A9096" strokeWidth={1} strokeDasharray="2 3" style={{ opacity: g * 0.5 }} />
      <text className="fl-svg-attr fl-anim-opacity" x={x1} y={y + 18} textAnchor="end" fill="#8A9096" style={{ opacity: g }}>INACTIVE</text>
    </g>
  );
}
