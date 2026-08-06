#!/usr/bin/env bash
# Connects this repository to its (private) remote and pushes main.
# Usage: bash scripts/first-push.sh git@github.com:owner/repo.git
set -euo pipefail

remote_url="${1:-}"
branch="${2:-main}"

if [[ -z "${remote_url}" ]]; then
  echo "Usage: bash scripts/first-push.sh <remote-url> [branch]" >&2
  exit 2
fi

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash your changes first:" >&2
  git status --short >&2
  exit 3
fi

current="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${current}" != "${branch}" ]]; then
  echo "Switching from ${current} to ${branch}"
  git checkout "${branch}"
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Updating existing origin -> ${remote_url}"
  git remote set-url origin "${remote_url}"
else
  echo "Adding origin -> ${remote_url}"
  git remote add origin "${remote_url}"
fi

echo "Pushing ${branch} (no force, history preserved)…"
git push -u origin "${branch}"
echo "Done. Commits on ${branch}: $(git rev-list --count "${branch}")"
