# Samvaad Browser Extension

This is a lightweight Chrome extension that launches the existing Samvaad web app.

## What it does

- Opens `Samvaad` home or live demo from the extension popup
- Can open the demo in a narrow popup window for quick testing
- Adds an optional floating `Open Samvaad` launcher on normal web pages
- Stores the target app URL so you can point it at local dev or a deployed app

## Load it in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `/Users/dabbumothsera/Desktop/Samvaad/extension`

## Recommended local setup

1. Run the backend:
   `cd /Users/dabbumothsera/Desktop/Samvaad/backend && node server.js`
2. Run the frontend:
   `cd /Users/dabbumothsera/Desktop/Samvaad/frontend && npm run dev`
3. In the extension popup, set `Web app URL` to the actual Vite URL, for example `http://localhost:5174`

## Product direction

This extension is intentionally a launcher layer, not a second implementation of the copilot UI.
That keeps the main product in the web app while giving users a faster way to try Samvaad from the browser.
