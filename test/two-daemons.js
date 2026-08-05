#!/usr/bin/env node

// Integration test: two walkie daemons on separate socket paths
// simulating two agents on different machines

const { spawn } = require('child_process')
const net = require('net')
const path = require('path')
const fs = require('fs')

const DIR_A = '/tmp/walkie-test-a'
const DIR_B = '/tmp/walkie-test-b'
const SOCK_A = path.join(DIR_A, 'daemon.sock')
const SOCK_B = path.join(DIR_B, 'daemon.sock')
const DAEMON = path.join(__dirname, '..', 'src', 'daemon.js')
const CLI = path.join(__dirname, '..', 'bin', 'walkie.js')

function cleanup() {
  // Kill any leftover daemons
  try {
    const pidA = fs.readFileSync(path.join(DIR_A, 'daemon.pid'), 'utf8')
    process.kill(parseInt(pidA), 'SIGTERM')
  } catch {}
  try {
    const pidB = fs.readFileSync(path.join(DIR_B, 'daemon.pid'), 'utf8')
    process.kill(parseInt(pidB), 'SIGTERM')
  } catch {}
  try { fs.rmSync(DIR_A, { recursive: true }) } catch {}
  try { fs.rmSync(DIR_B, { recursive: true }) } catch {}
}

function ipc(sockPath, cmd, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout)
    const sock = net.connect(sockPath)
    let buf = ''
    sock.on('connect', () => sock.write(JSON.stringify(cmd) + '\n'))
    sock.on('data', d => {
      buf += d.toString()
      const idx = buf.indexOf('\n')
      if (idx !== -1) {
        clearTimeout(timer)
        sock.destroy()
        resolve(JSON.parse(buf.slice(0, idx)))
      }
    })
    sock.on('error', e => { clearTimeout(timer); reject(e) })
  })
}

async function waitReady(sockPath, label, maxWait = 15000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const r = await ipc(sockPath, { action: 'ping' })
      if (r.ok) { console.log(`[${label}] Daemon ready`); return }
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error(`${label} daemon failed to start`)
}

async function run() {
  cleanup()
  fs.mkdirSync(DIR_A, { recursive: true })
  fs.mkdirSync(DIR_B, { recursive: true })

  // Start two daemons with separate WALKIE_DIR
  console.log('Starting Daemon A...')
  const procA = spawn(process.execPath, [DAEMON], {
    env: { ...process.env, WALKIE_DIR: DIR_A },
    stdio: 'ignore', detached: true
  })
  procA.unref()

  console.log('Starting Daemon B...')
  const procB = spawn(process.execPath, [DAEMON], {
    env: { ...process.env, WALKIE_DIR: DIR_B },
    stdio: 'ignore', detached: true
  })
  procB.unref()

  await waitReady(SOCK_A, 'A')
  await waitReady(SOCK_B, 'B')

  // Agent A creates channel
  console.log('\n[A] Creating channel "test-room"...')
  let r = await ipc(SOCK_A, { action: 'join', channel: 'test-room', secret: 'abc123' })
  console.log(`[A] Join: ${JSON.stringify(r)}`)

  // Agent B joins channel
  console.log('[B] Joining channel "test-room"...')
  r = await ipc(SOCK_B, { action: 'join', channel: 'test-room', secret: 'abc123' })
  console.log(`[B] Join: ${JSON.stringify(r)}`)

  // Wait for DHT discovery
  console.log('\nWaiting for P2P discovery...')
  let peersFound = false
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const statusA = await ipc(SOCK_A, { action: 'status' })
    const statusB = await ipc(SOCK_B, { action: 'status' })
    const pA = statusA.channels?.['test-room']?.peers || 0
    const pB = statusB.channels?.['test-room']?.peers || 0
    process.stdout.write(`  ${i + 1}s: A sees ${pA} peer(s), B sees ${pB} peer(s)\r`)
    if (pA > 0 && pB > 0) {
      peersFound = true
      console.log(`\nPeers discovered after ${i + 1}s!`)
      break
    }
  }

  if (!peersFound) {
    console.log('\nPeers not found within 30s - DHT might be slow')
    cleanup()
    process.exit(1)
  }

  // Agent A sends a message
  console.log('\n[A] Sending message...')
  r = await ipc(SOCK_A, { action: 'send', channel: 'test-room', message: 'Hello from Agent A!' })
  console.log(`[A] Send: delivered to ${r.delivered} peer(s)`)

  await new Promise(r => setTimeout(r, 1000))

  // Agent B reads
  console.log('[B] Reading messages...')
  r = await ipc(SOCK_B, { action: 'read', channel: 'test-room' })
  console.log(`[B] Read: ${JSON.stringify(r.messages)}`)

  // Agent B replies
  console.log('[B] Sending reply...')
  r = await ipc(SOCK_B, { action: 'send', channel: 'test-room', message: 'Roger that, Agent A!' })
  console.log(`[B] Send: delivered to ${r.delivered} peer(s)`)

  await new Promise(r => setTimeout(r, 1000))

  // Agent A reads
  console.log('[A] Reading messages...')
  r = await ipc(SOCK_A, { action: 'read', channel: 'test-room' })
  console.log(`[A] Read: ${JSON.stringify(r.messages)}`)

  // Verify
  const aGotMsg = r.messages?.length > 0
  console.log(`\n--- Results ---`)
  console.log(`Two-way P2P communication: ${aGotMsg ? 'PASS' : 'FAIL'}`)

  // Cleanup
  await ipc(SOCK_A, { action: 'stop' }).catch(() => {})
  await ipc(SOCK_B, { action: 'stop' }).catch(() => {})
  await new Promise(r => setTimeout(r, 1000))
  cleanup()
  process.exit(aGotMsg ? 0 : 1)
}

run().catch(e => {
  console.error(e)
  cleanup()
  process.exit(1)
})
