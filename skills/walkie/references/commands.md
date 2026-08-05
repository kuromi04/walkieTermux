# Command Reference

Full reference for all `walkie` CLI commands.

## walkie connect \<channel\>

Connect to a channel. The channel argument uses `channel:secret` format.

```bash
walkie connect <channel>:<secret>
walkie connect mychannel           # secret defaults to channel name
```

**Output on success:**
```
Connected to channel "mychannel"
```

**Notes:**
- If no colon is present, the secret defaults to the channel name
- Secrets can contain colons — only the first colon splits channel from secret
- The daemon auto-starts if not already running
- Replaces the old `create`/`join` commands
- When a new subscriber connects, all existing subscribers on the channel receive a `[system] X joined` announcement

## walkie create \<channel\> (deprecated)

Create a channel and start listening for peers.

```bash
walkie create <channel> -s <secret>
```

| Option | Required | Description |
|--------|----------|-------------|
| `-s, --secret <secret>` | Yes | Shared secret for channel authentication |

**Output on success:**
```
Channel "ops-room" created. Listening for peers...
```

**Notes:**
- **Deprecated**: use `walkie connect <channel>:<secret>` instead
- Functionally identical to `walkie join` — both call the same underlying action
- The daemon auto-starts if not already running

## walkie join \<channel\> (deprecated)

Join an existing channel.

```bash
walkie join <channel> -s <secret>
```

| Option | Required | Description |
|--------|----------|-------------|
| `-s, --secret <secret>` | Yes | Must match the secret used by `create` |

**Output on success:**
```
Joined channel "ops-room"
```

**Notes:**
- **Deprecated**: use `walkie connect <channel>:<secret>` instead
- Peer discovery happens via DHT, typically takes 1–15 seconds
- If both agents join at nearly the same time, both will discover each other
- Re-joining an already-joined channel is a no-op

## walkie send \<channel\> \<message\>

Send a message to all connected peers on a channel.

```bash
walkie send <channel> "your message here"
walkie send <channel>:<secret> "your message"   # auto-connects first
echo "your message" | walkie send <channel>     # read from stdin (avoids shell escaping)
```

**Output on success:**
```
Sent (delivered to 2 recipients)
```

**Notes:**
- If no message argument is provided, reads from stdin — useful for avoiding shell escaping issues with special characters
- If the channel argument contains a colon (`channel:secret`), the agent auto-connects before sending — no separate `connect` step needed
- `delivered` counts remote P2P peers plus local subscribers (other `WALKIE_ID`s on the same daemon), excluding the sender
- Messages are fire-and-forget. If `delivered: 0`, the message is permanently lost — there is no buffering for offline peers
- Messages are only received by peers and subscribers connected at the time of sending
- Quote messages with spaces to prevent shell word-splitting

**Errors:**
```
Error: Not in channel: <channel>
```
You must `connect` to the channel before sending (or use the `channel:secret` format to auto-connect).

## walkie read \<channel\>

Read pending messages from a channel's buffer.

```bash
walkie read <channel>                         # Non-blocking, returns immediately
walkie read <channel> --wait                  # Block until a message arrives (no timeout)
walkie read <channel> --wait --timeout 60     # Block up to 60 seconds
walkie read <channel>:<secret>                # Auto-connects first
walkie read <channel>:<secret> --wait         # Auto-connects, then blocks
```

| Option | Required | Description |
|--------|----------|-------------|
| `-w, --wait` | No | Block until a message arrives |
| `-t, --timeout <seconds>` | No | Optional timeout for `--wait` mode (default: no timeout) |

**Output format:**
```
[14:30:05] a1b2c3d4: task complete, results ready
[14:30:12] a1b2c3d4: second message here
```

Each line: `[timestamp] sender-id: message-content`

- For same-machine messages, `sender-id` is the sender's `WALKIE_ID` (e.g., `alice`)
- For remote P2P messages, `sender-id` is the remote daemon's 8-character hex ID

**No messages:**
```
No new messages
```

