#!/bin/bash
# Install the worker as a login item for this user: it starts at login and restarts if it stops.
#   bash worker/install-launchd.sh            install or reinstall
#   bash worker/install-launchd.sh uninstall  stop it and remove it
set -euo pipefail

LABEL="com.apgrader.llm-worker"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [ "$(uname)" != "Darwin" ]; then
  echo "This installs a macOS login item. On other systems, run worker/run.sh with your own service manager." >&2
  exit 1
fi

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true

if [ "${1:-}" = "uninstall" ]; then
  rm -f "$TARGET"
  echo "Removed $LABEL."
  exit 0
fi

if [ ! -f "$REPO/worker/.env" ]; then
  echo "Create $REPO/worker/.env first (copy worker/.env.example)." >&2
  exit 1
fi
chmod 600 "$REPO/worker/.env"
chmod +x "$REPO/worker/run.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" "$REPO/worker/$LABEL.plist" > "$TARGET"
plutil -lint "$TARGET" >/dev/null
launchctl bootstrap "$DOMAIN" "$TARGET"
launchctl enable "$DOMAIN/$LABEL"

echo "Installed $LABEL. It starts now and at every login."
echo "Logs: tail -f ~/Library/Logs/apgrader-llm-worker.log"
echo "Status: launchctl print $DOMAIN/$LABEL | grep -E 'state|pid'"
