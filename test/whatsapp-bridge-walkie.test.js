// Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
// Integración: el bridge WhatsApp usa el cliente walkie (join/send/stream/leave)
// para enrutar mensajes. Este test valida ese límite de integración con un
// daemon real, sin necesitar una cuenta de WhatsApp.

const test = require('node:test')
const assert = require('node:assert')

const { createTempDir, cleanupDir } = require('./helpers')

test('bridge walkie side: join → send → stream → leave', async () => {
  const walkieDir = createTempDir()
  // client.js lee WALKIE_DIR al cargar; lo fijamos a un dir temporal.
  process.env.WALKIE_DIR = walkieDir

  const { request, streamMessages } = require('../src/client')

  const channel = 'wa-itest'
  const secret = 'secret'
  const cid = 'wa-bot'

  let abort = { aborted: false, socket: null }
  try {
    // 1) join (igual que el bridge)
    const join = await request({ action: 'join', channel, secret, clientId: cid })
    assert.ok(join.ok, `join falló: ${JSON.stringify(join)}`)

    // 2) listener secundario para verificar recepción (simula un agente)
    const listenerId = 'nika'
    await request({ action: 'join', channel, secret, clientId: listenerId })

    const received = []
    streamMessages(channel, secret, listenerId, abort, (msg) => {
      received.push(msg)
    })

    // 3) send (igual que el bridge, WhatsApp → walkie)
    const send = await request({ action: 'send', channel, message: 'hola desde WA', clientId: cid })
    assert.ok(send.ok, `send falló: ${JSON.stringify(send)}`)

    // Esperar (con timeout) a que el listener reciba el mensaje exacto.
    const target = await new Promise((resolve) => {
      const start = Date.now()
      const poll = () => {
        const hit = received.find((m) => String(m.data) === 'hola desde WA')
        if (hit) return resolve(hit)
        if (Date.now() - start > 8000) return resolve(null)
        setTimeout(poll, 50)
      }
      poll()
    })
    assert.ok(target, 'mensaje no encontrado en el stream')
    assert.strictEqual(target.from, cid, 'el mensaje debería atribuirse a wa-bot')

    // 4) leave (limpieza del bridge)
    const leave = await request({ action: 'leave', channel, clientId: cid })
    assert.ok(leave.ok, `leave falló: ${JSON.stringify(leave)}`)
  } finally {
    abort.aborted = true
    if (abort.socket) { try { abort.socket.destroy() } catch {} }
    try { await request({ action: 'stop' }) } catch {}
    cleanupDir(walkieDir)
    delete process.env.WALKIE_DIR
  }
})
