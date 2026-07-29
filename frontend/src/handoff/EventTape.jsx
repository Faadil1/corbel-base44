import React from "react";

export default function EventTape({ events }) {
  return (
    <section className="corbel-tape">
      <div className="corbel-tape-head">
        <span>IMMUTABLE EVENT TAPE</span>
        <span className="corbel-tape-count">APPEND-ONLY · {events.length}</span>
      </div>

      <div className="corbel-tape-list">
        {events.length === 0 && (
          <div className="corbel-tape-empty">NO EVENTS RECORDED</div>
        )}

        {events.map((event) => (
          <div key={event.id} className="corbel-tape-item">
            <div className="corbel-tape-row1">
              <span className="corbel-tape-type">{event.type}</span>
              <span className="corbel-tape-time">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="corbel-tape-row2">
              <span>ACTOR {event.actor}</span>
              <span className="corbel-tape-trans">
                {event.prev} → <b>{event.next}</b>
              </span>
              <span className="corbel-tape-hash">#{event.hash}</span>
            </div>

            {event.message && (
              <div className="corbel-tape-message">{event.message}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
