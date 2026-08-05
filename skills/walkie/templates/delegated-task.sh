#!/usr/bin/env bash
# Delegate a task to a remote agent and wait for the result.
#
# Usage: ./delegated-task.sh <channel> <secret> "task to delegate" [timeout_seconds]
#
# Example:
#   ./delegated-task.sh research-room mysecret "summarize the latest news on AI" 120

set -euo pipefail

CHANNEL="${1:?Channel name required}"
SECRET="${2:?Secret required}"
TASK="${3:?Task description required}"
TIMEOUT="${4:-60}"

# Create channel and wait for peer
walkie connect "$CHANNEL:$SECRET"
echo "Connected. Waiting for worker to join..."

# Poll for peer connection
for i in $(seq 1 30); do
  STATUS=$(walkie status 2>/dev/null || true)
  if echo "$STATUS" | grep -q "$CHANNEL.*[1-9] peer"; then
    echo "Worker connected."
    break
  fi
  sleep 1
done

# Send the task
walkie send "$CHANNEL" "$TASK"
echo "Task delegated: $TASK"

# Wait for result
echo "Waiting up to ${TIMEOUT}s for result..."
RESULT=$(walkie read "$CHANNEL" --wait --timeout "$TIMEOUT")
echo "Result received:"
echo "$RESULT"

# Cleanup
walkie leave "$CHANNEL"
