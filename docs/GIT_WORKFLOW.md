# Git Workflow & Branching Strategy

## Branch Strategy: **Simple Trunk-Based** ✅

### Main Branches

```
main (production-ready)
  ↑
feature/* (short-lived)
```

**Decision:** Single `main` branch with short-lived feature branches

**Rationale:**
- **Small team (2-3 devs)**: No need for complex GitFlow
- **Fast iteration**: Merge to main frequently (daily/weekly)
- **Simple CI/CD**: Single branch to deploy from
- **Less overhead**: No long-lived develop branch to maintain

### Branch Naming Convention

```
feature/billing-screen
feature/inventory-search
fix/print-alignment
hotfix/crash-on-startup
chore/update-dependencies
```

**Format:** `<type>/<short-description>`

**Types:**
- `feature/` - New functionality
- `fix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `chore/` - Maintenance (deps, config)
- `docs/` - Documentation only

---

## Workflow

### 1. Starting New Work

```bash
# Pull latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/product-search

# Work on your feature
# ... make changes ...
```

### 2. Committing Changes

```bash
# Stage changes
git add .

# Commit with clear message
git commit -m "feat: add product search with barcode scanner"
```

**Commit message format:**
```
<type>: <short description>

[optional body]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

### 3. Pushing & Creating PR

```bash
# Push feature branch
git push origin feature/product-search

# Create PR on GitHub/GitLab
# Title: Clear description of what changed
# Description: Why, what, how (if complex)
```

### 4. Merging

```bash
# After PR approval, merge to main
# Delete feature branch after merge
```

---

## Pull Request (PR) Rules

### For Small Startup Team (2-3 devs)

**Lightweight but disciplined:**

1. **PR Size**: Keep PRs small (< 400 lines changed when possible)
   - Easier to review
   - Faster to merge
   - Less risky

2. **Review Requirements:**
   - **1 approval required** (at least one other dev)
   - **Self-review first**: Review your own diff before requesting review
   - **CI must pass**: Tests + build must succeed

3. **Review Checklist:**
   - [ ] Code works (tested locally)
   - [ ] No console errors
   - [ ] TypeScript compiles
   - [ ] Follows naming conventions
   - [ ] No sensitive data (API keys, passwords)

4. **Merge Strategy:**
   - **Squash and merge** (keeps main history clean)
   - Delete branch after merge

5. **When to Skip PR:**
   - Typo fixes in docs
   - README updates
   - `.gitignore` changes
   - **Use judgment**: If in doubt, create PR

---

## Emergency Hotfixes

For critical production bugs:

```bash
# Create hotfix branch from main
git checkout -b hotfix/critical-crash main

# Fix the issue
# ... make changes ...

# Commit and push
git commit -m "hotfix: fix crash on empty cart"
git push origin hotfix/critical-crash

# Fast-track PR (can merge with 1 quick review or self-merge if critical)
```

---

## Protected Branch Settings (GitHub/GitLab)

**For `main` branch:**
- ✅ Require PR before merging
- ✅ Require 1 approval
- ✅ Require status checks to pass (CI)
- ❌ Don't require linear history (squash handles this)
- ❌ Don't lock branch (allow hotfix self-merge if needed)

---

## Daily Workflow Example

**Developer A (working on billing):**
```bash
git checkout -b feature/billing-screen
# ... work ...
git commit -m "feat: add billing screen UI"
git push origin feature/billing-screen
# Create PR → Get review from Dev B → Merge
```

**Developer B (working on inventory):**
```bash
git checkout -b feature/inventory-list
# ... work ...
git commit -m "feat: add inventory list with search"
git push origin feature/inventory-list
# Create PR → Get review from Dev A → Merge
```

**Both sync daily:**
```bash
git checkout main
git pull origin main
```

---

## Tips for Teams

1. **Communicate**: Use PR descriptions to explain "why" not just "what"
2. **Review quickly**: Don't let PRs sit for days
3. **Merge often**: Small, frequent merges > large, rare merges
4. **Keep main stable**: Always deployable
5. **Use draft PRs**: For work-in-progress that needs early feedback

---

## Summary

| Aspect | Decision | Why |
|--------|----------|-----|
| **Branch strategy** | Trunk-based (main + feature/*) | Simple, fast, small team |
| **PR approval** | 1 required | Lightweight but safe |
| **Merge strategy** | Squash and merge | Clean history |
| **Branch lifetime** | < 3 days ideal | Fast iteration |

---