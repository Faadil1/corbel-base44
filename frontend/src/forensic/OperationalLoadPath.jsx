import React from "react";

/**
 * OperationalLoadPath — continuous operational load path.
 * All segments render persistently; the solid carried path retracts via
 * stroke-dashoffset, the blunt cap fades, and downstream ghosts via channels.
 *
 * Props:
 *  - x, top, bottom, nodeYs: geometry
 *  - ch: { pathFrac, capY, capVis, releaseBlocked, downGhost }
 */
export default function OperationalLoadPath({ x, top, bottom, nodeYs, ch }) {
  const dashOffset = 1 - (ch.pathFrac ?? 1);
  const capY = ch.capY;
  const downGhost = ch.downGhost ?? 0;
  const exitGhosted = downGhost > 0.5;

  return (
    <g>
      {/* node tick marks */}
      {nodeYs.map((ny, i) => {
        const ghost = capY != null && ny > capY;
        return (
          <line
            key={i}
            x1={x - 8}
            y1={ny}
            x2={x + 8}
            y2={ny}
            stroke={ghost && exitGhosted ? "#8A9096" : "#1F4F8F"}
            strokeWidth={2}
            strokeDasharray={ghost && exitGhosted ? "2 2" : "none"}
            opacity={ghost ? 1 - 0.5 * downGhost : 1}
          />
        );
      })}

      {/* ghosted full path (always behind) */}
      <line x1={x} y1={top} x2={x} y2={bottom} stroke="#8A9096" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.5} />

      {/* solid carried path — retracts via dashoffset */}
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={bottom}
        stroke="#1F4F8F"
        strokeWidth={2}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={dashOffset}
      />

      {/* blunt cap (~12px) */}
      {capY != null && (
        <line className="fl-anim-opacity" x1={x - 6} y1={capY} x2={x + 6} y2={capY} stroke="#1F4F8F" strokeWidth={2} style={{ opacity: ch.capVis ?? 0 }} />
      )}

      {/* entry label */}
      <line x1={x} y1={top - 22} x2={x} y2={top} stroke="#1F4F8F" strokeWidth={2} />
      <text className="fl-svg-load-label" x={x} y={top - 30} textAnchor="middle">OPERATIONAL LOAD</text>

      {/* exit label */}
      <line
        x1={x}
        y1={bottom}
        x2={x}
        y2={bottom + 22}
        stroke={exitGhosted ? "#8A9096" : "#1F4F8F"}
        strokeWidth={2}
        strokeDasharray={exitGhosted ? "2 3" : "none"}
        opacity={exitGhosted ? 0.5 : 1}
      />
      <text className="fl-svg-release-label" x={x} y={bottom + 38} textAnchor="middle" fill={exitGhosted ? "#8A9096" : "#14181C"}>
        RELEASE
      </text>
      <text className="fl-svg-blocked fl-anim-opacity" x={x} y={bottom + 52} textAnchor="middle" style={{ opacity: ch.releaseBlocked ?? 0 }}>
        RELEASE BLOCKED
      </text>
    </g>
  );
}
