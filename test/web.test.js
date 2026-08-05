const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const WebSocket = require('ws')
const { createTempDir, ipc, startDaemon, stopDaemon, cleanupDir } = require('./helpers')

let tmpDir, sockPath, webPort, closeWeb
const openSockets = []

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${webPort}${urlPath}`, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    }).on('error', reject)
  })
}

// Buffer messages from connection time to avoid race conditions
function wsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${webPort}/ws`)
    ws._buf = []
    ws._waiters = []
    ws.on('message', data => {
      const parsed = JSON.parse(data.toString())
      if (ws._waiters.length > 0) {
        ws._waiters.shift()(parsed)
      } else {
        ws._buf.push(parsed)
      }
    })
    ws.on('open', () => { openSockets.push(ws); resolve(ws) })
    ws.on('error', reject)
  })
}

function wsRecv(ws, timeout = 10000) {
  if (ws._buf.length > 0) {
    return Promise.resolve(ws._buf.shift())
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws._waiters = ws._waiters.filter(w => w !== waiter)
      reject(new Error('ws recv timeout'))
    }, timeout)
    const waiter = (msg) => {
      clearTimeout(timer)
      resolve(msg)
    }
    ws._waiters.push(waiter)
  })
}

function wsSend(ws, msg) {
  ws.send(JSON.stringify(msg))
}

before(async () => {
  tmpDir = createTempDir()
  process.env.WALKIE_DIR = tmpDir
  const d = await startDaemon(tmpDir)
  sockPath = d.sockPath

  // Pre-join test channels via IPC so Hyperswarm discovery is already flushed
  // when WS clients join (avoids ~4s delay per channel in tests)
  await ipc(sockPath, { action: 'join', channel: 'ws-test', secret: 'sec', clientId: '_preflight' }, 15000)

  // Clear module cache so web.js/client.js pick up WALKIE_DIR
  delete require.cache[require.resolve('../src/client')]
  delete require.cache[require.resolve('../src/web')]
  const { startWebServer } = require('../src/web')
  const srv = await startWebServer({ port: 49100 })
  webPort = srv.port
  closeWeb = srv.close
})

after(async () => {
  for (const ws of openSockets) {
    try { ws.terminate() } catch {}
  }
  await new Promise(r => setTimeout(r, 300))
  if (closeWeb) closeWeb()
  await stopDaemon(sockPath)
  cleanupDir(tmpDir)
  delete process.env.WALKIE_DIR
  // Force exit — read loop retries may hold the process open
  setTimeout(() => process.exit(0), 500)
})

describe('HTTP', () => {
  it('GET / returns 200 with HTML', async () => {
    const r = await httpGet('/')
    assert.equal(r.status, 200)
    assert.ok(r.headers['content-type'].includes('text/html'))
    assert.ok(r.body.includes('<'))
    assert.ok(r.body.includes("const STORAGE_KEY = 'walkie:web:state:v1';"))
    assert.ok(r.body.includes("fetch('/state')"))
  })

  it('GET /unknown returns 404', async () => {
    const r = await httpGet('/unknown')
    assert.equal(r.status, 404)
  })
})

describe('WebSocket', () => {
  it('receives hello on connect', async () => {
    const ws = await wsConnect()
    const msg = await wsRecv(ws)
    assert.equal(msg.type, 'hello')
    assert.ok(msg.clientId.startsWith('web-'))
    ws.terminate()
  })

  it('join + send + receive between two clients', async () => {
    const ws1 = await wsConnect()
    const ws2 = await wsConnect()
    const hello1 = await wsRecv(ws1)
    const hello2 = await wsRecv(ws2)
    assert.equal(hello1.type, 'hello')
    assert.equal(hello2.type, 'hello')

    // Join (channel pre-joined via IPC, so Hyperswarm is already flushed — fast)
    wsSend(ws1, { type: 'join', channel: 'ws-test', secret: 'sec' })
    const joined1 = await wsRecv(ws1)
    assert.equal(joined1.type, 'joined')

    wsSend(ws2, { type: 'join', channel: 'ws-test', secret: 'sec' })
    const joined2 = await wsRecv(ws2)
    assert.equal(joined2.type, 'joined')

    // Give read loops time to start, flush system messages
    await new Promise(r => setTimeout(r, 500))
    ws1._buf = []
    ws2._buf = []

    // ws2 sends a message
    wsSend(ws2, { type: 'send', channel: 'ws-test', message: 'hi from ws2' })

    // ws2 gets 'sent' confirmation (skip any interleaved system messages)
    let sent
    for (let i = 0; i < 5; i++) {
      sent = await wsRecv(ws2)
      if (sent.type === 'sent') break
    }
    assert.equal(sent.type, 'sent')

    // ws1 should receive it (skip any interleaved system messages)
    let received
    for (let i = 0; i < 5; i++) {
      received = await wsRecv(ws1)
      if (received.type === 'messages' && received.messages?.some(m => m.data === 'hi from ws2')) break
    }
    assert.equal(received.type, 'messages')
    assert.ok(received.messages.some(m => m.data === 'hi from ws2'))

    ws1.terminate()
    ws2.terminate()
  })

  it('rename changes clientId', async () => {
    const ws = await wsConnect()
    const hello = await wsRecv(ws)
    assert.equal(hello.type, 'hello')

    wsSend(ws, { type: 'rename', name: 'testuser' })
    const msg = await wsRecv(ws)
    assert.equal(msg.type, 'renamed')
    assert.equal(msg.clientId, 'testuser')
    ws.terminate()
  })

  it('rename strips invalid characters', async () => {
    const ws = await wsConnect()
    const hello = await wsRecv(ws)
    assert.equal(hello.type, 'hello')

    wsSend(ws, { type: 'rename', name: 'te-st_OK' })
    const msg = await wsRecv(ws)
    assert.equal(msg.type, 'renamed')
    assert.equal(msg.clientId, 'te-st_OK')
    ws.terminate()
  })
})