**Notes:**
- If the channel argument contains a colon (`channel:secret`), the agent auto-connects before reading — no separate `connect` step needed
- `read` drains the buffer — each message is returned only once
- Without `--wait`, returns immediately with whatever is buffered (or "No new messages")
- With `--wait`, blocks indefinitely until at least one message arrives. Add `--timeout N` to give up after N seconds (returns "No new messages" on timeout, exit code 0)
- Messages received while not reading are buffered locally in the daemon
- If you read from a channel that exists on this daemon but you haven't explicitly joined, your subscriber is auto-registered. You will only receive messages sent after this auto-registration
- The timestamp format is locale-dependent — do not rely on a specific format for parsing

**Errors:**
```
Error: Not in channel: <channel>
```
The channel does not exist on this daemon. Connect to it first (or use the `channel:secret` format to auto-connect).

## walkie watch \<channel\>

Stream messages continuously from a channel. Auto-connects on start.

```bash
walkie watch <channel>:<secret>                # JSONL output (one JSON object per line)
walkie watch <channel>:<secret> --pretty       # Human-readable format
walkie watch <channel>:<secret> --exec <cmd>   # Run a command for each message
```

| Option | Required | Description |
|--------|----------|-------------|
| `--pretty` | No | Human-readable `[HH:MM:SS] sender: message` format |
| `--exec <cmd>` | No | Shell command to run for each message |

**JSONL output (default):**
```json
{"data":"hello","from":"alice","ts":1234567890}
{"data":"world","from":"bob","ts":1234567891}
```

**Pretty output (`--pretty`):**
```
[14:30:05] alice: hello
[14:30:12] bob: world
```

**Exec mode (`--exec`):**

The command runs for each message with these environment variables:

| Variable | Description |
|----------|-------------|
| `WALKIE_MSG` | Message content |
| `WALKIE_FROM` | Sender ID |
| `WALKIE_TS` | Unix timestamp |
| `WALKIE_CHANNEL` | Channel name |

```bash
walkie watch ops:secret --exec 'echo "GOT: $WALKIE_MSG from $WALKIE_FROM"'
```

**Notes:**
- Runs until interrupted (Ctrl+C / SIGINT / SIGTERM)
- Automatically reconnects if the daemon restarts
- Each exec command has a 30-second timeout; errors are logged but don't stop the stream
- If no colon is present in the channel argument, secret defaults to channel name

## walkie status

Show active channels and connection status.

```bash
walkie status
```

**Output:**
```
Daemon ID: a1b2c3d4
  #ops-room — 2 peer(s), 1 subscriber(s), 0 buffered
  #logs — 1 peer(s), 2 subscriber(s), 3 buffered
```

**Notes:**
- `Daemon ID` is a random 8-character hex string, unique per daemon instance
- `peers` = number of connected P2P peers on that channel
- `subscribers` = number of local subscribers (agents using this daemon)
- `buffered` = total messages waiting to be read across **all** subscribers (aggregate, not per-subscriber)
- `status` always shows aggregate data across all subscribers

## walkie leave \<channel\>

Remove your subscription from a channel. The underlying P2P connection is only torn down when all local subscribers (`WALKIE_ID`s) have left.

```bash
walkie leave <channel>
```

**Output on success:**
```
Left channel "ops-room"
```

**Notes:**
- When you leave, all remaining subscribers on the channel receive a `[system] X left` announcement

## walkie stop

Stop the background daemon process.

```bash
walkie stop
```

**Output:**
```
Daemon stopped
```

If daemon is not running:
```
Daemon is not running
```

**Notes:**
- Cleans up the Unix socket at `~/.walkie/daemon.sock`
- All active channels are disconnected
- The daemon will auto-restart on the next `walkie` command

## Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Print the walkie version |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WALKIE_DIR` | Directory for daemon socket, PID, and logs | `~/.walkie` |
| `WALKIE_ID` | Client identity for human-readable sender names | auto-derived |

```bash
export WALKIE_ID=alice
walkie connect demo-room:secret
walkie send demo-room "hello"
# Messages will show "alice" as the sender
```

## Exit Codes

- `0` — Success
- `1` — Error (printed to stderr)
