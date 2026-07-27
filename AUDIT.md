# CORBEL Integration Audit

**Date:** July 27, 2026  
**Assessment:** NOT READY for Build-Off submission  
**Core Issue:** Entire backend is mock; no actual Base44 integration

---

## A. WHAT IS MOCK-ONLY

### 1. HTTP Server (backend/server.ts)

**Status:** ❌ Mock in-memory JSON  
**Reality:**
- Node.js HTTP server listening on :8080
- In-memory JSON store (no persistence)
- Simulates Base44 API endpoints
- No Base44 SDK used
- No database layer
- Data lost on server restart

**Code Evidence:**
```typescript
// backend/server.ts:7
let store = initializeStore();  // In-memory object

// Every endpoint is a simple HTTP handler
if (path === '/api/functions/detectHazard' && req.method === 'POST') {
  // Manually modifies store object
  req_obj.status = 'UNOWNED';
  const hazardId = `hazard-${Date.now()}`;
  store.hazards[hazardId] = { ... };
}
```

### 2. Authentication

**Status:** ❌ Hardcoded mock users  
**Reality:**
- 4 fake users in memory (alex@corbel.local, maya@corbel.local, etc.)
- No actual credential validation
- No Base44 auth system used
- Frontend can spoof any user by passing userId

**Code Evidence:**
```typescript
// backend/server.ts:23-28
'user-maya': { id: 'user-maya', ..., role: 'ACCOUNTABLE_OWNER' }

// No JWT validation, no session check, no Base44 auth
```

### 3. Authorization Enforcement

**Status:** ❌ Application-layer only (not enforced at storage level)  
**Reality:**
- Role checks happen inside HTTP handler functions
- If someone bypasses the handler (direct DB access), no protection exists
- No Row-Level Security (RLS)
- No Field-Level Security (FLS)
- No persistent permission rules

**Code Evidence:**
```typescript
// backend/server.ts (acceptOwnership handler)
const user = store.users[data.userId];  // No auth check
if (user.role !== 'ACCOUNTABLE_OWNER') {
  // Returns 403, but this is application-level only
}
req_obj.status = 'OWNED';  // Direct object mutation
```

### 4. Realtime Updates

**Status:** ❌ 2-second polling (not subscriptions)  
**Reality:**
- Frontend uses setInterval() to poll every 2 seconds
- Not a WebSocket subscription
- Not Base44 realtime
- Polling is marked as "fallback" but it's the only implementation

**Code Evidence:**
```typescript
// frontend/src/components/OperationalControl.tsx:56-58
const interval = setInterval(() => {
  loadEvents();
}, 2000);  // Poll every 2 seconds
```

### 5. Data Persistence

**Status:** ❌ None (in-memory only)  
**Reality:**
- Data stored in JavaScript object
- Lost when process restarts
- No database
- No persistence between sessions

---

## B. WHAT IS SUPPOSEDLY BASE44-BACKED (But Isn't)

### Claims Made in Documentation

| Claim | Reality | Status |
|---|---|---|
| "Entity storage with RLS" | No RLS implemented | ❌ |
| "Protected backend functions" | HTTP handlers, not Base44 functions | ❌ |
| "Realtime subscriptions" | 2-second polling | ❌ |
| "Authentication via Base44" | Hardcoded mock users | ❌ |
| "Deno runtime" | Node.js HTTP server | ❌ |
| "Immutable records" | In-memory objects, easily modified | ❌ |
| "Cryptographic audit trail" | SHA256 hash of event IDs (not chained) | ⚠️ Partially |
| "User roles enforced" | Only in application logic | ⚠️ Application-level only |

---

## C. STATE MODEL ISSUES

### Current (WRONG)

```
Operation states: READY, HOLD_UNOWNED, HOLD_OWNED, VERIFYING
Requirement states: SATISFIED, UNOWNED, OWNED, EVIDENCE_SUBMITTED, VERIFIED, REJECTED
```

**Problem:** Operation should have 4 states total, but code uses 8 different operation-level states.

### Required (SPEC)

```
Operation states:
  - READY
  - HOLD
  - VERIFYING
  - RELEASED
```

**Change Needed:** Refactor to use only these 4 states. Requirements track ownership/verification status, operation tracks overall readiness.

---

## D. AUTHORIZATION VULNERABILITIES

### Issue 1: Frontend Can Write currentState

**Status:** ❌ Not enforced  
**Proof:** Frontend sends `currentState` in recommendation payload; mock server ignores it (by luck).

