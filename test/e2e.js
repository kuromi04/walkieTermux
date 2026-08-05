#!/usr/bin/env node

// End-to-end test: two daemons discover each other via Hyperswarm
// and exchange messages over P2P

const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')

const topic = crypto.createHash('sha256').update('walkie:test-room:secret').digest()

async function run() {
  console.log('Starting two swarm nodes...\n')

  const swarmA = new Hyperswarm()
  const swarmB = new Hyperswarm()

  const messagesA = []
  const messagesB = []

  swarmA.on('connection', (conn) => {
    console.log('[A] Peer connected!')
    conn.on('error', () => {})
    conn.on('data', d => {
      const msg = d.toString().trim()
      console.log(`[A] Received: ${msg}`)
      messagesA.push(msg)
    })
    // Send after a short delay to let handshake complete
    setTimeout(() => {
      console.log('[A] Sending: hello from A')
      conn.write('hello from A\n')
    }, 500)
  })

  swarmB.on('connection', (conn) => {
    console.log('[B] Peer connected!')
    conn.on('error', () => {})
    conn.on('data', d => {
      const msg = d.toString().trim()
      console.log(`[B] Received: ${msg}`)
      messagesB.push(msg)
    })
    setTimeout(() => {
      console.log('[B] Sending: hello from B')
      conn.write('hello from B\n')
    }, 500)
  })

  // Both join the same topic
  const discA = swarmA.join(topic, { server: true, client: true })
  const discB = swarmB.join(topic, { server: true, client: true })

  await discA.flushed()
  console.log('[A] Joined topic, discovering peers...')
  await discB.flushed()
  console.log('[B] Joined topic, discovering peers...')

  // Wait for messages to flow (DHT discovery can take a while)
  console.log('Waiting for P2P discovery (up to 15s)...')
  const start = Date.now()
  while (messagesA.length === 0 && messagesB.length === 0 && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 500))
  }
  // Extra time for both sides to finish
  await new Promise(r => setTimeout(r, 2000))

  console.log('\n--- Results ---')
  console.log(`[A] received ${messagesA.length} message(s):`, messagesA)
  console.log(`[B] received ${messagesB.length} message(s):`, messagesB)

  const passed = messagesA.length > 0 && messagesB.length > 0
  console.log(`\n${passed ? 'PASS' : 'FAIL'}: P2P communication ${passed ? 'works!' : 'failed'}`)

  await swarmA.destroy()
  await swarmB.destroy()
  process.exit(passed ? 0 : 1)
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
