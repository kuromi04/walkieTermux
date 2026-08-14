# 🔒 Seguridad

Revisión de seguridad de WalkieTermux: modelo de amenazas, buenas prácticas ya
aplicadas, hallazgos corregidos y recomendaciones pendientes.

## Modelo de seguridad

WalkieTermux es una plataforma **P2P sin servidor**. No hay un backend central:

- El **canal + secreto** se derivan a un *topic* mediante SHA-256
  (`walkie:canal:secreto`) y los peers se descubren por ese topic.
- El transporte se cifra de extremo a extremo (Noise).
- **Quien conozca el `canal:secreto` puede unirse al canal** y, por tanto,
  leer mensajes o hablar con los agentes. Por eso el secreto es la llave de
  acceso: debe ser fuerte, único y **nunca** publicarse.

## ✅ Buenas prácticas ya aplicadas

| Área | Estado |
|---|---|
| **`.gitignore`** | Excluye `.env`, `config/agents.json`, `session_whatsapp/`, `*.jstore` y `presentacion-walkieTermux/`. |
| **Secretos hardcodeados** | Ninguno en el código ni en el historial de git (solo placeholders en `.env.example` y `agents.example.json`). |
| **Permisos de credenciales** | Token de Telegram, `creds.json` de WhatsApp, `config/agents.json` y socket IPC en `600`/`700` (solo propietario). |
| **Remoto git** | Sin token embebido en la URL (`https://github.com/kuromi04/walkieTermux.git`). |
| **Metadatos de imágenes** | Sin coordenadas GPS en las capturas subidas. |
| **Token de Telegram** | Se lee de archivo (`~/.config/walkie-tg/token`, `chmod 600`), no hardcodeado. |
| **Anti-inyección de prompt** | Regla de seguridad por defecto antepuesta a cada agente: no revelar tokens, rutas ni archivos internos; rechazar jailbreaks. |

## ⚠️ Hallazgos corregidos

### 1. Servidor web expuesto en `0.0.0.0` (corregido)

`walkie web` escuchaba en **todas las interfaces** (`0.0.0.0`) y **sin
autenticación**, exponiendo `/state` (lectura/escritura) y el control por
WebSocket `/ws` a cualquier dispositivo de la red local.

**Corrección:** ahora enlaza a `127.0.0.1` por defecto. Solo se puede abrir a
la LAN de forma explícita:

```bash
walkie web --host 0.0.0.0   # solo si sabes el riesgo
```

### 2. Secreto del canal filtrado en la documentación (corregido)

El secreto real del canal estaba escrito como "ejemplo" en `docs/BROWSER.md`.
Al estar el repo **público**, eso equivalía a publicar la llave de acceso al
canal de los agentes. Se sustituyó por `TU_SECRETO`.

> ⚠️ **Importante:** aunque se corrigió el archivo, el valor sigue en el
> historial de git. Como el repo es público, **da por comprometido ese secreto**.

### 3. Número de teléfono real en un test (corregido)

`test/whatsapp-utils.test.js` usaba un número real de WhatsApp como fixture. Se
sustituyó por el placeholder `573001234567` (mismo convenio que el resto de la
documentación).

> ⚠️ Al igual que el secreto, el número queda en el historial de git. Revísalo
> si no deseas que figure asociado al proyecto.

### 4. Imágenes pendientes de revisión manual

`banner.jpg` contiene dígitos/cadenas largas que no se pueden verificar desde la
terminal (requiere inspección visual). Revisa que no muestre teléfonos, correos
ni datos personales antes de mantenerlo público.

## 🔧 Recomendaciones pendientes

1. **Rotar el secreto del canal (recomendado).** El actual es débil y predecible
   (y fue expuesto en el historial de git). Usa el script incluido, que genera
   un secreto de 192 bits, respalda la config y (opcionalmente) reinicia los
   puentes:

   ```bash
   bin/walkie-rotate-secret                  # dry-run: muestra el plan
   bin/walkie-rotate-secret --apply          # aplica la rotación (con backup)
   bin/walkie-rotate-secret --apply --restart# aplica y reinicia WhatsApp + Telegram
   ```

   Actualiza `config/agents.json` (campo `channel`) y
   `~/.config/walkie-tg/config.json` (campo `secret`). Mantenlo **solo** en
   archivos gitignorados.

2. **Si expones la web UI a la LAN**, añade autenticación (token/túnel SSH)
   antes de usar `--host 0.0.0.0`.

3. **Captura de pantalla del dispositivo.** `termux-screenshot` ya no existe en
   termux-api (Android 10+ retiró el permiso *screencap* para apps sin root).
   Alternativa que sí funciona: una terminal en el display X11 (Termux:X11) y
   capturarla con ImageMagick:

   ```bash
   export DISPLAY=:0
   xfce4-terminal --hold -x <script> &   # o xterm
   import -window root captura.png       # o -window <id> para una sola ventana
   ```

## 🔐 Privacidad de los mensajes

- El historial del canal se guarda **localmente** en `~/.walkie/messages/`
  (permisos `700`), no en la nube.
- Los mensajes que llegan por WhatsApp se reenvían por el canal P2P: revisa el
  alcance del canal si no quieres que otros peers conozcan ese contenido.
- No se suben capturas que contengan conversaciones reales de usuarios.

## Contacto de seguridad

Reporta vulnerabilidades abriendo un *issue* privado o contactando al autor
(`kuromi04`). Por favor, no publiques exploits sin dar tiempo a corregirlos.
