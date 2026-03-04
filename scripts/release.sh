#!/usr/bin/env bash

set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required to read package.json version" >&2
  exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "error: release must be cut from main (current: $CURRENT_BRANCH)" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree has uncommitted changes" >&2
  exit 1
fi

if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "error: working tree has untracked files" >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "error: package.json version '$VERSION' is not semver-like" >&2
  exit 1
fi

TAG="v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "error: local tag '$TAG' already exists" >&2
  exit 1
fi

git fetch origin main --tags
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "error: local main is not at origin/main; run 'git pull --ff-only origin main'" >&2
  exit 1
fi

if git ls-remote --tags origin "refs/tags/$TAG" | grep -q .; then
  echo "error: remote tag '$TAG' already exists on origin" >&2
  exit 1
fi

echo "Creating annotated tag: $TAG"
git tag -a "$TAG" -m "dashboard $TAG"

echo "Pushing tag to origin: $TAG"
git push origin "$TAG"

echo "Release tag pushed successfully."