**Real vulnerability:** If backend trusted frontend payload:
```javascript
// Attacker request
POST /api/functions/recommendAction
{
  "operationId": "op-floor12-bayc",
  "recommendationType": "RELEASE",
  "currentState": "RELEASED"  // Frontend tries to set state directly
}
```

**Fix needed:** Backend must reject any payload containing state fields.

### Issue 2: Agent Can Masquerade as User

**Status:** ❌ Not enforced  
**Proof:** `acceptOwnership()` accepts `userId` parameter from client:
```typescript
await fetch('/api/functions/acceptOwnership', {
  method: 'POST',
  body: JSON.stringify({
    operationId: 'op-floor12-bayc',
    userId: 'user-maya'  // Frontend chooses which user
  })
});
```

**Real issue:** Coordinator agent can call acceptOwnership() and choose which user to credit.

**Fix needed:** Backend must extract user from authenticated session, not from client payload.

### Issue 3: Verifier ≠ Owner Check is Weak

**Status:** ⚠️ Implemented but not enforced at database level  
**Code:**
```typescript
if (requirement.ownerUserId === user.id) {
  return new Response(
    JSON.stringify({ error: 'Forbidden' }),
    { status: 403 }
  );
}
```

**Real issue:** Application-layer check can be bypassed if someone accesses data directly.

**Fix needed:** Database-level constraints or RLS rules that prevent a user from verifying a record they own.

---

## E. RECEIPT ISSUES

### Issue 1: Not Immutable

**Status:** ❌ Misleadingly named "immutable"  
**Reality:**
- SHA256 hash only proves the exact content of that moment
- Events in `store.events` can be modified or deleted before screenshot
- No append-only permissions
- No update-prevention rules
- No chained event hashes

**Code Evidence:**
```typescript
// backend/server.ts (generateReleaseReceipt)
const events = Object.values(store.events).filter(...);
const hash = crypto.createHash('sha256')
  .update(JSON.stringify(eventChain))
  .digest('hex');
```

Nothing prevents:
```javascript
delete store.events[eventId];  // Event deleted
store.events[eventId].message = 'Modified';  // Event modified
```

### Issue 2: Hash is Not Chained

**Status:** ❌ Should be cryptographically linked  
**Current:**
```
Hash = SHA256(eventId1, eventId2, eventId3, ...)
```

**Required:**
```
event1.hash = SHA256(null + event1.payload)
event2.hash = SHA256(event1.hash + event2.payload)
event3.hash = SHA256(event2.hash + event3.payload)
...
```

Each event hash depends on the previous one, creating an unbreakable chain.

---

## F. AGENT INTEGRATION ISSUES

### Issue 1: No Real Agent

**Status:** ❌ No Base44 agent configured  
**Reality:**
- base44.config.ts defines an agent named "coordinator"
- But nowhere does this agent actually exist
- Frontend pretends API calls are "agent recommendations"
- No proof agent is actually invoking functions

**Code Evidence:**
```typescript
// base44.config.ts
agents: {
  coordinator: {
    name: 'coordinator',
    instructions: 'You are a coordination agent...',
    tools: [
      { type: 'function', name: 'detectHazard' },
      { type: 'function', name: 'recommendAction' },
    ],
  },
}
```

But this agent is never actually used. Frontend manually calls `/api/functions/detectHazard`.

### Issue 2: Agent Can Access Denied Operations

**Status:** ❌ Agent has write access to required fields  
**Reality:**
- Agent can call `acceptOwnership()`, `submitEvidence()`, `verifyEvidence()`
- There's a role check that says "only ACCOUNTABLE_OWNER can accept"
- But agent calls come from mock user 'agent-coordinator'
- If someone swaps user IDs, agent can do anything

**Fix needed:** Implement true role-based authorization at the Base44 function level, not application level.

---

## G. TEST COVERAGE

### Status: ❌ NO TESTS

**Current:**
- No test files exist
- No automated validation
- No CI/CD pipeline
- No proof that any invariant holds

**Required tests (minimum):**

