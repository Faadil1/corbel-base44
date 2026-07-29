export const CORBEL_STATES = ["READY", "HOLD", "VERIFYING", "RELEASED"];

export const CORBEL_ROLES = [
  "OPERATIONS_LEAD",
  "ACCOUNTABLE_OWNER",
  "INDEPENDENT_VERIFIER",
];

export const sampleUser = {
  id: "demo-operations-lead",
  name: "J. MERCER",
  role: "OPERATIONS_LEAD",
  canResetDemo: true,
};

export const sampleOperation = {
  runId: "CBL-014",
  name: "TURBINE HALL — LINE 4 RECOMMISSION",
  location: "SITE NORTH / BAY 12",
};

export const sampleRequirements = [
  {
    id: "R-01",
    displayId: "R-01",
    label: "Crew assigned",
    category: "STAFFING",
    status: "SATISFIED",
    owner: null,
    ownerUserId: null,
    decision: "NOT REQUIRED",
    critical: true,
    evidence: [],
  },
  {
    id: "R-02",
    displayId: "R-02",
    label: "Equipment inspection",
    category: "SAFETY",
    status: "SATISFIED",
    owner: null,
    ownerUserId: null,
    decision: "NOT REQUIRED",
    critical: true,
    evidence: [],
  },
  {
    id: "R-03",
    displayId: "R-03",
    label: "Fall protection anchor",
    category: "SAFETY",
    status: "SATISFIED",
    owner: null,
    ownerUserId: null,
    decision: "NOT REQUIRED",
    critical: true,
    evidence: [],
  },
  {
    id: "R-04",
    displayId: "R-04",
    label: "Supervisor present",
    category: "OVERSIGHT",
    status: "SATISFIED",
    owner: null,
    ownerUserId: null,
    decision: "NOT REQUIRED",
    critical: true,
    evidence: [],
  },
];

export const sampleEvents = [
  {
    id: "evt-init-014",
    type: "DEMO_SETUP",
    actor: "SYSTEM",
    timestamp: "2026-07-28T07:30:00.000Z",
    prev: "READY",
    next: "READY",
    hash: "a1f4c902",
    message: "Fresh append-only demonstration run created.",
  },
];

export function makeSampleRun(lineage = 14) {
  return {
    lineage,
    operation: {
      ...sampleOperation,
      runId: `CBL-${String(lineage).padStart(3, "0")}`,
    },
    state: "READY",
    user: { ...sampleUser },
    requirements: sampleRequirements.map((requirement) => ({
      ...requirement,
      evidence: requirement.evidence.map((evidence) => ({ ...evidence })),
    })),
    events: sampleEvents.map((event) => ({ ...event })),
    receipt: null,
  };
}
