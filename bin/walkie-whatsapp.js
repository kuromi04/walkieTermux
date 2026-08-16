#!/data/data/com.termux/files/usr/bin/env node
// Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
//
// walkie-whatsapp — Puente bidireccional entre WhatsApp (Baileys) y un canal P2P de Walkie.
//
//   WhatsApp ──(mensaje)──▶ canal walkie ──▶ agentes (Nika/Nova/Kai)
//   agentes  ──(respuesta)──▶ canal walkie ──▶ WhatsApp
//
// Uso:
//   node bin/walkie-whatsapp.js canal:secreto [--name wa-bot] [--session session_whatsapp]
//
// El puente se une al canal como un cliente estable (por defecto "wa-bot").
// Reutiliza el emparejamiento de Baileys: Código QR o Código de Emparejamiento.

const { program } = require('commander')
const readline = require('readline')

program
  .name('walkie-whatsapp')
  .description('Bridge entre WhatsApp y un canal P2P de Walkie')
  .argument('<channel>', 'Canal de Walkie (formato: canal:secreto)')
  .option('--secret <secret>', 'Secreto personalizado (default: nombre del canal)')
  .option('--name <name>', 'Nombre del puente en el canal (default: wa-bot)', 'wa-bot')
  .option('--session <dir>', 'Carpeta de sesión de WhatsApp (default: session_whatsapp)', 'session_whatsapp')
  .option('--no-media', 'Desactiva el reenvío de fotos/audio (solo texto)')
  .option('--pair <phone>', 'Vincular por código de emparejamiento (sin menú interactivo)')
  .action(async (channelArg, opts) => {
    await run(channelArg, opts)
  })

