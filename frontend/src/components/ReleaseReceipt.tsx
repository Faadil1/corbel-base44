import React from 'react';

interface Event {
  id: string;
  eventType: string;
  message: string;
  timestamp: string;
}

interface Receipt {
  receipt: {
    operationId: string;
    receiptHash: string;
    generatedAt: string;
  };
  events: Event[];
  summary: {
    operationName: string;
    operationLocation: string;
    finalState: string;
    totalEvents: number;
    receiptHash: string;
    generatedAt: string;
  };
}

interface ReleaseReceiptProps {
  receipt: Receipt;
  onClose: () => void;
}

export function ReleaseReceipt({ receipt, onClose }: ReleaseReceiptProps) {
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="corbel-modal-overlay">
      <div className="corbel-modal">
        <button className="corbel-modal-close" onClick={onClose}>
          ✕
        </button>

        <div className="corbel-receipt">
          <div className="corbel-receipt-title">✓ RELEASE RECEIPT</div>

          <div className="corbel-receipt-meta">
            <div className="corbel-receipt-meta-item">
              <div className="corbel-receipt-meta-label">Operation</div>
              <div className="corbel-receipt-meta-value">{receipt.summary.operationName}</div>
            </div>
            <div className="corbel-receipt-meta-item">
              <div className="corbel-receipt-meta-label">Location</div>
              <div className="corbel-receipt-meta-value">{receipt.summary.operationLocation}</div>
            </div>
            <div className="corbel-receipt-meta-item">
              <div className="corbel-receipt-meta-label">Final State</div>
              <div className="corbel-receipt-meta-value">{receipt.summary.finalState}</div>
            </div>
            <div className="corbel-receipt-meta-item">
              <div className="corbel-receipt-meta-label">Generated At</div>
              <div className="corbel-receipt-meta-value">{formatTime(receipt.summary.generatedAt)}</div>
            </div>
            <div className="corbel-receipt-meta-item">
              <div className="corbel-receipt-meta-label">Receipt Hash</div>
              <div className="corbel-receipt-meta-value">{receipt.summary.receiptHash.substring(0, 32)}...</div>
            </div>
            <div className="corbel-receipt-meta-item">
              <div className="corbel-receipt-meta-label">Total Events</div>
              <div className="corbel-receipt-meta-value">{receipt.summary.totalEvents}</div>
            </div>
          </div>

          <div className="corbel-receipt-events">
            <div className="corbel-receipt-events-title">Event Chain</div>
            {receipt.events.map((event, index) => (
              <div key={event.id} className="corbel-receipt-event-item">
                <div className="corbel-receipt-event-time">
                  {index + 1}. {formatTime(event.timestamp)}
                </div>
                <div className="corbel-receipt-event-message">{event.message}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="corbel-button primary" onClick={onClose} style={{ marginTop: '16px', width: '100%' }}>
          Close Receipt
        </button>
      </div>
    </div>
  );
}
