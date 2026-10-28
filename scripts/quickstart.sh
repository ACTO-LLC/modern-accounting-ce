#!/usr/bin/env bash
# One-command CE start: creates .env.ce, starts the stack, waits for health, prints the URL.
#
#   ./scripts/quickstart.sh            # build from source (default)
#   ./scripts/quickstart.sh --images   # pull prebuilt images from GHCR (faster; see docker-compose.ce.images.yml)
#   ./scripts/quickstart.sh --demo     # also load ~3 months of sample invoices, bills and payments (fresh books only)
#   ./scripts/quickstart.sh --reset    # DELETE the database volume first and start with clean books (asks to confirm)
#   ./scripts/quickstart.sh --down     # stop the stack (data volume is kept)
#
# Options combine, e.g. --images --reset --demo. Pass --yes to skip the --reset prompt (needed without a terminal).
# SAMPLE_DATA_SEED=N varies the sample data (same seed and date give the same data).
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILES=(-f docker-compose.ce.yml)
MODE=build
DEMO=false
RESET=false
YES=false
TIMEOUT="${QUICKSTART_TIMEOUT:-1200}"

for arg in "$@"; do
  case "$arg" in
    --images) COMPOSE_FILES=(-f docker-compose.ce.yml -f docker-compose.ce.images.yml); MODE=images ;;
    --down)   MODE=down ;;
    --demo)   DEMO=true ;;
    --reset)  RESET=true ;;
    --yes|-y) YES=true ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$MODE" = down ] && { [ "$DEMO" = true ] || [ "$RESET" = true ]; }; then
  echo "--down can't be combined with --demo or --reset." >&2
  exit 2
fi

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

if [ "$RESET" = true ]; then
  if [ "$YES" != true ]; then
    if [ ! -t 0 ]; then
      echo "--reset deletes every record in the database. Re-run with --yes to confirm when there is no terminal." >&2
      exit 2
    fi
    echo "--reset permanently deletes the CE database volume: every customer, invoice, bill and setting."
    read -r -p "Type 'reset' to continue: " answer
    if [ "$answer" != reset ]; then
      echo "Cancelled; nothing was deleted."
      exit 1
    fi
  fi
  echo "Removing containers and the database volume..."
  dc down -v --remove-orphans
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

if [ "$DEMO" = true ]; then
  echo "Loading sample data..."
  dc run --rm sample-data ${SAMPLE_DATA_SEED:+--seed "$SAMPLE_DATA_SEED"}
fi

cat <<MSG

Modern Accounting CE is up.
  App:  http://localhost:5173   (auth is bypassed by default; no login needed)
  API:  http://localhost:5000/api
Stop with: ./scripts/quickstart.sh --down
MSG
