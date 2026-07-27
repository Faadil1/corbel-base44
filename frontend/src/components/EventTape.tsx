import React from 'react';

interface Event {
  id: string;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

interface EventTapeProps {
  events: Event[];
}

export function EventTape({ events }: EventTapeProps) {
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (events.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
        No events yet
      </div>
    );
  }

  return (
    <div className="corbel-event-tape">
      {events.map((event) => (
        <div key={event.id} className="corbel-event">
          <div className="corbel-event-time">{formatTime(event.createdAt)}</div>
          <div className="corbel-event-type">{event.eventType}</div>
          <div className="corbel-event-message">{event.message}</div>
        </div>
      ))}
    </div>
  );
}
