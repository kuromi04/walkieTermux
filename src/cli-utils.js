const crypto = require('crypto')
const os = require('os')

function clientId() {
  if (process.env.WALKIE_ID) return process.env.WALKIE_ID

  // Auto-derive from terminal session (unique per tab/window, stable across commands)
  const sessionHint = process.env.TERM_SESSION_ID   // macOS Terminal.app
    || process.env.ITERM_SESSION_ID                  // iTerm2
    || process.env.WEZTERM_PANE                      // WezTerm
    || process.env.TMUX_PANE                         // tmux
    || process.env.WINDOWID                          // X11 terminals
  if (sessionHint) {
    return crypto.createHash('sha256').update(sessionHint).digest('hex').slice(0, 8)
  }

  return undefined // falls back to 'default' in daemon
}

function chatName() {
  if (process.env.WALKIE_ID) return process.env.WALKIE_ID
  return os.hostname().split('.')[0]
}

function parseChannelArg(str) {
  const idx = str.indexOf(':')
  if (idx === -1) return { channel: str, secret: str }
  return { channel: str.slice(0, idx), secret: str.slice(idx + 1) }
}

module.exports = { clientId, chatName, parseChannelArg }
