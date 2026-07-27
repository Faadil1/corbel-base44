# PHASE 5A: ENTITY SCHEMAS REPORT

## 1. ENTITY FILE TREE

```
base44/entities/
├── operation.jsonc
├── readiness-requirement.jsonc
├── hazard-report.jsonc
├── ownership-acceptance.jsonc
├── evidence.jsonc
├── verification.jsonc
├── operational-event.jsonc
├── release-receipt.jsonc
└── agent-recommendation.jsonc
```

**Total:** 9 entity definitions

---

## 2. ENTITY SCHEMAS

### Operation
**Purpose:** Primary work unit with operational readiness state

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Operation name |
| `location` | string | ✅ | Geographic or facility location |
| `currentState` | enum (READY \| HOLD_UNOWNED \| HOLD_OWNED \| VERIFYING) | ✅ | Current readiness state |
| `createdAt` | date-time | ✅ | Creation timestamp |
| `updatedAt` | date-time | ✅ | Last modification timestamp |

**Server-Only Fields:**
- `currentState` — Modified exclusively by `recalculateReadiness` function

---

### ReadinessRequirement
**Purpose:** Individual verification requirement for an operation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | uuid | ✅ | Reference to parent Operation |
| `label` | string | ✅ | Human-readable requirement label |
| `category` | string | ✅ | Category for grouping |
| `criticality` | enum (CRITICAL \| STANDARD) | ✅ | Importance level |
| `status` | enum (SATISFIED \| UNOWNED \| OWNED \| EVIDENCE_SUBMITTED \| VERIFIED \| REJECTED) | ✅ | Verification state |
| `ownerUserId` | string | ✅ | User ID of owner (empty if unowned) |
| `evidenceRequired` | boolean | ✅ | Whether evidence must be submitted |
| `verificationRequired` | boolean | ✅ | Whether independent verification required |
| `createdAt` | date-time | ✅ | Creation timestamp |

**Server-Only Fields:**
- `status` — Modified only by backend functions (`acceptOwnership`, `submitEvidence`, `verifyEvidence`)
- `ownerUserId` — Modified only by `acceptOwnership` function

---

### HazardReport
**Purpose:** Operational hazard detection and tracking

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | uuid | ✅ | Reference to parent Operation |
| `requirementId` | uuid | ✅ | Reference to related ReadinessRequirement |
| `reportedBy` | string | ✅ | User ID of hazard reporter |
| `title` | string | ✅ | Hazard title |
| `description` | richtext | ✅ | Detailed hazard description |
| `severity` | enum (LOW \| MEDIUM \| HIGH) | ✅ | Hazard severity level |
| `photoUrl` | uri | ❌ | Optional photo URL (empty if none) |
| `createdAt` | date-time | ✅ | Report timestamp |

---

### OwnershipAcceptance
**Purpose:** Record of user accepting ownership of a requirement

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirementId` | uuid | ✅ | Reference to ReadinessRequirement |
| `acceptedBy` | string | ✅ | User ID of owner accepting responsibility |
| `acceptedAt` | date-time | ✅ | Timestamp of acceptance |
| `status` | enum (ACTIVE \| SUPERSEDED) | ✅ | Whether this acceptance is current |

---

### Evidence
**Purpose:** Proof submitted to satisfy a requirement

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirementId` | uuid | ✅ | Reference to ReadinessRequirement |
| `submittedBy` | string | ✅ | User ID of submitter (must be current owner) |
| `evidenceType` | enum (PHOTO \| DOCUMENT \| REPORT \| NOTE) | ✅ | Type of evidence |
| `fileUrl` | uri | ❌ | URL to evidence file (empty if none) |
| `note` | richtext | ✅ | Free-form note about evidence |
| `submittedAt` | date-time | ✅ | Submission timestamp |

**Constraints:**
- Only current requirement owner can submit evidence (enforced by `submitEvidence` function)

---

