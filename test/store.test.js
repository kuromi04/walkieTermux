const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { createTempDir, cleanupDir } = require('./helpers')

let tmpDir
let store

before(() => {
  tmpDir = createTempDir()
  process.env.WALKIE_DIR = tmpDir
  // Fresh require so store picks up the new WALKIE_DIR
  delete require.cache[require.resolve('../src/store')]
  store = require('../src/store')
})

after(() => {
  cleanupDir(tmpDir)
  delete process.env.WALKIE_DIR
})

describe('sanitizeName', () => {
  it('replaces null bytes, slashes, backslashes', () => {
    assert.equal(store.sanitizeName('a/b\\c\x00d'), 'a_b_c_d')
  })

  it('leaves normal names unchanged', () => {
    assert.equal(store.sanitizeName('my-channel'), 'my-channel')
  })
})

describe('append + read', () => {
  it('round-trips entries', () => {
    const ch = 'test-rw'
    store.append(ch, { data: 'a', ts: 100 })
    store.append(ch, { data: 'b', ts: 200 })
    store.append(ch, { data: 'c', ts: 300 })
    const msgs = store.read(ch, 0)
    assert.equal(msgs.length, 3)
    assert.equal(msgs[0].data, 'a')
    assert.equal(msgs[2].data, 'c')
  })

  it('filters by since', () => {
    const ch = 'test-since'
    store.append(ch, { data: 'old', ts: 100 })
    store.append(ch, { data: 'mid', ts: 200 })
    store.append(ch, { data: 'new', ts: 300 })
    const msgs = store.read(ch, 150)
    assert.equal(msgs.length, 2)
    assert.equal(msgs[0].data, 'mid')
    assert.equal(msgs[1].data, 'new')
  })

  it('returns [] for nonexistent channel', () => {
    const msgs = store.read('no-such-channel', 0)
    assert.deepEqual(msgs, [])
  })

  it('skips malformed JSONL lines', () => {
    const ch = 'test-malformed'
    const msgDir = path.join(tmpDir, 'messages')
    fs.mkdirSync(msgDir, { recursive: true })
    const fp = path.join(msgDir, ch + '.jsonl')
    fs.writeFileSync(fp, '{"data":"ok","ts":1}\nnot json\n{"data":"also ok","ts":2}\n')
    const msgs = store.read(ch, 0)
    assert.equal(msgs.length, 2)
    assert.equal(msgs[0].data, 'ok')
    assert.equal(msgs[1].data, 'also ok')
  })
})

describe('compact', () => {
  it('removes entries older than TTL', () => {
    const ch = 'test-compact'
    const now = Date.now()
    store.append(ch, { data: 'old', ts: now - 100000 })
    store.append(ch, { data: 'new', ts: now })
    store.compact(ch, 50000)
    const msgs = store.read(ch, 0)
    assert.equal(msgs.length, 1)
    assert.equal(msgs[0].data, 'new')
  })

  it('deletes file when all entries expired', () => {
    const ch = 'test-compact-empty'
    const now = Date.now()
    store.append(ch, { data: 'old', ts: now - 100000 })
    store.compact(ch, 50000)
    const msgDir = path.join(tmpDir, 'messages')
    const fp = path.join(msgDir, ch + '.jsonl')
    assert.equal(fs.existsSync(fp), false)
  })
})

describe('compactAll', () => {
  it('processes all .jsonl files', () => {
    const now = Date.now()
    store.append('compact-a', { data: 'old', ts: now - 100000 })
    store.append('compact-a', { data: 'new', ts: now })
    store.append('compact-b', { data: 'old', ts: now - 100000 })
    store.compactAll(50000)
    assert.equal(store.read('compact-a', 0).length, 1)
    assert.equal(store.read('compact-b', 0).length, 0)
  })
})

describe('loadIds', () => {
  it('returns a Set of message id fields', () => {
    const ch = 'test-ids'
    store.append(ch, { data: 'a', ts: 1, id: 'id-1' })
    store.append(ch, { data: 'b', ts: 2, id: 'id-2' })
    store.append(ch, { data: 'c', ts: 3 }) // no id
    const ids = store.loadIds(ch)
    assert.ok(ids instanceof Set)
    assert.ok(ids.has('id-1'))
    assert.ok(ids.has('id-2'))
    assert.equal(ids.size, 2)
  })

  it('returns empty Set for nonexistent channel', () => {
    const ids = store.loadIds('no-such-ids')
    assert.equal(ids.size, 0)
  })
})
