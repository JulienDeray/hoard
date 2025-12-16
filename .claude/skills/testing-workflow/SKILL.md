---
name: Testing Workflow
description: Manages testing lifecycle - analyzes changes, creates/updates tests, runs tests, maintains acceptance criteria
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Testing Workflow Skill

## When to Use This Skill

This skill is automatically invoked when:
- Code changes are made to services, repositories, or CLI commands
- New features are added
- User explicitly requests testing
- Before completing a feature implementation

## Testing Philosophy

Follow the testing pyramid:
- **Many unit tests** (fast, isolated, test business logic)
- **Some integration tests** (test database operations, service coordination)
- **Few E2E tests** (test CLI commands end-to-end)

## Workflow Steps

### Step 1: Analyze Changes
- Review conversation context or git diff
- Identify modified/new files
- Determine test coverage needs
- Check for existing tests

### Step 2: Create/Update Tests
- Use appropriate template based on file type
- Write comprehensive test cases
- Include edge cases and error scenarios
- Mock external dependencies (APIs, databases)

### Step 3: Run Tests
- Execute `npm test`
- Analyze failures
- Fix issues iteratively

### Step 4: Update Documentation
- Create/update acceptance criteria in `docs/acceptance-criteria/`
- Update CLAUDE.md if new testing patterns introduced
- Document any testing decisions

## File Type → Template Mapping

| File Pattern | Template | Test Focus |
|-------------|----------|------------|
| `src/services/*.ts` | service.test.ts | Business logic, service coordination |
| `src/database/*.ts` | repository.test.ts | Database operations with in-memory DB |
| `src/cli/commands/*.ts` | cli-command.test.ts | Command execution, user interaction |
| `src/utils/*.ts` | service.test.ts | Utility functions |
| `src/models/*.ts` | Skip | Simple type definitions |

## Test Requirements

### Services
- Test all public methods
- Mock external dependencies (APIs, databases)
- Test error handling
- Test edge cases (null, undefined, empty arrays)

### Repositories
- Use in-memory SQLite (`:memory:`)
- Test CRUD operations
- Test constraint violations
- Test transaction handling

### CLI Commands
- Mock interactive prompts
- Test command execution
- Test output formatting
- Test error messages

## Templates Usage

Refer to `templates/` directory for starting points. Customize based on:
- Specific dependencies
- Error conditions
- Business rules
- API contracts
