import React from 'react';

interface StateDisplayProps {
  operation: {
    currentState: string;
    updatedAt: string;
  };
}

export function StateDisplay({ operation }: StateDisplayProps) {
  const getStateReason = (state: string): string => {
    switch (state) {
      case 'READY':
        return 'All critical requirements verified and satisfied';
      case 'HOLD_UNOWNED':
        return 'Critical requirement has no accountable owner';
      case 'HOLD_OWNED':
        return 'Critical requirement awaiting evidence or verification';
      case 'VERIFYING':
        return 'Evidence submitted, awaiting independent verification';
      default:
        return '';
    }
  };

  return (
    <div className="corbel-state-section">
      <div className="corbel-state-label">Current State</div>
      <div className={`corbel-state-display ${operation.currentState}`}>
        {operation.currentState.replace(/_/g, ' ')}
      </div>
      <div className="corbel-state-reason">
        {getStateReason(operation.currentState)}
      </div>
    </div>
  );
}
