---
name: report-to-pm
description: Reports implementation completion to the PM via Notion ticket with implementation notes, checks acceptance criteria, and marks as Done
allowed-tools: Bash, Read, Glob, mcp__notion__notion-fetch, mcp__notion__notion-update-page
---

# Report to PM Skill

Report implementation completion to the PM by updating a Notion ticket with implementation notes, checking acceptance criteria boxes, and marking status as Done.

## Usage

```
/report-to-pm <notion-url>
```

**Example:**
```
/report-to-pm https://www.notion.so/My-Ticket-abc123
```

## Workflow Steps

### Step 1: Parse Input

Extract the Notion URL from the skill argument. The URL should be a valid Notion page URL.

**Validation:**
- URL must contain `notion.so` or be a Notion page ID
- If no URL provided, ask the user for the Notion ticket URL

### Step 2: Fetch Notion Page

Use `mcp__notion__notion-fetch` to retrieve the current page content.

**Extract from page:**
- Page title
- Current content structure
- Status property (if exists)
- Acceptance criteria section (look for checkboxes `- [ ]`)

### Step 3: Gather Git Information

Run these bash commands to collect implementation details:

```bash
# Current commit
git rev-parse HEAD
git rev-parse --short HEAD

# Check for uncommitted changes
git status --porcelain

# Recent commits (last 10)
git log --oneline -n 10

# Files changed (staged and unstaged)
git diff --name-only
git diff --cached --name-only

# All files changed in recent commits
git diff --name-only HEAD~10..HEAD 2>/dev/null || git diff --name-only $(git rev-list --max-parents=0 HEAD)..HEAD
```

### Step 4: Gather Implementation Context

**Check for dependency changes:**
```bash
git diff HEAD~10 -- package.json 2>/dev/null || echo "No recent package.json changes"
```

**Check for API/route changes:**
- Look for modified files in `src/api/`, `web/src/api/`, or route files
- Note any new endpoints or modified APIs

**Check for plan file:**
- Read `.claude/plans/*.md` if exists to extract key decisions

**Check validation status:**
- If build/lint/tests were run recently in conversation, note their status
- Otherwise mark as "Not verified"

### Step 5: Compose Implementation Notes

Create the Implementation Notes section in Notion markdown format:

```markdown
## Implementation Notes

**Completed**: {YYYY-MM-DD}
**Commit**: `{short_hash}` ({full_hash})

### Commits Involved
- `{hash1}` - {message1}
- `{hash2}` - {message2}
...

### Files Changed
**Created:**
- path/to/new/file.ts

**Modified:**
- path/to/existing/file.ts

### Dependencies Added
- {package}@{version} (if any)
- Or "None"

### API Changes
- {description of API changes}
- Or "None"

### Validations
- [x] TypeScript build passes (or [ ] if not verified)
- [x] ESLint passes (or [ ] if not verified)
- [x] Tests pass (or [ ] if not verified or N/A)

### Tests Added
- path/to/test.spec.ts - {description}
- Or "None"

### Key Decisions
- {Decision 1}: {Rationale}
- Or "None documented"
```

**Guidelines for content:**
- Use today's date for completion
- If uncommitted changes exist, note "Commit: uncommitted changes pending"
- Group files into Created vs Modified based on git status
- Only list dependencies if package.json actually changed
- Only list API changes if route/API files were modified
- For validations, check conversation history or mark as not verified
- Only list tests if test files were created/modified

### Step 6: Update Notion Page

Perform these updates using `mcp__notion__notion-update-page`:

**6a. Add Implementation Notes section:**
- Use `insert_content_after` to add the Implementation Notes section at the end of the page content
- Find the last section and insert after it

**6b. Check acceptance criteria boxes:**
- If the page contains acceptance criteria with unchecked boxes (`- [ ]`)
- Use `replace_content_range` to convert them to checked (`- [x]`)
- Do this for ALL unchecked boxes in the acceptance criteria section

**6c. Update Status property:**
- Use `update_properties` command to set Status to "Done"
- Property name is typically "Status" but verify from fetch response

**Order of operations:**
1. First add Implementation Notes (content update)
2. Then check acceptance criteria boxes (content update)
3. Finally update Status property (property update)

### Step 7: Confirm Completion

Report a summary to the user:

```
## Notion Ticket Updated

**Page**: {page_title}
**URL**: {notion_url}

**Updates made:**
- Added Implementation Notes section
- Checked {N} acceptance criteria boxes
- Status changed to "Done"

**Implementation Summary:**
- Commit: {short_hash}
- Files changed: {count}
- Dependencies added: {yes/no}
- API changes: {yes/no}
```

## Error Handling

**No Notion URL provided:**
- Ask user: "Please provide the Notion ticket URL for this implementation."

**Notion fetch fails:**
- Report error and suggest checking URL or Notion permissions

**No acceptance criteria found:**
- Skip checkbox updates
- Note: "No acceptance criteria checkboxes found"

**Status property not found:**
- Try common variations: "Status", "status", "State"
- If none found, note: "Could not find Status property to update"

**Git not available or not a repo:**
- Use "N/A" for git-related fields
- Note: "Git information unavailable"

## Notes

- This skill performs full automation - no user confirmation needed for updates
- All Notion content uses Notion-flavored markdown
- The skill assumes the ticket follows standard format with acceptance criteria as checkboxes
- If the page already has Implementation Notes, append to it rather than creating duplicate
