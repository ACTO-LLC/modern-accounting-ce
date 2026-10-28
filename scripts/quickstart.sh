#!/usr/bin/env bash
# One-command CE start: creates .env.ce, starts the stack, waits for health, prints the URL.
#
#   ./scripts/quickstart.sh            # build from source (default)
#   ./scripts/quickstart.sh --images   # pull prebuilt images from GHCR (faster; see docker-compose.ce.images.yml)
#   ./scripts/quickstart.sh --down     # stop the stack (data volume is kept)
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILES=(-f docker-compose.ce.yml)
MODE=build
TIMEOUT="${QUICKSTART_TIMEOUT:-1200}"

for arg in "$@"; do
  case "$arg" in
    --images) COMPOSE_FILES=(-f docker-compose.ce.yml -f docker-compose.ce.images.yml); MODE=images ;;
    --down)   MODE=down ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not reachable. Start Docker and re-run." >&2
  exit 1
fi

if [ ! -f .env.ce ]; then
  cp .env.ce.example .env.ce
  echo "Created .env.ce from .env.ce.example (defaults are fine for local use)."
fi

dc() { docker compose "${COMPOSE_FILES[@]}" --env-file .env.ce --profile app "$@"; }

if [ "$MODE" = down ]; then
  dc down
  exit 0
fi

if [ "$MODE" = images ]; then
  dc pull
  dc up -d
else
  dc up -d --build
fi

wait_for() {
  local name=$1 url=$2 deadline=$((SECONDS + TIMEOUT))
  printf 'Waiting for %s (%s) ' "$name" "$url"
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "timed out"
      echo "Check logs with: docker compose ${COMPOSE_FILES[*]} --env-file .env.ce --profile app logs" >&2
      exit 1
    fi
    printf '.'
    sleep 5
  done
  echo " ok"
}

wait_for "DAB API"  "http://localhost:5000/"
wait_for "chat-api" "http://localhost:8080/api/health"
wait_for "client"   "http://localhost:5173"

cat <<MSG

Modern Accounting CE is up.
  App:  http://localhost:5173   (auth is bypassed by default; no login needed)
  API:  http://localhost:5000/api
Stop with: ./scripts/quickstart.sh --down
MSG
