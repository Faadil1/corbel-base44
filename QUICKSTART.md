# CORBEL Quick Start

## One-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Start mock server + frontend (in parallel)
npm run dev
```

**That's it.**

- Frontend: http://localhost:3000
- Server: http://localhost:8080

---

## One-Minute Demo

1. **Open** http://localhost:3000
   - See "FLOOR 12 — BAY C" in READY state (green)
   - All 4 requirements show SATISFIED (green checkmarks)

2. **Click** "Agent: Recommend Release"
   - Agent proposes RELEASE
   - System accepts it (all requirements satisfied)
   - ✓ APPROVED

3. **Click** "Dev Reset"
   - Everything cleared
   - Back to initial READY state
   - Event tape empty

**→ This proves the agent CAN recommend when conditions are met.**

---

## Full Hero Scenario (8 seconds)

Read [DEMO.md](./DEMO.md) for the complete walkthrough:
- Hazard detected → operation HELD
- Agent blocked from releasing
- Owner accepts responsibility
- Evidence submitted and verified
- Release receipt generated

**Run the scenario:**

```bash
# In terminal, run these commands in sequence:
curl -X POST http://localhost:8080/api/functions/detectHazard \
  -H "Content-Type: application/json" \
  -d '{"operationId":"op-floor12-bayc","requirementId":"req-fallprotection","title":"Fall protection anchor incomplete","severity":"HIGH"}'

curl -X POST http://localhost:8080/api/functions/acceptOwnership \
  -H "Content-Type: application/json" \
  -d '{"operationId":"op-floor12-bayc","requirementId":"req-fallprotection","userId":"user-maya"}'

curl -X POST http://localhost:8080/api/functions/submitEvidence \
  -H "Content-Type: application/json" \
  -d '{"operationId":"op-floor12-bayc","requirementId":"req-fallprotection","userId":"user-maya","evidenceType":"PHOTO","note":"Anchor reinforced"}'

curl -X POST http://localhost:8080/api/functions/verifyEvidence \
  -H "Content-Type: application/json" \
  -d '{"operationId":"op-floor12-bayc","requirementId":"req-fallprotection","userId":"user-jordan","decision":"APPROVED","note":"Evidence confirmed"}'

curl -X POST http://localhost:8080/api/functions/generateReleaseReceipt \
  -H "Content-Type: application/json" \
  -d '{"operationId":"op-floor12-bayc"}'
```

**In browser:**
- Watch state change READY → HOLD_UNOWNED → HOLD_OWNED → VERIFYING → READY
- Watch requirements change color (red/amber/green)
- Watch event tape update with each action
- See final receipt with SHA256 hash

---

## What This Is

CORBEL is an operational release-control system that enforces **accountability through role separation**.

**Core Principle:** "Nothing proceeds unowned."

- ✅ Agent can detect and recommend
- ❌ Agent cannot accept ownership or release
- ✅ Owner can submit evidence
- ❌ Owner cannot verify their own evidence
- ✅ Verifier can approve
- ❌ Verifier cannot be the owner

**Result:** Work cannot proceed without:
1. A named accountable owner
2. An independent verification
3. All gates passing (determined server-side)

---

## Files to Know

| File | Purpose |
|---|---|
| `backend/functions/*.ts` | Protected backend functions (state transitions) |
| `backend/server.ts` | Mock API server (simulates Base44) |
| `frontend/src/components/*.tsx` | React UI components |
| `frontend/src/styles.css` | Dark industrial theme |
| `README.md` | Full architecture documentation |
| `DEMO.md` | Detailed walkthrough of hero scenario |

---

## Next Steps

- **Understand the flow:** Read [README.md](./README.md)
- **Run the demo:** See [DEMO.md](./DEMO.md)
- **Explore the code:**
  - `backend/functions/recalculateReadiness.ts` — The state machine (linchpin)
  - `backend/functions/verifyEvidence.ts` — Authorization enforcement (verifier ≠ owner)
  - `frontend/src/components/OperationalControl.tsx` — Main UI

---

## Architecture at a Glance

```
Agent detects hazard
  ↓
Backend: detectHazard() → requirement UNOWNED
  ↓
Backend: recalculateReadiness() → operation HOLD_UNOWNED
  ↓
[UI shows large red "HOLD_UNOWNED"]
  ↓
Agent recommends RELEASE
  ↓
Backend: recommendAction() evaluates authorization
  ↓
System rejects: "RELEASE DENIED — NO ACCOUNTABLE OWNER"
  ↓
Human accepts ownership (authenticated user)
  ↓
Backend: acceptOwnership() → requirement OWNED
  ↓
Backend: recalculateReadiness() → operation HOLD_OWNED
  ↓
Human submits evidence
  ↓
Backend: submitEvidence() → requirement EVIDENCE_SUBMITTED
  ↓
Backend: recalculateReadiness() → operation VERIFYING
  ↓
Independent verifier approves (different user)
  ↓
Backend: verifyEvidence() → requirement VERIFIED
  ↓
Backend: recalculateReadiness() → operation READY
  ↓
Backend: generateReleaseReceipt() creates immutable receipt with event hash
  ↓
[UI shows green "READY" + receipt modal]
```

**No step can be skipped. No role can complete the chain alone.**

---

## Proof This Works

1. **Agent cannot release:**  
   Click "Agent: Recommend Release" during HOLD_UNOWNED → System blocks with reason

2. **State is server-calculated:**  
   Every state change tied to requirement status; never written by frontend

3. **Ownership is human-authenticated:**  
   User ID tied to OwnershipAcceptance record

4. **Verification is independent:**  
   Verifier ≠ owner enforced; if same user tries to verify their own work, backend rejects

5. **Realtime updates:**  
   Event tape updates as you click buttons; no refresh needed

6. **Receipt is immutable:**  
   SHA256 hash of sorted event IDs; refresh browser and receipt is identical

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start mock server + frontend (parallel) |
| `npm run server` | Start mock server only (port 8080) |
| `npm run frontend` | Start frontend only (port 3000) |
| `npm run build` | Build for production |
| `npm run type-check` | TypeScript validation |

---

## Troubleshooting

**"Cannot GET /api/..."**
→ Server not running. Try `npm run server` in separate terminal.

**State not updating**
→ Check browser console. Try refresh. Check server logs.

**Mock data persists across refresh**
→ Expected. Click "Dev Reset" to clear, or restart server with Ctrl+C.

---

## Base44 Integration

This demo uses a mock server. In production:

- Replace `backend/server.ts` with real Base44 SDK calls
- Backend functions would run on Base44's Deno runtime
- Entity reads/writes would hit Base44's database
- Authentication would use Base44's auth system
- Realtime subscriptions would use Base44 WebSocket

The authorization logic, state machine, and UI would be **identical**.

---

## That's It

CORBEL is now running.

**Start:** `npm run dev`  
**Demo:** http://localhost:3000  
**Walkthrough:** [DEMO.md](./DEMO.md)
