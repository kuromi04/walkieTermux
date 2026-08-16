# 🟢 WhatsApp ⇄ Walkie Bridge

Conecta tus agentes de WalkieTermux a **WhatsApp** usando Baileys, para que puedas
hablar con tu flota (Nika, Nova, Kai) directamente desde WhatsApp, sin servidores.

```
 WhatsApp  ──(mensaje con chat)──▶  canal P2P walkie  ──▶  agentes (@mención)
 agentes   ──(respuesta con chat)─▶  canal P2P walkie  ──▶  WhatsApp (texto / foto / audio)
```

## Requisitos

- Node.js >= 18 en Termux.
- El daemon de walkie corriendo (`walkie status` debe responder).
- Tu flota de agentes lanzada (ej. `walkie-fleet start --tmux` o `walkie-team`).
- Dependencias de Baileys instaladas (incluidas en `package.json`):
  ```bash
  npm install
  ```

## Uso

```bash
# 1. Lanza tu flota (si aún no está arriba)
walkie-fleet start --tmux
#    o el squad de tmux:  walkie-team

# 2. Levanta el puente de WhatsApp (servicio persistente runit)
sv restart walkie-whatsapp
#    o manualmente:  walkie-whatsapp walkie-fleet:TU_SECRETO_AQUI
#    └── usa el MISMO canal:secreto que config/agents.json
```

En el primer arranque el puente pedirá vincular WhatsApp:

1. **Código de Emparejamiento** (opción `2`, recomendado en Termux):
   ingresa tu número con código de país (ej. `573001234567`) y en WhatsApp
   móvil: *Dispositivos vinculados → Vincular un dispositivo → Vincular con el
   número de teléfono en su lugar*, e ingresa el código que imprime el puente.
2. **Código QR** (opción `1`): escanea el QR que aparece en la terminal.

La sesión queda guardada en `~/session_whatsapp/` (no la compartas ni la subas a git).

## Opciones

| Opción | Descripción |
|--------|-------------|
| `--name <n>` | Nombre del puente en el canal (default: `wa-bot`). |
| `--session <dir>` | Carpeta de sesión de WhatsApp (default: `session_whatsapp`). |
| `--secret <s>` | Secreto del canal (si no lo incluyes en `canal:secreto`). |
| `--no-media` | Desactiva el reenvío de fotos/audio; solo texto. |

## Cómo se enrutan los mensajes

El puente actúa como un cliente estable `wa-bot`. El enrutamiento por `@mención`
funciona igual que en walkie:

| Mensaje que envías por WhatsApp | Quién responde |
|---------------------------------|----------------|
| `prende la linterna` (sin @)    | Solo **Nika** (primaria) |
| `@Nova ¿qué tiempo hace?`       | Solo **Nova** |
| `@Kai dame un script`           | Solo **Kai** |

## Separación de chats (funciona como un WhatsApp real)

Cada contacto de WhatsApp tiene su **propia conversación aislada**:

- El puente envuelve cada mensaje como `{"chat": <jid>, "text": <texto>}` con el
  JID del remitente.
- El agente mantiene **memoria independiente por contacto** (una sesión jcode
  aislada por JID), así no mezcla el contexto entre clientes.
- La respuesta del agente se re-envuelve con el **mismo JID**, por lo que vuelve
  SIEMPRE al contacto correcto, aunque varios hablen a la vez.
- **Aislamiento entre plataformas**: las conversaciones de WhatsApp no se reenvían
  a Telegram y las de Telegram no salen por WhatsApp. Cada plataforma conserva
  sus propios chats.

## Media (foto y voz)

- Si el agente responde con `photo:/ruta.jpg` o `file:/ruta/voice.ogg`, el puente
  envía la imagen o la nota de voz real a WhatsApp (no el texto de la ruta).
- Notas de voz entrantes: Baileys las entrega como audio; el puente actualmente
  reenvía texto. Para transcripción de voz entrante usa la lógica de Whisper del
  agente (`walkie agent`).

## Mantenerlo corriendo en segundo plano

`walkie-whatsapp` corre como **servicio runit** (se reinicia solo si muere):

```bash
sv status walkie-whatsapp       # estado
sv restart walkie-whatsapp      # reiniciar tras editar código/config
sv down walkie-whatsapp         # detener
sv up walkie-whatsapp           # reanudar
tail -f ~/.config/walkie-whatsapp/walkie-whatsapp.log   # logs
```

Definición del servicio: `/data/data/com.termux/files/usr/var/service/walkie-whatsapp/`.

## Solución de problemas

- **Sesión desvinculada / bucle de reconexión**: borra la sesión y vuelve a vincular:
  ```bash
  rm -rf ~/session_whatsapp
  ```
- **QR cortado en la terminal**: reduce la escala de la fuente en Termux (pellizco).
- **No responde en WhatsApp pero sí en walkie**: verifica que el puente use el mismo
  `canal:secreto` que `config/agents.json`.
- **El agente se "pausa" tras muchos mensajes seguidos**: no debería pasar; el puente
  `wa-bot` está exento del límite anti-bucles (igual que `tg-bot`).
- **WhatsApp no aparece en Telegram**: es correcto; las conversaciones de WhatsApp
  están aisladas y no se reenvían a Telegram.

## Seguridad

- `session_whatsapp/` contiene tus claves de autenticación: **no la subas a git**.
  Añádela a `.gitignore` si no está ya cubierta.
- El canal P2P se cifra de extremo a extremo (Noise) y el secreto se hashea en el topic.
