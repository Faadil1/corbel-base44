# Phase 5B Automated Test Plan

## Function Deployment Summary
✅ All 10 functions deployed successfully:
1. recalculate-readiness
2. detect-hazard
3. accept-ownership
4. submit-evidence
5. verify-evidence
6. generate-release-receipt
7. recommend-action
8. setup-demo
9. reset-demo
10. assign-demo-roles

## Test Execution Prerequisites

### Demo Data Setup
1. Call `setup-demo` to create demo Operation "FLOOR 12 — BAY C" with 4 CRITICAL SATISFIED requirements
2. Create demo users through auth system:
   - alex@corbel.local (OPERATIONS_LEAD)
   - maya@corbel.local (ACCOUNTABLE_OWNER)
   - jordan@corbel.local (INDEPENDENT_VERIFIER)
3. Call `assign-demo-roles` to assign corbel_role to demo users

## Test Scenarios

### Test 1: READY → HOLD after hazard
**Trigger:** detect-hazard (OPERATIONS_LEAD) reports hazard on a SATISFIED requirement
**Expected State Flow:** READY → HOLD
**Verification:**
- HazardReport created
- ReadinessRequirement status changed to UNOWNED
- Operation.currentState = HOLD
- OperationalEvent chain updated with HAZARD_DETECTED event

### Test 2: HOLD remains after ownership acceptance
**Prerequisite:** Operation in HOLD state
**Trigger:** acceptOwnership (ACCOUNTABLE_OWNER) takes responsibility
**Expected State Flow:** HOLD → HOLD (no change)
**Verification:**
- OwnershipAcceptance created
- ReadinessRequirement.ownerUserId = authenticated user
- ReadinessRequirement.status = OWNED
- OperationalEvent chain updated with OWNERSHIP_ACCEPTED event
- recalculate-readiness returns HOLD (waiting for evidence)

### Test 3: HOLD → VERIFYING after evidence submission
**Prerequisite:** Requirement in OWNED status
**Trigger:** submitEvidence (requirement owner) submits evidence
**Expected State Flow:** HOLD → VERIFYING
**Verification:**
- Evidence entity created
- ReadinessRequirement.status = EVIDENCE_SUBMITTED
- Operation.currentState = VERIFYING
- OperationalEvent chain updated with EVIDENCE_SUBMITTED event

### Test 4: VERIFYING → RELEASED after independent verification
**Prerequisite:** Requirement in EVIDENCE_SUBMITTED status
**Trigger:** verifyEvidence (INDEPENDENT_VERIFIER, not owner) approves
**Expected State Flow:** VERIFYING → RELEASED
**Verification:**
- Verification entity created with decision=APPROVED
- ReadinessRequirement.status = VERIFIED
- Operation.currentState = RELEASED
- OperationalEvent chain updated with VERIFICATION_APPROVED event

### Test 5: VERIFYING → HOLD after verification rejection
**Prerequisite:** Requirement in EVIDENCE_SUBMITTED status
**Trigger:** verifyEvidence (INDEPENDENT_VERIFIER) rejects with decision=REJECTED
**Expected State Flow:** VERIFYING → HOLD
**Verification:**
- Verification entity created with decision=REJECTED
- ReadinessRequirement.status = REJECTED
- Operation.currentState = HOLD
- OperationalEvent chain updated with VERIFICATION_REJECTED event

### Test 6: Authorization - Wrong role denied (401/403)
**Test Cases:**
- submitEvidence called by non-owner → 403 FORBIDDEN
- acceptOwnership called by non-ACCOUNTABLE_OWNER → 403 ROLE_FORBIDDEN
- verifyEvidence called by non-INDEPENDENT_VERIFIER → 403 ROLE_FORBIDDEN
- detectHazard called by non-OPERATIONS_LEAD → 403 ROLE_FORBIDDEN
- Unauthenticated call → 401 UNAUTHENTICATED

### Test 7: Owner self-verification denied
**Prerequisite:** Requirement in EVIDENCE_SUBMITTED status with owner = authenticated user
**Trigger:** verifyEvidence called by the same user who owns the requirement
**Expected Result:** 403 FORBIDDEN (independence requirement)
**Verification:**
- Error: "Verifier cannot verify evidence for requirements they own"

