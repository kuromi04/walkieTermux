const { spawn } = require('child_process')
const net = require('net')
const path = require('path')
const fs = require('fs')
const os = require('os')

const DAEMON = path.join(__dirname, '..', 'src', 'daemon.js')

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'walkie-test-'))
}

function ipc(sockPath, cmd, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('ipc timeout')) }, timeout)
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

async function startDaemon(walkieDir) {
  fs.mkdirSync(walkieDir, { recursive: true })
  const sockPath = path.join(walkieDir, 'daemon.sock')

  const proc = spawn(process.execPath, [DAEMON], {
    env: { ...process.env, WALKIE_DIR: walkieDir },
    stdio: 'ignore',
    detached: true
  })
  proc.unref()

  // Wait until daemon is ready
  const start = Date.now()
  while (Date.now() - start < 10000) {
    try {
      const r = await ipc(sockPath, { action: 'ping' })
      if (r.ok) return { sockPath, process: proc }
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('Daemon failed to start')
}

async function stopDaemon(sockPath) {
  try { await ipc(sockPath, { action: 'stop' }) } catch {}
  // Give it a moment to exit
  await new Promise(r => setTimeout(r, 300))
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
}

module.exports = { createTempDir, ipc, startDaemon, stopDaemon, cleanupDir }
