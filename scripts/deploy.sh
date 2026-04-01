#!/usr/bin/env bash
# deploy.sh — build, release, and deploy a Paperclip plugin to the local Docker stack
#
# Usage:
#   ./scripts/deploy.sh [version]          # e.g. ./scripts/deploy.sh 0.2.0
#   ./scripts/deploy.sh                    # reads version from package.json
#
# Prerequisites:
#   - Docker with paperclip-paperclip-1 running
#   - FORGEJO_TOKEN env var set, or APPLICATION_ACCESS_TOKEN in Infisical at /paperclip/forgejo
#   - Infisical accessible at http://localhost:8050 (optional — falls back to env)
#
# What it does:
#   1. Build (pnpm build)
#   2. Pack (npm pack → .tgz)
#   3. Push a git tag and create a Forgejo release with the .tgz attached
#   4. Extract the .tgz into the paperclip Docker volume at /plugins/<name>
#   5. Update the DB package_path and version
#   6. Restart the paperclip container
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Config ───────────────────────────────────────────────────────────────────
FORGEJO_URL="https://forge.icelab.dev"
FORGEJO_ORG="atlas-apex"
CONTAINER="paperclip-paperclip-1"
DB_CONTAINER="paperclip-db-1"
DB_USER="paperclip"
VOLUME="paperclip_paperclip-data"
INFISICAL_URL="${INFISICAL_URL:-http://localhost:8050}"

# ── Resolve Forgejo token ─────────────────────────────────────────────────────
if [ -z "${FORGEJO_TOKEN:-}" ]; then
  echo "→ Fetching FORGEJO_TOKEN from Infisical..."
  INFISICAL_IDENTITY_TOKEN=$(docker exec paperclip-db-1 psql -U paperclip -tAq \
    "SELECT value_json->>'token' FROM plugin_state WHERE plugin_id = (SELECT id FROM plugins WHERE plugin_key = 'paperclip-plugin-infisical') AND state_key = 'token' LIMIT 1" 2>/dev/null || echo "")
  PROJECT_ID=$(docker exec paperclip-db-1 psql -U paperclip -tAq \
    "SELECT value_json->>'projectId' FROM plugin_state WHERE plugin_id = (SELECT id FROM plugins WHERE plugin_key = 'paperclip-plugin-infisical') AND state_key = 'projectId' LIMIT 1" 2>/dev/null || echo "")

  if [ -n "${INFISICAL_IDENTITY_TOKEN}" ] && [ -n "${PROJECT_ID}" ]; then
    FORGEJO_TOKEN=$(curl -sf "${INFISICAL_URL}/api/v3/secrets/raw/APPLICATION_ACCESS_TOKEN?secretPath=%2Fpaperclip%2Fforgejo&environment=dev&workspaceId=${PROJECT_ID}" \
      -H "Authorization: Bearer ${INFISICAL_IDENTITY_TOKEN}" | python3 -c "import sys,json; print(json.load(sys.stdin)['secret']['secretValue'])")
  fi
fi

if [ -z "${FORGEJO_TOKEN:-}" ]; then
  echo "ERROR: FORGEJO_TOKEN not found. Set it as env var or store APPLICATION_ACCESS_TOKEN in Infisical at /paperclip/forgejo"
  exit 1
fi

# ── Read plugin metadata ──────────────────────────────────────────────────────
PLUGIN_NAME=$(python3 -c "import json; print(json.load(open('${PLUGIN_DIR}/package.json'))['name'])")
VERSION="${1:-$(python3 -c "import json; print(json.load(open('${PLUGIN_DIR}/package.json'))['version'])")}"
PLUGIN_KEY="${PLUGIN_NAME}"   # plugin_key matches package name in DB
INSTALL_PATH="/paperclip/plugins/${PLUGIN_NAME#paperclip-plugin-}"  # strip prefix for dir name

echo "Plugin : ${PLUGIN_NAME}"
echo "Version: ${VERSION}"
echo "Path   : ${INSTALL_PATH}"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
echo "→ Building..."
cd "${PLUGIN_DIR}"
pnpm build