### Test 8: Wrong owner cannot submit evidence
**Prerequisite:** Requirement with ownerUserId = user-A
**Trigger:** submitEvidence called by user-B (different ACCOUNTABLE_OWNER)
**Expected Result:** 403 FORBIDDEN
**Verification:**
- Error: "Only the accountable owner can submit evidence for this requirement"

### Test 9: Receipt generation requires RELEASED state
**Test Cases:**
- generateReleaseReceipt when Operation.currentState = READY → 409 CONFLICT
- generateReleaseReceipt when Operation.currentState = HOLD → 409 CONFLICT
- generateReleaseReceipt when Operation.currentState = VERIFYING → 409 CONFLICT
- generateReleaseReceipt when Operation.currentState = RELEASED → 200 SUCCESS

### Test 10: RELEASED cannot come from request payload
**Trigger:** Any function attempt to set Operation.currentState = RELEASED directly
**Expected Result:** Only recalculateReadiness can set RELEASED state
**Verification:**
- All functions use asServiceRole and invoke recalculate-readiness
- recalculate-readiness is the only function that can transition to RELEASED

## Event Chain Integrity Tests

### Test 11: Event chain mutation detection
**Setup:** Generate complete event chain to RELEASED state
**Trigger:** Manually modify an event's hash in the database
**Verification:** validateEventChain detects mismatch:
- Previous hash linkage verification fails
- generateReleaseReceipt fails with "Event chain validation failed"

### Test 12: Event chain deletion detection
**Setup:** Generate complete event chain
**Trigger:** Delete a middle event from OperationalEvent table
**Verification:** validateEventChain detects broken chain:
- "Event chain broken: expected previousHash X, got null"
- generateReleaseReceipt fails

### Test 13: Event chain reordering detection
**Setup:** Generate complete event chain
**Trigger:** Reorder two events in the database (change createdAt)
**Verification:** validateEventChain detects invalid hash sequence:
- Previous event's hash no longer matches
- Chain validation fails

### Test 14: Event hash consistency
**Verification:** For all events in chain:
- previousEventHash on event N equals eventHash on event N-1
- eventHash on event N = SHA256(previousHash + canonicalPayload)
- All hashes recomputed independently match stored hashes

## Role-Based Authorization Matrix

| Function | OPERATIONS_LEAD | ACCOUNTABLE_OWNER | INDEPENDENT_VERIFIER | Anonymous |
|----------|---|---|---|---|
| detect-hazard | ✅ | ❌ | ❌ | ❌ |
| accept-ownership | ❌ | ✅ | ❌ | ❌ |
| submit-evidence | ❌ (owner-only) | ✅ (owner-only) | ❌ | ❌ |
| verify-evidence | ❌ | ❌ | ✅ | ❌ |
| generate-release-receipt | ✅ | ⚠️ | ✅ | ⚠️ |
| recommend-action | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| setup-demo | ✅ | ❌ | ❌ | ❌ |

✅ = Allowed, ❌ = Denied (403), ⚠️ = Read-only/Advisory

## Test Execution Commands

```bash
# 1. Setup demo environment
curl -X POST http://localhost:5000/functions/setup-demo \
  -H "Authorization: Bearer <ops-lead-token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. Assign demo roles
curl -X POST http://localhost:5000/functions/assign-demo-roles \
  -H "Authorization: Bearer <ops-lead-token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. Test state transitions with specific users
# [See individual test scenarios above]

# 4. Validate event chain
curl -X POST http://localhost:5000/functions/generate-release-receipt \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"operationId":"op-floor12-bayc"}'
```

## Test Results Status

All functions deployed and accessible:
- ✅ recalculate-readiness
- ✅ detect-hazard
- ✅ accept-ownership
- ✅ submit-evidence
- ✅ verify-evidence
- ✅ generate-release-receipt
- ✅ recommend-action
- ✅ setup-demo
- ✅ reset-demo
- ✅ assign-demo-roles

**Note:** Empirical remote testing with authenticated demo users is blocked until demo user accounts are created through the authentication system. See test prerequisites above.
