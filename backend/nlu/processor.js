const { run } = require("./llmClient");
const buildMasterPrompt = require("./prompts/masterPrompt");
const conversationStore = require("../services/conversationStore");
const Events = require("../sockets/events");
const logger = require("../utils/logger");

const pending = {};
const conversationState = {};

function parseNluJson(raw) {
  if (!raw || !raw.trim()) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/{[\s\S]*}/);
    if (!match) {
      logger.error("NLU JSON parse error, no JSON found");
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (err) {
      logger.error("NLU JSON parse error after extraction:", err);
      return null;
    }
  }
}

function normalizeNluOutput(parsed = {}) {
  return {
    intent: parsed.intent || {},
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    compliance: Array.isArray(parsed.compliance) ? parsed.compliance : [],
    crm: parsed.crm && typeof parsed.crm === "object" ? parsed.crm : {},
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    conversation_state:
      parsed.conversation_state && typeof parsed.conversation_state === "object"
        ? parsed.conversation_state
        : {},
  };
}

function emitNluOutput(io, sessionId, output) {
  const { intent, suggestions, compliance, crm, actions, conversation_state } =
    output;

  io.to(sessionId).emit(Events.AGENT_INTENT, { intent });
  io.to(sessionId).emit(Events.AGENT_SUGGESTIONS, { suggestions });
  io.to(sessionId).emit(Events.AGENT_COMPLIANCE, { flags: compliance });
  io.to(sessionId).emit(Events.AGENT_CRM, { fields: crm });
  io.to(sessionId).emit(Events.AGENT_ACTIONS, { actions });

  const prevState = conversationState[sessionId] || {};
  const {
    phase = "UNKNOWN",
    risk = 0,
    opportunity = 0,
    reason = "",
  } = conversation_state;

  const phaseChanged = prevState.phase !== phase;
  const riskChanged = Math.abs((prevState.risk || 0) - risk) >= 10;
  const oppChanged = Math.abs((prevState.opportunity || 0) - opportunity) >= 10;

  conversationState[sessionId] = { phase, risk, opportunity };

  if (phaseChanged || riskChanged || oppChanged) {
    logger.info(
      `[STATE] ${sessionId} phase=${phase} risk=${risk} opportunity=${opportunity}`,
    );
    io.to(sessionId).emit(Events.CONVERSATION_STATE, {
      phase,
      risk,
      opportunity,
      reason,
      prevPhase: prevState.phase || null,
    });
  }
}

async function runNluWithText(io, sessionId, transcript) {
  if (!transcript || !transcript.trim()) return null;

  logger.info(`[NLU] Running for session=${sessionId}`);
  const raw = await run(buildMasterPrompt(transcript));
  const parsed = parseNluJson(raw);
  if (!parsed) return null;

  const output = normalizeNluOutput(parsed);
  emitNluOutput(io, sessionId, output);
  return output;
}

async function runNlu(io, sessionId) {
  return runNluWithText(io, sessionId, conversationStore.getTranscript(sessionId));
}

function scheduleNluProcessing(io, sessionId, delay = 2000) {
  if (pending[sessionId]) {
    clearTimeout(pending[sessionId]);
    logger.debug(`[NLU] Debounce reset for ${sessionId}`);
  }

  pending[sessionId] = setTimeout(() => {
    delete pending[sessionId];
    logger.debug(`[NLU] Debounce fired for ${sessionId} after ${delay}ms`);
    runNlu(io, sessionId).catch((err) =>
      logger.error(`[NLU] Debounced run failed for ${sessionId}:`, err),
    );
  }, delay);
}

function clearNluSession(sessionId) {
  if (pending[sessionId]) clearTimeout(pending[sessionId]);
  delete pending[sessionId];
  delete conversationState[sessionId];
}

module.exports = {
  clearNluSession,
  emitNluOutput,
  normalizeNluOutput,
  parseNluJson,
  runNlu,
  runNluWithText,
  scheduleNluProcessing,
};
