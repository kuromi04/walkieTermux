# Polling Patterns

Strategies for AI agents to send and receive messages effectively.

## Background Read-Wait (recommended for AI agents)

AI agents (Claude Code, Cursor, etc.) work in a single process and can't dedicate a terminal to `watch`. The recommended pattern is background `read --wait`:

```
Agent starts background task:  walkie read channel --wait
                                    ↓
                          blocks until message arrives
                                    ↓
                          agent gets notified with output
                                    ↓
                          agent acts on message
                                    ↓
                          starts another background read --wait
```

### How to use in Claude Code

```bash
# 1. Connect once at the start
walkie connect team:secret

# 2. Run read --wait as a background task (run_in_background=true in Bash tool)
walkie read team --wait

# 3. Claude Code auto-notifies you when a message arrives
# 4. Process the message, send a reply if needed
walkie send team "acknowledged, working on it"

# 5. Start another background read --wait for the next message
walkie read team --wait
```

### Why this works

- `read --wait` blocks until a message arrives, then returns immediately
- Claude Code's background task system notifies the agent when the command completes
- No polling interval, no wasted cycles, no separate terminal needed
- The agent can do other work while waiting — it gets interrupted when a message arrives

### Why not `watch`?

`watch` streams continuously and blocks the terminal. It's designed for scripts and `--exec` handlers, not for AI agents that need to interleave work with message handling. Use `watch` for shell scripts and automation; use background `read --wait` for AI agents.

## Continuous Monitoring with watch

Stream all messages in real-time. For scripts and automation (not AI agents — see above).

```bash
walkie watch <channel>:<secret>              # JSONL output
walkie watch <channel>:<secret> --pretty     # human-readable
walkie watch <channel>:<secret> --exec 'process_message.sh'  # run command per message
```

`watch` auto-connects, streams continuously, and handles daemon restarts. Use this instead of writing your own read loop.

## Non-Blocking Poll

Check for messages without waiting. Best for periodic checks between task steps.

```bash
walkie read <channel>
```

Returns immediately. If no messages: `No new messages`. Use this when you have other work to do and just want to check for updates.

## Blocking Wait

Block until a message arrives or timeout elapses.

```bash
walkie read <channel> --wait --timeout 30
```

Use this when you're idle and waiting for a specific response from another agent. The timeout prevents hanging indefinitely.

## Pattern: Task Delegation

One agent sends a task, waits for the result.

```bash
# Coordinator
walkie send work-channel "process /data/input.csv"
walkie read work-channel --wait --timeout 120   # Wait up to 2 min for result

# Worker
walkie read work-channel --wait                 # Get assignment
# ... process ...
walkie send work-channel "result: 42 records processed, output at /tmp/out.csv"
```

## Pattern: Heartbeat / Keep-Alive

Periodic status updates so a coordinator knows workers are alive.

```bash
# Worker (every N steps)
walkie send status-channel "worker-1: alive, step 5/10, 50% done"

# Coordinator (poll periodically)
walkie read status-channel
```

## Pattern: Stop Signal

A coordinator can send a stop signal mid-task.

```bash
# Coordinator
walkie send task-channel "STOP"

# Worker (checks between steps)
MESSAGES=$(walkie read task-channel)
if echo "$MESSAGES" | grep -q "STOP"; then
  walkie send task-channel "acknowledged STOP, cleaning up"
  # ... cleanup ...
  exit 0
fi
```

## Pattern: Request-Response

Simulate synchronous request-response over the async channel.

```bash
# Requester
walkie send qa-channel "REQUEST: what is the current price of BTC?"
RESPONSE=$(walkie read qa-channel --wait --timeout 60)

# Responder
walkie read qa-channel --wait
# Got: "REQUEST: what is the current price of BTC?"
# ... look up answer ...
walkie send qa-channel "RESPONSE: BTC = $45,230"
```

## Pattern: Fan-Out / Fan-In

One coordinator, multiple workers.

```bash
# Coordinator: fan out
walkie send dispatch "task:worker-1:analyze batch A"
walkie send dispatch "task:worker-2:analyze batch B"
walkie send dispatch "task:worker-3:analyze batch C"

# Each worker: read and filter
MESSAGES=$(walkie read dispatch)
# Parse for your task based on worker ID prefix

# Coordinator: fan in (collect results)
walkie read dispatch --wait --timeout 120
# Repeat reads until all workers report back
```

## Tips

- **Non-blocking reads are cheap** — call `walkie read` liberally between steps
- **Buffer awareness** — messages accumulate while you're not reading; a single `read` returns all pending messages
- **No message persistence** — messages are fire-and-forget. If `delivered: 0`, the message is permanently lost. There is no buffering for offline peers. On the same machine, local subscribers (other WALKIE_IDs) do receive messages even when no P2P peers are connected
- **One read = drain** — `walkie read` returns all buffered messages and clears them; you won't see them again
- **Timeout padding** — the CLI adds 5 seconds to the `--wait` timeout internally for IPC overhead, so the actual wait duration matches what you specify
- **`watch` replaces polling loops** — for continuous monitoring, use `walkie watch` instead of a `while true; do walkie read; sleep N; done` loop
- **Auto-connect with `channel:secret`** — `send` and `read` accept `channel:secret` format and auto-join, removing the need for a separate `connect`/`join` step
