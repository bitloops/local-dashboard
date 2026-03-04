# Deploy (Dashboard Bundle)

This is the release flow for `bitloops/local-dashboard` bundle artifacts consumed by `bitloops dashboard`.

## Release Model

- `main` is protected and updated via PR merge.
- Release is triggered by pushing tag `vX.Y.Z` from `main`.
- Artifacts are GitHub Release assets:
  - `bundle.tar.zst`
  - `bundle.tar.zst.sha256`
- Version discovery is static:
  - `https://raw.githubusercontent.com/bitloops/local-dashboard/main/bundle_versions.json`

## 1. Open One Release PR (`vX.Y.Z`)

Single PR is enough.

Include:

- `package.json` version bump to `X.Y.Z`
- `bundle_versions.json` new entry for `X.Y.Z`

Example manifest entry:

```json
{
  "version": "X.Y.Z",
  "min_required_cli_version": "A.B.C",
  "max_required_cli_version": "latest",
  "download_url": "https://github.com/bitloops/local-dashboard/releases/download/vX.Y.Z/bundle.tar.zst",
  "checksum_url": "https://github.com/bitloops/local-dashboard/releases/download/vX.Y.Z/bundle.tar.zst.sha256"
}
```

Then merge the PR after CI passes.

## 2. Create and Push Tag

From clean, up-to-date `main`:

```bash
git checkout main
git pull --ff-only origin main
./scripts/release.sh
```

The script creates `v<package.json version>` and pushes only the tag.

## 3. Verify Release Workflow

Watch `.github/workflows/release.yml`.

Success criteria:

- GitHub Release `vX.Y.Z` is created
- Both assets are uploaded
- Checksum verification job passes

## 4. Smoke Test Bundle

Confirm you can download, verify checksum, extract, and render `index.html`.

## 5. Why `version.json` Exists

`~/.bitloops/dashboard/bundle/version.json` is used by the CLI to know which dashboard version is installed and whether updates are available.

You do **not** edit this file manually. The release workflow generates it inside the bundle archive from the release tag/version.

## 6. Rollback

If release `vX.Y.Z` is bad:

1. Delete GitHub Release + tag `vX.Y.Z`
2. Remove or revert the `X.Y.Z` manifest entry in `bundle_versions.json`
3. Fix forward and publish `vX.Y.(Z+1)`
