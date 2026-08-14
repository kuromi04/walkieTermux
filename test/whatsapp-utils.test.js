// Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
const test = require('node:test')
const assert = require('node:assert/strict')
const { extractText, parseMediaLine, isAudioFile } = require('../src/whatsapp-utils')

test('extractText: conversation', () => {
  assert.equal(extractText({ conversation: 'hola' }), 'hola')
})

test('extractText: extendedTextMessage', () => {
  assert.equal(extractText({ extendedTextMessage: { text: 'texto ext' } }), 'texto ext')
})

test('extractText: captions de media', () => {
  assert.equal(extractText({ imageMessage: { caption: 'pie de foto' } }), 'pie de foto')
  assert.equal(extractText({ videoMessage: { caption: 'pie de video' } }), 'pie de video')
  assert.equal(extractText({ documentMessage: { caption: 'pie de doc' } }), 'pie de doc')
})

test('extractText: null / vacío', () => {
  assert.equal(extractText(null), null)
  assert.equal(extractText({}), null)
  assert.equal(extractText({ imageMessage: {} }), null)
})

test('parseMediaLine: photo y file', () => {
  assert.deepEqual(parseMediaLine('photo:/ruta/foto.jpg'), { kind: 'photo', filePath: '/ruta/foto.jpg', raw: 'photo:/ruta/foto.jpg' })
  assert.deepEqual(parseMediaLine('file:/tmp/nota.ogg'), { kind: 'file', filePath: '/tmp/nota.ogg', raw: 'file:/tmp/nota.ogg' })
})

test('parseMediaLine: no media', () => {
  assert.equal(parseMediaLine('hola mundo'), null)
  assert.equal(parseMediaLine('photo:'), null)
  assert.equal(parseMediaLine(''), null)
})

test('isAudioFile', () => {
  for (const f of ['a.ogg', 'b.opus', 'c.mp3', 'd.m4a', 'e.aac', 'f.wav', 'g.flac', 'H.MP3']) {
    assert.equal(isAudioFile(f), true, f)
  }
  assert.equal(isAudioFile('x.png'), false)
  assert.equal(isAudioFile('doc.pdf'), false)
})
