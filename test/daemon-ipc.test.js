const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { createTempDir, ipc, startDaemon, stopDaemon, cleanupDir } = require('./helpers')

let tmpDir, sockPath

before(async () => {
  tmpDir = createTempDir()
  const d = await startDaemon(tmpDir)
  sockPath = d.sockPath
})

after(async () => {
  await stopDaemon(sockPath)
  cleanupDir(tmpDir)
})

describe('ping', () => {
  it('returns ok', async () => {
    const r = await ipc(sockPath, { action: 'ping' })
    assert.equal(r.ok, true)
  })
})

describe('unknown action', () => {
  it('returns error', async () => {
    const r = await ipc(sockPath, { action: 'bogus' })
    assert.equal(r.ok, false)
    assert.match(r.error, /Unknown action/)
  })
})

describe('status', () => {
  it('returns empty channels on fresh daemon', async () => {
    const r = await ipc(sockPath, { action: 'status' })
    assert.equal(r.ok, true)
    assert.ok(r.daemonId)
    assert.deepEqual(r.channels, {})
  })
})

describe('join + status', () => {
  it('shows channel after join', async () => {
    const r = await ipc(sockPath, { action: 'join', channel: 'ch1', secret: 's1', clientId: 'alice' })
    assert.equal(r.ok, true)

    const s = await ipc(sockPath, { action: 'status' })
    assert.ok(s.channels.ch1)
    assert.equal(s.channels.ch1.subscribers, 1)
  })

  it('is idempotent', async () => {
    const r = await ipc(sockPath, { action: 'join', channel: 'ch1', secret: 's1', clientId: 'alice' })
    assert.equal(r.ok, true)
    // Still just 1 subscriber
    const s = await ipc(sockPath, { action: 'status' })
    assert.equal(s.channels.ch1.subscribers, 1)
  })
})

describe('send + read', () => {
  it('send to non-joined channel returns error', async () => {
    const r = await ipc(sockPath, { action: 'send', channel: 'nonexistent', message: 'hi', clientId: 'x' })
    assert.equal(r.ok, false)
  })

  it('delivers messages to other subscribers, excludes sender', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch2', secret: 's2', clientId: 'alice' })
    await ipc(sockPath, { action: 'join', channel: 'ch2', secret: 's2', clientId: 'bob' })
    // Drain any system announcements from joins
    await ipc(sockPath, { action: 'read', channel: 'ch2', clientId: 'alice' })
    await ipc(sockPath, { action: 'read', channel: 'ch2', clientId: 'bob' })

    const send = await ipc(sockPath, { action: 'send', channel: 'ch2', message: 'hello', clientId: 'alice' })
    assert.equal(send.ok, true)
    assert.ok(send.delivered >= 1)

    // Bob should have the message
    const bobRead = await ipc(sockPath, { action: 'read', channel: 'ch2', clientId: 'bob' })
    assert.equal(bobRead.ok, true)
    const userMsgs = bobRead.messages.filter(m => m.from !== 'system')
    assert.equal(userMsgs.length, 1)
    assert.equal(userMsgs[0].data, 'hello')
    assert.equal(userMsgs[0].from, 'alice')

    // Alice should NOT have her own message
    const aliceRead = await ipc(sockPath, { action: 'read', channel: 'ch2', clientId: 'alice' })
    assert.equal(aliceRead.ok, true)
    const own = aliceRead.messages.filter(m => m.data === 'hello')
    assert.equal(own.length, 0)
  })

  it('read with no messages returns empty array', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch-empty', secret: 's', clientId: 'reader' })
    const r = await ipc(sockPath, { action: 'read', channel: 'ch-empty', clientId: 'reader' })
    assert.equal(r.ok, true)
    assert.deepEqual(r.messages, [])
  })

  it('read on non-joined channel returns error', async () => {
    const r = await ipc(sockPath, { action: 'read', channel: 'never-joined', clientId: 'ghost' })
    assert.equal(r.ok, false)
  })
})

