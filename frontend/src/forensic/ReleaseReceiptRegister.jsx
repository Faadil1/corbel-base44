import React from "react";

/**
 * ReleaseReceiptRegister — technical custody-rail release receipt.
 * Rendered persistently; visibility driven by the `opacity` channel.
 * Copy affordances are UI-only.
 *
 * Field priority:
 *   1. RELEASED  2. Receipt ID  3. Independent verifier  4. Generated at
 *   5. Event count  6. Event-chain head hash  7. Receipt hash  8. Operation ID
 */
function groupHashLines(hex) {
  const clean = hex.replace(/\s+/g, "").toUpperCase();
  const half = Math.ceil(clean.length / 2);
  const fmt = (s) => s.match(/.{1,4}/g)?.join(" ") || s;
  return [fmt(clean.slice(0, half)), fmt(clean.slice(half))];
}

function CopyBtn({ value }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="fl-receipt-copy"
      onClick={() => {
        try {
          navigator.clipboard?.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* clipboard unavailable — UI affordance only */
        }
      }}
      aria-label="Copy hash"
    >
      {done ? "COPIED" : "COPY"}
    </button>
  );
}

function HashBlock({ label, value }) {
  const [a, b] = groupHashLines(value);
  return (
    <>
      <div className="fl-receipt-hash-label">
        {label} <CopyBtn value={value} />
      </div>
      <div className="fl-receipt-hash">{a}<br />{b}</div>
    </>
  );
}

export default function ReleaseReceiptRegister({ receipt, opacity = 1 }) {
  if (!receipt) return null;
  return (
    <div className="fl-receipt fl-anim-opacity" style={{ opacity }} aria-label="Release receipt">
      <div className="fl-receipt-title">Release receipt</div>
      <div className="fl-receipt-status">RELEASED</div>
      <div className="fl-receipt-row"><span className="fl-receipt-k">Receipt ID</span><span className="fl-receipt-v">{receipt.receiptId}</span></div>
      <div className="fl-receipt-row"><span className="fl-receipt-k">Independent verifier</span><span className="fl-receipt-v">{receipt.independentVerifier}</span></div>
      <div className="fl-receipt-row"><span className="fl-receipt-k">Generated at</span><span className="fl-receipt-v">{receipt.generatedAt}</span></div>
      <div className="fl-receipt-row"><span className="fl-receipt-k">Event count</span><span className="fl-receipt-v">{receipt.eventCount}</span></div>
      <HashBlock label="Event-chain head hash" value={receipt.eventChainHeadHash} />
      <HashBlock label="Receipt hash" value={receipt.receiptHash} />
      <div className="fl-receipt-row" style={{ marginTop: 8 }}>
        <span className="fl-receipt-k">Operation ID</span>
        <span className="fl-receipt-v">{receipt.operationId}</span>
      </div>
    </div>
  );
}