async function run(channelArg, opts) {
  const path = require('path')
  const { parseChannelArg } = require('../src/cli-utils')
  const { request, streamMessages } = require('../src/client')

  const parsed = parseChannelArg(channelArg)
  const channel = parsed.channel
  const secret = opts.secret || parsed.secret
  const cid = opts.name

  // --- 1) Conectar WhatsApp (Baileys) -------------------------------------
  let sock = null
  let lastRemoteJid = null

  // Adjunta el manejador de mensajes entrantes. Se re-ejecuta en cada
  // (re)conexión para enlazar el socket fresco a la variable "sock".
  const attachInbound = (s) => {
    sock = s
    s.ev.on('messages.upsert', async (m) => {
      try {
        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue
          const remoteJid = msg.key.remoteJid
          if (remoteJid === 'status@broadcast') continue
          lastRemoteJid = remoteJid
          const text = extractText(msg.message)
          if (!text) continue
          console.log(`\x1b[2m[WA→walkie]\x1b[0m ${remoteJid.split('@')[0]}: ${text.slice(0, 120)}`)
          await request({ action: 'send', channel, message: encodeWaMessage(remoteJid, text), clientId: cid })
        }
      } catch (e) {
        console.error(`\x1b[31m[WA→walkie] Error:\x1b[0m ${e.message}`)
      }
    })
  }

  try {
    sock = await connectWhatsApp(opts.session, channel, attachInbound, opts.pair)
  } catch (e) {
    console.error(`\x1b[31m[WhatsApp] Error de conexión:\x1b[0m ${e.message}`)
    process.exit(1)
  }

  // --- 2) Unirse al canal P2P ---------------------------------------------
  try {
    const resp = await request({ action: 'join', channel, secret, clientId: cid })
    if (!resp.ok) {
      console.error(`\x1b[31m[Walkie] Error al unirse:\x1b[0m ${resp.error}`)
      process.exit(1)
    }
  } catch (e) {
    console.error(`\x1b[31m[Walkie] No se pudo contactar al daemon:\x1b[0m ${e.message}`)
    process.exit(1)
  }

  console.log(`\x1b[1m--- walkie-whatsapp: #${channel} ---\x1b[0m`)
  console.log(`\x1b[2mPuente "${cid}" activo. WhatsApp ⇄ Walkie.\x1b[0m`)
  console.log(`\x1b[2mCada chat de WhatsApp es una conversación aislada (memoria propia); respuestas por @mención.\x1b[0m`)
  console.log(`\x1b[2mCtrl+C para salir.\x1b[0m\n`)

  // (El enrutamiento WhatsApp → Walkie se adjunta vía attachInbound arriba.)

  // --- 4) Walkie → WhatsApp ------------------------------------------------
  const abort = { aborted: false, socket: null }
  let exiting = false

  streamMessages(channel, secret, cid, abort, async (msg) => {
    // No reenviar los propios mensajes ni los del sistema.
    if (msg.from === cid || msg.from === 'system') return

    // Separación de chats: cada conversación de WhatsApp es independiente.
    // Solo reenviamos a WhatsApp los mensajes que llevan envelope de chat
    // (respuestas de los agentes a una conversación de WhatsApp). Los mensajes
    // planos (origen Telegram/walkie) NO deben salir por WhatsApp.
    const { chat, text } = decodeWaMessage(msg.data)
    if (!chat) {
      console.log(`\x1b[2m[walkie→WA]\x1b[0m ${msg.from}: mensaje sin chat de origen (no WhatsApp); se omite.\x1b[0m`)
      return
    }

    const targetJid = chat
    console.log(`\x1b[2m[walkie→WA]\x1b[0m ${msg.from} → ${chat.split('@')[0]}: ${text.slice(0, 120)}`)

    try {
      await deliverToWhatsApp(sock, targetJid, text, opts.media)
    } catch (e) {
      console.error(`\x1b[31m[walkie→WA] Error:\x1b[0m ${e.message}`)
    }
  })

  // --- 5) Limpieza ---------------------------------------------------------
  const cleanup = async () => {
    if (exiting) return
    exiting = true
    abort.aborted = true
    if (abort.socket) { try { abort.socket.destroy() } catch {} }
    try { await request({ action: 'leave', channel, clientId: cid }) } catch {}
    try { sock.end() } catch {}
    console.log('\n\x1b[2mPuente detenido.\x1b[0m')
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

// ---------------------------------------------------------------------------
// Conexión WhatsApp (refactorizada desde whatsapp-termux-connect)
// ---------------------------------------------------------------------------
async function connectWhatsApp(sessionDir, channel, onOpen, pairPhone) {
  let baileys, pino
  try {
    baileys = require('@whiskeysockets/baileys')
    pino = require('pino')
  } catch (e) {
    throw new Error('Faltan dependencias de WhatsApp. Ejecuta: npm install @whiskeysockets/baileys pino qrcode-terminal')
  }

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
  } = baileys

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  })

  // Vincular si no está registrado
  if (!sock.authState.creds.registered) {
    await pair(sock, channel, pairPhone)
  }

  // Reintento automático ante desconexiones
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const debeReconectar = statusCode !== DisconnectReason.loggedOut
      console.log(`\x1b[31m[WhatsApp] Conexión cerrada (${statusCode}). Reconectando: ${debeReconectar}\x1b[0m`)
      if (debeReconectar) {
        setTimeout(() => {
          connectWhatsApp(sessionDir, channel, onOpen).catch(() => {})
        }, 5000)
      } else {
        console.log(`\x1b[33m[WhatsApp] Sesión desvinculada. Borra "${sessionDir}" y vuelve a vincular.\x1b[0m`)
        process.exit(0)
      }
    } else if (connection === 'open') {
      console.log(`\x1b[32m🚀 WhatsApp conectado. Puente listo en #${channel}.\x1b[0m`)
      if (onOpen) onOpen(sock)
    }
  })

  sock.ev.on('creds.update', saveCreds)
  return sock
}

