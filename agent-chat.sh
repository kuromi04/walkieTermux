#!/data/data/com.termux/files/usr/bin/bash
# Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
# Walkie-Termux quick launcher

show_help() {
  echo "Walkie-Termux Quick Helper"
  echo "Usage: ./agent-chat.sh [chat|agent] <channel_name>"
  echo "Examples:"
  echo "  ./agent-chat.sh chat my-secure-channel"
  echo "  ./agent-chat.sh agent my-secure-channel"
  exit 1
}

if [ -z "$1" ] || [ -z "$2" ]; then
  show_help
fi

TYPE=$1
CHANNEL=$2

if [ "$TYPE" = "chat" ]; then
  echo "Starting interactive chat on channel: $CHANNEL"
  walkie chat "$CHANNEL"
elif [ "$TYPE" = "agent" ]; then
  echo "Starting AI Agent listener on channel: $CHANNEL..."
  walkie agent "$CHANNEL" --cli codex --name "TermuxAgent" --prompt "You are a Termux terminal assistant."
else
  show_help
fi
