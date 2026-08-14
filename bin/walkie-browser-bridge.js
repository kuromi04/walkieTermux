#!/data/data/com.termux/files/usr/bin/env node
// Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
//
// walkie-browser-bridge : puente entre un canal P2P de Walkie y Firefox (vía
// firefox-agent-bridge de 1jehuang). Corre como un agente más en el canal:
// recibe comandos de navegador desde cualquier peer y devuelve el resultado.
//
// Uso:
//   node bin/walkie-browser-bridge.js canal-agentes:secreto  [--name browser-bot]
//
// Formato de comando (mensaje en el canal):
//   JSON con { "action": "navigate", "params": { "url": "..." } }
//   o texto plano:  browser <action> '<json params>'
//   (ej:  browser navigate '{"url":"https://example.com"}' )

const { request, streamMessages } = require('../src/client')
const { clientId, parseChannelArg } = require('../src/cli-utils')
const { spawnSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const path = require('path')

// Resolver el binario `browser` (firefox-agent-bridge). Preferimos el del PATH;
// si no, el instalado por jcode.
function resolveBrowser() {
  const inPath = spawnSync('sh', ['-c', 'command -v browser'], { encoding: 'utf8' }).stdout.trim()
  if (inPath) return inPath
  const home = os.homedir()
  const candidates = [
    path.join(home, '.jcode', 'browser', 'browser'),
    path.join(home, '.local', 'bin', 'browser')
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  return 'browser'
}

const BROWSER = resolveBrowser()

function runBrowser(action, params) {
  const json = typeof params === 'string' ? params : JSON.stringify(params || {})
  const r = spawnSync(BROWSER, [action, json], { encoding: 'utf8', timeout: 120000 })
  const out = (r.stdout || '').trim()
  const err = (r.stderr || '').trim()
  return { status: r.status, out, err }
}

// Interpreta un mensaje como comando de navegador. Devuelve { action, params } o null.
function parseCommand(data) {
  const raw = String(data).trim()
  // 1) JSON directo: { "action": "...", "params": {...} }
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw)
      if (obj && typeof obj.action === 'string') {
        return { action: obj.action, params: obj.params || {} }
      }
    } catch {}
  }
  // 2) Texto: browser <action> '<json>'  (o  browser <action> sin params)
  const m = raw.match(/^browser\s+([a-zA-Z]+)\s*(.*)$/i)
  if (m) {
    const action = m[1]
    let params = m[2].trim()
    if (!params) params = '{}'
    return { action, params }
  }
  return null
}

async function main() {
  const channelArg = process.argv[2]
  if (!channelArg) {
    console.error('uso: walkie-browser-bridge <canal[:secreto]> [--name <nombre>]')
    process.exit(1)
  }
  let name = 'browser-bot'
  const ni = process.argv.indexOf('--name')
  if (ni !== -1 && process.argv[ni + 1]) name = process.argv[ni + 1]

  const { channel, secret } = parseChannelArg(channelArg)
  const cid = clientId() || name

  console.log(`\x1b[1m--- walkie-browser: #${channel} ---\x1b[0m`)
  console.log(`\x1b[2mPuente "${name}" activo. Firefox ⇄ Walkie (firefox-agent-bridge).\x1b[0m`)
  console.log(`\x1b[2mBinario: ${BROWSER}\x1b[0m`)

  const joinResp = await request({ action: 'join', channel, secret, clientId: cid })
  if (!joinResp.ok) {
    console.error(`Error al unirse: ${joinResp.error}`)
    process.exit(1)
  }

  const abort = { aborted: false, socket: null }

  streamMessages(channel, secret, cid, abort, async (msg) => {
    if (msg.from === cid || msg.from === 'system') return

    const cmd = parseCommand(msg.data)
    if (!cmd) return // ignorar mensajes que no son comandos de navegador

    console.log(`\x1b[2m[walkie→firefox]\x1b[0m ${msg.from}: ${cmd.action}`)

    const { status, out, err } = runBrowser(cmd.action, cmd.params)
    const prefix = status === 0 ? '✅' : `❌ (exit ${status})`
    const body = out || err || '(sin salida)'
    // Truncar para no saturar el canal
    const max = 4000
    const truncated = body.length > max ? body.slice(0, max) + '…' : body
    const reply = `[browser] ${prefix} ${cmd.action}\n${truncated}`

    console.log(`\x1b[2m[firefox→walkie]\x1b[0m ${cmd.action} → ${status === 0 ? 'ok' : 'error'}`)
    await request({ action: 'send', channel, message: reply, clientId: cid }).catch(() => {})
  })

  const cleanup = async () => {
    abort.aborted = true
    if (abort.socket) try { abort.socket.destroy() } catch {}
    try { await request({ action: 'leave', channel, clientId: cid }) } catch {}
    console.log('\n\x1b[2mPuente browser detenido\x1b[0m')
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

main().catch((e) => {
  console.error(`Error: ${e.message}`)
  process.exit(1)
})
