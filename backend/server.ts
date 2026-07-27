// CORBEL Mock API Server - Demonstrates the hero scenario without Base44
// In production, these endpoints would use Base44 SDK and protected functions

import * as http from 'http';

// In-memory data store (replaced on reset)
let store = initializeStore();

interface AppState {
  users: Record<string, any>;
  operations: Record<string, any>;
  requirements: Record<string, any>;
  hazards: Record<string, any>;
  acceptances: Record<string, any>;
  evidence: Record<string, any>;
  verifications: Record<string, any>;
  events: Record<string, any>;
  recommendations: Record<string, any>;
}

function initializeStore(): AppState {
  return {
    users: {
      'user-alex': { id: 'user-alex', email: 'alex@corbel.local', name: 'Alex Morgan', role: 'OPERATIONS_LEAD' },
      'user-maya': { id: 'user-maya', email: 'maya@corbel.local', name: 'Maya Chen', role: 'ACCOUNTABLE_OWNER' },
      'user-jordan': { id: 'user-jordan', email: 'jordan@corbel.local', name: 'Jordan Lee', role: 'INDEPENDENT_VERIFIER' },
      'agent-coordinator': { id: 'agent-coordinator', email: 'agent@corbel.local', name: 'Coordinator Agent', role: 'COORDINATION_AGENT' }
    },
    operations: {
      'op-floor12-bayc': {
        id: 'op-floor12-bayc',
        name: 'FLOOR 12 — BAY C',
        location: 'Construction Site East, Level 12, Bay C',
        currentState: 'READY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    requirements: {
      'req-crew': { id: 'req-crew', operationId: 'op-floor12-bayc', label: 'Crew assigned', category: 'staffing', criticality: 'CRITICAL', status: 'SATISFIED', ownerUserId: null },
      'req-equipment': { id: 'req-equipment', operationId: 'op-floor12-bayc', label: 'Equipment inspection', category: 'safety', criticality: 'CRITICAL', status: 'SATISFIED', ownerUserId: null },
      'req-fallprotection': { id: 'req-fallprotection', operationId: 'op-floor12-bayc', label: 'Fall protection anchor', category: 'safety', criticality: 'CRITICAL', status: 'SATISFIED', ownerUserId: null },
      'req-supervisor': { id: 'req-supervisor', operationId: 'op-floor12-bayc', label: 'Supervisor present', category: 'oversight', criticality: 'CRITICAL', status: 'SATISFIED', ownerUserId: null }
    },
    hazards: {},
    acceptances: {},
    evidence: {},
    verifications: {},
    events: {},
    recommendations: {}
  };
}

function recalculateReadiness(operationId: string): void {
  const operation = store.operations[operationId];
  if (!operation) return;

  const reqs = Object.values(store.requirements).filter((r: any) => r.operationId === operationId && r.criticality === 'CRITICAL');
  const previousState = operation.currentState;
  let newState = previousState;

  // Priority rules
  if (reqs.some((r: any) => r.status === 'REJECTED')) {
    newState = 'HOLD_OWNED';
  } else if (reqs.some((r: any) => r.status === 'UNOWNED')) {
    newState = 'HOLD_UNOWNED';
  } else if (reqs.some((r: any) => (r.status === 'OWNED' || r.status === 'EVIDENCE_SUBMITTED'))) {
    newState = 'HOLD_OWNED';
  } else if (reqs.some((r: any) => r.status === 'EVIDENCE_SUBMITTED')) {
    newState = 'VERIFYING';
  } else if (reqs.every((r: any) => r.status === 'VERIFIED' || r.status === 'SATISFIED')) {
    newState = 'READY';
  }

  if (previousState !== newState) {
    operation.currentState = newState;
    operation.updatedAt = new Date().toISOString();
    createEvent(operationId, 'STATE_CHANGE', 'system', previousState, newState, `State changed to ${newState}`);
  }
}

function createEvent(operationId: string, eventType: string, actorId: string, prevState?: string, newState?: string, message?: string): void {
  const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  store.events[eventId] = {
    id: eventId,
    operationId,
    eventType,
    actorUserId: actorId,
    previousState: prevState,
    newState: newState,
    message: message || eventType,
    createdAt: new Date().toISOString()
  };
}

// HTTP Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname;

  // Routes
  if (path === '/api/operation/op-floor12-bayc' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(store.operations['op-floor12-bayc']));
  } else if (path === '/api/requirements/op-floor12-bayc' && req.method === 'GET') {
    const reqs = Object.values(store.requirements).filter((r: any) => r.operationId === 'op-floor12-bayc');
    res.writeHead(200);
    res.end(JSON.stringify(reqs));
  } else if (path === '/api/events/op-floor12-bayc' && req.method === 'GET') {
    const events = Object.values(store.events).filter((e: any) => e.operationId === 'op-floor12-bayc');
    res.writeHead(200);
    res.end(JSON.stringify(events));
  } else if (path === '/api/functions/detectHazard' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body);
      const req_obj = store.requirements[data.requirementId];
      if (req_obj) {
        req_obj.status = 'UNOWNED';
        req_obj.ownerUserId = null;
        const hazardId = `hazard-${Date.now()}`;
        store.hazards[hazardId] = { id: hazardId, ...data, reportedBy: 'agent-coordinator', createdAt: new Date().toISOString() };
        createEvent(data.operationId, 'HAZARD_DETECTED', 'agent-coordinator', undefined, 'UNOWNED', data.title);
        recalculateReadiness(data.operationId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, hazard: store.hazards[hazardId] }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Requirement not found' }));
      }
    });
  } else if (path === '/api/functions/acceptOwnership' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body);
      const req_obj = store.requirements[data.requirementId];
      if (req_obj) {
        req_obj.status = 'OWNED';
        req_obj.ownerUserId = data.userId;
        const acceptanceId = `acceptance-${Date.now()}`;
        store.acceptances[acceptanceId] = {
          id: acceptanceId,
          requirementId: data.requirementId,
          acceptedBy: data.userId,
          acceptedAt: new Date().toISOString()
        };
        const user = store.users[data.userId];
        createEvent(data.operationId, 'OWNERSHIP_ACCEPTED', data.userId, 'UNOWNED', 'OWNED', `${user?.name} accepted ownership`);
        recalculateReadiness(data.operationId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, acceptance: store.acceptances[acceptanceId] }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Requirement not found' }));
      }
    });
  } else if (path === '/api/functions/submitEvidence' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body);
      const req_obj = store.requirements[data.requirementId];
      if (req_obj) {
        req_obj.status = 'EVIDENCE_SUBMITTED';
        const evidenceId = `evidence-${Date.now()}`;
        store.evidence[evidenceId] = {
          id: evidenceId,
          requirementId: data.requirementId,
          submittedBy: data.userId || req_obj.ownerUserId,
          evidenceType: data.evidenceType,
          note: data.note,
          submittedAt: new Date().toISOString()
        };
        const user = store.users[data.userId || req_obj.ownerUserId];
        createEvent(data.operationId, 'EVIDENCE_SUBMITTED', data.userId || req_obj.ownerUserId, 'OWNED', 'EVIDENCE_SUBMITTED', `${user?.name} submitted evidence`);
        recalculateReadiness(data.operationId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, evidence: store.evidence[evidenceId] }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Requirement not found' }));
      }
    });
  } else if (path === '/api/functions/verifyEvidence' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body);
      const req_obj = store.requirements[data.requirementId];
      if (req_obj) {
        const newStatus = data.decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
        req_obj.status = newStatus;
        const verificationId = `verification-${Date.now()}`;
        store.verifications[verificationId] = {
          id: verificationId,
          requirementId: data.requirementId,
          verifierUserId: data.userId,
          decision: data.decision,
          note: data.note,
          verifiedAt: new Date().toISOString()
        };
        const user = store.users[data.userId];
        createEvent(data.operationId, 'EVIDENCE_VERIFIED', data.userId, 'EVIDENCE_SUBMITTED', newStatus, `${user?.name} verified evidence as ${data.decision}`);
        recalculateReadiness(data.operationId);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, verification: store.verifications[verificationId] }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Requirement not found' }));
      }
    });
  } else if (path === '/api/functions/recommendAction' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body);
      const operation = store.operations[data.operationId];
      let blocked = false;
      let blockReason = '';

      if (data.recommendationType === 'RELEASE') {
        if (operation.currentState !== 'READY') {
          blocked = true;
          blockReason = `RELEASE DENIED — Operation is in ${operation.currentState}, not READY`;
        } else {
          const reqs = Object.values(store.requirements).filter((r: any) => r.operationId === data.operationId && r.criticality === 'CRITICAL');
          const unowned = reqs.filter((r: any) => r.status === 'UNOWNED');
          if (unowned.length > 0) {
            blocked = true;
            blockReason = `RELEASE DENIED — ${unowned.length} critical requirement(s) have no accountable owner`;
          }
        }
      }

      const recommendationId = `rec-${Date.now()}`;
      store.recommendations[recommendationId] = {
        id: recommendationId,
        operationId: data.operationId,
        recommendationType: data.recommendationType,
        reasoning: data.reasoning,
        blocked,
        blockReason,
        createdAt: new Date().toISOString()
      };

      createEvent(data.operationId, 'AGENT_RECOMMENDATION', 'agent-coordinator', undefined, undefined, blocked ? `Agent recommendation blocked: ${blockReason}` : `Agent recommended ${data.recommendationType}`);

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        recommendation: store.recommendations[recommendationId],
        decision: blocked ? 'DENIED' : 'ALLOWED'
      }));
    });
  } else if (path === '/api/functions/generateReleaseReceipt' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const data = JSON.parse(body);
      const operation = store.operations[data.operationId];

      if (operation.currentState !== 'READY') {
        res.writeHead(409);
        res.end(JSON.stringify({ error: `Operation is in ${operation.currentState}, not READY` }));
        return;
      }

      const events = Object.values(store.events)
        .filter((e: any) => e.operationId === data.operationId)
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const eventChain = events.map((e: any) => e.id);
      const hash = require('crypto').createHash('sha256').update(JSON.stringify(eventChain)).digest('hex');

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        receipt: {
          receipt: { operationId: data.operationId, receiptHash: hash, generatedAt: new Date().toISOString() },
          events: events,
          summary: {
            operationName: operation.name,
            operationLocation: operation.location,
            finalState: operation.currentState,
            totalEvents: events.length,
            receiptHash: hash,
            generatedAt: new Date().toISOString()
          }
        }
      }));
    });
  } else if (path === '/api/functions/devReset' && req.method === 'POST') {
    store = initializeStore();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, message: 'Demo data reset' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`CORBEL Mock API Server running on http://localhost:${PORT}`);
  console.log('Frontend: http://localhost:3000');
});
