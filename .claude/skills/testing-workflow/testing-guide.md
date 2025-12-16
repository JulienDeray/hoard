# Testing Guide

## Quick Reference

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage
npm test -- service.test   # Run specific test
```

### Test Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => { /* setup */ });
  afterEach(() => { /* cleanup */ });

  describe('methodName', () => {
    it('should handle happy path', () => {
      // Arrange - setup test data
      // Act - execute the code
      // Assert - verify results
    });
  });
});
```

## Mocking Strategies

### 1. External APIs

Always mock external APIs (CoinMarketCap, Claude):

```typescript
vi.mock('../path/to/service', () => ({
  ServiceName: vi.fn(() => mockImplementation),
}));
```

### 2. Database

Use in-memory SQLite for repository tests:

```typescript
const db = new Database(':memory:');
```

### 3. CLI Prompts

Mock clack prompts for CLI tests:

```typescript
vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  confirm: vi.fn(),
}));
```

## Testing Checklist

- [ ] All public methods tested
- [ ] Happy path covered
- [ ] Error cases handled
- [ ] Edge cases (null, empty, invalid input)
- [ ] External dependencies mocked
- [ ] Database operations isolated
- [ ] Async operations properly awaited
- [ ] Cleanup in afterEach hooks

## Common Patterns

### Testing Async Functions

```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Errors

```typescript
it('should throw on invalid input', () => {
  expect(() => syncFunction()).toThrow('Error message');
});

it('should reject on async error', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error');
});
```

### Testing Database Operations

```typescript
it('should persist data', () => {
  const created = repo.create(data);
  const retrieved = repo.get(created.id);
  expect(retrieved).toEqual(created);
});
```
