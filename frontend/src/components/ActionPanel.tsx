import React, { useState } from 'react';

interface ActionPanelProps {
  operation: { id: string; currentState: string };
  onRecommendRelease: () => void;
  onGenerateReceipt: () => void;
  onReset: () => void;
  isReady: boolean;
  isHoldingUnowned: boolean;
}

export function ActionPanel({
  operation,
  onRecommendRelease,
  onGenerateReceipt,
  onReset,
  isReady,
  isHoldingUnowned
}: ActionPanelProps) {
  const [showOwnershipForm, setShowOwnershipForm] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);

  const actionsAvailable = [
    {
      name: 'Accept Ownership',
      show: isHoldingUnowned,
      onClick: () => setShowOwnershipForm(true),
      className: 'primary'
    },
    {
      name: 'Agent: Recommend Release',
      show: true,
      onClick: onRecommendRelease,
      className: ''
    },
    {
      name: 'Generate Receipt',
      show: isReady,
      onClick: onGenerateReceipt,
      className: 'primary'
    },
    {
      name: 'Dev Reset',
      show: true,
      onClick: onReset,
      className: 'danger'
    }
  ];

  return (
    <div className="corbel-action-panel">
      <div className="corbel-action-panel-title">Actions</div>
      <div className="corbel-actions">
        {actionsAvailable
          .filter((a) => a.show)
          .map((action) => (
            <button
              key={action.name}
              className={`corbel-button ${action.className}`}
              onClick={action.onClick}
            >
              {action.name}
            </button>
          ))}
      </div>

      {showOwnershipForm && (
        <OwnershipForm onClose={() => setShowOwnershipForm(false)} operationId={operation.id} />
      )}

      {showEvidenceForm && (
        <EvidenceForm onClose={() => setShowEvidenceForm(false)} operationId={operation.id} />
      )}
    </div>
  );
}

function OwnershipForm({ onClose, operationId }: { onClose: () => void; operationId: string }) {
  const [selectedUser, setSelectedUser] = useState('user-maya');

  const users = [
    { id: 'user-maya', name: 'Maya Chen (Safety Supervisor)' },
    { id: 'user-alex', name: 'Alex Morgan (Operations Lead)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/functions/acceptOwnership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          requirementId: 'req-fallprotection',
          userId: selectedUser
        })
      });
      onClose();
    } catch (error) {
      console.error('Failed to accept ownership:', error);
    }
  };

  return (
    <div className="corbel-modal-overlay">
      <div className="corbel-modal">
        <h2>Accept Ownership</h2>
        <form onSubmit={handleSubmit} className="corbel-form">
          <div className="corbel-form-group">
            <label className="corbel-form-label">Select Owner</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="corbel-form-select"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="corbel-button primary">
            Accept Ownership
          </button>
          <button type="button" onClick={onClose} className="corbel-button">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

function EvidenceForm({ onClose, operationId }: { onClose: () => void; operationId: string }) {
  const [evidenceType, setEvidenceType] = useState('PHOTO');
  const [note, setNote] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/functions/submitEvidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          requirementId: 'req-fallprotection',
          evidenceType,
          note
        })
      });
      onClose();
    } catch (error) {
      console.error('Failed to submit evidence:', error);
    }
  };

  return (
    <div className="corbel-modal-overlay">
      <div className="corbel-modal">
        <h2>Submit Evidence</h2>
        <form onSubmit={handleSubmit} className="corbel-form">
          <div className="corbel-form-group">
            <label className="corbel-form-label">Evidence Type</label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
              className="corbel-form-select"
            >
              <option value="PHOTO">Photo</option>
              <option value="DOCUMENT">Document</option>
              <option value="REPORT">Report</option>
              <option value="NOTE">Note</option>
            </select>
          </div>
          <div className="corbel-form-group">
            <label className="corbel-form-label">Description/Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="corbel-form-textarea"
              placeholder="Describe the corrective action taken..."
            />
          </div>
          <button type="submit" className="corbel-button primary">
            Submit Evidence
          </button>
          <button type="button" onClick={onClose} className="corbel-button">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
