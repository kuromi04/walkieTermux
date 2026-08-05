# CLAUDE.md

## Project

walkie — P2P communication CLI for AI agents. npm package: `walkie-sh`.

## Architecture

- `bin/walkie.js` — CLI entry point (commander). Version is here AND in `package.json` (keep in sync)
- `src/api.js` — **Programmatic API** (`require('walkie-sh')`). Exports `listen()` and `send()`. Uses daemon IPC under the hood.
- `src/daemon.js` — background daemon managing Hyperswarm P2P + local subscriber routing
- `src/client.js` — IPC client, handles daemon auto-start and stale socket cleanup
- `src/crypto.js` — topic derivation (SHA-256 of channel+secret)
- `src/web.js` — HTTP + WebSocket server bridging browser clients to daemon
- `src/web-ui.js` — exports HTML string for web chat UI (minimal, terminal-style)

## Programmatic API

`package.json` `"main"` points to `src/api.js`. Node apps can `require('walkie-sh')`:

```js
const walkie = require('walkie-sh')

// Listen on a channel (EventEmitter — emits 'message' and 'error')
const ch = await walkie.listen('mychannel:secret', { id: 'mybot' })
ch.on('message', async (msg) => {
  // msg: { from: string, data: string, ts: number, id: string }
  await ch.send('response')
})
await ch.close()

// One-shot send (auto-joins if secret provided)
await walkie.send('mychannel:secret', 'hello', { id: 'sender' })
```

- `listen()` joins the channel, starts streaming via `streamMessages()`, filters own messages, returns a `WalkieChannel` (EventEmitter + `send()` + `close()`)
- `send()` auto-joins and fires a single message — good for scripts/CI
- Both auto-start the daemon if not running

## Testing

`npm test` — 53 automated tests using `node:test` (zero extra deps). Covers crypto, store, CLI utils, daemon IPC, web server, and programmatic API.

`npm run test:p2p` — manual P2P integration test (two daemons, Hyperswarm discovery, ~30s).

Manual same-machine test with two identities:
```bash
walkie stop
WALKIE_ID=alice walkie create test -s secret
WALKIE_ID=bob walkie join test -s secret
WALKIE_ID=alice walkie send test "hello"
WALKIE_ID=bob walkie read test
```

## Publishing

```bash
# bump version in package.json AND bin/walkie.js
npm publish
```

## Git

Remote uses SSH alias: `git@github-vikasprogrammer:vikasprogrammer/walkie.git`

## Skill

- Skill source: `skills/walkie/`
- Test copy: `/Users/vikas/Playground/random/walkie-test/.agents/skills/walkie/`
- Keep both in sync when updating skill docs

## Website

`docs/index.html` — single-page static site at walkie.sh

Deploy:
```bash
instapods deploy walkie --local docs --preset static
```

## Key decisions

- No `--as` flag (removed in v1.3.0). Only `WALKIE_ID` env var for explicit names
- Auto-derived subscriber IDs from terminal session env vars (v1.2.0)
- `--wait` blocks indefinitely, `--timeout` is optional
- `walkie web` uses read-wait loops per channel (no daemon changes needed for real-time)
- Web client identity: `web-{random8hex}`, renameable via header click
- Web session state (channels, secrets, name) persisted in sessionStorage
- `ws` npm package added as 3rd dependency
- Programmatic API (`src/api.js`) wraps `client.js` functions — no new deps, uses existing daemon IPC
- `package.json` `"main": "./src/api.js"` makes `require('walkie-sh')` return the API (not the CLI)
