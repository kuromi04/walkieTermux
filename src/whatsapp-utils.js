// Copyright (c) 2026 kuromi04 · WalkieTermux. GPL-3.0 License.
// Utilidades puras del bridge WhatsApp, extraídas para poder testearlas sin
// una cuenta de WhatsApp.

// Extrae el texto legible de un mensaje de WhatsApp (Baileys) según su tipo.
function extractText(message) {
  if (!message) return null
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage && message.extendedTextMessage.text) return message.extendedTextMessage.text
  if (message.imageMessage && message.imageMessage.caption) return message.imageMessage.caption
  if (message.videoMessage && message.videoMessage.caption) return message.videoMessage.caption
  if (message.documentMessage && message.documentMessage.caption) return message.documentMessage.caption
  return null
}

// Detecta una línea de media del estilo "photo:/ruta" o "file:/ruta" al inicio
// del texto. Devuelve { kind, filePath, raw } o null.
function parseMediaLine(text) {
  const m = String(text).match(/^(photo|file):(\S+)$/m)
  if (!m) return null
  return { kind: m[1], filePath: m[2], raw: m[0] }
}

// Decide si un archivo debe enviarse como nota de voz (audio).
function isAudioFile(filePath) {
  return /\.(ogg|opus|mp3|m4a|aac|wav|flac)$/i.test(filePath)
}

module.exports = { extractText, parseMediaLine, isAudioFile }
