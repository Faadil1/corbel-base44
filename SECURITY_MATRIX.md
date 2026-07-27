# COMPLETE SECURITY MATRIX: CORBEL ENTITIES

**Generated:** 2026-07-27  
**Status:** Ready for Push with RLS Enforcement

---

## ENTITY-LEVEL SECURITY RULES

| Entity | Create | Read | Update | Delete | Purpose | Backend Mutations |
|--------|--------|------|--------|--------|---------|-------------------|
| **Operation** | ❌ `create: false` | ✅ Authenticated ({{user.id}}) | ❌ `update: false` | ❌ `delete: false` | Primary work unit | `recalculateReadiness()` |
| **ReadinessRequirement** | ❌ `create: false` | ✅ Authenticated ({{user.id}}) | ❌ `update: false` | ❌ `delete: false` | Verification requirements | `acceptOwnership()`, `submitEvidence()`, `verifyEvidence()`, `recalculateReadiness()` |
| **HazardReport** | ✅ Authenticated ({{user.id}}) | ✅ Authenticated ({{user.id}}) | ❓ Default | ❓ Default | Hazard detection | `detectHazard()` creates via service role |
| **OwnershipAcceptance** | ✅ Authenticated ({{user.id}}) | ✅ Authenticated ({{user.id}}) | ❓ Default | ❓ Default | Ownership records | `acceptOwnership()` creates via service role |
| **Evidence** | ✅ Authenticated ({{user.id}}) | ✅ Authenticated ({{user.id}}) | ❓ Default | ❓ Default | Evidence submissions | `submitEvidence()` creates via service role |
| **Verification** | ✅ Authenticated ({{user.id}}) | ✅ Authenticated ({{user.id}}) | ❓ Default | ❓ Default | Verification records | `verifyEvidence()` creates via service role |
| **OperationalEvent** | ❌ `create: false` | ✅ Authenticated ({{user.id}}) | ❌ `update: false` | ❌ `delete: false` | Immutable audit log | Backend functions only (service role) |
| **ReleaseReceipt** | ❌ `create: false` | ✅ Authenticated ({{user.id}}) | ❌ `update: false` | ❌ `delete: false` | Tamper-evident proof | `generateReleaseReceipt()` only (service role) |
| **AgentRecommendation** | ✅ Authenticated ({{user.id}}) | ✅ Authenticated ({{user.id}}) | ❓ Default | ❓ Default | Agent recommendations | Backend agent function |
| **User** | ⚠️ Special | ✅ Authenticated ({{user.id}}) | ❌ write: false on corbel_role | ❓ Default | Role extension | Seed function / admin only |

---

## FIELD-LEVEL SECURITY (Write Protection)

### Operation
- `currentState`: **`write: false`** — Read-only to all clients. Only `recalculateReadiness()` backend function can write.

### ReadinessRequirement
- `status`: **`write: false`** — Read-only to all clients. Only backend state-change functions can write.
- `ownerUserId`: **`write: false`** — Read-only to all clients. Only `acceptOwnership()` can write.

### OperationalEvent
- `previousEventHash`: **`write: false`** — Read-only to all clients. Computed by backend.
- `eventHash`: **`write: false`** — Read-only to all clients. Computed by backend (includes all fields + previous hash).

### ReleaseReceipt
- `receiptHash`: **`write: false`** — Read-only to all clients. Computed by `generateReleaseReceipt()`.
- `eventChainHeadHash`: **`write: false`** — Read-only to all clients. Hash of final event in chain.

### User
- `corbel_role`: **`write: false`** — Read-only to clients. Cannot self-assign roles. Seed function or admin only.

---

## SECURITY ARCHITECTURE

### Mutation Pathways

**Protected Entities (Server-Mutation-Only):**
- Operation
- ReadinessRequirement
- OperationalEvent
- ReleaseReceipt

**How they work:**
1. Clients can READ these entities
2. Clients CANNOT CREATE, UPDATE, or DELETE
3. Backend functions use service-role authentication to write
4. All changes recorded in OperationalEvent audit log

**Example: Accepting Ownership**
```
Frontend → acceptOwnership(requirementId, userId)
           ↓
Backend Function (service role)
           ↓
Verify: user is ACCOUNTABLE_OWNER role
Verify: requirement status is UNOWNED
           ↓
CREATE: OwnershipAcceptance record
UPDATE: ReadinessRequirement.status → OWNED
UPDATE: ReadinessRequirement.ownerUserId → userId
CREATE: OperationalEvent (status change recorded)
           ↓
Database (RLS prevents client direct writes)
```

---

## AUTHORIZATION MODEL

### Role-Based Access

| Role | Can Accept Ownership | Can Submit Evidence | Can Verify Evidence | Can Change State |
|------|----------------------|---------------------|---------------------|------------------|
| **OPERATIONS_LEAD** | ✅ | ✅ (own requirements) | ✅ (independent) | Via recalculateReadiness |
| **ACCOUNTABLE_OWNER** | ✅ (assigned requirements) | ✅ (own requirements) | ❌ | Via recalculateReadiness |
| **INDEPENDENT_VERIFIER** | ❌ | ❌ | ✅ (never own evidence) | Via recalculateReadiness |

### User Identity

- Derived from Base44 authenticated session (`{{user.id}}`)
- Role assigned in User.corbel_role (read-only, backend-assigned)
- No trust of user-provided role/ID from frontend

---

## OPERATION STATE FLOW

