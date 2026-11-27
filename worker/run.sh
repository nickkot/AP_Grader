#!/bin/bash
# Start the local model worker and keep this Mac awake while it runs.
# launchd runs this at login (see worker/install-launchd.sh). You can also run it by hand.
set -euo pipefail

cd "$(dirname "$0")/.."

# launchd starts with a bare PATH. Pick up Node from nvm or Homebrew.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" --no-use
  nvm use --silent 22 >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
fi
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

if [ ! -f worker/.env ]; then
  echo "worker/.env is missing. Copy worker/.env.example to worker/.env and fill it in." >&2
  exit 1
fi

# caffeinate -i stops idle sleep and -s stops system sleep while on power, for as long as
# the worker runs. Closing the lid still sleeps a MacBook unless it is on power with an
# external display (clamshell mode). Jobs a sleeping Mac cannot finish go to the cloud.
if command -v caffeinate >/dev/null 2>&1; then
  exec caffeinate -is node --import tsx worker/llm-worker.ts
fi
exec node --import tsx worker/llm-worker.ts
