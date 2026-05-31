const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

const SYSTEM_JSON_INSTRUCTION =
  "You are a strict JSON generator. Return ONLY valid JSON matching the schema requested in the prompt.\n\n";
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20000);
const LLM_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES || 2);
const CIRCUIT_OPEN_MS = Number(process.env.LLM_CIRCUIT_OPEN_MS || 30000);

// Initialize Gemini (Google) client
const API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Optional OpenAI client (used first, falls back to Gemini on rate-limit)
let openaiClient = null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
try {
  if (OPENAI_API_KEY) {
    const OpenAI = require("openai");
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: LLM_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
} catch (err) {
  console.warn(
    "[LLM] OpenAI client not available, skipping OpenAI fallback:",
    err.message,
  );
  openaiClient = null;
}

const circuit = {
  gemini: { failures: 0, openedUntil: 0 },
  openai: { failures: 0, openedUntil: 0 },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCircuitOpen(provider) {
  return circuit[provider].openedUntil > Date.now();
}

function markSuccess(provider) {
  circuit[provider].failures = 0;
  circuit[provider].openedUntil = 0;
}

function markFailure(provider, err) {
  const transient = isTransientError(err);
  if (!transient) return;

  circuit[provider].failures += 1;
  if (circuit[provider].failures > LLM_MAX_RETRIES) {
    circuit[provider].openedUntil = Date.now() + CIRCUIT_OPEN_MS;
    logger.error(
      `[LLM] ${provider} circuit opened for ${CIRCUIT_OPEN_MS}ms after repeated transient errors`,
    );
  }
}

function normalizeError(err) {
  const status = err?.response?.status || err?.status || err?.code || null;
  const message =
    err?.message ||
    (err?.response && JSON.stringify(err.response.data)) ||
    String(err);

  const normalized = new Error(message);
  normalized.status = status;
  normalized.isRateLimit =
    status === 429 || /rate limit|too many requests|quota/i.test(message);
  normalized.isServerError =
    typeof status === "number" && status >= 500 && status < 600;
  normalized.isTimeout = /timeout|timed out|aborted/i.test(message);
  normalized.original = err;
  return normalized;
}

function isTransientError(err) {
  const normalized = normalizeError(err);
  return (
    normalized.isRateLimit ||
    normalized.isServerError ||
    normalized.isTimeout ||
    normalized.status === "ETIMEDOUT" ||
    normalized.status === "ECONNRESET"
  );
}

async function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${LLM_TIMEOUT_MS}ms`)),
      LLM_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runWithRetries(provider, fn) {
  if (isCircuitOpen(provider)) {
    throw new Error(`${provider} circuit is open`);
  }

  let lastError;
  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      const result = await withTimeout(fn(), provider);
      markSuccess(provider);
      return result;
    } catch (err) {
      lastError = normalizeError(err);
      markFailure(provider, lastError);

      if (!isTransientError(lastError) || attempt === LLM_MAX_RETRIES) {
        break;
      }

      const backoffMs = 500 * 2 ** attempt;
      console.warn(
        `[LLM] ${provider} transient error, retrying in ${backoffMs}ms:`,
        lastError.message,
      );
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

async function runWithGemini(prompt) {
  if (!API_KEY) {
    logger.error("Missing GOOGLE_API_KEY");
    return "";
  }

  return runWithRetries("gemini", async () => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: SYSTEM_JSON_INSTRUCTION + prompt,
            },
          ],
        },
      ],
    });

    const text = await result.response.text();

    const usage =
      result?.response?.metadata?.tokenUsage ||
      result?.response?.usage ||
      result?.usage ||
      null;

    const tokenInfo =
      usage ||
      result?.candidates?.[0]?.metadata?.tokenUsage ||
      result?.candidates?.[0]?.usage ||
      null;

    console.log(
      "[LLM] model:",
      GEMINI_MODEL,
      "responseLength:",
      text?.length || 0,
      "tokenUsage:",
      tokenInfo,
    );

    return text;
  });
}

async function runOpenAI(prompt) {
  if (!openaiClient) throw new Error("OpenAI client not configured");

  return runWithRetries("openai", async () => {
    const resp = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: SYSTEM_JSON_INSTRUCTION + prompt,
        },
      ],
      max_tokens: 800,
      temperature: 0.0,
    });

    const text = resp?.choices?.[0]?.message?.content || "";
    const usage = resp?.usage || null;

    console.log(
      "[LLM][OpenAI] model:",
      OPENAI_MODEL,
      "responseLength:",
      text.length,
      "usage:",
      usage,
    );
    return text;
  });
}

// Public run function — tries OpenAI first, falls back to Gemini on rate limits or missing config
async function run(prompt) {
  // Try OpenAI first if available
  if (openaiClient) {
    try {
      return await runOpenAI(prompt);
    } catch (err) {
      console.warn(
        "[LLM] OpenAI error, falling back to Gemini:",
        err.message || err,
      );
    }
  }

  try {
    return await runWithGemini(prompt);
  } catch (err) {
    logger.error("[LLM] Gemini failed:", err.message || err);
    return "";
  }
}

module.exports = { run };
