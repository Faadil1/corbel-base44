import React, { useEffect, useState } from "react";
import EngineeringTitleBlock from "../forensic/EngineeringTitleBlock";
import CriticalControlIndex from "../forensic/CriticalControlIndex";
import ForensicLoadSection from "../forensic/ForensicLoadSection";
import ForensicStateAnnotation from "../forensic/ForensicStateAnnotation";
import CustodyRail from "../forensic/CustodyRail";
import ReleaseReceiptRegister from "../forensic/ReleaseReceiptRegister";
import "../forensic/forensic-load-section.css";

function deriveForensicStateKey(operationState, requirements, receipt) {
  if (operationState === "RELEASED" && receipt) {
    return "RELEASED";
  }

  if (operationState === "VERIFYING") {
    return "VERIFYING";
  }

  if (operationState === "HOLD") {
    const hasRejected = requirements.some((r) => r.status === "REJECTED");
    if (hasRejected) {
      return "REJECTED";
    }

    const unownedCount = requirements.filter((r) => r.status === "UNOWNED").length;
    if (unownedCount > 0) {
      return "HOLD_UNOWNED";
    }

    return "HOLD_OWNED";
  }

  return "READY";
}

function adaptRequirementForensic(requirement, index) {
  return {
    id: requirement.id,
    label: requirement.label,
    category: requirement.category,
    status: requirement.status,
    owner:
      requirement.status === "UNOWNED"
        ? null
        : requirement.owner ?? null,
    verifier: null,
    evidence:
      requirement.status === "EVIDENCE_SUBMITTED"
        ? {
            title: `Evidence · ${requirement.evidence?.[0]?.title ?? "Submitted"}`,
            type: "Evidence",
            submittedBy: requirement.evidence?.[0]?.submittedBy ?? "Unknown",
            captureTimestamp: requirement.evidence?.[0]?.submittedAt ?? new Date().toISOString(),
            status: "PENDING",
          }
        : requirement.status === "VERIFIED" && requirement.evidence?.[0]
          ? {
              title: `Evidence · ${requirement.evidence[0].title}`,
              type: "Evidence",
              submittedBy: requirement.evidence[0].submittedBy ?? "Unknown",
              captureTimestamp: requirement.evidence[0].submittedAt ?? new Date().toISOString(),
              status: "VERIFIED",
            }
          : requirement.status === "REJECTED" && requirement.evidence?.[0]
            ? {
                title: `Evidence · ${requirement.evidence[0].title}`,
                type: "Evidence",
                submittedBy: requirement.evidence[0].submittedBy ?? "Unknown",
                captureTimestamp: requirement.evidence[0].submittedAt ?? new Date().toISOString(),
                status: "REJECTED",
                rejectionReason: "Evidence rejected during verification",
              }
            : null,
    restraint:
      requirement.status === "SATISFIED" || requirement.status === "VERIFIED"
        ? "closed"
        : requirement.status === "EVIDENCE_SUBMITTED"
          ? "half"
          : "open",
    verified:
      requirement.status === "VERIFIED" ||
      requirement.status === "SATISFIED",
  };
}

function adaptReceiptForensic(receipt) {
  if (!receipt) return null;

  return {
    receiptId: receipt.runId ?? "RC-UNKNOWN",
    operationId: receipt.runId ?? "OP-UNKNOWN",
    releaseStatus: "RELEASED",
    generatedAt: receipt.releasedAt ?? new Date().toISOString(),
    eventCount: receipt.eventCount ?? 0,
    eventChainHeadHash: receipt.finalHash ?? "HASH-UNKNOWN",
    receiptHash: receipt.finalHash ?? "HASH-UNKNOWN",
    independentVerifier: receipt.releasedBy ?? "SYSTEM",
  };
}

function adaptEventForensic(event) {
  return {
    index: event.id,
    name: event.type,
    actor: event.actor,
    role: "UNKNOWN",
    prev: event.prev,
    next: event.next,
    timestamp: event.timestamp,
    hash: event.hash,
  };
}

