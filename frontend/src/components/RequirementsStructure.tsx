import React from 'react';

interface Requirement {
  id: string;
  label: string;
  status: string;
  ownerUserId?: string;
  ownerName?: string;
}

interface RequirementsStructureProps {
  requirements: Requirement[];
}

export function RequirementsStructure({ requirements }: RequirementsStructureProps) {
  return (
    <div>
      <div className="corbel-requirements-title">Critical Load-Bearing Requirements</div>
      <div className="corbel-requirements-grid">
        {requirements.map((req) => (
          <div key={req.id} className={`corbel-requirement-card ${req.status}`}>
            <div className="corbel-requirement-label">{req.label}</div>
            <div className={`corbel-requirement-status ${req.status}`}>
              {req.status === 'UNOWNED' && '◆ UNOWNED'}
              {req.status === 'OWNED' && '● OWNED'}
              {req.status === 'SATISFIED' && '✓ SATISFIED'}
              {req.status === 'VERIFIED' && '✓ VERIFIED'}
              {req.status === 'EVIDENCE_SUBMITTED' && '◐ EVIDENCE'}
              {req.status === 'REJECTED' && '✗ REJECTED'}
            </div>
            {req.ownerUserId && (
              <div className="corbel-requirement-owner">
                Owner: {req.ownerName || req.ownerUserId}
              </div>
            )}
            {!req.ownerUserId && req.status === 'UNOWNED' && (
              <div className="corbel-requirement-owner missing">
                No accountable owner
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
