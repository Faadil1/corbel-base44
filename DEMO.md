# CORBEL Hero Scenario Demo

## Setup

### 1. Start the Mock Server & Frontend

```bash
npm run dev
```

This will start:
- **Mock API Server:** http://localhost:8080
- **Frontend UI:** http://localhost:3000

### 2. Open the UI

Navigate to http://localhost:3000 in your browser.

You should see:
- **Top left:** "FLOOR 12 — BAY C" operation name
- **Large display:** "READY" in green
- **Center:** 4 requirements, all SATISFIED (green checkmarks)
- **Right sidebar:** Event tape (currently empty)
- **Bottom right:** Action panel with "Agent: Recommend Release" and "Dev Reset" buttons

---

## Hero Scenario: 8-Second Demonstration

### Timeline

**T=0s: Initial State**
- Operation: **READY**
- All 4 critical requirements: **SATISFIED**
- UI shows green "READY" state

**T=1s: Agent Detects Hazard**
The coordination agent detects that the fall protection anchor has lost its accountable owner.

In terminal:
```bash
curl -X POST http://localhost:8080/api/functions/detectHazard \
  -H "Content-Type: application/json" \
  -d '{
    "operationId": "op-floor12-bayc",
    "requirementId": "req-fallprotection",
    "title": "Fall protection anchor incomplete",
    "description": "Anchor point not secure",
    "severity": "HIGH"
  }'
```

**Watch the UI:**
- State changes: **READY → HOLD_UNOWNED** (red, uppercase)
- "Fall protection anchor" card turns red, shows **UNOWNED** status
- Event tape shows: "Agent detected hazard: Fall protection anchor incomplete (severity: HIGH)"

**T=2s: State Reason Updates**
The UI explanation changes: "Critical requirement has no accountable owner"

**T=3s: Agent Attempts Release (Gets Blocked)**

Click the "Agent: Recommend Release" button in the action panel.

**Watch the UI:**
A blue recommendation box appears saying:
```
⛔ BLOCKED
RELEASE DENIED — NO ACCOUNTABLE OWNER
```

This proves the agent **cannot** release when requirements are unowned.

**T=4s: Human Accepts Ownership**

Click "Accept Ownership" button.
- Select "Maya Chen (Safety Supervisor)" from dropdown
- Click "Accept Ownership"

**Watch the UI:**
- "Fall protection anchor" card turns amber, shows **OWNED**
- State changes: **HOLD_UNOWNED → HOLD_OWNED** (red but different reason)
- Event tape shows: "Maya Chen accepted ownership of \"Fall protection anchor\""
- Explanation changes: "Critical requirement awaiting evidence or verification"

**T=5s: Maya Submits Evidence**

Click "Submit Evidence" button (if visible; may need to scroll/refresh).
- Evidence Type: "Photo"
- Note: "Anchor point has been reinforced and tested. New securing cable installed."
- Click "Submit Evidence"

**Watch the UI:**
- "Fall protection anchor" card shows **EVIDENCE** status
- State changes: **HOLD_OWNED → VERIFYING** (orange/amber)
- Event tape shows: "Maya Chen submitted evidence for \"Fall protection anchor\""
- Explanation changes: "Evidence submitted, awaiting independent verification"

**T=6s: Independent Verifier Reviews**

Click "Verify Evidence" button (shown when in VERIFYING state).
- Review note: "Anchor point has been reinforced and tested..."
- Click "Approve"

**Watch the UI:**
- "Fall protection anchor" card turns green, shows **VERIFIED**
- State changes: **VERIFYING → READY** (green)
- Event tape shows: "Jordan Lee verified evidence for \"Fall protection anchor\" as APPROVED"
- Explanation: "All critical requirements verified and satisfied"

**T=7s: Generate Release Receipt**

Click "Generate Receipt" button.

**Watch the modal:**
```
✓ RELEASE RECEIPT
Operation:  FLOOR 12 — BAY C
Location:   Construction Site East, Level 12, Bay C
Final State: READY
Generated At: 2026-07-27 03:45:30
Receipt Hash: a3f9c8e1d2b7...

Event Chain:
1. 2026-07-27 03:45:00  Agent detected hazard...
2. 2026-07-27 03:45:05  Maya Chen accepted ownership...
3. 2026-07-27 03:45:10  Maya Chen submitted evidence...
4. 2026-07-27 03:45:15  State changed to VERIFYING
5. 2026-07-27 03:45:20  Jordan Lee verified evidence as APPROVED
6. 2026-07-27 03:45:25  State changed to READY
```

The receipt shows:
- ✅ Original hazard was detected (event 1)
- ✅ Work was held (state → HOLD_UNOWNED)
- ✅ Owner was human-authenticated (event 2)
- ✅ Evidence was submitted (event 3)
- ✅ Verification was independent (Jordan ≠ Maya)
- ✅ Only after verification did state → READY (event 6)
- ✅ SHA256 hash proves event chain is immutable

