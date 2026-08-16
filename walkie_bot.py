#!/usr/bin/env python3
import os
import sys
import json
import time
import logging
import subprocess
import re
from telegram import Update, ForceReply
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Configurar logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.expanduser("~/walkie_bot_config.json")
DEFAULT_TOKEN = "8366992146:AAF2WcFpy_IznJz57ch0WZCGf_cgPeh3WeA"

# Configuración por defecto
default_config = {
    "TOKEN": DEFAULT_TOKEN,
    "ALLOW_ALL": False,   # Si True, cualquier persona puede usar el bot (modo público)
    "ALLOWED_USERS": [],  # Si está vacío, el primero en /start se vuelve dueño
    "WALKIE_CHANNEL": "telegram_bot",
    "WALKIE_SECRET": "telegram_bot",
    "AGENT_NAME": "Nika",
    "AGENT_CLI": "auto",  # 'jcode', 'claude', 'codex' o 'auto'
    "AGENT_MODEL": ""     # Opcional, modelo para el agente
}

def load_config():
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=4, ensure_ascii=False)
        logger.info(f"Creado archivo de configuración por defecto en {CONFIG_PATH}")
        return default_config
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
            # Asegurar que todas las claves por defecto existan
            for k, v in default_config.items():
                if k not in config:
                    config[k] = v
            return config
    except Exception as e:
        logger.error(f"Error al leer configuración: {e}. Usando valores por defecto.")
        return default_config

def save_config(config):
    try:
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error al guardar configuración: {e}")

config = load_config()
TOKEN = config["TOKEN"]
WALKIE_CHANNEL = config["WALKIE_CHANNEL"]
WALKIE_SECRET = config["WALKIE_SECRET"]
AGENT_NAME = config["AGENT_NAME"]

# Global variable to store reference to agent process
agent_proc = None

