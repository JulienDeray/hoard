# Snapshot Add - Acceptance Criteria

**Feature:** Add Portfolio Snapshot
**Component:** CLI Command (`snapshot add`)
**Priority:** High

## User Story

As a crypto portfolio tracker user
I want to add a snapshot of my crypto holdings for a specific date
So that I can track my portfolio value over time

## Acceptance Criteria

### AC1: Date Input and Validation

**Given** the user runs `snapshot add`
**When** prompted for a date
**Then** the system should accept YYYY-MM-DD format or default to today

**Test Cases:**
- [ ] Happy path: Valid date in YYYY-MM-DD format (e.g., "2024-01-15")
- [ ] Default: Empty input defaults to today's date
- [ ] Edge case: Future dates are accepted
- [ ] Edge case: Historical dates are accepted
- [ ] Error case: Invalid format (e.g., "15-01-2024", "Jan 15") shows error and re-prompts

### AC2: Duplicate Snapshot Detection

**Given** a snapshot already exists for the entered date
**When** the user confirms to add more holdings
**Then** the system should allow adding additional assets to the existing snapshot

**Test Cases:**
- [ ] Happy path: Add new asset to existing snapshot
- [ ] Happy path: User can cancel and exit
- [ ] Edge case: Updating amount for existing asset in snapshot
- [ ] Verify: Original snapshot data is preserved

### AC3: Asset Entry Loop

**Given** the user is adding holdings
**When** prompted for asset symbol and amount
**Then** the system should validate and create holdings iteratively

**Test Cases:**
- [ ] Happy path: Add multiple assets in sequence
- [ ] Happy path: User can stop adding assets (empty symbol)
- [ ] Validation: Positive amounts only (reject 0, negative)
- [ ] Validation: Numeric amounts (reject "abc", "1.2.3")
- [ ] Edge case: Decimal amounts (e.g., 0.5 BTC)
- [ ] Edge case: Very small amounts (e.g., 0.00000001)

### AC4: Asset Discovery via CoinMarketCap

**Given** the user enters an asset symbol not in the database
**When** the system searches CoinMarketCap
**Then** it should display asset info and ask for confirmation before adding

**Test Cases:**
- [ ] Happy path: Symbol found on CMC, user confirms, asset added to DB
- [ ] Happy path: Symbol found, user declines, asset not added
- [ ] Edge case: Multiple results, system picks best match
- [ ] Error case: Symbol not found on CMC, offer manual CMC ID entry
- [ ] Error case: CMC API fails, allow graceful fallback

### AC5: Manual CMC ID Entry

**Given** automatic asset lookup fails
**When** user chooses manual CMC ID entry
**Then** the system should accept CMC ID and fetch asset info

**Test Cases:**
- [ ] Happy path: Valid CMC ID, asset info displayed and saved
- [ ] Error case: Invalid CMC ID shows error
- [ ] Edge case: User cancels manual entry

### AC6: Automatic Price Fetching (Today's Snapshots)

**Given** the snapshot date is today
**When** holdings are added
**Then** the system should automatically fetch and save current prices

**Test Cases:**
- [ ] Happy path: Prices fetched for all assets in snapshot
- [ ] Verify: Prices saved to rate_cache and historical_rates
- [ ] Verify: 5-minute cache TTL is respected
- [ ] Error case: Price fetch fails for one asset, continue with others
- [ ] Error case: CMC API unavailable, snapshot still created without prices

### AC7: Optional Price Fetching (Historical Snapshots)

**Given** the snapshot date is in the past
**When** holdings are added
**Then** the system should ask if user wants to fetch current prices

**Test Cases:**
- [ ] Happy path: User opts in, prices fetched
- [ ] Happy path: User opts out, no prices fetched
- [ ] Verify: Historical snapshots don't auto-fetch prices

### AC8: Portfolio Value Display

**Given** all holdings and prices are entered
**When** the snapshot is complete
**Then** the system should display total portfolio value

**Test Cases:**
- [ ] Happy path: Display total value in EUR
- [ ] Display: Show breakdown by asset
- [ ] Display: Show percentage allocation
- [ ] Edge case: Partial prices (some assets missing prices)
- [ ] Edge case: No prices available shows holdings without values

### AC9: Notes Field

**Given** the user is creating a new snapshot
**When** prompted for notes
**Then** the system should accept optional text notes

**Test Cases:**
- [ ] Happy path: User enters notes, saved with snapshot
- [ ] Happy path: User skips notes (empty), snapshot created
- [ ] Edge case: Long notes (500+ characters)
- [ ] Edge case: Special characters in notes

## Integration Points

- **Dependencies:**
  - LedgerRepository (snapshot, holding, asset CRUD)
  - RatesRepository (price caching)
  - CoinMarketCapService (asset lookup, price fetching)
  - PortfolioService (value calculation)

- **Data:**
  - Tables: `snapshots`, `holdings`, `assets`, `rate_cache`, `historical_rates`

- **APIs:**
  - CoinMarketCap API (asset info, current prices)

## Error Handling

| Error Scenario | Expected Behavior |
|---------------|-------------------|
| CMC API rate limit exceeded | Show warning, continue without prices |
| CMC API network error | Retry once, then fail gracefully |
| Invalid date format | Show error message, re-prompt for date |
| Negative/zero amount | Show validation error, re-prompt for amount |
| Database constraint violation | Show error, rollback transaction |
| User cancellation (Ctrl+C) | Graceful exit with confirmation |

## Non-Functional Requirements

- **Performance:** Asset lookup should complete within 2 seconds
- **Validation:** All numeric inputs validated with Zod schemas
- **Rate Limiting:** Respect 1-second delay between CMC API calls
- **UX:** Progress spinners for API calls, clear error messages

## Test Coverage

- [ ] Unit tests for input validation logic
- [ ] Integration tests for database operations (snapshot/holding/asset creation)
- [ ] Integration tests for CMC API calls (mocked)
- [ ] E2E test for complete snapshot creation flow
- [ ] Error handling tests for API failures
- [ ] Edge case tests for boundary values

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests written and passing
- [ ] E2E test covers happy path
- [ ] Error handling tested
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Manual testing completed
