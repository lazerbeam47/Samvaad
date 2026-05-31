require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const createDeepgramStream = require("./stt/liveDeepgram");
const conversationStore = require("./services/conversationStore");
const { clearNluSession, runNluWithText } = require("./nlu/processor");
const { run } = require("./nlu/llmClient");
const { isMeaningful, normalizeSpeaker } = require("./utils/textGates");

const {
  initConversationState,
  clearConversationState,
} = require("./services/conversationState");
const Events = require("./sockets/events");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const LOG_TRANSCRIPTS = process.env.LOG_TRANSCRIPTS === "true";

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.get("/", (req, res) => res.send("Deepgram server running"));
app.get("/api/calls", (req, res) => res.json({ calls: callHistory }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, methods: ["GET", "POST"] },
});

const sessionStreams  = {};
const audioBuffers    = {};
const transcriptBuffers   = {};
const transcriptLastRun   = {};
const isLLMRunning        = {};
const lastProcessedLength = {};
const sessionTotalCalls   = {};
const transcriptCounts    = {};
const finalCounts         = {};
const llmCallCounts       = {};
const lastFinalText       = {};
const sessionSpeakers     = {};
const sessionEnding       = {};
const diarizationState    = {};
const callHistory         = [];

// Global hard rate limiter — 5s between LLM calls
const lastGlobalCall = { time: 0 };
function canCallLLM() {
  const now = Date.now();
  if (now - lastGlobalCall.time < 5000) return false;
  lastGlobalCall.time = now;
  return true;
}

function getStreamKey(sessionId, speaker) {
  return `${sessionId}:${normalizeSpeaker(speaker)}`;
}

setInterval(() => {
  try {
    const sessions = Object.keys(transcriptCounts);
    if (sessions.length === 0) return;
    console.log("--- METRICS SUMMARY ---");
    sessions.forEach((s) => {
      console.log(
        `session=${s} transcripts=${transcriptCounts[s] || 0} finals=${finalCounts[s] || 0} llmCalls=${llmCallCounts[s] || 0} totalCalls=${sessionTotalCalls[s] || 0}`,
      );
    });
    console.log("-----------------------");
  } catch (err) {
    console.error("Error printing metrics", err);
  }
}, 10000);

function cleanupSession(sessionId) {
  if (!sessionId) return;

  for (const key of Object.keys(sessionStreams)) {
    if (key === sessionId || key.startsWith(`${sessionId}:`)) {
      delete sessionStreams[key];
    }
  }
  for (const key of Object.keys(audioBuffers)) {
    if (key === sessionId || key.startsWith(`${sessionId}:`)) {
      delete audioBuffers[key];
    }
  }

  delete audioBuffers[sessionId];
  delete transcriptBuffers[sessionId];
  delete transcriptLastRun[sessionId];
  delete isLLMRunning[sessionId];
  delete lastProcessedLength[sessionId];
  delete sessionTotalCalls[sessionId];
  delete transcriptCounts[sessionId];
  delete finalCounts[sessionId];
  delete llmCallCounts[sessionId];
  delete lastFinalText[sessionId];
  delete sessionSpeakers[sessionId];
  delete sessionEnding[sessionId];
  delete diarizationState[sessionId];

  conversationStore.endSession(sessionId);
  clearConversationState(sessionId);
  clearNluSession(sessionId);
}

