# Release Process

This document describes how PayStream contract releases are versioned, prepared, deployed, and announced.

---

## Table of Contents

- [Versioning Strategy](#versioning-strategy)
- [Branch Strategy](#branch-strategy)
- [Tag Naming Convention](#tag-naming-convention)
- [Changelog Format](#changelog-format)
- [Release Checklist](#release-checklist)
- [Release Notes Template](#release-notes-template)
- [Announcement Process](#announcement-process)

---

## Versioning Strategy

PayStream follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`).

| Segment | Increment when… |
|---|---|
| `MAJOR` | A breaking change is made to any public contract interface (function removed, parameter type changed, error code changed) |
| `MINOR` | New backwards-compatible functionality is added (new function, new optional parameter with a default) |
| `PATCH` | Backwards-compatible bug fixes, documentation-only changes, or dependency updates with no interface change |

**Pre-release suffixes:**

| Suffix | Meaning |
|---|---|
| `-alpha.N` | Early development, unstable API |
| `-beta.N` | Feature-complete, may have bugs |
| `-rc.N` | Release candidate, no planned changes |

Examples: `1.0.0`, `1.1.0-beta.1`, `2.0.0-rc.1`

---

## Branch Strategy

```
main          ← always deployable; tagged releases cut from here
  └── feature/...    ← new features, merged to main via PR
  └── fix/...        ← bug fixes, merged to main via PR
  └── docs/...       ← documentation only, merged to main via PR
  └── release/X.Y.Z  ← optional; used for release prep on large versions
```

- **`main`** is the source of truth. All releases are cut from `main`.
- Feature and fix branches are short-lived and deleted after merge.
- A `release/X.Y.Z` branch is only created when a release requires several preparatory commits (e.g., updating version strings, finalising the changelog) that should not land on `main` until the release is ready.
- Hotfixes to a previous release that cannot go through `main` first are branched from the relevant tag: `git checkout -b fix/1.0.1 v1.0.0`.

---

## Tag Naming Convention

All release tags are annotated tags on `main`:

```
v<MAJOR>.<MINOR>.<PATCH>
v<MAJOR>.<MINOR>.<PATCH>-<pre-release>
```

Examples:

```
v1.0.0
v1.1.0
v2.0.0-rc.1
v1.0.1
```

**Rules:**
- Always prefix with `v`.
- Never reuse or move a tag — if a tag was pushed to the remote in error, create a new version instead.
- Annotated tags include the release title and one-line summary as the tag message.

**Creating a tag:**
```bash
git tag -a v1.2.0 -m "v1.2.0: add batch stream creation and top-up support"
git push origin v1.2.0
```

---

## Changelog Format

The changelog lives in `CHANGELOG.md` at the repository root and follows [Keep a Changelog](https://keepachangelog.com/) conventions.

### Structure

```markdown
# Changelog

All notable changes to PayStream are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/)
Versioning: [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- ...

### Changed
- ...

### Fixed
- ...

## [1.1.0] - 2026-06-01

### Added
- `create_streams_batch` for atomic multi-stream creation (#42)
- `top_up` function to extend stream runway (#38)

### Changed
- `withdraw` now returns the amount transferred (#45)

### Fixed
- Off-by-one in `claimable` when `stop_time` equals current ledger time (#50)

[Unreleased]: https://github.com/PrincessnJoy/paystream-contracts/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/PrincessnJoy/paystream-contracts/compare/v1.0.0...v1.1.0
```

### Categories

Use only these categories (omit a category if it has no entries):

| Category | Use for |
|---|---|
| `Added` | New functions, new parameters, new features |
| `Changed` | Behaviour changes to existing functions |
| `Deprecated` | Functions or parameters that will be removed in a future version |
| `Removed` | Functions or parameters removed in this release |
| `Fixed` | Bug fixes |
| `Security` | Security fixes — always include, even for patch releases |

---

## Release Checklist

Work through this checklist in order for every release.

### Pre-release

- [ ] All planned issues / PRs for this version are merged to `main`
- [ ] CI is green on `main` (`make test`, `make lint`, `make fmt-check`)
- [ ] `CHANGELOG.md` — move items from `[Unreleased]` to the new version section with today's date
- [ ] Version string updated in `Cargo.toml` (workspace root and any sub-crates)
- [ ] `docs/api-reference.md` reflects any interface changes in this release
- [ ] Review any breaking changes; confirm `MAJOR` version bump if applicable
- [ ] Tag reviewed by a second maintainer for `MAJOR` and `MINOR` releases

### Build & Test

- [ ] `make build` — confirm WASM artifacts compile cleanly
- [ ] `make test` — all tests pass
- [ ] `docker compose run --rm test` — confirm Docker-based test run passes
- [ ] WASM binary sizes are within expected range (compare to previous release)

### Testnet Deployment

- [ ] Deploy to testnet: `./scripts/deploy-testnet.sh`
- [ ] Run `./scripts/init-testnet.sh` to initialise the contract
- [ ] Smoke-test key flows: `create_stream` → `withdraw` → `cancel_stream`
- [ ] Confirm contract IDs in `docs/testnet.md` are updated

### Tagging & GitHub Release

- [ ] Create an annotated tag on `main`: `git tag -a vX.Y.Z -m "..."`
- [ ] Push the tag: `git push origin vX.Y.Z`
- [ ] Create a GitHub Release from the tag (see [Release Notes Template](#release-notes-template))
- [ ] Attach WASM artifacts as release assets

### Post-release

- [ ] Add a new empty `[Unreleased]` section to `CHANGELOG.md` and push to `main`
- [ ] Update `docs/testnet.md` with new contract IDs if changed
- [ ] Post announcement (see [Announcement Process](#announcement-process))
- [ ] Close or milestone-move any issues that are resolved by this release

---

## Release Notes Template

Use this template when creating a GitHub Release.

```markdown
## PayStream vX.Y.Z

Released: YYYY-MM-DD

### Highlights

<!-- 2–4 sentence summary of the most important changes in this release. -->

### What's Changed

#### Added
- ...

#### Changed
- ...

#### Fixed
- ...

#### Security
- ...

### Breaking Changes

<!-- List any breaking changes with migration steps. Delete this section if none. -->

### Deployment

**Testnet**
| Contract | Address |
|---|---|
| Stream | `C...` |
| Token | `C...` |

**Mainnet**
| Contract | Address |
|---|---|
| Stream | `C...` |
| Token | `C...` |

### Upgrade Notes

<!-- Any steps required for operators or users upgrading from the previous version. -->

### Contributors

<!-- @mention contributors or link to the full list. -->

**Full Changelog:** https://github.com/PrincessnJoy/paystream-contracts/compare/vX.Y.Z-prev...vX.Y.Z
```

---

## Announcement Process

For every release, post an announcement in the following places:

| Channel | Required for | Content |
|---|---|---|
| GitHub Release (tag) | All releases | Full release notes (see template above) |
| `CHANGELOG.md` commit on `main` | All releases | Changelog entry |
| GitHub Discussions — Announcements | `MINOR` and `MAJOR` | Link to GitHub Release + highlights |
| Discord `#announcements` | `MINOR` and `MAJOR` | Short summary + link to GitHub Release |
| Twitter / X | `MAJOR` only | One-sentence summary + link |

**Announcement timing:**
- Post all announcements within 24 hours of the tag being pushed.
- For `MAJOR` releases, coordinate announcements with any external partners or integrators who may be affected by breaking changes at least 1 week in advance.

**Security releases:**
- For releases that fix a security vulnerability, follow the disclosure process in [SECURITY.md](../SECURITY.md) before publishing the announcement. Do not disclose vulnerability details before the fix is deployed and users have had reasonable time to upgrade.
