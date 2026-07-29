import React from "react";
import OwnershipConnectionNode from "./OwnershipConnectionNode";
import EvidenceStratum from "./EvidenceStratum";
import IndependentRestraint from "./IndependentRestraint";

/**
 * LoadBearingMember — one load-bearing member in the elevation.
 * All visual variants render persistently; visibility/transform driven by
 * the `channels` transition channels (no remounting between states).
 *
 * Props:
 *  - member, x0, x1, beamY
 *  - variant: "stable" | "affected" | "downstream"
 *  - channels: transition channel object
 *  - prevMember: previous affected member (affected variant only, for fade-out)
 *  - selected, onSelect
 */
export default function LoadBearingMember({ member, x0, x1, beamY, variant, channels, prevMember, selected, onSelect }) {
  const w = x1 - x0;
  const evX0 = x0 + 30;
  const evX1 = x1;
  const restraintY = beamY + 90;
  const evY = beamY + 20;
  const evH = 50;
  const ch = channels || {};

  let o;
  if (variant === "affected") {
    o = {
      deflect: ch.deflect, downGhost: 0, seated: ch.socketSeated, joint: ch.transferJoint,
      cavity: ch.cavity, ownerName: ch.ownerName, unowned: ch.cavity, inactive: 0,
      compact: ch.compactPresent, full: ch.fullPresent, void: ch.void, dimmed: ch.dimmed,
      rejected: ch.rejected, restraint: ch.restraint, ghosted: 0,
    };
  } else if (variant === "downstream") {
    o = {
      deflect: 0, downGhost: ch.downGhost, seated: 1 - ch.downGhost, joint: 1 - ch.downGhost,
      cavity: 0, ownerName: 1 - ch.downGhost, unowned: 0, inactive: ch.downGhost,
      compact: 1 - ch.downGhost, full: 0, void: 0, dimmed: 0, rejected: 0,
      restraint: 1, ghosted: ch.downGhost,
    };
  } else {
    o = {
      deflect: 0, downGhost: 0, seated: 1, joint: 1, cavity: 0, ownerName: 1, unowned: 0,
      inactive: 0, compact: 1, full: 0, void: 0, dimmed: 0, rejected: 0,
      restraint: 1, ghosted: 0,
    };
  }

  const label = (member.label || "").toUpperCase();
  const normalOpacity = Math.max(0, 1 - o.deflect - o.downGhost);
  const prevEvidence = variant === "affected" ? prevMember?.evidence : undefined;
  const prevOwner = variant === "affected" ? prevMember?.owner : undefined;

  return (
    <g className="fl-member-group" style={{ transform: `translateY(${3 * o.deflect}px)` }}>
      <text className="fl-svg-label" x={x0 + 30} y={beamY - 16}>{label}</text>
      <text className="fl-svg-id" x={x1} y={beamY - 16} textAnchor="end">{member.id} · {member.category}</text>

      {/* normal structural profile */}
      <g className="fl-anim-opacity" style={{ opacity: normalOpacity }}>
        <rect x={x0} y={beamY - 10} width={w} height={20} fill="none" stroke="#0F1317" strokeWidth={3} />
        <line x1={x0 + 14} y1={beamY} x2={x1 - 2} y2={beamY} stroke="#4A5158" strokeWidth={1} />
      </g>

      {/* unowned (oxide hatched) profile */}
      <g className="fl-anim-opacity" style={{ opacity: o.deflect }}>
        <rect x={x0} y={beamY - 10} width={w} height={20} fill="url(#fl-hatch)" stroke="#A8331C" strokeWidth={3} />
        <line x1={x0 + 14} y1={beamY} x2={x1 - 2} y2={beamY} stroke="#A8331C" strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      </g>

      {/* ghosted (downstream) profile */}
      <g className="fl-anim-opacity" style={{ opacity: o.downGhost }}>
        <rect x={x0} y={beamY - 10} width={w} height={20} fill="none" stroke="#8A9096" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
      </g>

      <OwnershipConnectionNode
        x={x0}
        y={beamY}
        owner={member.owner}
        prevOwner={prevOwner}
        op={{ seated: o.seated, joint: o.joint, cavity: o.cavity, ownerName: o.ownerName, unowned: o.unowned, inactive: o.inactive }}
      />

      <EvidenceStratum
        x0={evX0}
        x1={evX1}
        y={evY}
        h={evH}
        evidence={member.evidence}
        prevEvidence={prevEvidence}
        op={{ compact: o.compact, full: o.full, void: o.void, dimmed: o.dimmed, rejected: o.rejected, ghosted: o.ghosted }}
      />

      <IndependentRestraint x0={evX0} x1={evX1} y={restraintY} restraint={o.restraint} ghosted={o.downGhost} verifier={member.verifier} />

      {selected && <rect className="fl-selected-frame" x={x0 - 12} y={beamY - 22} width={w + 24} height={132} />}

      <rect
        className="fl-hit"
        x={x0 - 12}
        y={beamY - 22}
        width={w + 24}
        height={132}
        tabIndex={0}
        role="button"
        aria-label={`${member.label}. ${member.owner ? "Owner " + member.owner.name + "." : "No accountable owner."} Status ${member.status}.`}
        onClick={() => onSelect(member.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(member.id);
          }
        }}
      />
    </g>
  );
}
