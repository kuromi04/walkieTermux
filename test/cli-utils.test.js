const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const os = require('os')

// Save/restore env between tests
const ENV_KEYS = ['WALKIE_ID', 'TERM_SESSION_ID', 'ITERM_SESSION_ID', 'WEZTERM_PANE', 'TMUX_PANE', 'WINDOWID']
let savedEnv

beforeEach(() => {
  savedEnv = {}
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k]
    else delete process.env[k]
  }
})

// Fresh require each time so env changes take effect
function load() {
  delete require.cache[require.resolve('../src/cli-utils')]
  return require('../src/cli-utils')
}

describe('parseChannelArg', () => {
  it('plain channel name defaults secret to channel', () => {
    const { parseChannelArg } = load()
    assert.deepEqual(parseChannelArg('ops'), { channel: 'ops', secret: 'ops' })
  })

  it('splits on first colon', () => {
    const { parseChannelArg } = load()
    assert.deepEqual(parseChannelArg('ops:mysecret'), { channel: 'ops', secret: 'mysecret' })
  })

  it('preserves colons in secret', () => {
    const { parseChannelArg } = load()
    assert.deepEqual(parseChannelArg('ops:my:complex:secret'), { channel: 'ops', secret: 'my:complex:secret' })
  })

  it('handles empty secret', () => {
    const { parseChannelArg } = load()
    assert.deepEqual(parseChannelArg('ops:'), { channel: 'ops', secret: '' })
  })
})

describe('clientId', () => {
  it('returns WALKIE_ID if set', () => {
    process.env.WALKIE_ID = 'alice'
    const { clientId } = load()
    assert.equal(clientId(), 'alice')
  })

  it('derives 8-char hex from TERM_SESSION_ID', () => {
    process.env.TERM_SESSION_ID = 'some-session-123'
    const { clientId } = load()
    const id = clientId()
    assert.equal(id.length, 8)
    assert.match(id, /^[0-9a-f]{8}$/)
  })

  it('returns undefined when no env vars set', () => {
    const { clientId } = load()
    assert.equal(clientId(), undefined)
  })
})

describe('chatName', () => {
  it('returns WALKIE_ID if set', () => {
    process.env.WALKIE_ID = 'bob'
    const { chatName } = load()
    assert.equal(chatName(), 'bob')
  })

  it('falls back to hostname prefix', () => {
    const { chatName } = load()
    const expected = os.hostname().split('.')[0]
    assert.equal(chatName(), expected)
  })
})
