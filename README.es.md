# 🛰️ Walkie-Termux: Orquestación de Agentes de IA P2P

<p align="center">
  <img src="./banner.jpg" alt="Walkie-Termux Banner" width="100%">
</p>

<p align="center">
  <a href="https://github.com/termux/termux-app"><img src="https://img.shields.io/badge/Termux-Entorno-black?style=for-the-badge&logo=termux&logoColor=22c55e" alt="Termux"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://github.com/kuromi04/walkie-sh-termux"><img src="https://img.shields.io/badge/P2P-Descentralizado-blueviolet?style=for-the-badge" alt="P2P"></a>
</p>

---

🌐 **[Read this file in English :uk:](./README.md)**

---

## 💡 Sobre este Proyecto

Este repositorio documenta una implementación práctica de orquestación de agentes de IA P2P descentralizados y sin servidores en dispositivos móviles que ejecutan **Termux**. Sirve como una prueba de concepto simple que demuestra que los entornos móviles pueden alojar y coordinar flujos de trabajo de IA ligeros completamente de punto a punto, con cero servidores centralizados.

La configuración y pruebas fueron realizadas por **[kuromi04](https://github.com/kuromi04)**, enfocándose en resolver los límites del loopback local de Android, la adaptabilidad de la UI web móvil, las limitaciones del entorno de paquetes en terminales móviles y la coordinación de conexiones multidispositivo.

---

## 🛠️ Notas de Orquestación (Cómo se resolvió)

Durante el despliegue en Termux, se abordaron varios desafíos específicos de la plataforma:

1. **Resolución del Wrapper de NPM en i-HakLab:**
   El script wrapper global de `npm` dentro de la suite `i-HakLab` entraba en un bucle infinito en instalaciones sin argumentos. Para instalar las dependencias, puenteamos este script ejecutando directamente el binario nativo de npm en el prefijo de Termux:
   ```bash
   /data/data/com.termux/files/usr/bin/npm install
   ```
2. **Corrección de Shebang en Android Node:**
   Las rutas estándar de shebang fallan en Termux debido a la estructura de directorios de Android. Corregimos el ejecutable global utilizando la herramienta de Termux:
   ```bash
   termux-fix-shebang $(which walkie)
   ```
3. **UI Web Responsiva para Móviles:**
   Ajustamos el diseño de la interfaz (`src/web-ui.js`) para soportar pantallas verticales y pantallas táctiles, implementando barras laterales colapsables automáticamente y un botón de retroceso móvil (`←`).
4. **Conexiones WebSocket en Chrome para Android:**
   Los navegadores móviles aplican estrictos límites de seguridad en las conexiones de loopback. Verificamos que al usar direcciones IP numéricas explícitas (`127.0.0.1:3000` o la IP local de la red) se evitan con éxito estas restricciones.

---

## 📸 Prueba de Concepto

Aquí tienes una vista previa del panel web responsivo ejecutándose en `localhost:3000` en Chrome de Android, esperando a sincronizar conexiones:

<p align="center">
  <img src="./screenshot.jpg" width="320" alt="Walkie Localhost Screenshot">
</p>

---

## 🚀 Pasos de Configuración en Termux

### 1. Instalar requisitos en Termux:
```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```

### 2. Clonar este repositorio:
```bash
git clone https://github.com/kuromi04/walkie-sh-termux.git
cd walkie-sh-termux
```

### 3. Instalar dependencias (Evitando el wrapper):
```bash
/data/data/com.termux/files/usr/bin/npm install
```

### 4. Enlazar binario global:
```bash
npm install -g .
termux-fix-shebang /data/data/com.termux/files/home/.npm-global/bin/walkie
```

---

## 🛰️ Cómo ejecutarlo

*   **Chat de Terminal P2P:**
    ```bash
    walkie chat nombre-de-mi-canal
    ```
*   **Escucha del Agente de IA:**
    ```bash
    walkie agent nombre-de-mi-canal --cli codex --name "Asistente" --prompt "Eres un asistente servicial de Termux."
    ```
*   **Panel de Control Web:**
    ```bash
    walkie web
    ```
    *Accede vía `http://127.0.0.1:3000/?v=4` en tu navegador móvil (se recomienda pestaña de incógnito/privada para limpiar caché vieja).*

---

## 🤝 Agradecimientos y Créditos

*   🏆 **Integración y Orquestación:** [kuromi04](https://github.com/kuromi04) (Ajustes de UI responsiva, corrección de loopback y pruebas en Termux).
*   🛰️ **Creador del Motor Original:** Todo el crédito al autor original de `walkie` / `walkie-sh` por desarrollar el núcleo de comunicación P2P seguro.
*   💫 **Agradecimiento Especial a @Ivam3 y la Comunidad i-HakLab:** Un agradecimiento profundo a mi amigo [@Ivam3](https://github.com/ivam3), quien es el cerebro detrás del funcionamiento y la adaptación del entorno. Su repositorio personalizado [termux-packages](https://github.com/ivam3/termux-packages) provee los paquetes vitales que hacen posible toda esta orquestación gráfica, web y de scripts dentro de Android. Un agradecimiento especial también a su comunidad **Ivam3bycinderella** por su constante apoyo.
    *   🖥️ [GitHub - Ivam3](https://github.com/ivam3)
    *   📦 [Repositorio termux-packages](https://github.com/ivam3/termux-packages)
    *   📺 [YouTube - Ivam3bycinderella](https://youtube.com/@Ivam3bycinderella)
    *   💬 [Grupo de Soporte en Telegram](https://t.me/Ivam3by_Cinderella)
    *   🤖 [Bot de Telegram (@Ivam3_bot)](https://t.me/ivam3_bot)
*   🔮 **La Base de Conocimiento termux-oracle:** Reconocimiento especial a la guía y documentación del skill `termux-oracle` por proveer las directrices esenciales para la resolución de errores en wrappers y los estándares de Node en Android.

---

## ⚖️ Licencia
Licencia MIT.
