import React from "react";

/**
 * EngineeringTitleBlock — engineering drawing title block.
 * Looks like part of an engineering document, not a navbar.
 *
 * Props:
 *  - operation: { operationId, runId, revision, drawing, state, lastAuthoritativeUpdate }
 *  - user: { name, role }
 */
export default function EngineeringTitleBlock({ operation, user }) {
  return (
    <div className="fl-title-block" role="banner" aria-label="CORBEL engineering title block">
      <div className="fl-tb-cell">
        <span className="fl-tb-label">System</span>
        <span className="fl-tb-brand">CORBEL</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Drawing</span>
        <span className="fl-tb-title">{operation.drawing}</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Operation ID</span>
        <span className="fl-tb-value">{operation.operationId}</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Run ID</span>
        <span className="fl-tb-value">{operation.runId}</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Revision</span>
        <span className="fl-tb-value">{operation.revision}</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Authoritative state</span>
        <span className="fl-tb-value">{operation.state}</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Last backend update</span>
        <span className="fl-tb-value">{operation.lastAuthoritativeUpdate}</span>
      </div>
      <div className="fl-tb-cell">
        <span className="fl-tb-label">Authenticated role</span>
        <span className="fl-tb-value">{user.role}</span>
      </div>
    </div>
  );
}
