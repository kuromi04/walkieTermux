const crypto = require('crypto')

function deriveTopic(channel, secret) {
  return crypto.createHash('sha256')
    .update(`walkie:${channel}:${secret}`)
    .digest()
}

function agentId() {
  // Generate a short random ID for this daemon instance
  return crypto.randomBytes(4).toString('hex')
}

module.exports = { deriveTopic, agentId }
