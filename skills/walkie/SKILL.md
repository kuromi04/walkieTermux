---
name: walkie
description: P2P communication between AI agents using walkie-sh CLI. Use when the user asks to set up agent-to-agent communication, create a walkie channel, send/receive messages between agents, or enable real-time coordination between multiple AI agents. Triggers on "walkie", "agent communication", "talk to another agent", "set up a channel", "inter-agent messaging", "collaborate with", "coordinate with".
allowed-tools: Bash(walkie:*)
---

# Walkie — Agent-to-Agent Communication

Each terminal session automatically gets a unique subscriber ID. Two agents in different terminals can communicate immediately — no setup beyond connecting to a channel.

## How to use walkie

Step 1. Connect to a channel:
```bash
walkie connect <channel>:<secret>
```

Step 2. Send and read messages:
```bash
walkie send <channel> "your message"
walkie read <channel>                      # non-blocking, returns buffered messages
walkie read <channel> --wait               # blocks until a message arrives
walkie read <channel> --wait --timeout 60  # optional: give up after N seconds
```

Step 3. Stream messages (alternative to polling):
```bash
walkie watch <channel>:<secret>            # JSONL output, auto-connects
walkie watch <channel>:<secret> --pretty   # human-readable format
walkie watch <channel>:<secret> --exec 'handle_msg.sh'  # run command per message
```

Step 4. Clean up when done:
```bash
walkie leave <channel>
```

## Listening for messages (recommended for AI agents)

AI agents like Claude Code can't run a blocking `watch` process and do work at the same time. Instead, use background `read --wait`:

```bash
# 1. Connect to the channel
walkie connect <channel>:<secret>

# 2. Start a background read that waits for the next message
walkie read <channel> --wait          # run this in background (run_in_background=true)

# 3. When notified of completion, read the output — that's the message
# 4. Act on it, then start another background read --wait
```

This works because `read --wait` blocks until a message arrives, then returns. Claude Code's background task system automatically notifies you when it completes. No polling, no separate terminal.

For non-AI-agent use cases (scripts, cron jobs), use `walkie watch` with `--exec` instead.

## Example

```bash
# Terminal 1 (Alice)
walkie connect room:secret
walkie send room "hello from alice"

# Terminal 2 (Bob)
walkie connect room:secret
walkie read room
# [14:30:05] alice: hello from alice
```

## Behavior to know

- When an agent connects, all existing subscribers see `[system] X joined`
- When an agent leaves, remaining subscribers see `[system] X left`
- `send` reads from stdin if no message argument given — use `echo "msg" | walkie send channel` to avoid shell escaping
- `delivered: 0` means the message is permanently lost — verify `delivered > 0` for critical messages
- `read` drains the buffer — each message returned only once
- Sender never sees their own messages
- Daemon auto-starts on first command, runs at `~/.walkie/`
- If the daemon crashes, re-join channels (no message persistence)
- `watch` streams messages continuously — handles daemon restarts automatically
- `send` and `read` accept `channel:secret` format and auto-connect if needed
- Debug logs: `~/.walkie/daemon.log`

## More

- [references/commands.md](references/commands.md) — full command reference
- [references/polling-patterns.md](references/polling-patterns.md) — polling strategies and patterns
- [references/architecture.md](references/architecture.md) — how the daemon works
