#!/bin/bash
# Security validation script for CORBEL entity schemas

echo "=== CORBEL ENTITY SECURITY VALIDATION ==="
echo

ENTITIES_DIR="base44/entities"
ERRORS=0
WARNINGS=0

# Define operational entities that must have create/update/delete restrictions
OPERATIONAL_ENTITIES=(
  "operation"
  "readiness-requirement"
  "operational-event"
  "release-receipt"
)

# Define protected fields
declare -A PROTECTED_FIELDS=(
  ["operation.jsonc"]="currentState"
  ["readiness-requirement.jsonc"]="status ownerUserId"
  ["operational-event.jsonc"]="previousEventHash eventHash"
  ["release-receipt.jsonc"]="receiptHash eventChainHeadHash"
  ["user.jsonc"]="corbel_role"
)

echo "1. Checking entity-level RLS structure..."
echo

for entity in "${OPERATIONAL_ENTITIES[@]}"; do
  file="${ENTITIES_DIR}/${entity}.jsonc"

  if [ ! -f "$file" ]; then
    echo "❌ MISSING: $file"
    ((ERRORS++))
    continue
  fi

  # Check for top-level rls object
  if ! grep -q '"rls"' "$file"; then
    echo "❌ NO RLS: $file (missing entity-level RLS)"
    ((ERRORS++))
  else
    echo "✅ RLS found: $(basename $file)"
  fi

  # Check for create/update/delete inside rls
  if grep -A 5 '"rls"' "$file" | grep -q '"create": false'; then
    echo "   ✅ create: false"
  else
    echo "   ❌ Missing create: false"
    ((ERRORS++))
  fi

  if grep -A 5 '"rls"' "$file" | grep -q '"update": false'; then
    echo "   ✅ update: false"
  else
    echo "   ❌ Missing update: false"
    ((ERRORS++))
  fi

  if grep -A 10 '"rls"' "$file" | grep -q '"delete": false'; then
    echo "   ✅ delete: false"
  else
    echo "   ❌ Missing delete: false"
    ((ERRORS++))
  fi
done

echo
echo "2. Checking for incorrect root-level RLS properties..."
echo

for file in "$ENTITIES_DIR"/*.jsonc; do
  # Check for improperly placed create/update/delete at root
  if grep -E '^  "create":|^  "update":|^  "delete":' "$file" | grep -v 'inside rls'; then
    echo "❌ INCORRECT: $(basename $file) has create/update/delete at root level (should be inside rls)"
    ((ERRORS++))
  fi
done

echo
echo "3. Checking field-level RLS for protected fields..."
echo

for file in "${!PROTECTED_FIELDS[@]}"; do
  filepath="$ENTITIES_DIR/$file"

  if [ ! -f "$filepath" ]; then
    continue
  fi

  fields="${PROTECTED_FIELDS[$file]}"
  echo "File: $(basename $file)"

  for field in $fields; do
    if grep -q "\"$field\"" "$filepath"; then
      # Check if field has nested rls.write
      if grep -A 3 "\"$field\"" "$filepath" | grep -q '"rls".*"write"'; then
        echo "  ✅ $field: has field-level RLS"
      else
        echo "  ❌ $field: MISSING field-level RLS (should have nested rls object)"
        ((ERRORS++))
      fi
    fi
  done
done

echo
echo "4. Checking for duplicate JSON/JSONC keys..."
echo

for file in "$ENTITIES_DIR"/*.jsonc; do
  # Simple check for duplicate property names on adjacent lines
  if grep -o '"[^"]*":' "$file" | sort | uniq -d | grep -q .; then
    echo "❌ DUPLICATES in $(basename $file):"
    grep -o '"[^"]*":' "$file" | sort | uniq -d
    ((ERRORS++))
  else
    echo "✅ $(basename $file): No duplicate keys"
  fi
done

echo
echo "5. Checking Operation state enum..."
echo

if grep -q '"enum": \["READY", "HOLD", "VERIFYING", "RELEASED"\]' "$ENTITIES_DIR/operation.jsonc"; then
  echo "✅ Operation states: READY, HOLD, VERIFYING, RELEASED"
else
  echo "❌ Operation state enum incorrect"
  ((ERRORS++))
fi

echo
echo "=== RESULTS ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo

if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL SECURITY CHECKS PASSED"
  exit 0
else
  echo "❌ SECURITY CHECKS FAILED"
  exit 1
fi
