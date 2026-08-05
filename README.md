# 🛰️ Walkie-Termux: P2P AI Agent Orchestration

![Walkie-Termux Banner](./banner.jpg)

> 🚀 **Milestone Achievement:** This project marks the successful realization of P2P AI Agent communication running natively inside **Termux** across multiple Android devices with **zero external servers or setup**. 

Designed, tested, and verified by developer **kuromi04**, this repository documents the exact process of orchestrating mobile terminals, handling network restrictions, and connecting local AI agents securely using P2P DHT overlays.

---

## 🏆 El Hito de kuromi04 (¿Qué se hizo?)

El desarrollador **kuromi04** logró conectar con éxito agentes de inteligencia artificial y usuarios de terminales dentro del ecosistema de **Termux** en Android de manera P2P. Durante el desarrollo de este proyecto, se resolvieron y documentaron importantes desafíos técnicos de entornos móviles:

1. **Resolución del Bug de NPM en i-HakLab:**
   El wrapper global de npm en `~/.local/bin/npm` presentaba un bucle vacío infinito al ejecutar instalaciones sin parámetros adicionales. Se resolvió puenteando el wrapper y ejecutando directamente el binario nativo de npm:
   ```bash
   /data/data/com.termux/files/usr/bin/npm install
   ```
2. **Corrección de Shebangs de Android:**
   Se aplicó la corrección del shebang de Node.js para que el binario global de `walkie` se ejecute correctamente bajo el entorno aislado de Termux sin dar errores de intérprete:
   ```bash
   termux-fix-shebang $(which walkie)
   ```
3. **Diseño de Interfaz Web Responsiva:**
   Se rediseñó la interfaz web original (`src/web-ui.js`) para soportar pantallas móviles táctiles, incorporando media queries, barras laterales autocolapsables y un botón de retroceso `←` adaptado para celulares.
4. **Puenteo de Bloqueos de Loopback en Android Chrome:**
   Se identificaron y documentaron los bloqueos de seguridad del sandbox de Android Chrome en la conexión de WebSockets locales, proponiendo el uso de direcciones numéricas directas como `http://127.0.0.1:3000` o la IP de red local para lograr una interactividad del 100%.

---

## 📸 Demostración Visual (Paso Clave)

A continuación se muestra la interfaz responsiva de Walkie ejecutándose directamente en `localhost:3000` sobre el navegador de Android, lista para unir canales P2P de forma inalámbrica:

<p align="center">
  <img src="./screenshot.jpg" width="350" alt="Walkie Localhost Screenshot">
</p>

---

## 🛠️ Guía de Instalación Paso a Paso en Termux

Sigue estos pasos detallados para instalar y ejecutar esta versión de `walkie` optimizada para Termux:

### Paso 1: Instalar dependencias en Termux
Actualiza los repositorios e instala Node.js y Git:
```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```

### Paso 2: Clonar este repositorio
Clona el repositorio en tu espacio local:
```bash
git clone https://github.com/kuromi04/walkie-sh-termux.git
cd walkie-sh-termux
```

### Paso 3: Instalación de dependencias (Bypasseando wrappers)
Instala las dependencias del proyecto usando directamente el instalador nativo de Termux para evitar el bucle infinito del wrapper de i-HakLab:
```bash
/data/data/com.termux/files/usr/bin/npm install
```

### Paso 4: Instalar walkie de forma global
Enlaza el comando globalmente en tu terminal:
```bash
npm install -g .
```

### Paso 5: Corregir el Shebang de ejecución
Corrige el shebang del ejecutable para enlazar el binario nativo de Node en Termux:
```bash
termux-fix-shebang /data/data/com.termux/files/home/.npm-global/bin/walkie
```

---

## 🚀 Cómo Usar walkie-sh-termux

### 1. Iniciar un Chat P2P entre Dispositivos
En el dispositivo 1 (Termux):
```bash
walkie chat mi-canal-seguro
```
En el dispositivo 2 (Termux):
```bash
walkie chat mi-canal-seguro
```
*La conexión se establecerá de forma cifrada de punto a punto de inmediato.*

### 2. Levantar un Agente de Inteligencia Artificial (Codex/Claude)
Puedes hacer que un dispositivo escuche como un Agente de IA:
```bash
walkie agent mi-canal-seguro --cli codex --name "AsistenteTermux" --prompt "Eres un agente experto en Termux."
```

### 3. Levantar la Interfaz Web Móvil
Ejecuta el servidor web local:
```bash
walkie web
```
Abre tu navegador en:
`http://127.0.0.1:3000` o en una pestaña de incógnito para evitar la caché vieja.

---

## 🤝 Créditos y Agradecimientos

*   🏆 **Líder de Desarrollo e Integración:** [kuromi04](https://github.com/kuromi04) por documentar el despliegue del hito en dispositivos móviles, solucionar las fallas de red de loopback de Android y la interfaz responsiva.
*   🛰️ **Creador del Proyecto Original:** Muchas gracias al autor original de `walkie` / `walkie-sh` por diseñar el excelente motor P2P en el que se basa este trabajo.

---

## ⚖️ Licencia
Este proyecto está bajo la Licencia MIT.
