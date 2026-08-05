#!/usr/bin/env node
// Quick IPC helper: node ipc-send.js <socket-path> <json-command>
const net = require('net')
const sockPath = process.argv[2]
const cmd = JSON.parse(process.argv[3])

const sock = net.connect(sockPath)
let buf = ''
sock.on('connect', () => sock.write(JSON.stringify(cmd) + '\n'))
sock.on('data', d => {
  buf += d.toString()
  const idx = buf.indexOf('\n')
  if (idx !== -1) {
    console.log(JSON.parse(buf.slice(0, idx)))
    sock.destroy()
  }
})
sock.on('error', e => { console.error(e.message); process.exit(1) })
