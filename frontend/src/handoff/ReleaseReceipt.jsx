import React from "react";

export default function ReleaseReceipt({ receipt }) {
  if (!receipt) {
    return (
      <section className="corbel-receipt corbel-receipt--empty">
        <div className="corbel-receipt-head">RELEASE RECEIPT</div>
        <div className="corbel-receipt-empty">NO RELEASE RECEIPT RECORDED</div>
      </section>
    );
  }

  const Row = ({ k, v }) => (
    <div className="corbel-receipt-row">
      <span className="corbel-receipt-k">{k}</span>
      <span className="corbel-receipt-v">{v}</span>
    </div>
  );

  return (
    <section className="corbel-receipt">
      <div className="corbel-receipt-head">RELEASE RECEIPT</div>
      <div className="corbel-receipt-stamp">RELEASED</div>
      <Row k="RUN" v={receipt.runId} />
      <Row k="OPERATION" v={receipt.operation} />
      <Row k="LOCATION" v={receipt.location} />
      <Row k="RELEASED BY" v={receipt.releasedBy} />
      <Row k="RELEASED AT" v={new Date(receipt.releasedAt).toLocaleString()} />
      <Row
        k="REQUIREMENTS"
        v={`${receipt.requirementsSatisfied} / ${receipt.requirementsTotal} CLEARED`}
      />
      <Row k="EVENT COUNT" v={receipt.eventCount} />
      <div className="corbel-receipt-hash">
        RECEIPT HASH #{receipt.finalHash}
      </div>
    </section>
  );
}