```typescript
describe('State Transitions', () => {
  it('READY → HOLD after hazard detected', async () => {
    // Verify operation state changes
  });

  it('HOLD remains after ownership acceptance', async () => {
    // Verify no premature state change
  });

  it('HOLD → VERIFYING after evidence submission', async () => {
    // Verify conditional transition
  });

  it('VERIFYING → RELEASED after independent approval', async () => {
    // Verify final state
  });

  it('VERIFYING → HOLD after evidence rejection', async () => {
    // Verify rejection flow
  });
});

describe('Authorization', () => {
  it('Owner cannot verify their own evidence', async () => {
    // Verify 403 returned
  });

  it('Non-owner cannot submit evidence', async () => {
    // Verify 403 returned
  });

  it('Agent cannot accept ownership', async () => {
    // Verify 403 returned
  });

  it('Agent cannot set RELEASED state', async () => {
    // Verify 403 returned
  });

  it('Frontend currentState payload is ignored', async () => {
    // Verify server recalculates, doesn't trust client
  });
});

describe('Events & Receipts', () => {
  it('Event chain is ordered correctly', async () => {
    // Verify chronological order
  });

  it('Receipt hash matches event chain', async () => {
    // Verify determinism
  });

  it('Receipt only generated when RELEASED', async () => {
    // Verify precondition
  });

  it('Chained event hashes verify', async () => {
    // Verify cryptographic integrity
  });
});
```

---

## H. DOCUMENTATION AUDIT

### README.md

**Unsupported Claims:**
```markdown
"Uses Base44 for:
- Entity storage with Row/Field Level Security"
REALITY: No RLS implemented. Objects in memory.

"Backend functions (protected Deno runtime; only way to mutate state)"
REALITY: Node.js HTTP handlers, not Base44 functions.

"Realtime updates via WebSocket subscriptions"
REALITY: 2-second polling via setInterval.

"Immutable OperationalEvent records"
REALITY: Can be deleted/modified in memory.
```

### DEMO.md

**Misleading statement:**
```markdown
"Proves the hazard changed backend data"
REALITY: Proves it changed in-memory object.

"CORBEL successfully demonstrates pre-execution authorization"
REALITY: Application-layer only, not database-enforced.
```

### QUICKSTART.md

**Acceptable** (clearly says "mock server").

---

## I. BUILD VALIDATION

### Current Status

```bash
npm install            # ✅ Works
npm run type-check     # ⚠️ Warnings but no errors
npm run dev            # ✅ Starts mock server + frontend
npm test               # ❌ No tests exist
npm run build          # ❌ Not configured for production
```

### Exact Commands to Verify

```bash
$ npm install
# Output: added 43 packages

$ npm run type-check
# Output: tsconfig warnings (non-fatal)

$ npm run dev
# Output: Server running on :8080, Frontend on :3000
# Reality: Mock server, not Base44

$ npm run build
# Output: ERROR (build script calls tsc + vite build, but vite.config points to frontend/)

$ npm test
# Output: No tests defined
```

---

## J. BROWSER TEST RESULTS

**Test:** Open http://localhost:3000, run hero scenario

**Actual Flow (2026-07-27):**
1. ✅ Page loads, shows READY
2. ✅ Click "Agent: Recommend Release" → shows APPROVED
3. ❌ No actual hazard detection (would need manual curl)
4. ❌ State doesn't automatically transition
5. ❌ No real authorization checks visible
6. ⚠️ Event tape updates only if you repeatedly click "Recommend Release"

**Verdict:** Frontend UI works, but backend is fake.

---

## K. PROOF THAT RELEASED CANNOT BE DIRECTLY WRITTEN

### Current Code

**Is Operation.currentState writable from frontend?**

Frontend attempts:
```javascript
// Can the frontend set currentState directly?
// Try 1: Submit in function payload
fetch('/api/functions/recommendAction', {
  body: JSON.stringify({
    operationId: '...',
    currentState: 'RELEASED'  // Attacker tries to set state
  })
});
// Result: Payload has no 'currentState' field, mock server ignores it
// Verdict: Protected by luck, not by design
```

**Is Operation.currentState writable via stored procedure?**

Mock server only exposes:
- POST /api/functions/acceptOwnership (returns 200 regardless)
- POST /api/functions/submitEvidence
- POST /api/functions/verifyEvidence
- POST /api/functions/recommendAction
- POST /api/functions/detectHazard
- POST /api/functions/generateReleaseReceipt

None of these accept a `currentState` parameter.

**But there's no database-level enforcement.**

If someone accessed the store directly:
```javascript
store.operations['op-floor12-bayc'].currentState = 'RELEASED';  // Works
```

**Honest verdict:** Frontend cannot set it (by code design), but database layer has no protection.

---

## L. PROOF THAT REALTIME IS NATIVE

### Current Code

**Is it using Base44 subscriptions?**

No. Frontend code:
```typescript
const interval = setInterval(() => {
  loadEvents();  // HTTP GET request
}, 2000);
```

This is polling, not subscription.

