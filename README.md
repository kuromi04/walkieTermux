# 🛰️ Walkie-Termux: P2P AI Agent Orchestration

<p align="center">
  <img src="./banner.jpg" alt="Walkie-Termux Banner" width="100%">
</p>

<p align="center">
  <a href="https://github.com/termux/termux-app"><img src="https://img.shields.io/badge/Termux-Environment-black?style=for-the-badge&logo=termux&logoColor=22c55e" alt="Termux"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://github.com/kuromi04/walkieTermux"><img src="https://img.shields.io/badge/P2P-Decentralized-blueviolet?style=for-the-badge" alt="P2P"></a>
</p>

---

🌐 **[Leer este archivo en Español :spain:](./README.es.md)**

---

## 💡 About this Project

This repository documents a practical implementation of serverless, decentralized P2P AI agent orchestration on mobile devices running **Termux**. It serves as a simple proof of concept showing that mobile environments can host and coordinate light AI workflows entirely peer-to-peer with zero centralized servers.

This setup and testing were carried out by **kuromi04**, focusing on resolving local loopback boundaries, mobile web UI responsiveness, package environment constraints in Android terminals, and coordinating multi-device connections.

---

## 🛠️ Orchestration Notes (How it was solved)

During deployment in Termux, several platform-specific challenges were addressed:

1. **Android Node Shebang Correction:**
   Standard shebang paths cause execution failures in Termux due to Android's directory structure. We corrected the global CLI executable using the Termux utility:
   ```bash
   termux-fix-shebang $(which walkie)
   ```
2. **Mobile Responsive Web UI:**
   Adjusted the interface layout (`src/web-ui.js`) to support portrait displays and touch interfaces by implementing auto-collapsing sidebars and a mobile navigation back button (`←`).
3. **Android Chrome Loopback WebSocket Connection:**
   Mobile browsers enforce strict sandbox limits on loopback connections. We verified that using explicit numeric IP configurations (`127.0.0.1:3000` or local LAN IP) successfully bypasses these limitations.

---

## 📸 Proof of Concept

Here is a preview of the responsive web dashboard running on `localhost:3000` inside Android Chrome, waiting to sync connections:

<p align="center">
  <img src="./screenshot.jpg" width="320" alt="Walkie Localhost Screenshot">
</p>

---

## 🚀 Setup Steps in Termux

### 1. Install prerequisites in Termux:
```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```

### 2. Clone this repository:
```bash
git clone https://github.com/kuromi04/walkieTermux.git
cd walkieTermux
```

### 3. Install dependencies:
```bash
npm install
```

### 4. Link global binary:
```bash
npm install -g .
termux-fix-shebang /data/data/com.termux/files/home/.npm-global/bin/walkie
```

---

## 🛰️ How to run

*   **P2P Terminal Chat:**
    ```bash
    walkie chat my-channel-name
    ```
*   **AI Agent listener:**
    ```bash
    walkie agent my-channel-name --cli codex --name "Assistant" --prompt "You are a helpful Termux assistant."
    ```
*   **Web Dashboard:**
    ```bash
    walkie web
    ```
    *Access via `http://127.0.0.1:3000/?v=4` on your mobile browser (incognito/private mode recommended to clear old cache).*

---

## 🤝 Acknowledgements & Credits

*   🏆 **Integration & Orchestration:** [kuromi04](https://github.com/kuromi04) (Mobile responsive UI adjustments, loopback fixes, and Termux testing).
*   🛰️ **Original Engine Creator:** Full credit to the original creator of `walkie` / `walkie-sh` for developing the secure P2P communication core.
*   💫 **Special Thanks to @Ivam3 & The Community:** Deep gratitude to my friend [@Ivam3](https://github.com/ivam3), who is the mastermind ("el cerebro") behind the runtime adaptation. His custom [termux-packages](https://github.com/ivam3/termux-packages) repository provides the vital packages that make graphical, web, and script orchestration possible inside Android. Special thanks to his **Ivam3bycinderella** community for their continuous support.
    *   🖥️ [GitHub - Ivam3](https://github.com/ivam3)
    *   📦 [termux-packages Repository](https://github.com/ivam3/termux-packages)
    *   📺 [YouTube - Ivam3bycinderella](https://youtube.com/@Ivam3bycinderella)
    *   💬 [Telegram Support Group](https://t.me/Ivam3by_Cinderella)
    *   🤖 [Telegram Bot (@Ivam3_bot)](https://t.me/ivam3_bot)
*   🔮 **The Termux Setup Guidelines:** Special acknowledgment to setup and documentation guidelines for providing the essential standards for Node on Android.

---

## ⚖️ License
MIT License.
