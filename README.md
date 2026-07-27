# CORBEL — Operational Accountability System for Base44

## Core Principle

**Nothing proceeds unowned.**

CORBEL is an operational release-control system for critical work. It enforces accountability through a strict role-based authorization model where:

- Work operations cannot start or resume until every critical dependency is satisfied
- Every critical condition has an accountable owner
- Required evidence has been submitted and independently verified
- Release is server-calculated and enforced

## Architecture

### Non-Negotiable Security Rules

1. The frontend must **never** directly write `Operation.currentState`
2. The agent must **never** directly write `Operation.currentState`
3. State transitions happen **only** through protected backend functions
4. `OwnershipAcceptance` is tied to the authenticated human user
5. A user cannot verify evidence for a requirement they own
6. Release is impossible while any critical requirement is unowned, unresolved, or unverified
7. Every action creates an immutable operational event before the transition is confirmed

### State Machine

**Operation States:**
- `READY` — All critical requirements verified or satisfied
- `HOLD_UNOWNED` — Critical requirement has no accountable owner
- `HOLD_OWNED` — Critical requirement owned but awaiting evidence
- `VERIFYING` — Evidence submitted, awaiting independent verification

**Requirement States:**
- `SATISFIED` — Requirement initially met (no action needed)
- `UNOWNED` — Hazard detected; owner must be assigned
- `OWNED` — Owner accepted; evidence must be submitted
- `EVIDENCE_SUBMITTED` — Evidence provided; awaiting verification
- `VERIFIED` — Evidence approved by independent verifier
- `REJECTED` — Evidence rejected; resubmission required

### Recalculation Priority

1. Any rejected critical requirement → `HOLD_OWNED`
2. Any unowned critical requirement → `HOLD_UNOWNED`
3. Any owned requirement missing evidence → `HOLD_OWNED`
4. Any submitted evidence awaiting verification → `VERIFYING`
5. All critical requirements verified or satisfied → `READY`

## Roles & Authorization

| Role | Permissions | Cannot Do |
|---|---|---|
| **OPERATIONS_LEAD** | View operation, initiate hazard reports | Accept ownership, verify evidence |
| **ACCOUNTABLE_OWNER** | Accept ownership, submit evidence | Verify evidence they submitted |
| **INDEPENDENT_VERIFIER** | Approve or reject evidence | Accept ownership, be the owner they verify |
| **COORDINATION_AGENT** | Detect hazards, recommend actions | Change state, accept ownership, verify, release |

## Backend Functions

All state changes go through protected functions:

### `acceptOwnership(requirementId, operationId)`
- **Role:** ACCOUNTABLE_OWNER only
- **Effect:** Marks requirement as OWNED, ties it to authenticated user
- **Calls:** `recalculateReadiness()`

### `submitEvidence(requirementId, operationId, evidenceType, note)`
- **Role:** Current owner only
- **Effect:** Creates Evidence record, marks requirement as EVIDENCE_SUBMITTED
- **Calls:** `recalculateReadiness()` → may move to VERIFYING

### `verifyEvidence(requirementId, operationId, decision, note)`
- **Role:** INDEPENDENT_VERIFIER only; must NOT be the owner
- **Effect:** Creates Verification, marks requirement as VERIFIED or REJECTED
- **Calls:** `recalculateReadiness()` → may move to READY or back to HOLD_OWNED

### `detectHazard(operationId, requirementId, title, severity)`
- **Role:** Agent or human (agent is constrained)
- **Effect:** Creates Hazard, marks requirement as UNOWNED
- **Calls:** `recalculateReadiness()` → moves to HOLD_UNOWNED

### `recommendAction(operationId, recommendationType, reasoning)`
- **Role:** Agent only (no effect; creates recommendation record)
- **Effect:** Agent proposes RELEASE/HOLD/ESCALATE; system verifies authorization and may block
- **Blocks:** RELEASE if operation not READY or critical requirements unowned

### `recalculateReadiness(operationId)` [SERVER-ONLY]
- **Reads:** All critical requirements for operation
- **Evaluates:** Requirement statuses against priority rules
- **Writes:** Operation.currentState and creates OperationalEvent if state changed
- **Guarantee:** Deterministic; always produces correct state

### `generateReleaseReceipt(operationId)`
- **Available:** Only when operation is READY
- **Effect:** Creates ReleaseReceipt with ordered event chain and SHA256 hash
- **Immutable:** Hash proves no events can be retroactively added

### `seedDemoData()` [DEVELOPMENT ONLY]
- Creates demo users, operation, and initial requirements

### `devReset()` [DEVELOPMENT ONLY]
- Wipes all data and returns to seed state

## Demo Scenario: FLOOR 12 — BAY C

### Hero Flow (8 seconds)

1. **Initial State:** Operation in READY; all requirements SATISFIED
2. **Hazard Detected:** Agent detects missing fall protection anchor owner
   - `detectHazard()` → requirement becomes UNOWNED
   - `recalculateReadiness()` → operation becomes HOLD_UNOWNED
   - UI shows state change in real-time
3. **Agent Recommendation Blocked:** Agent recommends release
   - `recommendAction('RELEASE')` evaluated server-side
   - System finds UNOWNED requirement
   - Returns `{blocked: true, reason: "RELEASE DENIED — NO ACCOUNTABLE OWNER"}`
   - UI displays rejection
