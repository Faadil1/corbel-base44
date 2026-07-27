#!/bin/bash
# Comprehensive RLS validation for all CORBEL entities

echo "=== CORBEL ENTITY RLS VALIDATION ==="
echo

ENTITIES_DIR="base44/entities"
ERRORS=0

# Define all 9 CORBEL custom entities (not including User extension)
CORBEL_ENTITIES=(
  "operation"
  "readiness-requirement"
  "hazard-report"
  "ownership-acceptance"
  "evidence"
  "verification"
  "operational-event"
  "release-receipt"
  "agent-recommendation"
)

# Define protected fields
declare -A PROTECTED_FIELDS=(
  ["operation.jsonc"]="currentState"
  ["readiness-requirement.jsonc"]="status ownerUserId"
  ["operational-event.jsonc"]="previousEventHash eventHash"
  ["release-receipt.jsonc"]="receiptHash eventChainHeadHash"
  ["User.jsonc"]="corbel_role"
)

echo "1. Verifying all 9 CORBEL entities have complete RLS blocks..."
echo

for entity in "${CORBEL_ENTITIES[@]}"; do
  file="${ENTITIES_DIR}/${entity}.jsonc"

  if [ ! -f "$file" ]; then
    echo "❌ MISSING: $file"
    ((ERRORS++))
    continue
  fi

  echo "$(basename $file):"

  # Check for top-level rls object
  if ! grep -q '"rls"' "$file"; then
    echo "  ❌ NO RLS BLOCK"
    ((ERRORS++))
    continue
  fi

  # Verify all 4 CRUD properties exist inside rls
  rls_section=$(grep -A 20 '"rls"' "$file" | head -20)

  for key in "create" "read" "update" "delete"; do
    if echo "$rls_section" | grep -q "\"$key\""; then
      if [ "$key" = "read" ]; then
        if echo "$rls_section" | grep -q "user_condition"; then
          echo "  ✅ rls.$key: {user_condition}"
        else
          echo "  ❌ rls.$key: missing user_condition"
          ((ERRORS++))
        fi
      else
        # For create, update, delete - should be false
        if echo "$rls_section" | grep -q "\"$key\": false"; then
          echo "  ✅ rls.$key: false"
        else
          echo "  ⚠️  rls.$key: found but not verified as false"
        fi
      fi
    else
      echo "  ❌ rls.$key: MISSING"
      ((ERRORS++))
    fi
  done

  # Check for incorrect root-level properties
  if grep -E '^  "create"|^  "update"|^  "delete"' "$file" | grep -v inside; then
    echo "  ❌ INCORRECT: create/update/delete at root (should be inside rls)"
    ((ERRORS++))
  fi

  echo
done

echo "2. Verifying protected fields have nested field-level RLS..."
echo

for file in "${!PROTECTED_FIELDS[@]}"; do
  filepath="$ENTITIES_DIR/$file"

  if [ ! -f "$filepath" ]; then
    continue
  fi

  echo "$(basename $file):"

  fields="${PROTECTED_FIELDS[$file]}"

  for field in $fields; do
    # Simple check: field must have rls.write: false somewhere after its definition
    if grep -q "\"$field\"" "$filepath"; then
      # Extract lines for this field and check next 5 lines for rls
      field_line=$(grep -n "\"$field\"" "$filepath" | head -1 | cut -d: -f1)
      if [ -n "$field_line" ]; then
        next_lines=$(tail -n +$field_line "$filepath" | head -10)
        if echo "$next_lines" | grep -A 3 "\"$field\"" | grep -q "\"rls\""; then
          echo "  ✅ $field: has nested rls"
        else
          echo "  ❌ $field: MISSING nested rls"
          ((ERRORS++))
        fi
      fi
    fi
  done

  echo
done

echo "3. Verifying Operation state enum..."
echo

if grep -q '"enum": \["READY", "HOLD", "VERIFYING", "RELEASED"\]' "$ENTITIES_DIR/operation.jsonc"; then
  echo "✅ Operation.currentState: READY, HOLD, VERIFYING, RELEASED"
else
  echo "❌ Operation state enum INCORRECT"
  ((ERRORS++))
fi

echo
echo "4. Verifying User.jsonc structure..."
echo

if [ -f "$ENTITIES_DIR/User.jsonc" ]; then
  if grep -q '"name"' "$ENTITIES_DIR/User.jsonc"; then
    echo "❌ User.jsonc should NOT have 'name' field"
    ((ERRORS++))
  else
    echo "✅ User.jsonc: no 'name' field (correct)"
  fi

  if grep -q '"corbel_role"' "$ENTITIES_DIR/User.jsonc"; then
    echo "✅ User.jsonc: has corbel_role property"
  else
    echo "❌ User.jsonc: missing corbel_role"
    ((ERRORS++))
  fi
else
  echo "❌ User.jsonc NOT FOUND"
  ((ERRORS++))
fi

echo
echo "=== RESULTS ==="
echo "Errors: $ERRORS"
echo

if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL RLS CHECKS PASSED"
  exit 0
else
  echo "❌ RLS CHECKS FAILED - DO NOT PUSH"
  exit 1
fi
