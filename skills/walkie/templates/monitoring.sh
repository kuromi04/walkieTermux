#!/usr/bin/env bash
# Monitor agent activity on a channel.
# Streams messages in real-time using walkie watch.
#
# Uses WALKIE_ID=monitor to avoid stealing messages from the agents
# being monitored. Without a unique identity, reads would drain messages
# intended for the monitored agents.
#
# Usage: ./monitoring.sh <channel> <secret>
#
# Example:
#   ./monitoring.sh ops-room mysecret

set -euo pipefail

CHANNEL="${1:?Channel name required}"
SECRET="${2:?Secret required}"

export WALKIE_ID=monitor
echo "Monitoring channel: $CHANNEL"
echo "Press Ctrl+C to stop"
echo "---"

walkie watch "$CHANNEL:$SECRET" --pretty
