# 🌐 Navegador ⇄ Walkie Bridge

Controla el navegador **Firefox** desde la red P2P de WalkieTermux: investigación
web, relleno de formularios, extracción de contenido y captura de pantalla, todo
manejable por agentes de IA o desde la terminal.

```
 agente de IA  ──►  walkie-browser  ──►  WebSocket :8766  ──►  host Rust  ──►  extensión Firefox  ──►  página (X11)
```

## Requisitos

- Firefox en Termux X11.
- [firefox-agent-bridge](https://github.com/1jehuang/firefox-agent-bridge) v1.0.0
  instalado (`~/.jcode/browser/`).
- El daemon de walkie corriendo (`walkie status` debe responder).

## Uso

```bash
# Acción directa al navegador (JSON como segundo argumento)
walkie-browser navigate '{"url":"https://example.com"}'
walkie-browser getContent '{"format":"text"}'
walkie-browser fillForm '{"fields":[{"selector":"input[name=fname]","value":"Ana"}]}'
walkie-browser screenshot '{"filename":"/ruta/captura.png"}'

# Agente en el canal P2P (recibe comandos y responde)
walkie-browser bridge canal-agentes:TU_SECRETO --name browser-bot

# Utilidades
walkie-browser ping      # comprobar que Firefox responde
walkie-browser help      # ayuda
```

## Agente en el canal P2P

En el canal, el agente entiende dos formatos de mensaje:

```json
{ "action": "navigate", "params": { "url": "https://example.com" } }
```

```text
browser navigate '{"url":"https://example.com"}'
```

y responde con el prefijo `[browser]`, truncado a 4000 caracteres para no
saturar el canal.

## Acciones disponibles

| Grupo | Acciones |
|---|---|
| Navegación | `navigate`, `reload`, `listTabs`, `newSession`, `setActiveTab`, `getActiveTab` |
| Contenido | `getContent` (`text`/`html`/`annotated`/`title`), `getInteractables`, `scout`, `preexplore` |
| Interacción | `click`, `type`, `fillForm`, `evaluate`, `scroll`, `uploadFile`, `dropFile` |
| Captura | `screenshot` (pasar `filename`; `/tmp` no existe en Termux) |
| Avanzado | `fork`, `parallel`, `batch`, `tryUntil`, `waitFor`, `autoLogin`, `vaultStatus` |

La investigación web nativa del agente (sin navegador) usa `websearch` y `webfetch`.

## Flujo real validado (en vivo)

1. **Investigación**: `navigate` a Wikipedia → `getContent` extrajo el artículo completo.
2. **Formulario**: `navigate` a w3schools → `fillForm` escribió `fname`/`lname` → `evaluate` verificó los valores.
3. **Captura**: `screenshot` guardó el PNG como evidencia visual.
4. **Agente P2P**: un peer envió `browser ping` al canal → el agente respondió `[browser] ✅ ping`.

## Notas técnicas

- El wrapper evita el bug de `PARAMS="${1:-{}}"` (añadía una `}` extra al JSON).
- `screenshot` escribe por defecto en `/tmp`; en Termux hay que pasar `filename`.
- El agente sale limpiamente con `SIGINT`/`SIGTERM` (deja el canal).
