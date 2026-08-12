# 🌐 Landing Page — WalkieTermux

Landing page de una sola página para el repositorio `walkieTermux`, publicada con **GitHub Pages**.

---

## 🚀 Cómo publicarla

Esta landing está pensada para desplegarse en:

```
https://kuromi04.github.io/walkieTermux/
```

### Pasos en GitHub (Settings → Pages)

1. En el repositorio `walkieTermux`, ve a **Settings** del repo.
2. En el menú lateral, entra a **Pages**.
3. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
4. En **Branch**, selecciona `main` y en la carpeta desplegable elige **`/site`** (en lugar de `/docs` o `/root`).
5. Guarda. El sitio quedará disponible en `https://kuromi04.github.io/walkieTermux/`.

> ⚠️ **Importante:** la carpeta `docs/` sigue dedicada al dominio `walkie.sh` del proyecto original y **no debe tocarse**. Esta landing usa la carpeta `site/` como raíz de Pages para no interferir.

---

## 📁 Estructura

```
site/
├── index.html      # Landing page completa (una sola página)
├── assets/
│   └── dashboard.jpg   # Screenshot del dashboard
└── README.md       # Este archivo
```

## ✏️ Personalización

- **Textos y agentes**: edita directamente en `index.html` las secciones `#ags` (agentes), `#caracteristicas` (features) y `#instalacion`.
- **Colores**: las variables están al inicio del CSS dentro de `index.html` (bloque `:root`), por ejemplo `--accent` para el verde principal.
- **Idioma**: la landing está en español. Cambia `lang="es"` y los textos según lo necesites.