# Portfolio Summary - Acceptance Criteria

**Feature:** Portfolio Summary Display
**Component:** CLI Command (`portfolio summary`)
**Priority:** Medium

## User Story

As a crypto portfolio tracker user
I want to see a summary of my current portfolio
So that I can quickly understand my holdings and their current values

## Acceptance Criteria

### AC1: Latest Snapshot Retrieval

**Given** the user runs `portfolio summary`
**When** the command executes
**Then** it should retrieve the most recent snapshot from the database

**Test Cases:**
- [ ] Happy path: Latest snapshot found and displayed
- [ ] Edge case: Multiple snapshots exist, picks most recent by date
- [ ] Error case: No snapshots exist, show helpful message
- [ ] Verify: Snapshot date is displayed

### AC2: Current Price Enrichment

**Given** a snapshot with holdings
**When** calculating current values
**Then** the system should fetch current prices for all assets

**Test Cases:**
- [ ] Happy path: All prices fetched successfully
- [ ] Cache hit: Uses cached prices (< 5 minutes old)
- [ ] Cache miss: Fetches from CoinMarketCap API
- [ ] Partial failure: Some prices fetch successfully, others fail gracefully
- [ ] Complete failure: Shows holdings without values

### AC3: Value Calculation

**Given** holdings with current prices
**When** calculating portfolio value
**Then** the system should compute total and per-asset values

**Test Cases:**
- [ ] Formula: value = amount × price (in EUR)
- [ ] Accuracy: Decimal precision for crypto amounts
- [ ] Total: Sum of all asset values
- [ ] Edge case: Very small amounts (0.00000001 BTC)
- [ ] Edge case: Very large values (>1M EUR)

### AC4: Percentage Allocation

**Given** portfolio total value
**When** displaying each holding
**Then** the system should show percentage allocation

**Test Cases:**
- [ ] Formula: percentage = (asset_value / total_value) × 100
- [ ] Formatting: Display as percentage with 2 decimal places
- [ ] Sum: All percentages should sum to ~100%
- [ ] Edge case: Single asset = 100%
- [ ] Edge case: Missing price for one asset affects percentages

### AC5: Display Format

**Given** all portfolio data is calculated
**When** displaying to the user
**Then** the output should be clear, formatted, and readable

**Test Cases:**
- [ ] Header: Shows "Portfolio Summary" with date
- [ ] Table: Columns for Symbol, Name, Amount, Price, Value, Allocation
- [ ] Formatting: Currency symbols (€), number formatting (commas)
- [ ] Footer: Total portfolio value prominently displayed
- [ ] Colors: Use chalk for visual hierarchy
- [ ] Alignment: Numbers right-aligned, text left-aligned

### AC6: Empty Portfolio Handling

**Given** no snapshots exist
**When** the user runs `portfolio summary`
**Then** the system should show a helpful empty state message

**Test Cases:**
- [ ] Message: Explains no data available
- [ ] Suggestion: Prompt user to add first snapshot
- [ ] Example: Show command to run (`snapshot add`)
- [ ] No error: Graceful, not a crash

### AC7: Performance and Caching

**Given** prices are being fetched
**When** multiple requests happen within 5 minutes
**Then** the system should use cached prices

**Test Cases:**
- [ ] First call: Fetches from API, caches result
- [ ] Subsequent calls (< 5 min): Uses cache, no API call
- [ ] After 5 minutes: Cache expired, fetches fresh prices
- [ ] Verify: Rate limiting (1 second between CMC calls) is respected

## Integration Points

- **Dependencies:**
  - PortfolioService (portfolio value calculation)
  - LedgerRepository (snapshot and holdings access)
  - RatesRepository (price caching)
  - CoinMarketCapService (current price fetching)

- **Data:**
  - Tables: `snapshots`, `holdings`, `assets`, `rate_cache`

- **APIs:**
  - CoinMarketCap API (current prices)

## Error Handling

| Error Scenario | Expected Behavior |
|---------------|-------------------|
| No snapshots in database | Show friendly message to add first snapshot |
| CMC API unavailable | Display holdings without prices, show warning |
| CMC API rate limit | Use cached prices or show partial data |
| Price fetch timeout | Continue with available prices, mark others as "N/A" |
| Database error | Show error message, don't crash |
| Invalid snapshot data | Handle gracefully, show partial data if possible |

## Non-Functional Requirements

- **Performance:** Summary should load within 2 seconds (with cache)
- **Performance:** Even without cache, complete within 5 seconds
- **Cache:** Respect 5-minute TTL for price data
- **Rate Limiting:** Respect 1-second delay between CMC API calls
- **UX:** Show spinner while fetching prices
- **UX:** Clear visual hierarchy in output

## Test Coverage

- [ ] Unit tests for PortfolioService value calculations
- [ ] Unit tests for percentage allocation logic
- [ ] Integration tests for price fetching with cache
- [ ] Integration tests for database retrieval
- [ ] E2E test for full command execution
- [ ] Error handling tests for missing data
- [ ] Edge case tests for boundary values

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests written and passing
- [ ] E2E test covers happy path
- [ ] Error handling tested
- [ ] Performance requirements met
- [ ] Code reviewed
- [ ] Documentation updated
