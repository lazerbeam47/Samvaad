const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
require("dotenv").config();

const KEEP_ALIVE_INTERVAL_MS = Number(
  process.env.DEEPGRAM_KEEP_ALIVE_MS || 8000,
);

function createDeepgramStream(onTranscript, onError, onClose) {
  const logTranscripts = process.env.LOG_TRANSCRIPTS === "true";
  console.log("Initializing Deepgram…");

  if (!process.env.DEEPGRAM_API_KEY) {
    const err = new Error("DEEPGRAM_API_KEY is not set in environment variables");
    console.error("❌", err.message);
    if (onError) onError(err);
    return null;
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  const connection = deepgram.listen.live({
    // nova-2 is the only model with full en-IN support
    // nova-3 silently falls back to en-US when language: "en-IN" is set
    model: "nova-2-phonecall",

    // Indian English acoustic model — this is the core fix for
    // "Samvaad" → "some of product" style mishearing
    language: "en-IN",

    encoding:    "linear16",
    sample_rate: 16000,
    channels:    1,

    // 300ms silence before a sentence finalizes (default is ~1000ms)
    endpointing: 300,

    smart_format:    true,
    interim_results: true,
    punctuate:       true,
    vad_events:      true,
    diarize:         true,
  });

  let isOpen = false;
  let keepAliveTimer = null;

  function stopKeepAlive() {
    if (!keepAliveTimer) return;
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  function startKeepAlive() {
    stopKeepAlive();
    keepAliveTimer = setInterval(() => {
      if (!isOpen) return;
      try {
        connection.keepAlive();
      } catch (err) {
        console.error("❌ Deepgram keepAlive failed:", err);
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  connection.on(LiveTranscriptionEvents.Open, () => {
    isOpen = true;
    console.log("🟢 Deepgram Live Stream Connected");
    console.log("🔍 Methods available:", {
      send:         typeof connection.send === "function",
      finish:       typeof connection.finish === "function",
      getRawStream: typeof connection.getRawStream === "function",
      keepAlive:    typeof connection.keepAlive === "function",
    });
    startKeepAlive();
    try { onTranscript?.("__STT_READY__"); } catch {}
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    try {
      let transcript = null;
      const isFinal  = data?.is_final || false;

      const alternative =
        data?.channel?.alternatives?.[0] ||
        data?.alternatives?.[0] ||
        null;
      const words = Array.isArray(alternative?.words) ? alternative.words : [];

      if (alternative?.transcript) {
        transcript = alternative.transcript;
      } else if (data?.transcript) {
        transcript = data.transcript;
      } else if (typeof data === "string") {
        transcript = data;
      }

      if (logTranscripts && !connection._loggedStructure) {
        console.log("🔍 Full transcript data:", JSON.stringify(data, null, 2));
        connection._loggedStructure = true;
      }

      if (transcript && transcript.trim()) {
        console.log(
          `✅ Transcript (${isFinal ? "FINAL" : "INTERIM"}):`,
          logTranscripts ? transcript : `<${transcript.split(/\s+/).length} words>`,
        );
        onTranscript({ text: transcript, isFinal, words });
      }
    } catch (err) {
      console.error("❌ Error processing transcript:", err);
      if (onError) onError(err);
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error("🔴 Deepgram Error:", error);
    if (onError) onError(error);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    isOpen = false;
    stopKeepAlive();
    console.log("🔴 Deepgram Stream Closed");
    if (onClose) onClose();
  });

  connection.on(LiveTranscriptionEvents.Metadata, (data) => {
    console.log("📊 Deepgram Metadata:", data);
  });

  connection.isReady = () => isOpen;
  connection.destroy = () => {
    stopKeepAlive();
    isOpen = false;
    try {
      if (typeof connection.requestClose === "function") connection.requestClose();
      else if (typeof connection.finish === "function") connection.finish();
      else if (typeof connection.close === "function") connection.close();
    } catch (err) {
      console.error("❌ Error closing Deepgram stream:", err);
    }
  };

  const originalSend = connection.send;
  connection.sendAudio = function (buffer) {
    if (!isOpen) {
      console.warn("⚠️ Attempting to send audio before connection is open");
      return false;
    }
    if (!buffer || buffer.length === 0) {
      console.warn("⚠️ Attempting to send empty buffer");
      return false;
    }
    try {
      if (typeof originalSend === "function") {
        originalSend.call(this, buffer);
        return true;
      } else if (typeof this.getRawStream === "function") {
        const rawStream = this.getRawStream();
        if (rawStream && typeof rawStream.send === "function") {
          rawStream.send(buffer);
          return true;
        }
      }
      console.error("❌ No send method available");
      return false;
    } catch (err) {
      console.error("❌ Error sending audio:", err);
      return false;
    }
  };

  console.log("🔍 Deepgram connection created");
  return connection;
}

module.exports = createDeepgramStream;
