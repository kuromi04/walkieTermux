const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { deriveTopic, agentId } = require('../src/crypto')

describe('deriveTopic', () => {
  it('returns a 32-byte Buffer', () => {
    const result = deriveTopic('chan', 'sec')
    assert.ok(Buffer.isBuffer(result))
    assert.equal(result.length, 32)
  })

  it('is deterministic', () => {
    const a = deriveTopic('chan', 'sec')
    const b = deriveTopic('chan', 'sec')
    assert.deepEqual(a, b)
  })

  it('differs for different channels', () => {
    const a = deriveTopic('a', 'secret')
    const b = deriveTopic('b', 'secret')
    assert.notDeepEqual(a, b)
  })

  it('differs for different secrets', () => {
    const a = deriveTopic('chan', 'x')
    const b = deriveTopic('chan', 'y')
    assert.notDeepEqual(a, b)
  })

  it('matches sha256 of walkie:{channel}:{secret}', () => {
    const expected = crypto.createHash('sha256').update('walkie:mychan:mysec').digest()
    const result = deriveTopic('mychan', 'mysec')
    assert.deepEqual(result, expected)
  })
})

describe('agentId', () => {
  it('returns an 8-character hex string', () => {
    const id = agentId()
    assert.equal(id.length, 8)
    assert.match(id, /^[0-9a-f]{8}$/)
  })

  it('returns unique values', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) ids.add(agentId())
    assert.ok(ids.size >= 90, `Expected >=90 unique IDs, got ${ids.size}`)
  })
})
