# CORBEL handoff presentation layer

Pure presentation components for CORBEL. These files contain no Base44 imports, API keys, entity writes or backend function calls.

## Files

- `CorbelDashboard.jsx`
- `ForensicLoadSection.jsx`
- `RequirementDetail.jsx`
- `EventTape.jsx`
- `ReleaseReceipt.jsx`
- `corbel-handoff.css`
- `sampleData.js`
- `README.md`

## Runtime dependency

React 18 or newer. Motion is implemented with CSS keyframes; no animation package is required.

## Backend-native states

Operation:

- `READY`
- `HOLD`
- `VERIFYING`
- `RELEASED`

Requirement:

- `SATISFIED`
- `UNOWNED`
- `OWNED`
- `EVIDENCE_SUBMITTED`
- `VERIFIED`
- `REJECTED`

`owner === null` does not automatically mean `UNOWNED`. The status field is authoritative.

## CorbelDashboard props

```jsx
<CorbelDashboard
  operation={{ id, runId, name, location }}
  state="READY"
  user={{ id, name, role, canResetDemo }}
  requirements={requirements}
  events={events}
  receipt={receipt}
  busy={false}
  onDetectHazard={(requirementId) => {}}
  onAcceptOwnership={(requirementId) => {}}
  onSubmitEvidence={(requirementId) => {}}
  onApproveEvidence={(requirementId) => {}}
  onRejectEvidence={(requirementId) => {}}
  onResetDemo={() => {}}
/>
```

The host application owns data access and callback implementations.