def get_agent_cli():
    cli_choice = config.get("AGENT_CLI", "auto")
    if cli_choice in ["jcode", "claude", "codex"]:
        return cli_choice
    # Auto detect (prefer jcode if available, then claude, then codex)
    for cmd in ["jcode", "claude", "codex"]:
        if subprocess.run(["which", cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            return cmd
    return None

def start_walkie_daemon():
    """Asegura que el daemon de walkie esté corriendo."""
    logger.info("Verificando el daemon de walkie.sh...")
    try:
        # 'walkie status' iniciará el daemon si no está corriendo
        subprocess.run(["walkie", "status"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        logger.info("Daemon de walkie.sh verificado/iniciado con éxito.")
    except Exception as e:
        logger.error(f"Error al verificar/iniciar el daemon de walkie.sh: {e}")

def stop_existing_agents():
    """Detiene cualquier proceso de walkie agent previo en el canal."""
    logger.info("Limpiando agentes de walkie antiguos...")
    try:
        # En Termux pkill es efectivo
        cmd = f"pkill -f 'walkie agent {WALKIE_CHANNEL}'"
        subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        logger.error(f"Error al detener agentes previos: {e}")

def start_walkie_agent():
    """Inicia el agente de walkie en segundo plano."""
    global agent_proc
    start_walkie_daemon()
    stop_existing_agents()
    
    cli = get_agent_cli()
    if not cli:
        logger.error("No se detectó ni 'claude' ni 'codex' CLI. No se puede iniciar el agente.")
        return False
        
    logger.info(f"Iniciando agente de walkie '{AGENT_NAME}' en canal '{WALKIE_CHANNEL}' usando '{cli}'...")
    
    agent_cmd = [
        "walkie", "agent", f"{WALKIE_CHANNEL}:{WALKIE_SECRET}",
        "--name", AGENT_NAME,
        "--cli", cli
    ]
    if config.get("AGENT_MODEL"):
        agent_cmd.extend(["--model", config["AGENT_MODEL"]])
        
    # Redirigir la salida del agente a un log local
    log_file = os.path.expanduser("~/walkie_agent.log")
    try:
        f = open(log_file, "w", encoding="utf-8")
        agent_proc = subprocess.Popen(
            agent_cmd,
            stdout=f,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid  # Crear nuevo grupo de procesos para poder matarlo limpiamente
        )
        logger.info(f"Agente iniciado (PID: {agent_proc.pid}). Logs en {log_file}")
        return True
    except Exception as e:
        logger.error(f"Error al iniciar el agente: {e}")
        return False

def clean_up():
    """Limpia los procesos iniciados."""
    global agent_proc
    if agent_proc:
        logger.info("Deteniendo el proceso del agente de walkie...")
        try:
            import signal
            os.killpg(os.getpgid(agent_proc.pid), signal.SIGTERM)
            agent_proc.wait(timeout=3)
        except Exception as e:
            logger.error(f"Error al detener el agente: {e}")
        agent_proc = None

# Parser para las respuestas de walkie
def parse_walkie_messages(stdout: str):
    messages = []
    current_msg = None
    # [hh:mm:ss] sender: data o [hh:mm:ss AM/PM] sender: data
    msg_start_re = re.compile(r'^\[(\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?)\]\s*([\w\-]+):\s*(.*)', re.IGNORECASE)
    
    for line in stdout.splitlines():
        match = msg_start_re.match(line)
        if match:
            if current_msg:
                messages.append(current_msg)
            current_msg = {
                "time": match.group(1),
                "from": match.group(2),
                "data": match.group(3)
            }
        else:
            if current_msg:
                current_msg["data"] += "\n" + line
            else:
                if line.strip() and not line.startswith("No new messages"):
                    current_msg = {
                        "time": "",
                        "from": "unknown",
                        "data": line
                    }
    if current_msg:
        messages.append(current_msg)
    return messages

def clear_pending_messages(channel: str, client_id: str):
    """Lee y vacía cualquier mensaje pendiente en la cola de walkie."""
    try:
        env = os.environ.copy()
        env["WALKIE_ID"] = client_id
        subprocess.run(
            ["walkie", "read", f"{channel}:{WALKIE_SECRET}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
            timeout=2
        )
    except Exception:
        pass

def get_walkie_response(message: str) -> str:
    """Envía un mensaje a walkie.sh y devuelve la respuesta del agente."""
    client_id = "tg_bot"
    env = os.environ.copy()
    env["WALKIE_ID"] = client_id

    # 1. Vaciar mensajes anteriores para evitar lecturas fantasmas
    clear_pending_messages(WALKIE_CHANNEL, client_id)

    try:
        # 2. Enviar el mensaje al canal
        subprocess.run(
            ["walkie", "send", f"{WALKIE_CHANNEL}:{WALKIE_SECRET}", message],
            env=env,
            check=True,
            timeout=5
        )
        
        # 3. Esperar la respuesta (máximo 30 segundos debido a la latencia de la IA)
        result = subprocess.run(
            ["walkie", "read", f"{WALKIE_CHANNEL}:{WALKIE_SECRET}", "--wait", "--timeout", "30"],
            env=env,
            capture_output=True,
            text=True,
            check=True,
            timeout=35
        )
        
        if result.stdout:
            messages = parse_walkie_messages(result.stdout)
            # Buscar el último mensaje del agente
            for msg in reversed(messages):
                sender = msg["from"]
                # Ignorar mensajes propios y del sistema
                if sender != client_id and sender != "system":
                    return msg["data"].strip()
            
            # Si no encontramos mensajes del agente pero hay texto, mostrarlo
            if messages:
                return messages[-1]["data"].strip()

        return "El agente no respondió a tiempo."
    except subprocess.TimeoutExpired:
        logger.warning("Timeout excedido al comunicarse con walkie.sh")
        return "Lo siento, el agente de IA tardó demasiado en responder."
    except Exception as e:
        logger.error(f"Error al comunicarse con walkie.sh: {e}")
        return "Ocurrió un error de conexión con walkie.sh."

# Verificación de usuario autorizado
def is_authorized(user):
    # Modo público: cualquiera puede usar el bot
    if config.get("ALLOW_ALL", False):
        return True

    allowed = config.get("ALLOWED_USERS", [])
    if not allowed:
        # Si no hay usuarios en la lista, permitimos todo por ahora,
        # pero la primera persona que use /start será dueña
        return True
    
    user_id = str(user.id)
    username = user.username
    
    if user_id in allowed:
        return True
    if username and username in allowed:
        return True
    if username and f"@{username}" in allowed:
        return True
        
    return False

# Comandos de Telegram
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    allowed = config.get("ALLOWED_USERS", [])

    if config.get("ALLOW_ALL", False):
        # Modo público: no se registra dueño, todos tienen acceso
        await update.message.reply_html(
            f"<b>¡Hola {user.mention_html()}!</b>\n\n"
            f"Este bot está en <b>modo público</b>, así que cualquiera puede usarlo.\n"
            f"El bot está conectado con <b>walkie.sh</b> y tu agente de IA local.\n"
            f"Escríbeme un mensaje para hablar con el agente o usa /help para ver los comandos."
        )
        return

    if not allowed:
        # Registrar como dueño inicial
        config["ALLOWED_USERS"].append(str(user.id))
        save_config(config)
        await update.message.reply_html(
            f"<b>¡Hola {user.mention_html()}!</b>\n\n"
            f"Te he registrado como el <b>dueño exclusivo</b> del bot en este dispositivo.\n"
            f"A partir de ahora, solo tú puedes enviar comandos y mensajes a este bot.\n\n"
            f"El bot está conectado con <b>walkie.sh v1.5.0</b> y tu agente de IA local.\n"
            f"Escríbeme un mensaje para hablar con el agente o usa /help para ver los comandos."
        )
        return
        
    if not is_authorized(user):
        await update.message.reply_text("Acceso denegado. Este es un bot de uso privado y exclusivo.")
        return

    await update.message.reply_html(
        f"¡Hola {user.mention_html()}! Estoy listo para conversar.\n"
        f"Usa /status para ver el estado del bot y del agente."
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_authorized(update.effective_user):
        await update.message.reply_text("Acceso denegado.")
        return
        
    help_text = (
        "<b>Comandos Disponibles:</b>\n"
        "/start - Iniciar el bot y verificar acceso\n"
        "/help - Mostrar este mensaje de ayuda\n"
        "/status - Mostrar el estado de walkie.sh y el agente\n"
        "/restart_agent - Forzar reinicio del agente de IA\n"
        "/add_user &lt;id_o_usuario&gt; - Agregar un usuario a la lista permitida\n"
        "/remove_user &lt;id_o_usuario&gt; - Eliminar un usuario de la lista permitida\n\n"
        "Solo envía un mensaje de texto normal para charlar con tu agente de IA local en Termux."
    )
    await update.message.reply_html(help_text)

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_authorized(update.effective_user):
        await update.message.reply_text("Acceso denegado.")
        return

    # Verificar si el agente está corriendo
    agent_status = "🔴 Detenido"
    if agent_proc and agent_proc.poll() is None:
        agent_status = f"🟢 Activo (PID: {agent_proc.pid})"
    else:
        # Verificar en procesos por si se inició fuera de este script
        chk = subprocess.run(f"pgrep -f 'walkie agent {WALKIE_CHANNEL}'", shell=True, capture_output=True, text=True)
        if chk.returncode == 0:
            agent_status = f"🟢 Activo externamente (PIDs: {chk.stdout.strip().replace(chr(10), ', ')})"

    # Verificar daemon de walkie
    daemon_status = "🔴 Inactivo"
    chk_daemon = subprocess.run(["walkie", "status"], capture_output=True, text=True)
    if chk_daemon.returncode == 0:
        lines = chk_daemon.stdout.strip().split('\n')
        daemon_status = f"🟢 Activo\n<code>{chr(10).join(lines[:3])}</code>"

    cli = get_agent_cli() or "No disponible"
    allowed_list = ", ".join(config.get("ALLOWED_USERS", []))
    access_mode = "🌍 Público (cualquiera puede usar)" if config.get("ALLOW_ALL", False) else "🔒 Privado (solo autorizados)"

    status_text = (
        f"<b>📊 Estado del Sistema Walkie Bot</b>\n\n"
        f"🤖 <b>Agente Walkie:</b> {agent_status}\n"
        f"⚙️ <b>Motor de IA (CLI):</b> {cli}\n"
        f"📡 <b>Canal Walkie:</b> <code>{WALKIE_CHANNEL}</code>\n\n"
        f"⚡ <b>Daemon Walkie.sh:</b>\n{daemon_status}\n\n"
        f"🛂 <b>Modo de acceso:</b> {access_mode}\n"
        f"🔒 <b>Usuarios Autorizados:</b> <code>{allowed_list}</code>"
    )
    await update.message.reply_html(status_text)

async def restart_agent_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_authorized(update.effective_user):
        await update.message.reply_text("Acceso denegado.")
        return

    await update.message.reply_text("Reiniciando el agente de Walkie...")
    success = start_walkie_agent()
    if success:
        await update.message.reply_text("¡Agente reiniciado con éxito!")
    else:
        await update.message.reply_text("Error al iniciar el agente. Revisa los logs en ~/walkie_agent.log")

async def add_user_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_authorized(update.effective_user):
        await update.message.reply_text("Acceso denegado.")
        return

    if not context.args:
        await update.message.reply_text("Uso: /add_user <id_o_usuario>")
        return

    new_user = context.args[0].strip().replace("@", "")
    if new_user not in config["ALLOWED_USERS"]:
        config["ALLOWED_USERS"].append(new_user)
        save_config(config)
        await update.message.reply_text(f"Usuario '{new_user}' agregado a la lista de autorizados.")
    else:
        await update.message.reply_text(f"El usuario '{new_user}' ya estaba autorizado.")

async def remove_user_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_authorized(update.effective_user):
        await update.message.reply_text("Acceso denegado.")
        return

    if not context.args:
        await update.message.reply_text("Uso: /remove_user <id_o_usuario>")
        return

    target_user = context.args[0].strip().replace("@", "")
    # No permitir que el dueño se elimine a sí mismo si es el único
    user_id = str(update.effective_user.id)
    if target_user == user_id or target_user == update.effective_user.username:
        await update.message.reply_text("No puedes eliminarte a ti mismo de la lista.")
        return

    if target_user in config["ALLOWED_USERS"]:
        config["ALLOWED_USERS"].remove(target_user)
        save_config(config)
        await update.message.reply_text(f"Usuario '{target_user}' eliminado de la lista de autorizados.")
    else:
        await update.message.reply_text(f"El usuario '{target_user}' no se encuentra en la lista.")

# ===== Voz bidireccional (TTS + transcripción) =====

def transcribe_audio(audio_path: str) -> str:
    """Transcribe un archivo de audio con whisper. Devuelve el texto o ''."""
    try:
        r = subprocess.run(
            ["whisper", audio_path, "--model", "base", "--language", "es", "--output_format", "txt"],
            capture_output=True, text=True, timeout=120
        )
        txt_path = re.sub(r'\.[^.]+$', '', audio_path) + '.txt'
        if os.path.exists(txt_path):
            text = open(txt_path, encoding="utf-8").read().strip()
            try:
                os.remove(txt_path)
            except Exception:
                pass
            return text
    except Exception as e:
        logger.warning(f"Error al transcribir audio: {e}")
    return ""

def synthesize_voice(text: str) -> str:
    """Genera una nota de voz (OGG) a partir de texto usando walkie-tts.
    Devuelve la ruta del archivo si se generó correctamente, o '' si falló."""
    if not text or not text.strip():
        return ""
    out_path = "/sdcard/Download/voice.ogg"
    try:
        r = subprocess.run(
            ["walkie-tts", text, out_path],
            capture_output=True, text=True, timeout=60
        )
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            return out_path
    except Exception as e:
        logger.warning(f"Error al generar TTS: {e}")
    return ""

def extract_voice_marker(response: str):
    """Extrae la ruta de una nota de voz (file:...) de la respuesta del agente.
    Devuelve (ruta, linea_marker) o (None, None)."""
    for line in reversed(response.splitlines()):
        line = line.strip()
        m = re.match(r'^(?:photo|file):(\S+)$', line)
        if m:
            return m.group(1), line
    return None, None

async def send_agent_response(update: Update, response: str) -> None:
    """Envía la respuesta del agente. Si trae un marker de voz (file:...), lo envía
    como nota de voz; en caso contrario envía texto."""
    path, marker = extract_voice_marker(response)
    if path and os.path.exists(path):
        try:
            with open(path, "rb") as f:
                await update.message.reply_voice(f)
        except Exception as e:
            logger.warning(f"No se pudo enviar la nota de voz: {e}")
        # Enviar también el texto (sin la línea del marker)
        clean = response.replace(marker, "").strip()
        if clean:
            await update.message.reply_text(clean)
        return
    await update.message.reply_text(response)

async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Recibe una nota de voz del usuario, la transcribe y responde con el agente."""
    user = update.effective_user
    if not is_authorized(user):
        await update.message.reply_text("Acceso denegado.")
        return

    voice = update.message.voice
    await update.message.reply_text("🎤 Escuchando tu nota de voz...")
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="record_voice")

    # Descargar la nota de voz
    local_path = os.path.expanduser(f"~/voice_in_{int(time.time())}.ogg")
    try:
        tg_file = await context.bot.get_file(voice.file_id)
        await tg_file.download_to_drive(custom_path=local_path)
    except Exception as e:
        logger.warning(f"Error al descargar la nota de voz: {e}")
        await update.message.reply_text("No pude descargar tu nota de voz.")
        return

    transcript = transcribe_audio(local_path)
    try:
        os.remove(local_path)
    except Exception:
        pass

    if not transcript:
        prompt = "[Nota de voz recibida]. No pude transcribirla correctamente. Indícalo amablemente y pide que la repita."
        response = get_walkie_response(prompt)
        await send_agent_response(update, response)
        return

    # Comando de dispositivo: se ejecuta directamente sin pasar por el LLM.
    device_reply = handle_device_command(transcript)
    if device_reply:
        await update.message.reply_text(device_reply)
        return

    prompt = (
        f'[Nota de voz transcrita: "{transcript}"] '
        f'Atiende la instrucción. Responde de forma concisa y natural, como si hablaras en voz alta.'
    )
    await update.message.reply_text(f"📝 Te escuché: {transcript}")

    response = get_walkie_response(prompt)

    # Si el agente ya generó un audio válido (file:...), se envía tal cual.
    path, marker = extract_voice_marker(response)
    if path and os.path.exists(path) and os.path.getsize(path) > 0:
        await send_agent_response(update, response)
        return

    # Fallback robusto: el bot sintetiza la voz a partir del texto del agente.
    voice_path = synthesize_voice(response)
    if voice_path:
        try:
            with open(voice_path, "rb") as f:
                await update.message.reply_voice(f)
        except Exception as e:
            logger.warning(f"No se pudo enviar la nota de voz: {e}")
        await update.message.reply_text(response)
    else:
        await update.message.reply_text(response)

# ===== Imágenes (fotos) =====
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Descarga la foto recibida y se la pasa al agente para que la analice."""
    user = update.effective_user
    if not is_authorized(user):
        await update.message.reply_text("⚠️ No estás autorizado.")
        return
    await update.message.reply_text("🖼️ Procesando tu imagen...")
    try:
        await context.bot.send_chat_action(chat_id=update.effective_chat.id,
                                           action="upload_photo")
    except Exception:
        pass
    photo = update.message.photo[-1]  # resolución más alta
    local_path = os.path.expanduser(f"~/img_in_{int(time.time())}.jpg")
    try:
        tg_file = await context.bot.get_file(photo.file_id)
        await tg_file.download_to_drive(custom_path=local_path)
    except Exception as e:
        logger.warning(f"No se pudo descargar la imagen: {e}")
        await update.message.reply_text("❌ No pude descargar tu imagen.")
        return
    prompt = (f"[El usuario envió una IMAGEN guardada en {local_path}]. "
              f"Analiza la imagen leyendo ese archivo con tu herramienta de lectura "
              f"(read) y responde en español describiendo su contenido de forma concisa. "
              f"No inventes nada que no puedas ver en la imagen.")
    response = get_walkie_response(prompt)
    text = response or "No pude analizar la imagen."
    voice_path = synthesize_voice(text)
    if voice_path:
        try:
            with open(voice_path, "rb") as f:
                await update.message.reply_voice(f)
        except Exception as e:
            logger.warning(f"No se pudo enviar la nota de voz de la imagen: {e}")
    await update.message.reply_text(text)
    try:
        os.remove(local_path)
    except Exception:
        pass

# ===== Comandos de dispositivo (termux-api) ejecutados directamente =====
def run_shell(cmd: str) -> str:
    """Ejecuta un comando shell y devuelve su salida o un mensaje de error."""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=25)
        out = (r.stdout or "").strip()
        err = (r.stderr or "").strip()
        if r.returncode == 0:
            return out or "Listo."
        return f"Error: {err or out or f'código {r.returncode}'}"
    except subprocess.TimeoutExpired:
        return "El comando tardó demasiado en ejecutarse."
    except Exception as e:
        return f"Error: {e}"

def handle_device_command(text: str):
    """Reconoce comandos de hardware/dispositivo y los ejecuta vía termux-api.
    Devuelve una cadena de respuesta si se manejó, o None si es conversación normal."""
    t = (text or "").strip().lower()
    if not t:
        return None

    # Linterna / torch / flash
    if re.search(r'(linterna|torch|flashlight|flash)', t):
        apaga = bool(re.search(r'(apag|off|deten|desactiv|deja de|prender no)', t))
        enciende = bool(re.search(r'(encend|prend|activ|on|prende)', t))
        state = "off" if (apaga and not enciende) else "on"
        result = run_shell(f"termux-torch {state}")
        estado = "encendida" if state == "on" else "apagada"
        return f"🔦 Linterna {estado}. {result}"

    # Batería
    if re.search(r'(bater[íi]a|battery|nivel de bater)', t):
        out = run_shell("termux-battery-status")
        try:
            data = json.loads(out)
            pct = data.get("percentage", "?")
            status = data.get("status", "?")
            return f"🔋 Batería al {pct}% (estado: {status})."
        except Exception:
            return out or "No se pudo leer la batería."

    # WiFi
    if re.search(r'(wi[-\s]?fi|wifi)', t):
        if re.search(r'(activ|encend|on)', t):
            return "📶 " + run_shell("termux-wifi-enable true")
        if re.search(r'(apag|off|desactiv)', t):
            return "📶 " + run_shell("termux-wifi-enable false")
        return "📶 " + (run_shell("termux-wifi-scaninfo") or "Sin datos WiFi.")

    # Bluetooth
    if re.search(r'(bluetooth|blu.?tooth)', t):
        if re.search(r'(activ|encend|on)', t):
            return "🩵 " + run_shell("termux-bluetooth-enable")
        if re.search(r'(apag|off|desactiv)', t):
            return "🩵 " + run_shell("termux-bluetooth-disable")
        return "🩵 " + (run_shell("termux-bluetooth-scan") or "Sin dispositivos.")

    # Volumen
    if re.search(r'(volumen|volume|sub[eé] el volumen|baja el volumen)', t):
        return "🔊 " + (run_shell("termux-volume stream system") or "Volumen configurado.")

    # Sensores
    if re.search(r'(sensores|sensor)', t):
        return "📈 " + (run_shell("termux-sensor -l") or "Sin sensores disponibles.")

    return None

# Manejador de mensajes de texto
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not is_authorized(user):
        await update.message.reply_text("Acceso denegado.")
        return

    user_message = update.message.text
    logger.info(f"Mensaje de {user.username or user.id}: {user_message}")

    # Indicar en Telegram que el bot está escribiendo
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    # Comandos de dispositivo: se ejecutan directamente (sin depender del LLM)
    device_reply = handle_device_command(user_message)
    if device_reply:
        await update.message.reply_text(device_reply)
        return

    # De lo contrario, obtener respuesta del agente
    response = get_walkie_response(user_message)

    # Enviar respuesta al usuario (voz si el agente la generó, si no texto)
    await send_agent_response(update, response)

def main() -> None:
    """Inicia el bot de Telegram."""
    # 1. Iniciar agente walkie local en segundo plano
    start_walkie_agent()

    # 2. Configurar aplicación Telegram
    application = Application.builder().token(TOKEN).build()

    # Comandos
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("restart_agent", restart_agent_command))
    application.add_handler(CommandHandler("add_user", add_user_command))
    application.add_handler(CommandHandler("remove_user", remove_user_command))

    # Mensajes de texto normales
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Notas de voz (entrada de audio)
    application.add_handler(MessageHandler(filters.VOICE, handle_voice))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    # Ejecutar polling de Telegram
    logger.info("Iniciando Walkie Telegram Bot (polling)...")
    try:
        application.run_polling(allowed_updates=Update.ALL_TYPES)
    finally:
        # Asegurarse de limpiar procesos hijo al salir
        clean_up()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        clean_up()
        sys.exit(0)