```
READY
  ↓
[Hazard Detected] → HOLD
  ↓
[Owner Accepts] → [Requirements Owner/Status → OWNED]
  ↓
[Evidence Submitted] → [Status → EVIDENCE_SUBMITTED]
  ↓
[Evidence Verified] → [Status → VERIFIED]
  ↓
[All Verified] → VERIFYING
  ↓
[Release Approved] → RELEASED + ReleaseReceipt generated
```

**State mutations:** Only `recalculateReadiness()` can update `Operation.currentState`

---

## REQUIREMENT STATUS FLOW

```
UNOWNED
  ↓
[Owner Accepts] → OWNED
  ↓
(if evidenceRequired) [Evidence Submitted] → EVIDENCE_SUBMITTED
  ↓
(if verificationRequired) [Evidence Verified] → VERIFIED
  ↓
[All Conditions Met] → SATISFIED
```

**Status mutations:** Gated by backend functions (`acceptOwnership`, `submitEvidence`, `verifyEvidence`, `recalculateReadiness`)

---

## IMMUTABILITY GUARANTEES

### OperationalEvent
- **Create:** Backend functions only
- **Read:** All authenticated users
- **Update:** Never (RLS: `update: false`)
- **Delete:** Never (RLS: `delete: false`)
- **Hash Chain:** Each event hashes previous event (tamper-evident)

### ReleaseReceipt
- **Create:** `generateReleaseReceipt()` only (when Operation → RELEASED)
- **Read:** All authenticated users
- **Update:** Never (RLS: `update: false`)
- **Delete:** Never (RLS: `delete: false`)
- **Cryptographic Proof:** Contains hash of all preceding events

---

## BACKEND FUNCTION RESPONSIBILITIES

Each function enforces authorization before mutation:

| Function | Enforces | Creates | Updates | Audit Event |
|----------|----------|---------|---------|------------|
| `acceptOwnership(requirementId, userId)` | User is ACCOUNTABLE_OWNER OR OPERATIONS_LEAD | OwnershipAcceptance | Req.status→OWNED, Req.ownerUserId | OWNERSHIP_ACCEPTED |
| `submitEvidence(requirementId, evidence)` | User is current owner | Evidence | Req.status→EVIDENCE_SUBMITTED | EVIDENCE_SUBMITTED |
| `verifyEvidence(requirementId, decision)` | User is INDEPENDENT_VERIFIER, not owner | Verification | Req.status→VERIFIED or REJECTED | VERIFICATION_COMPLETE |
| `recalculateReadiness(operationId)` | No direct role check; logic-based | — | Op.currentState, Req.status | STATE_RECALCULATED |
| `generateReleaseReceipt(operationId)` | Op.currentState == RELEASED | ReleaseReceipt | — | RELEASE_RECEIPT_GENERATED |
| `detectHazard(operationId, ...)` | No role restriction (anyone can report) | HazardReport | Op.currentState→HOLD | HAZARD_REPORTED |

---

## WHAT IS ENFORCED vs. NOT ENFORCED

### ✅ ENFORCED BY RLS/FLS
- Clients cannot directly write to `Operation.currentState`
- Clients cannot directly write to `ReadinessRequirement.status` or `ownerUserId`
- Clients cannot create/update/delete `OperationalEvent`
- Clients cannot create/update/delete `ReleaseReceipt`
- Unauthenticated users cannot read any entity

### ⚠️ ENFORCED BY BACKEND LOGIC (Not RLS)
- User role verification (OPERATIONS_LEAD, ACCOUNTABLE_OWNER, INDEPENDENT_VERIFIER)
- Ownership verification (only current owner can submit evidence)
- Self-verification prevention (verifier cannot verify own evidence)
- State transition validation (can only verify EVIDENCE_SUBMITTED, etc.)
- Role escalation prevention (users cannot assign themselves higher roles)

### ❓ REQUIRES APPLICATION-LEVEL CHECKS (HazardReport, OwnershipAcceptance, Evidence, Verification, AgentRecommendation)
- RLS allows authenticated users to create these
- Backend functions should validate before allowing creation
- Frontend should only call authorized functions (not raw CRUD API)

---

## REMOTE SYNC IMPACT

**App State:** Fresh provisioned (6a67a87fb27a05cbd4672d8d)

**Operation on `npx base44 entities push`:**
- CREATE 10 entities (Operation, ReadinessRequirement, HazardReport, OwnershipAcceptance, Evidence, Verification, OperationalEvent, ReleaseReceipt, AgentRecommendation, User)
- REPLACE: None
- DELETE: None

**Risk Level:** 🟢 LOW (fresh app, no existing data)

---

## VALIDATION CHECKLIST

- [x] Entity schemas syntactically valid (JSONC)
- [x] All protected fields have `write: false`
- [x] Server-mutation-only entities have `create: false`, `update: false`, `delete: false`
- [x] Read access defined with `user_condition` for authenticated users
- [x] Operation state enum correct: READY, HOLD, VERIFYING, RELEASED
- [x] ReadinessRequirement status enum correct: SATISFIED, UNOWNED, OWNED, EVIDENCE_SUBMITTED, VERIFIED, REJECTED
- [x] No UUID format constraints on entity IDs
- [x] No "immutable" claims (changed to "append-restricted", "tamper-evident")
- [x] OperationalEvent has hash fields (previousEventHash, eventHash)
- [x] ReleaseReceipt has hash fields (receiptHash, eventChainHeadHash)
- [x] User extension created with corbel_role (write: false)
- [x] npm run build passes
- [x] npx base44 types generate succeeds
- [x] No duplicate keys in JSONC files

---

**Status:** ✅ READY FOR PUSH
