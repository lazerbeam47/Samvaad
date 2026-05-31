// Conversation Store Service which could be used to store and retrieve conversations

const sessions = {}; // In-memory store for conversations, keyed by sessionId

function initSession(sessionId) {
  // Initialize a session if it doesn't exist
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      transcript: "",
      turns: [],
      lastUpdated: Date.now(),
    };
  }
}

function append(sessionId, input) {
  // Append text to a session's transcript
  if (!sessions[sessionId]) initSession(sessionId);
  const speaker =
    typeof input === "object" && input !== null
      ? normalizeSpeaker(input.speaker)
      : "customer";
  const text = typeof input === "object" && input !== null ? input.text : input;
  const chunk = (text ?? "").toString().trim();
  if (!chunk) return; // ignore empty/whitespace

  sessions[sessionId].turns.push({ speaker, text: chunk, ts: Date.now() });
  if (sessions[sessionId].turns.length > 80) {
    sessions[sessionId].turns = sessions[sessionId].turns.slice(-80);
  }

  sessions[sessionId].transcript = formatTurns(sessions[sessionId].turns);
  sessions[sessionId].lastUpdated = Date.now();
  // keep only last 4000 chars for performance
  if (sessions[sessionId].transcript.length > 4000) {
    sessions[sessionId].transcript =
      sessions[sessionId].transcript.slice(-4000);
  }
}

function getTranscript(sessionId) {
  // Retrieve the transcript for a session
  return sessions[sessionId]?.transcript || "";
}

function getTurns(sessionId) {
  return sessions[sessionId]?.turns || [];
}

function endSession(sessionId) {
  // Clean up session data
  delete sessions[sessionId];
}

function normalizeSpeaker(speaker) {
  return speaker === "agent" ? "agent" : "customer";
}

function formatTurns(turns) {
  return turns
    .map(({ speaker, text }) => `${speaker.toUpperCase()}: ${text}`)
    .join("\n");
}

module.exports = {
  initSession,
  append,
  getTurns,
  getTranscript,
  endSession,
};