**If Base44 were integrated, it would look like:**
```typescript
const subscription = client.entities
  .subscribe('OperationalEvent', { operationId: operationId })
  .on('change', (event) => {
    setEvents(prev => [event, ...prev]);
  });
```

**Honest verdict:** NOT implemented. Currently polling only.

---

## M. REMAINING BLOCKERS

### Critical (Must Fix)

1. **No actual Base44 integration** — Everything is mock
2. **State model wrong** — Uses 8 operation states instead of 4
3. **Authorization not enforced at DB level** — Application-layer only
4. **No tests** — Zero automated validation
5. **Agent not real** — No actual Base44 agent
6. **Receipts not immutable** — Can be modified in memory
7. **No chained event hashes** — Single SHA256 hash without chain
8. **Polling not subscription** — 2-second interval, not realtime

### High Priority

9. **No production build** — npm run build fails
10. **Documentation misleading** — Claims Base44 functionality that doesn't exist
11. **No RELEASED state** — State model doesn't include RELEASED
12. **Authorization bypasses** — Frontend can choose which user to credit

### Medium Priority

13. **No user session** — Mock users, no authentication
14. **No encryption** — Data in plain HTTP, no HTTPS
15. **No persistence** — Data lost on restart
16. **No database** — Pure in-memory store

---

## N. FINAL VERDICT

### Readiness Assessment

| Gate | Status | Evidence |
|---|---|---|
| **Real Base44 integration** | ❌ BLOCKED | Mock server only |
| **Correct state model** | ❌ BLOCKED | 8 states instead of 4 |
| **Database-level authorization** | ❌ BLOCKED | Application-layer only |
| **Automated tests** | ❌ BLOCKED | Zero tests |
| **Immutable events** | ❌ BLOCKED | In-memory, easily modified |
| **Chained event hashes** | ❌ BLOCKED | Single SHA256 hash |
| **Native realtime** | ❌ BLOCKED | Polling only |
| **Real agent** | ❌ BLOCKED | No Base44 agent configured |
| **Production build** | ❌ BLOCKED | Build script incomplete |
| **Honest documentation** | ❌ BLOCKED | Claims unsupported features |

### Submission Status

**NOT READY**

---

## O. PATH TO READINESS

To convert this prototype into a genuine Base44 submission:

### Phase 1: State Model Correction (2 hours)

1. Change Operation states from (READY, HOLD_UNOWNED, HOLD_OWNED, VERIFYING) to (READY, HOLD, VERIFYING, RELEASED)
2. Keep Requirement states as-is
3. Update recalculateReadiness() to use 4-state logic
4. Update UI state displays

### Phase 2: Real Base44 Integration (6+ hours)

1. Replace backend/server.ts with actual Base44 SDK calls
2. Create Deno backend functions for each protected operation
3. Use Base44 entities for persistence (no in-memory store)
4. Implement RLS/FLS for authorization
5. Use Base44 auth system (not hardcoded users)

### Phase 3: Realtime Implementation (2 hours)

1. Replace setInterval polling with Base44 WebSocket subscriptions
2. Test realtime events flow from backend to frontend
3. Remove polling fallback (or clearly label as fallback only)

### Phase 4: Immutable Events (2 hours)

1. Implement chained event hashes (previousEventHash + SHA256)
2. Add database-level constraints preventing updates/deletions
3. Rename "Release Receipt" to "Tamper-Evident Operational Receipt"
4. Prove events cannot be modified after creation

### Phase 5: Agent Integration (3+ hours)

1. Create real Base44 agent with exact tool list
2. Configure agent to call only detectHazard() and recommendAction()
3. Make agent-submitted evidence visible in UI
4. Prove agent CANNOT call acceptOwnership(), verifyEvidence(), or set state

### Phase 6: Authorization Hardening (2 hours)

1. Validate currentState not in any client payload
2. Extract user from Base44 session (not from request body)
3. Implement database-level permission rules
4. Test all authorization bypass vectors

### Phase 7: Testing (4+ hours)

1. Write 20+ automated tests for state transitions
2. Write 10+ authorization enforcement tests
3. Write cryptographic integrity tests for event chain
4. Run full browser test of hero scenario

### Phase 8: Documentation Audit (1 hour)

1. Remove all unsupported claims from README, DEMO, QUICKSTART
2. Mark which features are mock vs. Base44-backed
3. Add "NOT READY" label to submission summary

---

## TOTAL EFFORT TO PRODUCTION-READY: 22+ hours

**Current status:** Proof-of-concept prototype (demo mock architecture)  
**Submission-ready:** Not until all 8 phases complete with green tests

