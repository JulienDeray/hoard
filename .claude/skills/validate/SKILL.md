---
name: Validate
description: Runs build, lint, and tests to validate code quality after implementation
allowed-tools: Bash
---

# Validation Skill

Run this skill after completing implementation work to ensure code quality.

## Execution Steps

Execute these commands in order. Stop immediately on first failure.

### Step 1: TypeScript Build
Run: `npm run build`

**Success criteria:** Exit code 0, no compilation errors

**Common failures:**
- Type errors: Fix the type mismatch in the indicated file:line
- Import errors with `.js`: ESM requires `.js` extensions even for `.ts` files
- Missing exports: Check barrel files (index.ts) include new exports
- Unused variables: Prefix with `_` if intentional, or remove

### Step 2: ESLint
Run: `npm run lint`

**Success criteria:** Exit code 0, no errors (warnings acceptable)

**Common failures:**
- `@typescript-eslint/no-unused-vars`: Remove unused code or prefix with `_`
- `@typescript-eslint/no-explicit-any`: Replace `any` with proper types

### Step 3: Tests
Run: `npm test`

**Success criteria:** All tests pass

**Common failures:**
- Database errors: Ensure test uses in-memory DB (`:memory:`)
- Timeout errors: Check for missing async/await
- Mock errors: Verify mocks match current API signatures

## Output Format

After running all steps, provide a summary:

```
## Validation Results

| Check | Status |
|-------|--------|
| Build | PASS/FAIL |
| Lint  | PASS/FAIL |
| Tests | PASS/FAIL |

[If any failures, list specific errors to fix]
```

## When All Pass

If all checks pass, respond: "All validation checks passed. Code is ready for commit."

## When Any Fail

Stop at the first failure. Report:
1. Which check failed
2. The specific error(s)
3. Suggested fix(es)

Do not proceed to subsequent checks until the failure is resolved.
