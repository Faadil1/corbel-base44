import React, { useMemo } from "react";
import "./forensic-live-hero.css";

type AnyRecord = Record<string, any>;

type Props = {
  operation: AnyRecord;
  state: string;
  user: AnyRecord;
  requirements: AnyRecord[];
  events: AnyRecord[];
  receipt: AnyRecord | null;
};

const ORDER: Array<[RegExp, number]> = [
  [/\bcrew\b/i, 1],
  [/equipment/i, 2],
  [/fall protection|anchor/i, 3],
  [/supervisor/i, 4],
];

function canonicalOrder(requirement: AnyRecord): number {
  const id = String(requirement.displayId ?? "");
  const label = String(requirement.label ?? "");
  const explicit = Number(id.replace(/\D/g, ""));

  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const match = ORDER.find(([pattern]) => pattern.test(label));
  return match?.[1] ?? 99;
}

function statusKey(value: unknown): string {
  return String(value ?? "UNKNOWN")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-");
}

function isCarrying(requirement: AnyRecord): boolean {
  return ["SATISFIED", "VERIFIED"].includes(
    String(requirement.status ?? "").toUpperCase()
  );
}

function deriveVisualState(
  operationState: string,
  requirements: AnyRecord[]
): { word: string; qualifier: string; message: string } {
  const normalized = String(operationState ?? "READY").toUpperCase();

  if (normalized === "RELEASED") {
    return {
      word: "RELEASED",
      qualifier: "CHAIN VERIFIED",
      message: "Independent restraint closed. Operational load reaches release.",
    };
  }

  if (normalized === "VERIFYING") {
    return {
      word: "VERIFYING",
      qualifier: "EVIDENCE PRESENT",
      message: "Independent verification is still required before release.",
    };
  }

  if (normalized === "HOLD") {
    if (requirements.some((requirement) => requirement.status === "UNOWNED")) {
      return {
        word: "HOLD",
        qualifier: "UNOWNED",
        message: "A critical ownership socket is open. Release is blocked.",
      };
    }

    if (requirements.some((requirement) => requirement.status === "REJECTED")) {
      return {
        word: "HOLD",
        qualifier: "EVIDENCE REJECTED",
        message: "The evidence remains recorded, but the restraint is open.",
      };
    }

    return {
      word: "HOLD",
      qualifier: "OWNED",
      message: "Ownership restores accountability. Not readiness.",
    };
  }

  return {
    word: "READY",
    qualifier: "LOAD PATH CONTINUOUS",
    message: "All critical controls are carrying and release remains available.",
  };
}

function eventRole(type: unknown): string {
  switch (String(type ?? "").toUpperCase()) {
    case "HAZARD_DETECTED":
      return "OPERATIONS LEAD";
    case "OWNERSHIP_ACCEPTED":
      return "ACCOUNTABLE OWNER";
    case "EVIDENCE_SUBMITTED":
      return "EVIDENCE SUBMITTER";
    case "VERIFICATION_APPROVED":
    case "VERIFICATION_REJECTED":
      return "INDEPENDENT VERIFIER";
    default:
      return "RECORDED ACTOR";
  }
}

function evidenceLabel(requirement: AnyRecord): string {
  const latest = requirement.evidence?.[0];

  if (latest?.title) {
    return latest.title;
  }

  if (requirement.status === "SATISFIED") {
    return "CONTROL SATISFIED · VERIFICATION NOT REQUIRED";
  }

  if (requirement.status === "VERIFIED") {
    return "EVIDENCE VERIFIED";
  }

  if (requirement.status === "OWNED") {
    return "EVIDENCE REQUIRED";
  }

  if (requirement.status === "UNOWNED") {
    return "EVIDENCE SUSPENDED — OWNERSHIP FAILED";
  }

  return "NO EVIDENCE RECORDED";
}

