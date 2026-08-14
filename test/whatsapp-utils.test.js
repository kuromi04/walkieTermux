// Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  extractText,
  parseMediaLine,
  isAudioFile,
  encodeWaMessage,
  decodeWaMessage
} = require('../src/whatsapp-utils')

describe('extractText', () => {
  it('returns conversation text', () => {
    assert.equal(extractText({ conversation: 'hola' }), 'hola')
  })
  it('returns extendedTextMessage text', () => {
    assert.equal(extractText({ extendedTextMessage: { text: 'adios' } }), 'adios')
  })
  it('returns image caption', () => {
    assert.equal(extractText({ imageMessage: { caption: 'foto' } }), 'foto')
  })
  it('returns null for unsupported message', () => {
    assert.equal(extractText({ stickerMessage: {} }), null)
  })
  it('returns null for null input', () => {
    assert.equal(extractText(null), null)
  })
})

describe('parseMediaLine', () => {
  it('parses photo line', () => {
    assert.deepEqual(parseMediaLine('photo:/sdcard/a.jpg'), { kind: 'photo', filePath: '/sdcard/a.jpg', raw: 'photo:/sdcard/a.jpg' })
  })
  it('parses file line', () => {
    assert.deepEqual(parseMediaLine('file:/tmp/a.ogg'), { kind: 'file', filePath: '/tmp/a.ogg', raw: 'file:/tmp/a.ogg' })
  })
  it('returns null when no media line', () => {
    assert.equal(parseMediaLine('hola mundo'), null)
  })
})

describe('isAudioFile', () => {
  it('detects audio extensions', () => {
    for (const f of ['a.ogg', 'b.opus', 'c.mp3', 'd.m4a', 'e.aac', 'f.wav', 'g.flac']) {
      assert.equal(isAudioFile(f), true, f)
    }
  })
  it('rejects non-audio', () => {
    assert.equal(isAudioFile('a.jpg'), false)
  })
})

describe('encodeWaMessage / decodeWaMessage', () => {
  it('round-trips chat context', () => {
    const encoded = encodeWaMessage('573001234567@s.whatsapp.net', 'hola cliente')
    assert.deepEqual(decodeWaMessage(encoded), {
      chat: '573001234567@s.whatsapp.net',
      text: 'hola cliente'
    })
  })

  it('decode returns chat:null for plain text', () => {
    assert.deepEqual(decodeWaMessage('mensaje plano'), { chat: null, text: 'mensaje plano' })
  })

  it('decode handles non-string data', () => {
    assert.deepEqual(decodeWaMessage(123), { chat: null, text: '123' })
    assert.deepEqual(decodeWaMessage(null), { chat: null, text: '' })
    assert.deepEqual(decodeWaMessage(undefined), { chat: null, text: '' })
  })

  it('decode does not choke on arbitrary JSON without chat/text', () => {
    assert.deepEqual(decodeWaMessage('{"foo":1}'), { chat: null, text: '{"foo":1}' })
  })

  it('decode tolerates malformed JSON', () => {
    assert.deepEqual(decodeWaMessage('{oops'), { chat: null, text: '{oops' })
  })

  it('encode coerces chat and text to strings', () => {
    const encoded = encodeWaMessage(123, 456)
    assert.deepEqual(decodeWaMessage(encoded), { chat: '123', text: '456' })
  })

  it('distinguishes two different chats for isolated memory', () => {
    const a = decodeWaMessage(encodeWaMessage('a@s.whatsapp.net', 'x'))
    const b = decodeWaMessage(encodeWaMessage('b@s.whatsapp.net', 'y'))
    assert.notEqual(a.chat, b.chat)
  })
})
