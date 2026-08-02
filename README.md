# 🌸 Manga AI Translator

An AI-powered Japanese-to-English Manga Translator and Typesetter built with React, Vite, Express, and the Google Gemini Vision API.

---

## ⚡ Deployment Options (100% Free Cloud Hosting)

This application is built as a full-stack Node.js app (Express + React Vite). All image OCR, translation, and typesetting logic are processed on Google's Gemini Cloud infrastructure, using **0% of your local computer's RAM, CPU, or storage**.

### Option A: 1-Click Deploy on Render (Recommended for Full-Stack)
1. Fork or push this repository to your GitHub account (`https://github.com/sanim62/manga-translator`).
2. Log into [Render.com](https://render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your `sanim62/manga-translator` GitHub repository.
5. Set the settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
6. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/))*
7. Click **Deploy Web Service**!

---

### Option B: Deploy on Vercel
1. Log into [Vercel](https://vercel.com/) with GitHub.
2. Click **Add New Project** and select `sanim62/manga-translator`.
3. In **Environment Variables**, add `GEMINI_API_KEY`.
4. Click **Deploy**.

---

### Option C: Run Locally or in Docker
```bash
# 1. Clone repo
git clone https://github.com/sanim62/manga-translator.git
cd manga-translator

# 2. Install dependencies
npm install

# 3. Create .env file with your key
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env

# 4. Start Development Server
npm run dev
```

---

## 🛠️ Features
- **Exhaustive Manga OCR:** Scans speech bubbles, thought clouds, narration boxes, and floating text.
- **Multilingual Support:** Supports JPG, JPEG, WEBP, PNG, GIF, and AVIF image formats.
- **Automatic Fallback Engine:** Smart retry & model fallback system handling rate limits.
- **Side-by-Side Reader:** Interactive canvas with customizable background erasing, font sizes, colors, and stroke styling.
- **Batch Processing & ZIP Export:** Translate multiple pages in sequence and download translated chapters as ZIP files.