export default function ForensicLiveHero({
  operation,
  state,
  user,
  requirements,
  events,
  receipt,
}: Props) {
  const ordered = useMemo(
    () => [...requirements].sort((a, b) => canonicalOrder(a) - canonicalOrder(b)),
    [requirements]
  );

  const visual = deriveVisualState(state, ordered);
  const blocked = visual.word !== "READY" && visual.word !== "RELEASED";

  const affectedIndex = Math.max(
    0,
    ordered.findIndex((requirement) => !isCarrying(requirement))
  );

  const activeFraction = blocked
    ? Math.max(0.16, Math.min(0.88, (affectedIndex + 0.45) / Math.max(ordered.length, 1)))
    : 1;

  const recentEvents = [...events].slice(0, 4);

  return (
    <section
      className={`corbel-forensic-live corbel-forensic-live--${statusKey(
        `${visual.word}-${visual.qualifier}`
      )}`}
      aria-label="CORBEL forensic load section"
      style={{ "--cfl-active-fraction": activeFraction } as React.CSSProperties}
    >
      <header className="cfl-title-block">
        <div className="cfl-title-brand">
          <span>SYSTEM</span>
          <strong>CORBEL</strong>
        </div>
        <div className="cfl-title-cell cfl-title-cell--wide">
          <span>DRAWING</span>
          <strong>{operation.location ?? operation.name}</strong>
        </div>
        <div className="cfl-title-cell">
          <span>OPERATION</span>
          <strong>{operation.name}</strong>
        </div>
        <div className="cfl-title-cell">
          <span>RUN ID</span>
          <strong>{operation.runId ?? operation.id}</strong>
        </div>
        <div className="cfl-title-cell">
          <span>AUTHORITATIVE STATE</span>
          <strong>{state}</strong>
        </div>
        <div className="cfl-title-cell">
          <span>AUTHENTICATED ROLE</span>
          <strong>{user.role}</strong>
        </div>
      </header>

      <div className="cfl-layout">
        <nav className="cfl-control-index" aria-label="Critical control index">
          <div className="cfl-rail-heading">CRITICAL CONTROL INDEX</div>
          {ordered.map((requirement, index) => {
            const affected = blocked && index === affectedIndex;
            return (
              <div
                key={requirement.id}
                className={`cfl-index-item ${affected ? "is-affected" : ""}`}
              >
                <div>
                  <span>{requirement.displayId ?? `R-${String(index + 1).padStart(2, "0")}`}</span>
                  <em>{requirement.status}</em>
                </div>
                <strong>{requirement.label}</strong>
              </div>
            );
          })}
        </nav>

        <div className="cfl-drawing">
          <div className="cfl-drawing-meta">
            <span>ELEVATION · LIVE · ORTHOGRAPHIC</span>
            <span>NOTHING PROCEEDS UNOWNED</span>
          </div>

          <div className="cfl-load-field">
            <div className="cfl-path cfl-path--ghost" />
            <div className="cfl-path cfl-path--active" />
            {blocked && <div className="cfl-path-cap" />}
            <div className="cfl-load-label">OPERATIONAL LOAD</div>

            <div className="cfl-members">
              {ordered.map((requirement, index) => {
                const status = String(requirement.status ?? "UNKNOWN").toUpperCase();
                const affected = blocked && index === affectedIndex;
                const downstream = blocked && index > affectedIndex;
                const owner = requirement.owner ?? (status === "UNOWNED" ? null : "NOT REQUIRED");
                const verification = requirement.decision ?? "PENDING";

                return (
                  <article
                    key={requirement.id}
                    className={`cfl-member cfl-member--${statusKey(status)} ${
                      affected ? "is-affected" : ""
                    } ${downstream ? "is-downstream" : ""}`}
                  >
                    <div className="cfl-owner-zone">
                      <div className={`cfl-socket ${owner ? "is-seated" : "is-empty"}`}>
                        <span />
                      </div>
                      <div className="cfl-owner-copy">
                        <strong>{owner ?? "NO ACCOUNTABLE OWNER"}</strong>
                        <span>{owner ? "ACCOUNTABLE OWNER" : "RELEASE BLOCKED"}</span>
                      </div>
                    </div>

                    <div className="cfl-member-zone">
                      <div className="cfl-member-heading">
                        <strong>{requirement.label}</strong>
                        <span>{requirement.displayId ?? `R-${String(index + 1).padStart(2, "0")}`} · {requirement.category}</span>
                      </div>
                      <div className="cfl-profile"><span /></div>
                      <div className="cfl-evidence-stratum">
                        <strong>{evidenceLabel(requirement)}</strong>
                        <span>{verification}</span>
                      </div>
                      <div className={`cfl-restraint cfl-restraint--${statusKey(status)}`}>
                        <span />
                        <em>
                          {status === "EVIDENCE_SUBMITTED"
                            ? "PENDING INDEPENDENT VERIFICATION"
                            : status === "REJECTED"
                              ? "OPEN — NOT VERIFIED"
                              : ["SATISFIED", "VERIFIED"].includes(status)
                                ? "INDEPENDENT RESTRAINT CLOSED"
                                : "OPEN — NOT VERIFIED"}
                        </em>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={`cfl-release ${blocked ? "is-blocked" : ""}`}>
              <strong>RELEASE</strong>
              <span>{blocked ? "RELEASE BLOCKED" : "LOAD PATH CONTINUOUS"}</span>
            </div>
          </div>
        </div>

        <aside className="cfl-custody-rail">
          <div className="cfl-state-block">
            <strong>{visual.word}</strong>
            <span>{visual.qualifier}</span>
            <p>{visual.message}</p>
          </div>

          <div className="cfl-custody-block">
            <div className="cfl-rail-heading">CHAIN OF CUSTODY</div>
            {recentEvents.map((event, index) => (
              <div key={event.id ?? index} className="cfl-event">
                <strong>{String(index + 1).padStart(2, "0")} · {event.type}</strong>
                <span>{event.actor} · {eventRole(event.type)}</span>
                <span>{event.prev} → {event.next}</span>
                <code>{event.hash}</code>
              </div>
            ))}
          </div>

          {receipt && (
            <div className="cfl-receipt">
              <div className="cfl-rail-heading">RELEASE RECEIPT</div>
              <strong>RELEASED</strong>
              <span>{receipt.runId}</span>
              <span>{receipt.releasedBy}</span>
              <code>{receipt.finalHash}</code>
            </div>
          )}
        </aside>
      </div>

      <footer className="cfl-footer-note">
        LIVE FORENSIC VIEW · FULL REGISTER, ACTIONS, EVENT TAPE AND RECEIPT CONTINUE BELOW
      </footer>
    </section>
  );
}
