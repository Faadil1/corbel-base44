import React, { useEffect, useState } from 'react';
import { StateDisplay } from './StateDisplay';
import { RequirementsStructure } from './RequirementsStructure';
import { EventTape } from './EventTape';
import { ActionPanel } from './ActionPanel';
import { ReleaseReceipt } from './ReleaseReceipt';

interface Operation {
  id: string;
  name: string;
  location: string;
  currentState: 'READY' | 'HOLD_UNOWNED' | 'HOLD_OWNED' | 'VERIFYING';
  updatedAt: string;
}

interface Requirement {
  id: string;
  label: string;
  status: string;
  ownerUserId?: string;
  ownerName?: string;
}

interface Event {
  id: string;
  eventType: string;
  message: string;
  actorUserId: string;
  createdAt: string;
}

interface Recommendation {
  id: string;
  recommendationType: string;
  blocked: boolean;
  blockReason?: string;
  reasoning: string;
}

export function OperationalControl() {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial data
    loadOperation();
    loadRequirements();
    loadEvents();

    // Set up real-time subscriptions (would be WebSocket in real Base44)
    const interval = setInterval(() => {
      loadEvents();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  async function loadOperation() {
    try {
      // Simulate API call - in real app would use Base44 SDK
      const response = await fetch('/api/operation/op-floor12-bayc');
      if (!response.ok) throw new Error('Failed to load operation');
      const data = await response.json();
      setOperation(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load operation:', error);
      // Use mock data for demo
      setOperation({
        id: 'op-floor12-bayc',
        name: 'FLOOR 12 — BAY C',
        location: 'Construction Site East, Level 12, Bay C',
        currentState: 'READY',
        updatedAt: new Date().toISOString()
      });
      setLoading(false);
    }
  }

  async function loadRequirements() {
    try {
      const response = await fetch('/api/requirements/op-floor12-bayc');
      if (!response.ok) throw new Error('Failed to load requirements');
      const data = await response.json();
      setRequirements(data);
    } catch (error) {
      console.error('Failed to load requirements:', error);
      // Mock data
      setRequirements([
        {
          id: 'req-crew',
          label: 'Crew assigned',
          status: 'SATISFIED'
        },
        {
          id: 'req-equipment',
          label: 'Equipment inspection',
          status: 'SATISFIED'
        },
        {
          id: 'req-fallprotection',
          label: 'Fall protection anchor',
          status: 'SATISFIED'
        },
        {
          id: 'req-supervisor',
          label: 'Supervisor present',
          status: 'SATISFIED'
        }
      ]);
    }
  }

  async function loadEvents() {
    try {
      const response = await fetch('/api/events/op-floor12-bayc');
      if (!response.ok) throw new Error('Failed to load events');
      const data = await response.json();
      setEvents(data.sort((a: Event, b: Event) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      // Fail silently for events
    }
  }

  async function handleRecommendRelease() {
    try {
      const response = await fetch('/api/functions/recommendAction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: operation?.id,
          recommendationType: 'RELEASE',
          reasoning: 'All requirements appear satisfied'
        })
      });
      const result = await response.json();
      if (result.recommendation) {
        setRecommendations([result.recommendation]);
      }
      loadOperation();
      loadEvents();
    } catch (error) {
      console.error('Failed to recommend release:', error);
    }
  }

  async function handleGenerateReceipt() {
    try {
      const response = await fetch('/api/functions/generateReleaseReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: operation?.id
        })
      });
      const result = await response.json();
      if (result.receipt) {
        setReceipt(result.receipt);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error('Failed to generate receipt:', error);
    }
  }

  async function handleReset() {
    try {
      await fetch('/api/functions/devReset', { method: 'POST' });
      loadOperation();
      loadRequirements();
      loadEvents();
      setRecommendations([]);
      setShowReceipt(false);
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  }

  if (loading) {
    return (
      <div className="corbel-flex-center corbel-loading">
        <div>Loading CORBEL...</div>
      </div>
    );
  }

  return (
    <div className="corbel-container">
      <div className="corbel-main">
        <div className="corbel-header">
          <p>Operational Control System</p>
          <h1>{operation?.name}</h1>
        </div>

        <StateDisplay operation={operation!} />

        <div className="corbel-requirements">
          {recommendations.length > 0 && (
            <div className={`corbel-recommendation ${recommendations[0].blocked ? 'blocked' : ''}`}>
              <div className="corbel-recommendation-header">
                {recommendations[0].blocked ? '⛔ BLOCKED' : '✓ APPROVED'}
              </div>
              <div className="corbel-recommendation-text">
                {recommendations[0].blockReason || recommendations[0].reasoning}
              </div>
            </div>
          )}

          <RequirementsStructure requirements={requirements} />
        </div>
      </div>

      <div className="corbel-sidebar">
        <div className="corbel-sidebar-title">Event Tape</div>
        <EventTape events={events} />
        <ActionPanel
          operation={operation!}
          onRecommendRelease={handleRecommendRelease}
          onGenerateReceipt={handleGenerateReceipt}
          onReset={handleReset}
          isReady={operation?.currentState === 'READY'}
          isHoldingUnowned={operation?.currentState === 'HOLD_UNOWNED'}
        />
      </div>

      {showReceipt && receipt && (
        <ReleaseReceipt receipt={receipt} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
}
