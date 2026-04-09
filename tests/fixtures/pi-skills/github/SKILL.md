---
name: github
description: "GitHub repository operations. Triggers: PR, issue, repo, branch"
homepage: https://github.com
---

# GitHub Skill

Manage GitHub repositories, pull requests, and issues.

## When to Use

- "Create a PR for this branch"
- "List open issues in the repo"
- "Show me the recent commits"

## Tools Required

- gh CLI tool (GitHub CLI)

## Commands

```bash
# List PRs
gh pr list

# Create PR
gh pr create --title "My PR" --body "Description"

# View issue
gh issue view 123
```