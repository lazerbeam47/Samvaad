# Samvaad — AI Copilot for Real-Time Conversations (WIP)

TL;DR

- Samvaad is an experimental real-time agent-assist platform that listens to live calls, transcribes speech, and provides contextual suggestions, intents, CRM autofill and action items to agents.
- Project is under active development. Backend and frontend are functional but not production-ready.

Why this exists

- People need help during live conversations — not just after. Samvaad is a copilot that listens and assists in real time so agents and teams can communicate better and close more deals.

Vision (plain language)

Samvaad is like a copilot for live calls. It listens in real time, converts speech to text, understands context and intent, and suggests what to say next or what actions to take. The goal is simple: help people communicate better and close conversations more effectively.

Problem we’re solving

- Calls are noisy and fast — people miss key points.
- Agents forget follow-ups, compliance slips happen, and inexperienced reps need coaching.
- Existing tools mostly analyze calls after the fact or provide static scripts. Few provide live, contextual assistance.

What Samvaad does

- Streams speech from the browser to the backend (STT).
- Produces interim and final transcripts.
- Runs a hybrid NLU pipeline (rules + LLM) to extract intents, suggestions, compliance flags, CRM fields and action items.
- Emits structured events to the frontend to surface UI suggestions in real time.

High-level architecture

- Frontend (Vite + React)
  - Captures microphone audio, downsamples (client-side) to 16 kHz, encodes to PCM16 and streams binary chunks over Socket.IO.
  - Visualizer and live transcript UI. Receives interim-transcript, intent, suggestions and other agent-assist events.

- Backend (Node.js)
  - Socket.IO server receives binary audio and forwards to Deepgram live transcription.
  - Deepgram events are normalized and forwarded to clients.
  - NLU processor debounces and buffers transcripts, runs a controlled LLM pipeline (Gemini by default) and emits structured outputs.
  - Protections: per-session buffering, final-only triggers, global hard rate limiter to reduce LLM quota burn.

Status & work-in-progress

- Working: client capture, downsampling, PCM conversion, socket streaming; Deepgram live integration; basic NLU pipeline and frontend UI.
- WIP / TODO:
  - Migrate heavy audio processing to AudioWorklet for production stability.
  - Add exponential backoff / retry and circuit-breaker behavior for LLM calls (handle 429/503).
  - Add tests, CI, secure secret management and deployment scripts.
  - Improve UX and error handling.

Getting started (developer)

Prereqs:

- Node.js v16+ (or latest LTS)
- npm (or yarn/pnpm)

1. Backend

```bash
cd backend
npm install
# create backend/.env with at least:
# DEEPGRAM_API_KEY=your_key
# GEMINI_MODEL=gemini-2.5-flash
node server.js
```

Backend listens on port 3000 by default.

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server (Vite) defaults to port 5173.

3. Browser extension (optional)

Load `/Users/dabbumothsera/Desktop/Samvaad/extension` as an unpacked Chrome extension to launch the existing Samvaad web app from any browser tab.

Quick dev helper (macOS)

```bash
chmod +x ./scripts/dev-setup.sh
./scripts/dev-setup.sh
```

Development workflow

- Start backend first, then frontend.
- Use browser console and backend logs to debug AudioContext sample rate and chunk flow.
- Backend debug logs include: **STT_READY**, transcript events, buffer/flush logs and LLM run logs.

Operational tips

- Do NOT commit `.env` or API keys. `.gitignore` already excludes `.env`.
- If you see many LLM requests, tune thresholds in `backend/server.js` (buffer size, time window, global rate limit).
- If Deepgram or Gemini return transient errors (429/503), add backoff and retries in `backend/nlu/processor.js`.

Troubleshooting

- No transcripts: Check backend logs for `__STT_READY__` and audio chunk receive logs (`📤 Received audio chunk ...`).
- LLM quota burn: Ensure global rate limiting is active and that NLU is only triggered on final transcripts; consider lowering sampling frequency.

Roadmap (short)

- Stability: move to AudioWorklet; improve buffering and reconnection.
- Resilience: implement retry/backoff, circuit-breaker, metrics and monitoring.
- UX: refine suggestions, actions and CRM integrations.
- Security & infra: secrets management, CI, deployment, and permissioned access.

Contributing

- Open issues for bugs and feature requests.
- Small PRs welcome — add tests where possible.
- Follow code style used in the project and run linting via `npm run lint` if available.

Where to look in the code

- Frontend: `frontend/src/components/liveCall.jsx` — audio capture & socket client.
- Backend socket server: `backend/server.js` — audio buffering, Deepgram stream setup, transcript handling and LLM gating.
- Deepgram wrapper: `backend/stt/liveDeepgram.js` — Deepgram live SDK integration.
- NLU runner: `backend/nlu/processor.js` — LLM invocation and emit logic.

License

- Proprietary (work in progress)

Contact / next steps

- If you want, I can add a CONTRIBUTING.md, add CI, or create a Getting Started script that launches both servers in background with PM2.