### Verification
**Purpose:** Independent review and approval/rejection of evidence

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirementId` | uuid | ✅ | Reference to ReadinessRequirement |
| `verifierUserId` | string | ✅ | User ID of independent verifier |
| `decision` | enum (APPROVED \| REJECTED) | ✅ | Verification decision |
| `note` | richtext | ✅ | Verifier's reasoning |
| `verifiedAt` | date-time | ✅ | Verification decision timestamp |

**Constraints:**
- Verifier cannot be the evidence submitter (enforced by `verifyEvidence` function)

---

### OperationalEvent
**Purpose:** Immutable audit log of state changes and actions

**🔒 SERVER-ONLY ENTITY**
- Clients **CANNOT** create, update, or delete events
- Events created exclusively by backend functions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | uuid | ✅ | Reference to Operation |
| `eventType` | string | ✅ | Type of event (OWNERSHIP_ACCEPTED, EVIDENCE_SUBMITTED, etc.) |
| `actorUserId` | string | ✅ | User ID of actor (or 'system' for automated) |
| `previousState` | string | ❌ | State before event (empty if not applicable) |
| `newState` | string | ❌ | State after event (empty if not applicable) |
| `message` | richtext | ✅ | Human-readable event description |
| `metadata` | object | ❌ | Event-specific data |
| `createdAt` | date-time | ✅ | Event timestamp |

---

### ReleaseReceipt
**Purpose:** Immutable cryptographic receipt proving release

**🔒 SERVER-ONLY ENTITY**
- Clients **CANNOT** create, update, or delete receipts
- Receipts generated exclusively by `generateReleaseReceipt` function

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | uuid | ✅ | Reference to released Operation |
| `releaseStatus` | enum (RELEASED) | ✅ | Always RELEASED |
| `eventChain` | array[string] | ✅ | Sequence of event IDs (audit trail) |
| `receiptHash` | string | ✅ | Cryptographic hash (tamper-evidence) |
| `generatedAt` | date-time | ✅ | Receipt generation timestamp |

---

### AgentRecommendation
**Purpose:** AI agent recommendations for operational readiness

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | uuid | ✅ | Reference to Operation |
| `recommendationType` | enum (RELEASE \| HOLD \| ESCALATE) | ✅ | Type of recommendation |
| `reasoning` | richtext | ✅ | AI-generated reasoning |
| `blocked` | boolean | ✅ | Whether recommendation is blocked |
| `blockReason` | string | ❌ | Reason if blocked (empty if not) |
| `createdAt` | date-time | ✅ | Recommendation timestamp |

---

## 3. PERMISSIONS & ROW-LEVEL SECURITY (RLS)

### Read Permissions
- **Clients:** Can read all entities (Operation, Requirements, Evidence, Events, etc.)
- **Filtering:** Events and Receipts can be filtered by Operation reference

### Write Permissions (Client vs. Server)

| Entity | Client Create | Client Update | Client Delete | Server-Only |
|--------|---------------|---------------|---------------|-------------|
| Operation | ❌ | ❌ | ❌ | ✅ |
| ReadinessRequirement | ❌ | ❌ | ❌ | ✅ |
| HazardReport | ✅ (via detectHazard function) | ❌ | ❌ | ✅ |
| OwnershipAcceptance | ✅ (via acceptOwnership function) | ❌ | ❌ | ✅ |
| Evidence | ✅ (via submitEvidence, owner only) | ❌ | ❌ | ✅ |
| Verification | ✅ (via verifyEvidence, verifier only) | ❌ | ❌ | ✅ |
| OperationalEvent | ❌ | ❌ | ❌ | **🔒 Servers only** |
| ReleaseReceipt | ❌ | ❌ | ❌ | **🔒 Server only** |
| AgentRecommendation | ✅ (via agent function) | ❌ | ❌ | ✅ |

### State Mutation Restrictions

| Field | Who Can Modify | How |
|-------|-------|-----|
| `Operation.currentState` | Only backend | `recalculateReadiness()` function |
| `ReadinessRequirement.status` | Only backend | Functions: `acceptOwnership`, `submitEvidence`, `verifyEvidence`, `recalculateReadiness` |
| `ReadinessRequirement.ownerUserId` | Only backend | `acceptOwnership()` function |
| `OperationalEvent.*` | Server only | Functions create; clients cannot touch |
| `ReleaseReceipt.*` | Server only | `generateReleaseReceipt()` function; read-only to clients |

---

## 4. SERVER-ONLY FIELDS

**Fields that must be read-only to clients (enforced at database level):**

1. **Operation.currentState**
   - Only `recalculateReadiness` can write
   - Clients can read to display status

2. **ReadinessRequirement.status**
   - Only state-changing functions can write
   - Clients can read to display status

3. **ReadinessRequirement.ownerUserId**
   - Only `acceptOwnership` can write
   - Clients can read to verify ownership

4. **OperationalEvent** (entire entity)
   - Clients **cannot** create, update, or delete
   - Functions write events to audit trail
   - Clients can read for history

5. **ReleaseReceipt** (entire entity)
   - Clients **cannot** create, update, or delete
   - Only `generateReleaseReceipt` creates
   - Clients can read to verify release

---

## 5. UNSUPPORTED BASE44 CAPABILITIES

**Requirements from CORBEL not directly supported by Base44 entities:**

1. **Event Hash Chaining**
   - Base44 entities don't provide built-in hash chaining
   - CORBEL's tamper-evident chain will be implemented in backend functions
   - Events stored with event IDs; `ReleaseReceipt.receiptHash` computed in `generateReleaseReceipt()`

2. **Automatic RLS Enforcement**
   - Base44 has no built-in role-based access control via config
   - RLS will be implemented in backend functions
   - Example: `submitEvidence()` checks that user is current owner before allowing write

3. **Audit Trail Immutability**
   - No built-in record locking in Base44
   - Immutability enforced via function logic (no update/delete operations exposed)

---

## 6. EXACT PUSH COMMAND

```bash
npx base44 entities push
```

**Flags:**
- No `--force` flag (safe)
- No `--dry-run` flag available (will commit on success)

---

## 7. PUSH OPERATION IMPACT

**What will happen on push:**

- **Action:** CREATE (9 new entities)
- **Remote state before:** No entities exist
- **Remote state after:** All 9 entities uploaded to Base44 backend
- **Deletions:** None
- **Updates:** None
- **Conflicts:** None (fresh project)

**Risk level:** 🟢 LOW
- Creating new entities on empty project
- No existing data to lose
- Full rollback possible if needed

---

## 8. TYPE GENERATION

Entities have been validated and types generated:
- `base44/.types/types.d.ts` created
- All 9 entities recognized by Base44 CLI
- No schema errors remaining

---

## RECOMMENDATION

### ✅ Safe to Push

All entities are:
- ✅ Syntactically valid JSONC
- ✅ Recognized by Base44 CLI
- ✅ Aligned with CORBEL business logic
- ✅ Properly constrained (server-only fields documented)
- ✅ No unsupported features blocking deployment

**Prerequisites for Phase 5B (backend functions):**
1. Push entities first (this phase)
2. Verify entity creation in Base44 dashboard
3. Then migrate backend functions (Phase 5B)
4. Create tests (Phase 5C)
5. Update frontend (Phase 5D)

---

**Generated:** 2026-07-27
**Status:** Ready for `npx base44 entities push`