describe('read --wait', () => {
  it('with timeout returns empty after timeout', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch-wait', secret: 's', clientId: 'waiter' })
    // Drain any system messages
    await ipc(sockPath, { action: 'read', channel: 'ch-wait', clientId: 'waiter' })

    const start = Date.now()
    const r = await ipc(sockPath, { action: 'read', channel: 'ch-wait', clientId: 'waiter', wait: true, timeout: 1 })
    const elapsed = Date.now() - start
    assert.equal(r.ok, true)
    assert.deepEqual(r.messages, [])
    assert.ok(elapsed >= 900, `Expected >=900ms, got ${elapsed}ms`)
  })

  it('resolves when a message arrives', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch-wait2', secret: 's', clientId: 'sender2' })
    await ipc(sockPath, { action: 'join', channel: 'ch-wait2', secret: 's', clientId: 'waiter2' })
    // Drain system messages
    await ipc(sockPath, { action: 'read', channel: 'ch-wait2', clientId: 'waiter2' })

    // Start a waiting read (with generous timeout)
    const readPromise = ipc(sockPath, { action: 'read', channel: 'ch-wait2', clientId: 'waiter2', wait: true, timeout: 10 }, 15000)

    // Send a message after a short delay
    await new Promise(r => setTimeout(r, 200))
    await ipc(sockPath, { action: 'send', channel: 'ch-wait2', message: 'wake up', clientId: 'sender2' })

    const r = await readPromise
    assert.equal(r.ok, true)
    assert.equal(r.messages.length, 1)
    assert.equal(r.messages[0].data, 'wake up')
  })
})

describe('leave', () => {
  it('removes subscriber', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch-leave', secret: 's', clientId: 'leaver' })
    const s1 = await ipc(sockPath, { action: 'status' })
    assert.equal(s1.channels['ch-leave'].subscribers, 1)

    await ipc(sockPath, { action: 'leave', channel: 'ch-leave', clientId: 'leaver' })
    // Channel should be fully removed since no subscribers remain
    const s2 = await ipc(sockPath, { action: 'status' })
    assert.equal(s2.channels['ch-leave'], undefined)
  })

  it('announces leave to remaining subscribers', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch-announce', secret: 's', clientId: 'stayer' })
    await ipc(sockPath, { action: 'join', channel: 'ch-announce', secret: 's', clientId: 'goer' })
    // Drain join announcements
    await ipc(sockPath, { action: 'read', channel: 'ch-announce', clientId: 'stayer' })

    await ipc(sockPath, { action: 'leave', channel: 'ch-announce', clientId: 'goer' })

    const r = await ipc(sockPath, { action: 'read', channel: 'ch-announce', clientId: 'stayer' })
    assert.equal(r.ok, true)
    const sysMsg = r.messages.find(m => m.from === 'system' && m.data.includes('goer') && m.data.includes('left'))
    assert.ok(sysMsg, 'Expected system leave announcement')
  })
})

describe('join announcements', () => {
  it('announces new subscriber to existing ones', async () => {
    await ipc(sockPath, { action: 'join', channel: 'ch-join-ann', secret: 's', clientId: 'first' })
    // Drain
    await ipc(sockPath, { action: 'read', channel: 'ch-join-ann', clientId: 'first' })

    await ipc(sockPath, { action: 'join', channel: 'ch-join-ann', secret: 's', clientId: 'second' })

    const r = await ipc(sockPath, { action: 'read', channel: 'ch-join-ann', clientId: 'first' })
    const sysMsg = r.messages.find(m => m.from === 'system' && m.data.includes('second') && m.data.includes('joined'))
    assert.ok(sysMsg, 'Expected system join announcement')
  })
})

describe('persistence', () => {
  it('join with persist writes to disk on send', async () => {
    const fs = require('fs')
    const path = require('path')
    await ipc(sockPath, { action: 'join', channel: 'ch-persist', secret: 's', clientId: 'writer', persist: true })
    await ipc(sockPath, { action: 'send', channel: 'ch-persist', message: 'saved', clientId: 'writer' })

    const fp = path.join(tmpDir, 'messages', 'ch-persist.jsonl')
    assert.ok(fs.existsSync(fp), 'Expected .jsonl file on disk')
    const content = fs.readFileSync(fp, 'utf8')
    assert.ok(content.includes('saved'))
  })

  it('status shows persist info', async () => {
    const s = await ipc(sockPath, { action: 'status' })
    assert.equal(s.channels['ch-persist'].persist, true)
    assert.ok(typeof s.channels['ch-persist'].stored === 'number')
  })
})
