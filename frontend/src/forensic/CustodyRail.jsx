import React from "react";

/**
 * CustodyRail — compact chain-of-custody ledger (right rail).
 *
 * Props:
 *  - events: Array<{ index, name, actor, role, prev, next, timestamp, hash }>
 */
function shortTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return ts;
  }
}

export default function CustodyRail({ events }) {
  return (
    <div className="fl-custody">
      <div className="fl-custody-title">Chain of custody</div>
      <div className="fl-custody-list" role="log" aria-label="Chain of custody ledger">
        {events.map((e) => (
          <div key={e.index} className="fl-custody-row">
            <div className="fl-custody-name">
              <span className="fl-custody-idx">{String(e.index).padStart(2, "0")} · </span>
              {e.name.replace(/_/g, " ")}
            </div>
            <div>{e.actor} · {e.role.replace(/_/g, " ")}</div>
            <div className="fl-custody-trans">{e.prev} → <b>{e.next}</b></div>
            <div>{shortTime(e.timestamp)} · #{e.hash}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