4. **Human Accepts Ownership:** Maya Chen accepts responsibility
   - `acceptOwnership()` → requirement becomes OWNED
   - `recalculateReadiness()` → operation becomes HOLD_OWNED
5. **Evidence Submitted:** Maya submits corrective evidence
   - `submitEvidence()` → requirement becomes EVIDENCE_SUBMITTED
   - `recalculateReadiness()` → operation becomes VERIFYING
6. **Independent Verification:** Jordan Lee verifies evidence
   - `verifyEvidence(APPROVED)` → requirement becomes VERIFIED
   - Jordan ≠ Maya (verifier ≠ owner enforced)
   - `recalculateReadiness()` → operation becomes READY
7. **Release Receipt Generated:** System shows complete event chain
   - `generateReleaseReceipt()` produces immutable receipt
   - Shows all events, timestamps, SHA256 hash
   - Proves original hazard was detected, held, owned, verified, and released

## Technical Stack

### Backend
- **Language:** TypeScript (Deno runtime in Base44)
- **Database:** Base44 entities with RLS/FLS
- **Functions:** Protected endpoints; no direct entity mutation allowed
- **Events:** Immutable OperationalEvent records for audit

### Frontend
- **Framework:** React 19
- **Build:** Vite
- **Styling:** Custom CSS (dark industrial theme)
- **State:** Component-level with API polling

## File Structure

```
corbel-base44/
├── backend/
│   ├── entities/types.ts            # Entity type definitions
│   ├── functions/
│   │   ├── recalculateReadiness.ts  # STATE MACHINE (linchpin)
│   │   ├── acceptOwnership.ts
│   │   ├── submitEvidence.ts
│   │   ├── verifyEvidence.ts
│   │   ├── detectHazard.ts
│   │   ├── recommendAction.ts
│   │   ├── generateReleaseReceipt.ts
│   │   └── seedDemoData.ts
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── styles.css
│   │   ├── main.tsx
│   │   └── components/
│   │       ├── OperationalControl.tsx
│   │       ├── StateDisplay.tsx
│   │       ├── RequirementsStructure.tsx
│   │       ├── EventTape.tsx
│   │       ├── ActionPanel.tsx
│   │       └── ReleaseReceipt.tsx
│   ├── index.html
│   └── package.json
├── base44.config.ts                 # Entity & agent config
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Running CORBEL

### Setup
```bash
npm install
npm run type-check
```

### Development
```bash
npm run dev
```
Frontend will run on `http://localhost:3000`

### Build
```bash
npm run build
```

## Testing the Hero Scenario

1. **Seed Demo Data:**
   ```bash
   curl -X POST http://localhost:8080/api/functions/seedDemoData
   ```

2. **Load Initial Operation:**
   - UI shows FLOOR 12 — BAY C in READY state
   - All 4 requirements satisfied

3. **Agent Detects Hazard:**
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
   - UI updates: State → HOLD_UNOWNED
   - Requirement card shows UNOWNED
   - Event added to tape

4. **Agent Recommends Release (Will Be Blocked):**
   ```bash
   curl -X POST http://localhost:8080/api/functions/recommendAction \
     -H "Content-Type: application/json" \
     -d '{
       "operationId": "op-floor12-bayc",
       "recommendationType": "RELEASE",
       "reasoning": "Hazard appears resolved"
     }'
   ```
   - System returns: `{blocked: true, reason: "RELEASE DENIED — NO ACCOUNTABLE OWNER"}`
   - UI shows rejection

5. **Maya Accepts Ownership:**
   - Click "Accept Ownership" in UI
   - Select Maya Chen
   - Requirement becomes OWNED
   - State → HOLD_OWNED

6. **Maya Submits Evidence:**
   - Click "Submit Evidence"
   - Type corrective action note
   - State → VERIFYING

7. **Jordan Verifies:**
   - Click "Verify Evidence" (as Jordan)
   - Approve
   - State → READY

8. **Generate Receipt:**
   - Click "Generate Receipt"
   - Modal shows complete event chain with SHA256 hash

## Proof Points

The demo proves:
- ✅ Agent can detect and recommend but **cannot release**
- ✅ HOLD is **server-calculated** (not frontend-set)
- ✅ Ownership is **human-authenticated** (tied to user ID)
- ✅ Verification is **independent** (verifier ≠ owner enforced)
- ✅ Realtime updates occur across roles (event tape updates)
- ✅ READY returns only after all gates pass (state machine enforces)
- ✅ Receipt is from persisted events (immutable event chain + hash)

## Design Principles

1. **Authorization Before Action:** Every state-changing action is verified server-side before execution
2. **Role Separation:** No single role can complete the entire release chain
3. **Immutable Audit:** Every action creates an event; events form a chain that generates the receipt hash
4. **Honest Constraints:** Agent is intentionally limited; system rejects unauthorized actions transparently
5. **Industrial Clarity:** Dark, forensic UI; state visible at a glance; no generic dashboard patterns

## Base44 Indispensability

CORBEL uses Base44 as the core backend for:
- **Entity storage** with Row/Field Level Security
- **Authentication & roles** for user authorization
- **Backend functions** (protected endpoints; only way to mutate state)
- **Realtime updates** via WebSocket subscriptions
- **Audit trail** (OperationalEvent records)
- **Data integrity** (RLS prevents direct entity manipulation)

Without Base44's function-based architecture and RLS, this system would be impossible to build with the same security guarantees.

---

**Built for Base44 Dev Build-Off 2026**
**Tagline:** Nothing proceeds unowned.
