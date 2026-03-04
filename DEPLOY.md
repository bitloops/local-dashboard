# Deploy (Phase A, GitHub Releases + Static Manifest)

This is the minimal release flow for dashboard bundle artifacts consumed by `bitloops dashboard`.

## Release Model

- `main` is protected and only updated via PR merge.
- A dashboard release is triggered by pushing a semver tag (`vX.Y.Z`) that points to a commit already on `main`.
- Bundle artifacts are hosted as GitHub Release assets.
- Version discovery is hosted from a static repo URL:
  - `https://raw.githubusercontent.com/bitloops/local-dashboard/main/bundle_versions.json`
- CLI base URL should resolve to the same static root:
  - `BITLOOPS_DASHBOARD_CDN_BASE_URL=https://raw.githubusercontent.com/bitloops/local-dashboard/main`

## 1. Ship Code to `main`

1. Open PR(s) with dashboard changes.
2. Wait for CI to pass.
3. Merge to `main`.

Do not mix version-cutting with normal feature PRs unless the PR is explicitly the release cut.

## 2. Decide to Cut a Release

Cut a release only when:

- Desired dashboard changes are already merged to `main`
- `main` is green
- You want a new bundle version discoverable by the CLI

## 3. Create Release PR (`vX.Y.Z`)

Create a release PR that prepares the dashboard version.

Typical changes:

- Bump `package.json` version to `X.Y.Z`
- Ensure bundle-embedded version metadata is `X.Y.Z` (for `~/.bitloops/dashboard/bundle/version.json` at install time)

Then:

1. Open PR (example: `chore: release dashboard vX.Y.Z`).
2. Wait for CI.
3. Merge PR to `main`.

## 4. Create and Push Release Tag

From a clean, up-to-date local `main`:

```bash
git checkout main
git pull --ff-only origin main
./scripts/release.sh
```

Notes:

- Tag push is compatible with protected `main` because it does not push branch commits.
- If tag protection rules exist, they must allow release maintainers to push `v*` tags.

## 5. Observe Release Pipeline

Watch the tag-triggered release workflow at `.github/workflows/release.yml`.

Success criteria:

- GitHub Release for `vX.Y.Z` is created
- Assets are attached:
  - `bundle.tar.zst`
  - `bundle.tar.zst.sha256`
- Checksum verification job passes

Release asset URLs should be:

- `https://github.com/bitloops/local-dashboard/releases/download/vX.Y.Z/bundle.tar.zst`
- `https://github.com/bitloops/local-dashboard/releases/download/vX.Y.Z/bundle.tar.zst.sha256`

## 6. Update `bundle_versions.json` on `main`

After release assets are live, open a PR to update `bundle_versions.json` on `main` (this file exists at repo root and is served via the raw static URL).

Add a new entry:

```json
{
  "version": "X.Y.Z",
  "min_required_cli_version": "A.B.C",
  "max_required_cli_version": "latest",
  "download_url": "https://github.com/bitloops/local-dashboard/releases/download/vX.Y.Z/bundle.tar.zst",
  "checksum_url": "https://github.com/bitloops/local-dashboard/releases/download/vX.Y.Z/bundle.tar.zst.sha256"
}
```

Merge this PR once validated. This is the step that makes the release discoverable by CLI clients.

## 7. Quick End-to-End Check

Run the CLI with the static manifest base URL:

```bash
export BITLOOPS_DASHBOARD_CDN_BASE_URL=https://raw.githubusercontent.com/bitloops/local-dashboard/main
bitloops dashboard
```

Expected:

- `GET /api/check_bundle_version` resolves the new compatible version
- Install/update downloads release assets, verifies checksum, and installs successfully

## 8. Rollback Rule

If a release is bad:

1. Delete GitHub Release + tag `vX.Y.Z`
2. Remove or revert the `X.Y.Z` entry from `bundle_versions.json` (if already merged)
3. Fix forward
4. Publish a new patch tag (for example `vX.Y.(Z+1)`)
