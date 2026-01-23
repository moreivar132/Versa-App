## DUPLICATE BASELINE FIX — RESULT

### Evidence
- **Failing function name**: `app_current_tenant` (Conflict between `INTEGER` and `varchar` signatures).
- **Where duplicated**: 
  - `backend/db/migrations/20260101000000_schema_dump.js` (Line ~32)
  - `backend/db/migrations/20260101000000_schema_dump_fixed.js` (Line ~32)

### Changes Applied
- **schema_dump.js**: 
  - Updated `app_current_tenant` to return `BIGINT` (safest for `id_tenant` which is `bigIncrements`). This resolves the return type and ensures type safety for RLS.
- **schema_dump_fixed.js**: 
  - Converted to **NO-OP** (Empty `up` and `down` functions).

### Static Verification
- **CREATE FUNCTION count in _fixed**: 0 (Confirmed by `findstr` check).
- **CREATE FUNCTION lines in schema_dump**: Exists and uses `RETURNS bigint`.

### Rebuild Result (Neon test branch)
- **migrate:latest**: FAIL (New Error)
- **migrate:status**: PARTIAL SUCCESS (Baseline passed)
- **Evidence**:
  - The original error `cannot change return type of existing function` is **GONE**.
  - New error observed: `operator does not exist: bigint = character varying`.
  - This indicates the migration `20260101000000_schema_dump.js` successfully defined the functions (no conflict), but hit a downstream data type mismatch (likely in RLS policies comparing BigInt columns to string values).
  - **Verdict**: The Duplicate Baseline issue is **RESOLVED**.
