---
name: epic
description: Start a new epic from a PRD. Optionally provide a Notion link as argument, or invoke without arguments to paste the PRD content. Use when beginning a new epic development workflow.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task, EnterPlanMode, ExitPlanMode, AskUserQuestion, Skill, mcp__notion__notion-fetch, mcp__notion__notion-search, mcp__notion__notion-update-page
---

# Epic Development Workflow

Complete end-to-end workflow for implementing an epic from a PRD through to completion, with automated testing, validation, and PM reporting.

## Usage

**With Notion link:**
/epic https://www.notion.so/julienderay/Epic-Name-123abc...

**Without argument:**
/epic
Then provide Notion link or paste PRD content when prompted.

## Process

### Phase 1: Discovery

#### Step 1: Get PRD Content
- If a Notion link was provided as argument: Use `mcp__notion__notion-fetch` to fetch the PRD
- If no argument provided: Use AskUserQuestion with structured options:

**Question format:**
- Header: "PRD Source"
- Question: "How would you like to provide the PRD?"
- Options:
  1. **Notion link** - "I'll provide a Notion URL to fetch"
  2. **Paste content** - "I'll paste the PRD content directly"

Example tool call structure:
```json
{
  "questions": [{
    "question": "How would you like to provide the PRD?",
    "header": "PRD Source",
    "options": [
      {"label": "Notion link", "description": "I'll provide a Notion URL to fetch"},
      {"label": "Paste content", "description": "I'll paste the PRD content directly"}
    ],
    "multiSelect": false
  }]
}
```

- Store the Notion URL for later use in report-to-pm (if applicable)

#### Step 2: Explore Related Documentation
Search Notion for related documentation that might inform implementation:
- Use `mcp__notion__notion-search` with relevant keywords from PRD
- Look for: Domain Model, Roadmap, Architecture docs, Related tickets
- Read relevant pages to build context

#### Step 3: Analyze Codebase
Use Task tool with Explore agents to understand current implementation:
- Identify files related to the feature area
- Understand existing patterns and conventions
- Map out dependencies and integration points
- Note any technical debt or constraints

#### Step 4: Identify Discrepancies
Compare PRD requirements against codebase reality:
- Flag requirements that conflict with current architecture
- Highlight assumptions in PRD that don't match code
- Note missing context or prerequisites
- Identify scope creep risks

Present findings to user:
```
## Analysis Summary

### PRD Requirements
- [List key requirements]

### Current Codebase State
- [Relevant existing code/patterns]

### Potential Discrepancies
- [Conflicts or concerns]

### Technical Considerations
- [Dependencies, risks, unknowns]
```

**After presenting the summary, use AskUserQuestion to confirm priorities:**

```json
{
  "questions": [
    {
      "question": "I found potential discrepancies between the PRD and codebase. Which should we address before proceeding?",
      "header": "Discrepancies",
      "options": [
        {"label": "Address all", "description": "Resolve all discrepancies before implementation"},
        {"label": "Address critical only", "description": "Only fix blockers, proceed with minor gaps"},
        {"label": "Proceed as-is", "description": "Accept discrepancies, document for later"}
      ],
      "multiSelect": false
    },
    {
      "question": "The PRD assumes [X] but the codebase uses [Y]. How should we handle this?",
      "header": "Conflict",
      "options": [
        {"label": "Follow PRD", "description": "Adapt codebase to match PRD expectations"},
        {"label": "Follow codebase", "description": "Update approach to fit current architecture"},
        {"label": "Discuss with PM", "description": "Get clarification before deciding"}
      ],
      "multiSelect": false
    }
  ]
}
```

**Guidelines:**
- Present max 4 questions per AskUserQuestion call
- For multiple conflicts, prioritize the most impactful ones
- Use clear option descriptions that explain consequences

#### Step 5: Ask Clarification Questions
After analyzing the PRD and codebase, identify areas needing clarification. Use `AskUserQuestion` with structured options whenever possible.

**For each concern, create a focused question:**

1. **Scope clarification** - When requirements are ambiguous:
   - Header: "Scope" (max 12 chars)
   - Provide 2-4 concrete interpretations as options
   - Let user pick or choose "Other" for custom answer

2. **Technical decisions** - When multiple approaches exist:
   - Header: "Approach"
   - Present trade-offs in option descriptions

3. **Priority/phasing** - When scope might need trimming:
   - Header: "Priority"
   - Use multiSelect: true to let user pick multiple items

**Example: Ambiguous requirement**
```json
{
  "questions": [{
    "question": "The PRD mentions 'export functionality' - what formats should be supported initially?",
    "header": "Export",
    "options": [
      {"label": "JSON only", "description": "Simplest to implement, covers most use cases"},
      {"label": "JSON + CSV", "description": "Adds spreadsheet compatibility"},
      {"label": "JSON + CSV + PDF", "description": "Full export suite, more complex"}
    ],
    "multiSelect": false
  }]
}
```

