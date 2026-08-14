# 🤖 Modelos de IA utilizados

Documentación de los modelos y motores de IA que usa WalkieTermux, con el rol
de cada uno dentro de la plataforma.

## 1. Cerebro de los agentes (LLM)

La flota de agentes (Nika, Nova, Kai) habla con un LLM a través de un **CLI**.
WalkieTermux no se casa con un solo proveedor: abstrae la llamada y soporta
varios *backends* intercambiables.

| Backend | CLI | Nota |
|---|---|---|
| **jcode** | `jcode` | Backend **principal** de la flota (glibc, requiere el puente de compatibilidad Bionic en Termux). |
| **Claude** (Anthropic) | `claude` | Claude Code en modo *headless* (`-p`). |
| **Codex** (OpenAI) | `codex` | Codex CLI en modo *ephemeral* (`exec`). |
| **Ollama** (local) | `ollama` | Modelos locales sin nube. |

Se puede elegir un modelo concreto por agente con `--model nombre@proveedor`
(el identificador se sanitiza a `nombre` para que CLI y API coincidan). La
configuración activa de la flota usa el modelo por defecto de cada backend
(`"model": null`).

```bash
walkie agent canal:secreto --cli jcode --name Nika --model mi-modelo@proveedor
```

## 2. Transcripción de voz (STT)

Las notas de voz entrantes se transcriben con **Whisper** (OpenAI) de forma
local, en español:

```bash
whisper nota.ogg --model base --language es --output_format txt
```

Variantes usadas: `--model tiny` (rápido) y `--model base` (equilibrio
velocidad/precisión).

## 3. Síntesis de voz (TTS)

Las respuestas de los agentes se convierten en audio con dos motores:

| Motor | Uso |
|---|---|
| **Fish Audio** | Síntesis de voz del flujo principal (token en `.env`). |
| **edge-tts** (`walkie-tts`) | Síntesis gratuita con voces de Microsoft Edge. |

El resultado se sirve como `file:/sdcard/Download/voice.ogg`.

## 4. Control del navegador

El puente de Firefox (`firefox-agent-bridge` v1.0.0) no es un LLM, pero permite
que los agentes usen la web: navegar, extraer contenido, rellenar formularios y
capturar pantalla. Ver [`docs/BROWSER.md`](BROWSER.md).

## Resumen

| Rol | Motor/Modelo |
|---|---|
| Cerebro (LLM) | `jcode` (principal), `claude`, `codex`, `ollama` |
| Transcripción (STT) | Whisper (`tiny`/`base`, español) |
| Síntesis (TTS) | Fish Audio + edge-tts |
| Navegador | firefox-agent-bridge (Firefox) |
