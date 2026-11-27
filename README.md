# Manga Translator

Japanese manga page OCR and English typesetting built with React, Vite, Express, and MangaOCR. OCR runs in a persistent Python process on the server; English text comes from the bundled local dictionaries. Translation does not call an AI service.

## Run locally

Requirements: Node.js and Python 3.10 or newer.

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe python/prepare_model.py
npm run dev
```

Open `http://localhost:3000`. On Linux, activate/use `.venv/bin/python` in place of `.venv\\Scripts\\python.exe`. The model is downloaded once during setup (about 400 MB), loaded once when the server starts, then reused for each page. The first OCR request can take longer while the worker starts; subsequent pages avoid repeated model startup.

## Server deployment

`render.yaml` configures a full-stack Render web service. Its build step installs the CPU-only Python OCR dependencies, downloads the model into the deployment image, and builds the Vite frontend. The Node server starts a persistent Python OCR worker and serves the UI and `/api/translate-page` from the same host. Use a server instance with enough memory for PyTorch and MangaOCR (at least 2 GB RAM recommended); the configured Render free instance may not have enough memory for reliable OCR. Model weights are part of the deployment image, so the service does not need to download them for every page or restart.

Static-only hosting and short-lived Node serverless functions are not supported by this worker design. Chinese-to-English OCR/dictionary support is not currently connected; the active OCR model and bundled dictionary are for Japanese.

### Netlify frontend with a separate OCR server

Netlify can host the Vite frontend, but it does not run this persistent Python OCR worker. Deploy the full app/backend to Render or another host that supports a long-running Node process and Python, then set these environment variables:

- On the OCR server: `ALLOWED_ORIGINS` = the exact Netlify site origin, such as `https://your-site.netlify.app` (comma-separated if you use multiple origins).
- In Netlify: `VITE_API_BASE_URL` = the OCR server origin, such as `https://your-ocr-service.onrender.com` (no trailing slash).

Redeploy the Netlify site after setting `VITE_API_BASE_URL`, because Vite embeds it at build time. The included `netlify.toml` publishes `dist/`.

## Features

- Speech bubble and text region detection with light and dark bubble handling
- Japanese manga OCR, dictionary-based English translation, and typesetting
- Batch processing with ZIP export to `translated_images/`, `side_by_side/`, and `text_only/`
- Side-by-side reader and interactive editing
