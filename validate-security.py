#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

print("=== CORBEL ENTITY SECURITY VALIDATION ===\n")

ENTITIES_DIR = Path("base44/entities")
ERRORS = 0

# Operational entities that must have create/update/delete restrictions
OPERATIONAL_ENTITIES = {
    "operation.jsonc",
    "readiness-requirement.jsonc",
    "operational-event.jsonc",
    "release-receipt.jsonc"
}

# Protected fields per entity
PROTECTED_FIELDS = {
    "operation.jsonc": ["currentState"],
    "readiness-requirement.jsonc": ["status", "ownerUserId"],
    "operational-event.jsonc": ["previousEventHash", "eventHash"],
    "release-receipt.jsonc": ["receiptHash", "eventChainHeadHash"],
    "user.jsonc": ["corbel_role"]
}

def load_jsonc(file_path):
    """Load JSONC file (JSON with comments support via simple preprocessing)."""
    with open(file_path, 'r') as f:
        content = f.read()

    # Remove line comments
    lines = []
    for line in content.split('\n'):
        if '//' in line:
            line = line[:line.index('//')]
        lines.append(line)

    try:
        return json.loads('\n'.join(lines))
    except json.JSONDecodeError as e:
        print(f"❌ JSON PARSE ERROR in {file_path}: {e}")
        return None

print("1. Checking entity-level RLS for operational entities...")
print()

for entity_file in OPERATIONAL_ENTITIES:
    path = ENTITIES_DIR / entity_file
    if not path.exists():
        print(f"❌ MISSING: {path}")
        ERRORS += 1
        continue

    data = load_jsonc(path)
    if data is None:
        ERRORS += 1
        continue

    print(f"✅ {entity_file}")

    # Check for top-level rls object
    if "rls" not in data:
        print(f"   ❌ Missing top-level rls object")
        ERRORS += 1
        continue

    rls = data["rls"]

    # Check create, update, delete inside rls
    for key in ["create", "update", "delete"]:
        if key not in rls:
            print(f"   ❌ rls.{key}: MISSING")
            ERRORS += 1
        elif rls[key] is False:
            print(f"   ✅ rls.{key}: false")
        else:
            print(f"   ❌ rls.{key}: {rls[key]} (should be false)")
            ERRORS += 1

    # Check for incorrect root-level CRUD
    for key in ["create", "update", "delete"]:
        if key in data and key != "rls":
            print(f"   ❌ INCORRECT: {key} at root level (should be inside rls)")
            ERRORS += 1

print()
print("2. Checking field-level RLS for protected fields...")
print()

for entity_file, protected_field_list in PROTECTED_FIELDS.items():
    path = ENTITIES_DIR / entity_file
    if not path.exists():
        continue

    data = load_jsonc(path)
    if data is None:
        continue

    print(f"{entity_file}:")

    properties = data.get("properties", {})

    for field_name in protected_field_list:
        if field_name not in properties:
            print(f"  ⚠️  {field_name}: NOT FOUND")
            continue

        field_def = properties[field_name]

        # Check for incorrect direct write property
        if "write" in field_def:
            print(f"  ❌ {field_name}: has direct 'write' property (should be inside rls)")
            ERRORS += 1
            continue

        # Check for field-level rls
        if "rls" not in field_def:
            print(f"  ❌ {field_name}: MISSING field-level rls")
            ERRORS += 1
            continue

        field_rls = field_def["rls"]
        if "write" not in field_rls:
            print(f"  ❌ {field_name}: rls missing write property")
            ERRORS += 1
        elif field_rls["write"] is False:
            print(f"  ✅ {field_name}: rls.write: false")
        else:
            print(f"  ❌ {field_name}: rls.write: {field_rls['write']} (should be false)")
            ERRORS += 1

print()
print("3. Checking Operation state enum...")
print()

op_path = ENTITIES_DIR / "operation.jsonc"
op_data = load_jsonc(op_path)
if op_data:
    current_state = op_data.get("properties", {}).get("currentState", {})
    enum_val = current_state.get("enum", [])
    expected = ["READY", "HOLD", "VERIFYING", "RELEASED"]
    if enum_val == expected:
        print(f"✅ Operation.currentState: {enum_val}")
    else:
        print(f"❌ Operation.currentState enum incorrect")
        print(f"   Expected: {expected}")
        print(f"   Got: {enum_val}")
        ERRORS += 1

print()
print("4. Checking User extension structure...")
print()

user_path = ENTITIES_DIR / "user.jsonc"
user_data = load_jsonc(user_path)
if user_data:
    if "name" in user_data:
        print(f"❌ user.jsonc should not have 'name' field (it extends built-in User)")
        ERRORS += 1
    else:
        print(f"✅ user.jsonc: no custom name (extends built-in User)")

    if "type" in user_data and user_data["type"] == "object":
        print(f"✅ user.jsonc: type is object")

    if "properties" in user_data and "corbel_role" in user_data["properties"]:
        print(f"✅ user.jsonc: has corbel_role property")

print()
print("=== RESULTS ===")
print(f"Errors: {ERRORS}")
print()

if ERRORS == 0:
    print("✅ ALL SECURITY CHECKS PASSED")
    sys.exit(0)
else:
    print("❌ SECURITY CHECKS FAILED")
    sys.exit(1)