function RequirementDetailPanel({
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
    return null;
  }

  const normalizedRole = String(role ?? "")
    .replace(/[​-‍﻿]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const unowned = requirement.status === "UNOWNED";
  const canSubmit =
    normalizedRole === "ACCOUNTABLE_OWNER" &&
    ["OWNED", "REJECTED"].includes(requirement.status) &&
    requirement.ownerUserId === currentUserId;

  const canVerify =
    normalizedRole === "INDEPENDENT_VERIFIER" &&
    requirement.status === "EVIDENCE_SUBMITTED" &&
    requirement.latestEvidenceId;

  const actionButtons = [];

  if (normalizedRole === "ACCOUNTABLE_OWNER" && unowned) {
    actionButtons.push(
      <button
        key="accept"
        type="button"
        style={{
          padding: "4px 8px",
          border: "1px solid #4A5158",
          backgroundColor: "transparent",
          color: "#0F1317",
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
        onClick={() => onAcceptOwnership(requirement.id)}
        disabled={busy}
      >
        ASSUME OWNERSHIP
      </button>
    );
  }

  if (canSubmit) {
    actionButtons.push(
      <button
        key="submit"
        type="button"
        style={{
          padding: "4px 8px",
          border: "1px solid #4A5158",
          backgroundColor: "transparent",
          color: "#0F1317",
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
        onClick={() => onSubmitEvidence(requirement.id)}
        disabled={busy}
      >
        SUBMIT EVIDENCE
      </button>
    );
  }

  if (canVerify) {
    actionButtons.push(
      <button
        key="approve"
        type="button"
        style={{
          padding: "4px 8px",
          border: "1px solid #4A5158",
          backgroundColor: "transparent",
          color: "#0F1317",
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
        onClick={() => onApproveEvidence(requirement.id)}
        disabled={busy}
      >
        APPROVE EVIDENCE
      </button>
    );

    actionButtons.push(
      <button
        key="reject"
        type="button"
        style={{
          padding: "4px 8px",
          border: "1px solid #A8331C",
          backgroundColor: "transparent",
          color: "#A8331C",
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
        onClick={() => onRejectEvidence(requirement.id)}
        disabled={busy}
      >
        REJECT EVIDENCE
      </button>
    );
  }

  if (actionButtons.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        borderTop: "1px solid #C9C4B8",
        padding: "12px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {actionButtons}
    </div>
  );
}

const STATE_TEXT = {
  READY: {
    word: "READY",
    qualifier: "",
    sentence: "All ownership nodes named. Load path continuous to release.",
  },
  HOLD_UNOWNED: {
    word: "HOLD",
    qualifier: "UNOWNED",
    sentence: "No accountable owner assigned. Release blocked.",
  },
  HOLD_OWNED: {
    word: "HOLD",
    qualifier: "OWNED",
    sentence: "Ownership assigned. Evidence required before release.",
  },
  VERIFYING: {
    word: "VERIFYING",
    qualifier: "",
    sentence: "Evidence submitted. Independent verification in progress.",
  },
  RELEASED: {
    word: "RELEASED",
    qualifier: "",
    sentence: "Operation released. All critical controls verified.",
  },
  REJECTED: {
    word: "HOLD",
    qualifier: "EVIDENCE REJECTED",
    sentence: "Submitted evidence was rejected. Resubmission required.",
  },
};

export default function CorbelDashboard({
  operation,
  state,
  user,
  requirements,
  events,
  receipt,
  busy = false,
  onDetectHazard,
  onAcceptOwnership,
  onSubmitEvidence,
  onApproveEvidence,
  onRejectEvidence,
  onResetDemo,
}) {
  const [selectedId, setSelectedId] = useState(requirements[0]?.id ?? null);

  useEffect(() => {
    if (!requirements.some((requirement) => requirement.id === selectedId)) {
      setSelectedId(requirements[0]?.id ?? null);
    }
  }, [requirements, selectedId]);

  const selected =
    requirements.find((requirement) => requirement.id === selectedId) ?? null;

  const forensicStateKey = deriveForensicStateKey(state, requirements, receipt);
  const stateText = STATE_TEXT[forensicStateKey] || STATE_TEXT.READY;

  const forensicRequirements = requirements.map((r, idx) =>
    adaptRequirementForensic(r, idx)
  );

  const forensicReceipt = adaptReceiptForensic(receipt);
  const forensicEvents = events.map(adaptEventForensic);

  const unownedCount = requirements.filter(
    (requirement) => requirement.status === "UNOWNED"
  ).length;

  const selected_forensic = forensicRequirements.find(
    (r) => r.id === selectedId
  );

  const canDetectHazard = Boolean(
    selected?.critical &&
      ["SATISFIED", "VERIFIED"].includes(selected.status) &&
      state !== "HOLD"
  );

  const canResetDemo = user.canResetDemo === true;

  const stateChannels = {
    READY: { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:1, capY:null, capVis:0, releaseBlocked:0, downGhost:0, deflect:0, dimmed:0, void:0, compactPresent:1, fullPresent:0, rejected:0, restraint:1, receipt:0, annoPrev:0, annoNext:1 },
    HOLD_UNOWNED: { ownerName:0, socketSeated:0, transferJoint:0, cavity:1, pathFrac:0.45, capY:450, capVis:1, releaseBlocked:1, downGhost:1, deflect:1, dimmed:1, void:0, compactPresent:0, fullPresent:0, rejected:0, restraint:0, receipt:0, annoPrev:0, annoNext:1 },
    HOLD_OWNED: { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:0.466, capY:466, capVis:1, releaseBlocked:1, downGhost:1, deflect:0, dimmed:0, void:1, compactPresent:0, fullPresent:0, rejected:0, restraint:0, receipt:0, annoPrev:0, annoNext:1 },
    VERIFYING: { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:0.466, capY:466, capVis:1, releaseBlocked:1, downGhost:1, deflect:0, dimmed:0, void:0, compactPresent:0, fullPresent:1, rejected:0, restraint:0.5, receipt:0, annoPrev:0, annoNext:1 },
    RELEASED: { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:1, capY:null, capVis:0, releaseBlocked:0, downGhost:0, deflect:0, dimmed:0, void:0, compactPresent:0, fullPresent:1, rejected:0, restraint:1, receipt:1, annoPrev:0, annoNext:1 },
    REJECTED: { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:0.466, capY:466, capVis:1, releaseBlocked:1, downGhost:1, deflect:0, dimmed:0, void:0, compactPresent:0, fullPresent:1, rejected:1, restraint:0, receipt:0, annoPrev:0, annoNext:1 },
  };

  const channels = stateChannels[forensicStateKey] || stateChannels.READY;

  return (
    <div className={`fl-root ${busy ? "is-busy" : ""}`}>
      <EngineeringTitleBlock
        operation={{
          operationId: operation.id,
          runId: operation.runId,
          revision: "LIVE",
          drawing: operation.name || "CORBEL Operation",
          state: state,
          lastAuthoritativeUpdate: new Date().toISOString(),
        }}
        user={{
          name: user.name,
          role: user.role,
        }}
      />

      <div className="fl-layout">
        <CriticalControlIndex
          requirements={forensicRequirements}
          selectedId={selectedId}
          onSelectRequirement={setSelectedId}
        />

        <ForensicLoadSection
          requirements={forensicRequirements}
          channels={channels}
          prevAffected={null}
          selectedRequirementId={selectedId}
          onSelectRequirement={setSelectedId}
          announcement={`Operation state: ${forensicStateKey}`}
        />

        <aside className="fl-right-rail">
          <ForensicStateAnnotation
            prevText={stateText}
            nextText={stateText}
            annoPrev={0}
            annoNext={1}
          />
          <CustodyRail events={forensicEvents} />
          <ReleaseReceiptRegister receipt={forensicReceipt} opacity={channels.receipt} />
          <RequirementDetailPanel
            requirement={selected}
            role={user.role}
            currentUserId={user.id}
            busy={busy}
            onAcceptOwnership={onAcceptOwnership}
            onSubmitEvidence={onSubmitEvidence}
            onApproveEvidence={onApproveEvidence}
            onRejectEvidence={onRejectEvidence}
          />
        </aside>
      </div>

      <div style={{
        padding: "12px 14px",
        borderTop: "1px solid #C9C4B8",
        backgroundColor: "#E8E5DD",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
      }}>
        {user.role === "OPERATIONS_LEAD" && (
          <button
            type="button"
            style={{
              padding: "4px 8px",
              border: "1px solid #4A5158",
              backgroundColor: "transparent",
              color: "#0F1317",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
            onClick={() => selected && onDetectHazard(selected.id)}
            disabled={!canDetectHazard || busy}
          >
            RAISE CRITICAL HAZARD
          </button>
        )}

        {canResetDemo && (
          <button
            type="button"
            style={{
              padding: "4px 8px",
              border: "1px solid #4A5158",
              backgroundColor: "transparent",
              color: "#0F1317",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
            onClick={onResetDemo}
            disabled={busy}
          >
            CREATE FRESH RUN
          </button>
        )}
      </div>
    </div>
  );
}