**T=8s: Done**

The complete release cycle is proven:
- Hazard detected
- Operation held
- Owner accepted
- Evidence submitted
- Verification independent
- Release automatic after all gates pass
- Receipt generated from persisted event history

---

## Key Proof Points Demonstrated

### 1. Agent Cannot Release

When the agent recommends RELEASE while operation is HOLD_UNOWNED:
- **System blocks it** with explicit reason
- **Frontend displays the block** (blue warning box)
- **No state change occurs** (UI stays HOLD_UNOWNED)

**Proves:** Agent has no authority over final state.

### 2. State is Server-Calculated

Every state change is tied to requirement status changes:
- When requirement becomes UNOWNED → operation becomes HOLD_UNOWNED
- When all become VERIFIED → operation becomes READY

State is never written directly by frontend or agent.

**Proves:** State machine enforces correctness.

### 3. Ownership is Human-Authenticated

Maya's user ID is stored in `OwnershipAcceptance.acceptedBy` field.
Later, only Maya can submit evidence for that requirement.

**Proves:** Ownership is human-tied, not spoofable.

### 4. Verification is Independent

Jordan (INDEPENDENT_VERIFIER) verifies evidence submitted by Maya (ACCOUNTABLE_OWNER).
System enforces: `verifier_user_id ≠ owner_user_id`

If Jordan tried to verify a requirement he owned, the system would reject it.

**Proves:** Roles are separated; single person cannot complete entire chain.

### 5. Realtime Updates

Event tape updates in realtime as each action occurs.
Requirement cards change color and status instantly.
State display updates within 1 second.

**Proves:** UI reflects server state without manual refresh.

### 6. READY Returns Only After All Gates Pass

Before Jordan's approval:
- State is VERIFYING
- "Generate Receipt" button is disabled
- UI explains "awaiting verification"

After approval:
- State automatically becomes READY
- "Generate Receipt" button is enabled
- UI shows "All critical requirements verified"

No manual action; deterministic state machine.

**Proves:** READY is earned, not granted.

### 7. Receipt From Persisted Events

Receipt SHA256 hash includes:
- All event IDs in chronological order
- Hash is deterministic (same events = same hash)
- Hash proves no events can be added/removed retroactively

Clicking "Close Receipt" and re-opening (or refreshing browser) shows identical receipt.

**Proves:** Receipt is persisted and immutable.

---

## Testing Alternative Paths

### Test: Verifier Cannot Verify Own Evidence

(Requires modification of users)

Assign Jordan as both owner and verifier. Try to verify:
- Frontend would send verification request
- Backend validates: `verifier_id !== owner_id`
- Request rejected with 403 Forbidden
- State remains EVIDENCE_SUBMITTED

### Test: Agent Cannot Accept Ownership

Agent tries `acceptOwnership()`:
- Backend checks role: 'COORDINATION_AGENT'
- Rejects with 403: "Only ACCOUNTABLE_OWNER role can accept ownership"
- Requirement remains UNOWNED

### Test: Non-Owner Cannot Submit Evidence

Alex (OPERATIONS_LEAD) tries to submit evidence for Maya's requirement:
- Backend checks: `current_owner_id` vs. `submitting_user_id`
- Rejects if mismatch
- Requirement remains OWNED

### Test: Reset to READY

Click "Dev Reset":
- All events cleared
- Requirements reset to SATISFIED
- State returns to READY
- Event tape empty
- Recommendation cleared

---

## Troubleshooting

### "Cannot GET /api/..." errors
- Mock server crashed or not running
- Try: `npm run server` in separate terminal

### State not updating
- Check browser console for errors
- Mock server logs: Look for "State changed to" messages
- Refresh browser (http://localhost:3000)

### Receipt modal shows empty
- Ensure operation is in READY state
- Check mock server logs for hash generation
- Reload page and try again

---

## What This Proves

CORBEL successfully demonstrates:

✅ **Pre-Execution Authorization**  
Agent proposals are evaluated server-side before being blocked or allowed.

✅ **Immutable State Machine**  
State changes only through protected backend functions that enforce rules.

✅ **Role Separation**  
No single user can detect, own, verify, and release alone.

✅ **Realtime Accountability**  
Every action creates an immutable event; event chain generates receipt hash.

✅ **Operational Integrity**  
Work cannot proceed without accountable owner + independent verification.

**Core Principle Proven:** "Nothing proceeds unowned."

---

## Demo Timing

The entire scenario above takes **8–10 seconds** from initial state to final receipt.

Each human action (clicking buttons):
- Takes 1–2 seconds for UI to update
- Backend recalculates state
- Event appears in tape
- Requirement cards update color/status

No artificial delays; all timing is genuine server response + realtime updates.