# ── Pack ──────────────────────────────────────────────────────────────────────
echo "→ Packing..."
npm pack
TGZ=$(ls *.tgz | head -1)
echo "   ${TGZ}"

# ── Git tag ───────────────────────────────────────────────────────────────────
TAG="v${VERSION}"
if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "→ Tag ${TAG} already exists, skipping tag creation"
else
  echo "→ Creating git tag ${TAG}..."
  git tag "${TAG}" -m "Release ${VERSION}"
fi

REPO_FULL="${FORGEJO_ORG}/${PLUGIN_NAME}"

# ── Forgejo release ───────────────────────────────────────────────────────────
echo "→ Creating Forgejo release ${TAG}..."
RELEASE_RESPONSE=$(curl -sf -X POST "${FORGEJO_URL}/api/v1/repos/${REPO_FULL}/releases" \
  -H "Authorization: token ${FORGEJO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"tag_name\":\"${TAG}\",\"name\":\"${TAG}\",\"body\":\"Release ${VERSION}\"}" 2>/dev/null || echo "")

if [ -n "${RELEASE_RESPONSE}" ]; then
  RELEASE_ID=$(echo "${RELEASE_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  if [ -n "${RELEASE_ID}" ]; then
    echo "→ Uploading release asset..."
    curl -sf -X POST "${FORGEJO_URL}/api/v1/repos/${REPO_FULL}/releases/${RELEASE_ID}/assets?name=${TGZ}" \
      -H "Authorization: token ${FORGEJO_TOKEN}" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@${TGZ}" -o /dev/null
    echo "   uploaded ${TGZ}"
  fi
else
  echo "   (release may already exist, continuing with deploy)"
fi

# ── Push tag ──────────────────────────────────────────────────────────────────
echo "→ Pushing tag to Forgejo..."
FORGEJO_PUSH_URL="https://henkjanvries:${FORGEJO_TOKEN}@forge.icelab.dev/${REPO_FULL}.git"
git push "${FORGEJO_PUSH_URL}" "${TAG}" --quiet 2>/dev/null || echo "   (tag push skipped or already exists)"

# ── Deploy to Docker volume ───────────────────────────────────────────────────
echo "→ Deploying to Docker volume..."
docker cp "${TGZ}" "${CONTAINER}:/tmp/${TGZ}"
docker exec "${CONTAINER}" sh -c "
  mkdir -p '${INSTALL_PATH}' &&
  cd '${INSTALL_PATH}' &&
  tar -xzf '/tmp/${TGZ}' --strip-components=1 &&
  rm '/tmp/${TGZ}'
"
echo "   extracted to ${INSTALL_PATH}"

# ── Update DB ─────────────────────────────────────────────────────────────────
echo "→ Updating plugin registry..."
docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -c \
  "UPDATE plugins SET package_path='${INSTALL_PATH}', version='${VERSION}', status='ready', updated_at=now() WHERE plugin_key='${PLUGIN_KEY}';" 2>/dev/null

ROWS=$(docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -tAq \
  "SELECT COUNT(*) FROM plugins WHERE plugin_key='${PLUGIN_KEY}';" 2>/dev/null || echo "0")

if [ "${ROWS}" = "0" ]; then
  echo "   Plugin not in DB — run the install via the Paperclip admin UI first, then redeploy."
  echo "   Or use: docker exec ${DB_CONTAINER} psql -U ${DB_USER} -c \"INSERT INTO plugins ...\" (see docs)"
fi

# ── Restart container ─────────────────────────────────────────────────────────
echo "→ Restarting ${CONTAINER}..."
docker restart "${CONTAINER}" --time 5
echo "   waiting for startup..."
sleep 8
docker ps --filter "name=${CONTAINER}" --format "{{.Status}}"

echo ""
echo "✓ Deploy complete: ${PLUGIN_NAME}@${VERSION}"
echo "  Forgejo: ${FORGEJO_URL}/${REPO_FULL}/releases/tag/${TAG}"