function parseJsonObject(raw) {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/{[\s\S]*}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function summarizeWordsBySpeaker(words = []) {
  if (!Array.isArray(words) || words.length === 0) return [];

  const segments = [];
  for (const word of words) {
    if (word?.speaker === undefined || word?.speaker === null || !word?.word) {
      continue;
    }

    const speakerId = String(word.speaker);
    const text = String(word.punctuated_word || word.word).trim();
    if (!text) continue;

    const last = segments[segments.length - 1];
    if (last && last.speakerId === speakerId) {
      last.text = `${last.text} ${text}`;
    } else {
      segments.push({ speakerId, text });
    }
  }

  return segments;
}

function getRoleForDiarizedSpeaker(sessionId, speakerId, fallbackSpeaker) {
  diarizationState[sessionId] ||= {
    speakerRoles: {},
    customerSpeakerId: null,
    agentSpeakerId: null,
  };

  const state = diarizationState[sessionId];
  if (state.speakerRoles[speakerId]) return state.speakerRoles[speakerId];

  const fallback = normalizeSpeaker(fallbackSpeaker);

  if (!state.agentSpeakerId && fallback === "agent") {
    state.agentSpeakerId = speakerId;
    state.speakerRoles[speakerId] = "agent";
    return "agent";
  }

  if (!state.customerSpeakerId && speakerId !== state.agentSpeakerId) {
    state.customerSpeakerId = speakerId;
    state.speakerRoles[speakerId] = "customer";
    return "customer";
  }

  if (!state.agentSpeakerId && speakerId !== state.customerSpeakerId) {
    state.agentSpeakerId = speakerId;
    state.speakerRoles[speakerId] = "agent";
    return "agent";
  }

  state.speakerRoles[speakerId] = fallback;
  return fallback;
}

function normalizeTranscriptPayload(sessionId, payload, sourceSpeaker = null) {
  const fallbackSpeaker = normalizeSpeaker(
    sourceSpeaker || sessionSpeakers[sessionId] || "agent",
  );
  const segments = summarizeWordsBySpeaker(payload.words);

  if (segments.length > 0) {
    return segments.map((segment) => ({
      text: segment.text,
      speaker: sourceSpeaker
        ? fallbackSpeaker
        : getRoleForDiarizedSpeaker(
            sessionId,
            segment.speakerId,
            fallbackSpeaker,
          ),
      diarizedSpeaker: segment.speakerId,
    }));
  }

  return [
    {
      text: payload.text,
      speaker: fallbackSpeaker,
      diarizedSpeaker: null,
    },
  ];
}

async function buildPostCallSummary(sessionId) {
  const transcript = conversationStore.getTranscript(sessionId);
  const turns = conversationStore.getTurns(sessionId);

  const emptySummary = {
    discussed: [],
    decisions: [],
    action_items: [],
    crm_fields: {},
  };

  if (!transcript.trim()) return emptySummary;

  const prompt = `
Return ONLY valid JSON for this post-call summary.

Schema:
{
  "discussed": string[],
  "decisions": string[],
  "action_items": string[],
  "crm_fields": {
    "customer_name": string|null,
    "company": string|null,
    "issue_type": string|null,
    "product": string|null,
    "sentiment": "positive"|"neutral"|"negative",
    "follow_up_date": string|null,
    "priority": "low"|"medium"|"high"|null
  }
}

Rules:
- Base the summary only on CUSTOMER and AGENT turns in the transcript.
- Keep bullets short and useful for CRM entry.
- If something is unknown, use null or an empty array.

Transcript:
${transcript.slice(-5000)}
`;

  const parsed = parseJsonObject(await run(prompt));
  const summary = parsed && typeof parsed === "object" ? parsed : emptySummary;

  return {
    discussed: Array.isArray(summary.discussed) ? summary.discussed : [],
    decisions: Array.isArray(summary.decisions) ? summary.decisions : [],
    action_items: Array.isArray(summary.action_items)
      ? summary.action_items
      : [],
    crm_fields:
      summary.crm_fields && typeof summary.crm_fields === "object"
        ? summary.crm_fields
        : {},
    transcript,
    turnCount: turns.length,
  };
}

async function finishCall(sessionId) {
  const summary = await buildPostCallSummary(sessionId);
  const record = {
    id: sessionId,
    startedAt: Number(sessionId.replace(/^session-/, "")) || Date.now(),
    endedAt: Date.now(),
    summary,
  };

  callHistory.unshift(record);
  if (callHistory.length > 20) callHistory.pop();

  io.to(sessionId).emit(Events.CALL_SUMMARY, record);
  return record;
}

function ensureSessionBuffer(sessionId, speaker = "agent") {
  audioBuffers[getStreamKey(sessionId, speaker)] ||= [];
}

function flushBufferedAudio(sessionId, speaker, stream) {
  const key = getStreamKey(sessionId, speaker);
  const buffer = audioBuffers[key] || [];
  if (!buffer.length) return;

  let sentCount = 0;
  for (const chunk of buffer) {
    if (stream.sendAudio?.(chunk)) sentCount++;
    else if (typeof stream.send === "function") {
      stream.send(chunk);
      sentCount++;
    }
  }

  console.log(`✅ Flushed ${sentCount}/${buffer.length} buffered ${speaker} chunks`);
  audioBuffers[key] = [];
}

function attachDeepgramStream(sessionId, speaker = "agent") {
  const sourceSpeaker = normalizeSpeaker(speaker);
  const key = getStreamKey(sessionId, sourceSpeaker);

  const stream = createDeepgramStream(
    (payload) => {
      if (payload === "__STT_READY__") {
        io.to(sessionId).emit("stt-ready", { speaker: sourceSpeaker });
        flushBufferedAudio(sessionId, sourceSpeaker, stream);
        return;
      }

      let text = null;
      let isFinal = false;
      let words = [];

      if (typeof payload === "string") {
        text = payload;
      } else if (payload && typeof payload === "object") {
        text = payload.text || null;
        isFinal = !!payload.isFinal;
        words = Array.isArray(payload.words) ? payload.words : [];
      }

      if (!text || !text.trim()) return;

      transcriptCounts[sessionId] = (transcriptCounts[sessionId] || 0) + 1;
      if (isFinal) finalCounts[sessionId] = (finalCounts[sessionId] || 0) + 1;

      const segments = normalizeTranscriptPayload(sessionId, { text, words }, sourceSpeaker);

      for (const segment of segments) {
        if (!segment.text?.trim()) continue;

        console.log(
          "✅ Transcript received:",
          LOG_TRANSCRIPTS
            ? segment.text
            : `<${segment.text.split(/\s+/).length} words>`,
          "speaker:",
          segment.speaker,
          "deepgramSpeaker:",
          segment.diarizedSpeaker ?? "none",
          "isFinal:",
          isFinal,
        );

        io.to(sessionId).emit("interim-transcript", {
          text: segment.text,
          isFinal,
          speaker: segment.speaker,
          diarizedSpeaker: segment.diarizedSpeaker,
        });

        if (isFinal) {
          conversationStore.append(sessionId, {
            speaker: segment.speaker,
            text: segment.text,
          });
        }

        if (
          segment.speaker === "customer" &&
          isFinal &&
          segment.text.split(/\s+/).length > 6
        ) {
          if (lastFinalText[sessionId] === segment.text) {
            console.log("⚠️ Duplicate final transcript — skipping");
          } else if (canCallLLM()) {
            if (LOG_TRANSCRIPTS) {
              console.log("🧠 FORCED RUN WITH FINAL SENTENCE:", segment.text);
            }
            runNluWithText(io, sessionId, conversationStore.getTranscript(sessionId))
              .then(() => {
                llmCallCounts[sessionId] = (llmCallCounts[sessionId] || 0) + 1;
                lastFinalText[sessionId] = segment.text;
              })
              .catch((err) => {
                console.error("❌ Error running forced LLM:", err);
                io.to(sessionId).emit(Events.AGENT_ERROR, {
                  source: "nlu",
                  message: "Agent assist is temporarily unavailable.",
                });
              });
          }
        }

        if (isFinal) {
          handleTranscript(sessionId, segment.text, segment.speaker);
        }
      }
    },
    (err) => {
      console.error("❌ Deepgram Error:", err);
      io.to(sessionId).emit(Events.AGENT_ERROR, {
        source: "stt",
        message: "Speech transcription is temporarily unavailable.",
      });
    },
    () => {
      console.warn(`⚠️ Deepgram stream closed for session ${sessionId}`);
      if (sessionEnding[sessionId]) return;

      if (sessionStreams[key] === stream) {
        delete sessionStreams[key];
      }

      io.to(sessionId).emit(Events.AGENT_ERROR, {
        source: "stt",
        message: "Speech stream dropped. Reconnecting...",
      });

      ensureSessionBuffer(sessionId, sourceSpeaker);
      attachDeepgramStream(sessionId, sourceSpeaker);
    },
  );

  if (!stream) {
    console.error("❌ Failed to create Deepgram stream");
    io.to(sessionId).emit(Events.AGENT_ERROR, {
      source: "stt",
      message: "Speech transcription could not start.",
    });
    return null;
  }

  sessionStreams[key] = stream;
  ensureSessionBuffer(sessionId, sourceSpeaker);
  console.log(
    `📦 ${sourceSpeaker} stream created, buffered chunks:`,
    audioBuffers[key].length,
  );
  return stream;
}

async function handleTranscript(sessionId, text, speaker = "customer") {
  if (speaker !== "customer") return;

  transcriptBuffers[sessionId] ||= [];
  transcriptBuffers[sessionId].push(`CUSTOMER: ${text}`);

  const now     = Date.now();
  const lastRun = transcriptLastRun[sessionId] || 0;
  const combined = transcriptBuffers[sessionId].join(" ").trim();

  if (LOG_TRANSCRIPTS) console.log("🧠 BUFFER:", combined);
  console.log("🧠 WORD COUNT:", combined.split(/\s+/).length);
  console.log("⏱️ TIME SINCE LAST RUN:", now - lastRun, "ms");

  const currentLength = combined ? combined.split(/\s+/).length : 0;
  const prevLength    = lastProcessedLength[sessionId] || 0;
  const newWords      = Math.max(0, currentLength - prevLength);

  if (isLLMRunning[sessionId]) return;
  if (now - lastRun < 3000) return;
  if (newWords < 6) return; // lowered from 10 — 10 was too aggressive for short sales openers

  sessionTotalCalls[sessionId] ||= 0;
  if (sessionTotalCalls[sessionId] >= 10) { // raised cap from 5 to 10
    console.log(`⚠️ Session ${sessionId} reached LLM call cap`);
    return;
  }

  if (!isMeaningful(combined)) {
    console.log("⚠️ Skipping LLM run — content not meaningful");
    return;
  }

  if (!canCallLLM()) {
    console.log("⚠️ Skipping LLM run due to global rate limit");
    return;
  }

  isLLMRunning[sessionId] = true;

  try {
    if (LOG_TRANSCRIPTS) console.log("🔥 RUNNING LLM WITH:", combined);
    await runNluWithText(io, sessionId, combined);
    llmCallCounts[sessionId]      = (llmCallCounts[sessionId] || 0) + 1;
    sessionTotalCalls[sessionId] += 1;
    lastProcessedLength[sessionId] = currentLength;
    lastFinalText[sessionId]       = combined;
    transcriptBuffers[sessionId]   = transcriptBuffers[sessionId].slice(-2);
    transcriptLastRun[sessionId]   = now;
  } catch (err) {
    console.error("❌ Error running LLM:", err);
    io.to(sessionId).emit(Events.AGENT_ERROR, {
      source: "nlu",
      message: "Agent assist is temporarily unavailable.",
    });
  } finally {
    isLLMRunning[sessionId] = false;
  }
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join", ({ sessionId }) => {
    console.log("Joined session:", sessionId);
    socket.join(sessionId);
    initConversationState(sessionId);
    sessionEnding[sessionId] = false;

    if (!sessionStreams[getStreamKey(sessionId, "agent")]) {
      attachDeepgramStream(sessionId, "agent");
    }
    if (!sessionStreams[getStreamKey(sessionId, "customer")]) {
      attachDeepgramStream(sessionId, "customer");
    }
  });

  function handleAudioChunk(audioBuffer, meta, sourceSpeaker) {
    const { sessionId, seq, sampleRate } = meta || {};
    const speaker = normalizeSpeaker(sourceSpeaker || meta?.speaker);

    if (!sessionId) {
      console.error("❌ No sessionId in audio chunk meta — check frontend emit format");
      return;
    }

    sessionSpeakers[sessionId] = speaker;

    const buf    = Buffer.from(audioBuffer);
    const int16  = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
    let maxAmp   = 0;
    for (let i = 0; i < int16.length; i++) {
      const abs = Math.abs(int16[i]);
      if (abs > maxAmp) maxAmp = abs;
    }

    console.log(
      `📤 ${speaker}-audio-chunk | session=${sessionId} speaker=${speaker} seq=${seq} rate=${sampleRate}Hz bytes=${buf.length} maxAmp=${maxAmp}`
    );

    if (maxAmp < 100) {
      console.warn("⚠️ VERY LOW AMPLITUDE — audio may be silent or corrupt");
    }

    const key = getStreamKey(sessionId, speaker);
    const stream = sessionStreams[key];

    if (!stream) {
      console.log(`⏳ ${speaker} stream not ready, buffering chunk for session:`, sessionId);
      ensureSessionBuffer(sessionId, speaker);
      audioBuffers[key].push(buf);
      if (!sessionEnding[sessionId]) attachDeepgramStream(sessionId, speaker);
      return;
    }

    if (stream.isReady && stream.isReady()) {
      try {
        if (stream.sendAudio) {
          const success = stream.sendAudio(buf);
          if (!success) console.error("❌ Failed to send audio to Deepgram");
        } else if (typeof stream.send === "function") {
          stream.send(buf);
        } else {
          ensureSessionBuffer(sessionId, speaker);
          audioBuffers[key].push(buf);
        }
      } catch (err) {
        console.error("❌ Deepgram send error:", err);
      }
    } else {
      ensureSessionBuffer(sessionId, speaker);
      audioBuffers[key].push(buf);
    }
  }

  socket.on(Events.MIC_AUDIO_CHUNK, (audioBuffer, meta) => {
    handleAudioChunk(audioBuffer, meta, "agent");
  });

  socket.on(Events.TAB_AUDIO_CHUNK, (audioBuffer, meta) => {
    handleAudioChunk(audioBuffer, meta, "customer");
  });

  // Compatibility fallback for older clients. New clients use source-specific events.
  socket.on(Events.AUDIO_CHUNK, (audioBuffer, meta) => {
    handleAudioChunk(audioBuffer, meta, meta?.speaker);
  });

  socket.on("end-call", async ({ sessionId }) => {
    if (!sessionId) return;
    console.log("🛑 End call for session:", sessionId);
    sessionEnding[sessionId] = true;

    const streamKeys = Object.keys(sessionStreams).filter((key) =>
      key === sessionId || key.startsWith(`${sessionId}:`),
    );
    for (const key of streamKeys) {
      const stream = sessionStreams[key];
      if (!stream) continue;
      try {
        if (typeof stream.destroy === "function") stream.destroy();
        else if (typeof stream.finish === "function") stream.finish();
        else if (typeof stream.close === "function") stream.close();
      } catch (err) {
        console.error("❌ Error finishing stream:", err);
      }
      delete sessionStreams[key];
    }

    try {
      await finishCall(sessionId);
    } catch (err) {
      console.error("❌ Error building post-call summary:", err);
      io.to(sessionId).emit(Events.AGENT_ERROR, {
        source: "summary",
        message: "Post-call summary could not be generated.",
      });
    }

    cleanupSession(sessionId);
    io.to(sessionId).emit("call-ended");
  });
});

server.listen(PORT, () =>
  console.log(`🚀 Samvaad Backend running on port ${PORT}`),
);
