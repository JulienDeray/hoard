# Natural Language Query - Acceptance Criteria

**Feature:** Natural Language Portfolio Queries
**Component:** CLI Command (`query`)
**Priority:** High

## User Story

As a crypto portfolio tracker user
I want to ask questions about my portfolio in natural language
So that I can get insights without remembering specific commands or SQL

## Acceptance Criteria

### AC1: Question Processing

**Given** the user runs `query "<question>"`
**When** the question is submitted to Claude AI
**Then** Claude should analyze the question and call appropriate tools

**Test Cases:**
- [ ] Happy path: "How much Bitcoin do I have?" → calls get_holdings()
- [ ] Happy path: "What is my portfolio worth?" → calls calculate_portfolio_value()
- [ ] Happy path: "What was BTC price on 2024-01-15?" → calls get_historical_price()
- [ ] Happy path: "Show me all my snapshots" → calls list_snapshots()
- [ ] Complex query: Multi-step questions require multiple tool calls

### AC2: get_holdings Tool

**Given** Claude requests holdings data
**When** get_holdings(date?) is called
**Then** the tool should return holdings for the specified date or latest

**Test Cases:**
- [ ] No date: Returns latest snapshot holdings
- [ ] With date: Returns holdings for that specific date
- [ ] Multiple holdings: All assets returned
- [ ] Empty portfolio: Returns empty array
- [ ] Non-existent date: Returns null/empty

### AC3: calculate_portfolio_value Tool

**Given** Claude requests portfolio valuation
**When** calculate_portfolio_value(date?) is called
**Then** the tool should return total value and breakdown

**Test Cases:**
- [ ] No date: Calculates current portfolio value
- [ ] With date: Calculates value for that date
- [ ] Returns: Total value, per-asset breakdown, percentages
- [ ] Prices: Uses cached prices or fetches from CMC
- [ ] Missing prices: Continues with available data

### AC4: get_historical_price Tool

**Given** Claude requests historical price data
**When** get_historical_price(symbol, date) is called
**Then** the tool should return price for that symbol on that date

**Test Cases:**
- [ ] Happy path: Returns cached historical price if available
- [ ] Cache miss: Fetches from CMC API and caches
- [ ] Invalid symbol: Returns error message
- [ ] Invalid date: Returns error message
- [ ] API failure: Returns error, doesn't crash

### AC5: list_snapshots Tool

**Given** Claude requests snapshot listing
**When** list_snapshots() is called
**Then** the tool should return all snapshots with metadata

**Test Cases:**
- [ ] Returns: All snapshots sorted by date (desc)
- [ ] Includes: date, notes, number of holdings
- [ ] Empty portfolio: Returns empty array
- [ ] Formatting: Dates in ISO format

### AC6: Multi-Turn Conversation

**Given** Claude needs multiple tool calls to answer
**When** processing a complex question
**Then** the system should handle the tool-calling loop until completion

**Test Cases:**
- [ ] Sequential tools: Multiple tool calls executed in order
- [ ] Tool results: Properly formatted and sent back to Claude
- [ ] Final response: Claude returns natural language answer
- [ ] Error recovery: Failed tool doesn't break conversation

### AC7: Natural Language Response

**Given** all tool results are collected
**When** Claude formulates the final answer
**Then** the response should be natural, accurate, and helpful

**Test Cases:**
- [ ] Answer quality: Relevant to user's question
- [ ] Formatting: Readable, uses markdown if needed
- [ ] Numbers: Formatted with currency symbols (€)
- [ ] Context: Includes relevant details from tool results
- [ ] Errors: Gracefully communicates when data is unavailable

### AC8: Edge Case Questions

**Given** the user asks unusual or ambiguous questions
**When** Claude processes them
**Then** the system should handle gracefully

**Test Cases:**
- [ ] Ambiguous: "How much do I have?" → asks for clarification or assumes total
- [ ] Unsupported: "What will Bitcoin be worth tomorrow?" → explains limitation
- [ ] Empty query: Handles empty string input
- [ ] Very long question: Processes normally
- [ ] Typos in asset names: Claude interprets correctly (e.g., "Etherium" → ETH)

## Integration Points

- **Dependencies:**
  - ClaudeService (AI query processing)
  - QueryProcessor (tool execution)
  - LedgerRepository (data access)
  - RatesRepository (price data)
  - CoinMarketCapService (price fetching)

- **Data:**
  - Tables: `snapshots`, `holdings`, `assets`, `rate_cache`, `historical_rates`

- **APIs:**
  - Anthropic Claude API (natural language processing)
  - CoinMarketCap API (price data)

## Error Handling

| Error Scenario | Expected Behavior |
|---------------|-------------------|
| Claude API error | Show error message, suggest retry |
| Tool execution fails | Return error to Claude, continue conversation |
| Invalid tool parameters | Validate and return helpful error |
| Network timeout | Retry once, then fail with message |
| Empty portfolio | Return meaningful "no data" response |
| Malformed question | Claude handles naturally or asks for clarification |

## Non-Functional Requirements

- **Performance:** Query should complete within 5 seconds for single-tool questions
- **API Usage:** Efficient tool calling, minimal redundant calls
- **Cost:** Optimize prompt size to minimize Claude API costs
- **UX:** Show spinner while processing, clear error messages

## Test Coverage

- [ ] Unit tests for each tool function (get_holdings, calculate_portfolio_value, etc.)
- [ ] Integration tests for QueryProcessor with mocked Claude
- [ ] Integration tests for tool execution with mocked database
- [ ] E2E test with mocked Claude responses
- [ ] Error handling tests for API failures
- [ ] Edge case tests for unusual questions

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All 4 tools implemented and tested
- [ ] Tool calling loop works correctly
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests with mocked APIs passing
- [ ] Error handling tested
- [ ] Code reviewed
- [ ] Documentation updated
