# Acceptance Criteria

This directory contains acceptance criteria (AC) documentation for all features in the crypto portfolio tracker.

## Purpose

Acceptance criteria define:
- What the feature does (user story)
- How it should behave (criteria in Given/When/Then format)
- What tests are needed
- Error handling requirements
- Integration points and dependencies

## Structure

Each feature has its own markdown file with:
- User story
- Acceptance criteria
- Test cases
- Integration points
- Error handling
- Non-functional requirements
- Definition of done

## Feature Index

### CLI Commands

| Feature | File | Priority | Status |
|---------|------|----------|--------|
| Snapshot Add | [snapshot-add.md](./snapshot-add.md) | High | ✅ Documented |
| Snapshot List | [snapshot-list.md](./snapshot-list.md) | Medium | ⏳ Pending |
| Snapshot View | [snapshot-view.md](./snapshot-view.md) | High | ⏳ Pending |
| Natural Language Query | [query.md](./query.md) | High | ✅ Documented |
| Portfolio Summary | [portfolio-summary.md](./portfolio-summary.md) | Medium | ✅ Documented |

### Core Services

| Service | File | Priority | Status |
|---------|------|----------|--------|
| Portfolio Service | ⏳ Planned | High | ⏳ Pending |
| CoinMarketCap Service | ⏳ Planned | High | ⏳ Pending |
| Claude Service | ⏳ Planned | High | ⏳ Pending |

## Usage

### When Adding a Feature

1. **Before implementation**: Create AC document from template
2. **During implementation**: Reference ACs to guide development
3. **After implementation**: Check all ACs are met and tests pass
4. **Update status**: Mark as documented/implemented in this README

### Template

Use `.claude/skills/testing-workflow/templates/acceptance-criteria.md` as a starting point for new AC documents.

## Testing

All features should have:
- Unit tests for business logic
- Integration tests for database/API interactions
- E2E tests for user workflows
- Error handling tests

See `tests/` directory for test implementations.
