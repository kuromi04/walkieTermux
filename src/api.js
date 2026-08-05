/**
 * Programmatic API for walkie.
 *
 * Usage:
 *   const walkie = require('walkie-sh')
 *   const ch = await walkie.listen('mychannel:secret', { id: 'mybot' })
 *   ch.on('message', async (msg) => {
 *     console.log(msg.from, msg.data)
 *     await ch.send('got it')
 *   })
 *   // later:
 *   await ch.close()
 */

const { EventEmitter } = require('events')
const { request, streamMessages } = require('./client')
const { parseChannelArg } = require('./cli-utils')

/**
 * Listen on a channel and receive messages.
 *
 * @param {string} channelArg - Channel in "name:secret" format
 * @param {object} [opts]
 * @param {string} [opts.id] - Identity for this listener (like WALKIE_ID)
 * @param {boolean} [opts.persist] - Enable persistent message storage
 * @returns {Promise<WalkieChannel>}
 */
async function listen(channelArg, opts = {}) {
  const { channel, secret } = parseChannelArg(channelArg)
  const id = opts.id || `api-${Math.random().toString(36).slice(2, 10)}`

  // Join the channel
  const joinCmd = { action: 'join', channel, secret, clientId: id }
  if (opts.persist) joinCmd.persist = true
  const resp = await request(joinCmd)
  if (!resp.ok) {
    throw new Error(`Failed to join channel "${channel}": ${resp.error}`)
  }

  const emitter = new EventEmitter()
  const abort = { aborted: false, socket: null }

  // Start streaming in background
  const streamPromise = streamMessages(channel, secret, id, abort, (msg) => {
    // Skip own messages
    if (msg.from === id) return
    emitter.emit('message', msg)
  }, opts.persist)

  // Catch stream errors to emit on the channel
  streamPromise.catch((err) => {
    if (!abort.aborted) emitter.emit('error', err)
  })

  /** @type {WalkieChannel} */
  const ch = Object.create(emitter)

  ch.channel = channel
  ch.id = id

  /**
   * Send a message on this channel.
   * @param {string} message
   * @returns {Promise<{delivered: number}>}
   */
  ch.send = async (message) => {
    const resp = await request({ action: 'send', channel, message, clientId: id })
    if (!resp.ok) throw new Error(`Send failed: ${resp.error}`)
    return { delivered: resp.delivered }
  }

  /**
   * Leave the channel and stop listening.
   * @returns {Promise<void>}
   */
  ch.close = async () => {
    abort.aborted = true
    if (abort.socket) {
      try { abort.socket.destroy() } catch {}
    }
    try { await request({ action: 'leave', channel, clientId: id }) } catch {}
    emitter.removeAllListeners()
  }

  return ch
}

/**
 * Send a one-shot message to a channel (fire and forget).
 *
 * @param {string} channelArg - Channel in "name:secret" format
 * @param {string} message - Message text
 * @param {object} [opts]
 * @param {string} [opts.id] - Sender identity
 * @returns {Promise<{delivered: number}>}
 */
async function send(channelArg, message, opts = {}) {
  const { channel, secret } = parseChannelArg(channelArg)
  const id = opts.id || `api-${Math.random().toString(36).slice(2, 10)}`

  // Auto-join if secret provided
  if (secret !== channel) {
    await request({ action: 'join', channel, secret, clientId: id })
  }

  const resp = await request({ action: 'send', channel, message, clientId: id })
  if (!resp.ok) throw new Error(`Send failed: ${resp.error}`)
  return { delivered: resp.delivered }
}

module.exports = { listen, send }
