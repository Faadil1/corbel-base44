# CORBEL Phase 5 Evidence Ledger

Chronological record of deployment and testing evidence for CORBEL operational readiness control system.

| ID | Phase | Hypothesis | Action / Command | Expected | Observed | Status | Evidence |
|---|---|---|---|---|---|---|---|
| E-001 | Base44 Setup | App can be provisioned through CLI | Base44 create and linkage | Remote app created | App ID 6a67a87fb27a05cbd4672d8d created | PASS | CLI output |
| E-002 | Entity Deployment | Nine CORBEL entities and User extension deploy | `npx.cmd base44 entities push` | 9 create, 1 User extension | Push succeeded | PASS | Entity push output |
| E-003 | Function Cleanup | Broken Phase 5B functions can be removed safely | `base44 functions delete ...` | Only recalculate-readiness remains | 9 deleted, 1 remains | PASS | CLI output |
| E-004 | Readiness Engine | Deterministic readiness function deploys independently | Deploy recalculate-readiness | One function deployed | Deployment succeeded | PASS | Commit 7a4f9a2 |
| E-005 | Authenticated Script Runtime | Base44 exec can use authenticated CLI context | `base44.auth.me()` via `base44 exec` | Authenticated user returned | Admin user returned | PASS | Sanitized command output |
| E-006 | RLS Authenticated Read | Authenticated SDK user can read operational records | List Operation and ReadinessRequirement | 1 Operation, 4 Requirements | 0 Operation, 0 Requirements | FAIL | RLS defect reproduced remotely |
| E-007 | RLS Correction | Corrected role-based read rules expose records to authenticated users | Push corrected schemas | 9 entities with role-based read rules | Push succeeded; 9 updated entities | PASS | Entity push output |
