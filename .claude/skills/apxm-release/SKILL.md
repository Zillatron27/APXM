---
name: apxm-release
description: Bump version, update changelog, build both browser targets, and commit
disable-model-invocation: true
argument-hint: [version-bump description]
---

# APXM Release

Run the full release checklist for APXM. The argument describes what changed (used for the changelog entry).

## Pre-flight

1. Read the current version from `package.json` (`version` field) and `lib/constants.ts` (`BUILD_VERSION`)
2. Confirm they're in sync (package.json `X.Y.Z.N` maps to constants.ts `vX.Y.Z-bN`)
3. Determine the next version:
   - Default: increment the build number (e.g., `0.1.2.7` → `0.1.2.8`, `v0.1.2-b7` → `v0.1.2-b8`)
   - If the user specifies a version in `$ARGUMENTS`, use that instead
4. Show the user: current version, next version, and a summary of what will change. **Wait for explicit approval before proceeding.**

## Version bump

Update these files (and ONLY these files) with the new version:

| File | Field | Format |
|------|-------|--------|
| `package.json` | `version` | `X.Y.Z.N` (dot-separated integers) |
| `lib/constants.ts` | `BUILD_VERSION` | `vX.Y.Z-bN` (human-readable) |

Do NOT edit manifest files — WXT generates those from package.json at build time.

## Changelog

Add a new entry at the top of `CHANGELOG.md` following the existing format:

```markdown
## X.Y.Z-bN — Brief Title (YYYY-MM-DD)

### Features
- ...

### Bug Fixes
- ...
```

Use `$ARGUMENTS` and recent git history (`git log` since the last version tag/bump commit) to write the changelog entry. Keep it concise. Omit empty sections.

## Build

Run these sequentially — stop immediately if either fails:

```bash
pnpm run build
pnpm run build:firefox
```

Verify both `.output/chrome-mv3/manifest.json` and `.output/firefox-mv2/manifest.json` exist and contain the correct new version number.

## Package

```bash
pnpm run zip:firefox
```

This creates the AMO submission files in `.output/`.

## Commit and push

Stage only the changed files (package.json, lib/constants.ts, CHANGELOG.md):

```bash
git add package.json lib/constants.ts CHANGELOG.md
git commit -m "chore: bump version to vX.Y.Z-bN and update changelog"
SSH_AUTH_SOCK=/run/user/1000/ssh-agent.socket git push
```

## Summary

After push, print a summary table:
- Previous version → New version
- Chrome build: pass/fail
- Firefox build: pass/fail
- AMO zip path
- Commit hash