async function pair(sock, channel, phone) {
  const qrcode = require('qrcode-terminal')
  let latestQr = null

  // Baileys puede emitir el QR muy rápido, incluso antes de que el usuario
  // termine de escoger una opción. Escuchamos desde el inicio y cacheamos el
  // último QR para no perderlo en Termux.
  const qrListener = (update) => {
    if (update.qr) latestQr = update.qr
  }
  sock.ev.on('connection.update', qrListener)

  console.log('\n\x1b[1;36m==================================================')
  console.log('    WHATSAPP ⇄ WALKIE BRIDGE — VINCULACIÓN')
  console.log('==================================================\x1b[0m')
  console.log(` Canal P2P destino: #${channel}`)

  // Modo no interactivo (--pair): salta el menú y pide el código directamente.
  if (phone) {
    await requestPairingCode(sock, phone, qrListener)
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const question = (t) => new Promise((res) => rl.question(t, res))

  console.log(' Seleccione el método de vinculación:')
  console.log(' 1) Código QR (escanear con cámara)')
  console.log(' 2) Código de Emparejamiento (sin cámara)')
  console.log('--------------------------------------------------')

  const opcion = (await question(' Elija una opción [1-2]: ')).trim()

  if (opcion === '2') {
    console.log('\n\x1b[1;33m[Vinculación por Código]\x1b[0m')
    const telefono = await question(' Número (con código de país, ej: 573001234567): ')
    await requestPairingCode(sock, telefono, qrListener)
  } else {
    console.log('\n\x1b[1;34m[Vinculación por Código QR]\x1b[0m')
    let printedQr = null
    const printQr = (qr) => {
      printedQr = qr
      qrcode.generate(qr, { small: true })
      console.log(' Escanea el QR de arriba. Si expira, se imprimirá otro automáticamente.')
    }
    if (latestQr) printQr(latestQr)
    else console.log(' Generando QR...')
    sock.ev.on('connection.update', (update) => {
      if (update.qr && update.qr !== printedQr) printQr(update.qr)
    })
  }

  rl.close()
}

// Solicita un código de emparejamiento y lo imprime. Compartido por el modo
// interactivo (opción 2) y el modo no interactivo (--pair <phone>).
async function requestPairingCode(sock, phone, qrListener) {
  try {
    // Baileys cierra la conexión si se pide el código antes de que el socket
    // termine el handshake. Esperamos el primer QR (señal de que ya conectó).
    await waitForSocketReady(sock)
    if (qrListener) sock.ev.off('connection.update', qrListener)
    const codigo = await sock.requestPairingCode(String(phone).replace(/[^0-9]/g, ''))
    console.log('\n\x1b[1;32m==================================================')
    console.log(` 🔑 CÓDIGO DE VINCULACIÓN: ${codigo}`)
    console.log('==================================================\x1b[0m')
    console.log(' 1. WhatsApp > Dispositivos vinculados > Vincular un dispositivo.')
    console.log(' 2. Seleccione "Vincular con el número de teléfono en su lugar".')
    console.log(' 3. Ingrese el código mostrado arriba.\n')
  } catch (err) {
    console.error('\x1b[31m[ERROR] No se pudo solicitar el código:\x1b[0m', err.message)
    process.exit(1)
  }
}

// Resuelve cuando el socket emite su primer QR o pasa a "open" (ya conectado).
function waitForSocketReady(sock) {
  return new Promise((resolve) => {
    const handler = (u) => {
      if (u.qr || u.connection === 'open') {
        sock.ev.off('connection.update', handler)
        clearTimeout(timer)
        resolve()
      }
    }
    const timer = setTimeout(() => {
      sock.ev.off('connection.update', handler)
      resolve()
    }, 5000)
    sock.ev.on('connection.update', handler)
  })
}

// ---------------------------------------------------------------------------
// Utilidades (puras, en src/whatsapp-utils.js para testeo)
// ---------------------------------------------------------------------------
const { extractText, parseMediaLine, isAudioFile, encodeWaMessage, decodeWaMessage } = require('../src/whatsapp-utils')

async function deliverToWhatsApp(sock, jid, data, mediaEnabled) {
  const text = String(data)

  // Extraer rutas de media del estilo "photo:/ruta" o "file:/ruta"
  const mediaLine = parseMediaLine(text)

  if (mediaEnabled && mediaLine) {
    const { kind, filePath } = mediaLine
    const fs = require('fs')
    if (fs.existsSync(filePath)) {
      if (kind === 'photo') {
        await sock.sendMessage(jid, { image: { url: filePath }, caption: '' })
      } else if (isAudioFile(filePath)) {
        await sock.sendMessage(jid, { audio: { url: filePath }, mimetype: 'audio/ogg', ptt: true })
      } else {
        await sock.sendMessage(jid, { document: { url: filePath } })
      }
      // Si además hay texto extra, enviarlo
      const rest = text.replace(mediaLine.raw, '').trim()
      if (rest) await sock.sendMessage(jid, { text: rest })
      return
    }
  }

  await sock.sendMessage(jid, { text })
}

program.parse()