**Example: Multiple concerns**
Ask up to 4 questions in a single AskUserQuestion call:
```json
{
  "questions": [
    {
      "question": "Should the feature be accessible from the CLI, web UI, or both?",
      "header": "Interface",
      "options": [
        {"label": "CLI only", "description": "Faster to implement"},
        {"label": "Web UI only", "description": "Better UX for complex interactions"},
        {"label": "Both (Recommended)", "description": "Full coverage but more work"}
      ],
      "multiSelect": false
    },
    {
      "question": "How should errors be handled?",
      "header": "Errors",
      "options": [
        {"label": "Fail fast", "description": "Stop on first error"},
        {"label": "Collect all", "description": "Report all errors at once"}
      ],
      "multiSelect": false
    }
  ]
}
```

**Guidelines for effective questions:**
- Keep headers under 12 characters
- Provide 2-4 options per question (users can always select "Other")
- Put the recommended option first with "(Recommended)" suffix
- Use clear, concise descriptions explaining trade-offs
- Group related questions into a single AskUserQuestion call (max 4)
- Use multiSelect: true only when options aren't mutually exclusive

#### Step 6: Make Suggestions
Propose improvements and present them as actionable choices using AskUserQuestion:

**Categories of suggestions:**
- Better UX approaches
- Technical alternatives
- Potential issues to address early
- Simplifications or phasing recommendations

**Present suggestions as structured questions:**

```json
{
  "questions": [{
    "question": "I noticed an opportunity to simplify the implementation. Would you like to:",
    "header": "Suggestion",
    "options": [
      {"label": "Accept suggestion", "description": "[Brief description of improvement]"},
      {"label": "Keep as specified", "description": "Implement exactly as PRD describes"},
      {"label": "Discuss further", "description": "Let's talk through the trade-offs"}
    ],
    "multiSelect": false
  }]
}
```

**Example: Phasing recommendation**
```json
{
  "questions": [{
    "question": "The scope is large. I suggest phasing the implementation. Which approach?",
    "header": "Phasing",
    "options": [
      {"label": "Phase 1 only (Recommended)", "description": "Core functionality first, iterate later"},
      {"label": "Full scope", "description": "Implement everything at once"},
      {"label": "Custom phasing", "description": "Let me define what goes in each phase"}
    ],
    "multiSelect": false
  }]
}
```

### Phase 2: Planning

#### Step 7: Enter Plan Mode
Use EnterPlanMode to formally plan the implementation.

#### Step 8: Create Implementation Plan
Write a detailed plan including:
- Discrete tasks with clear scope
- Files to create/modify
- Technical approach for each task
- Testing requirements
- Acceptance criteria mapping

#### Step 9: Get Approval
Use ExitPlanMode to present plan for user review.
Wait for user approval before proceeding.

### Phase 3: Implementation

#### Step 10: Implement Code
Follow the approved plan:
- Write code following project conventions
- Use TodoWrite to track progress
- Keep changes focused and incremental

#### Step 11: Update Notion Checkboxes
If PRD came from Notion and has acceptance criteria checkboxes:
- Use `mcp__notion__notion-update-page` to check boxes as tasks complete
- Keep PM informed of progress

### Phase 4: Quality Assurance

#### Step 12: Write Tests
Invoke the testing-workflow skill:
```
/testing-workflow
```

This will:
- Analyze changes to identify test needs
- Create/update tests using project templates
- Run tests and fix any failures
- Update acceptance criteria docs

#### Step 13: Validate
Invoke the validate skill:
```
/validate
```

This runs in sequence:
1. TypeScript build (`npm run build`)
2. ESLint (`npm run lint`)
3. Tests (`npm test`)

If any check fails, fix the issue before proceeding.

### Phase 5: Wrap-up

#### Step 14: Commit Changes
Create a meaningful commit:
- Stage all relevant changes
- Write a descriptive commit message referencing the epic
- Format: "Implement [Epic Name]"

```bash
git add .
git commit -m "Implement [Epic Name]

[Brief description of changes]"
```

#### Step 15: Report to PM
Invoke the report-to-pm skill with the Notion URL:
```
/report-to-pm <notion-url>
```

This will:
- Add Implementation Notes section to Notion page
- Check all acceptance criteria boxes
- Update Status to "Done"

## Checklist Summary

- [ ] PRD fetched and understood
- [ ] Related documentation reviewed
- [ ] Codebase analyzed
- [ ] Discrepancies identified and discussed
- [ ] Questions asked and answered
- [ ] Suggestions made
- [ ] Plan created and approved
- [ ] Code implemented
- [ ] Notion checkboxes updated (if applicable)
- [ ] Tests written via /testing-workflow
- [ ] Validation passed via /validate
- [ ] Changes committed
- [ ] PM notified via /report-to-pm
