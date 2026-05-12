import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

// ─── Downsampler (linear interpolation) ──────────────────────────────────────
const downsample = (buffer, fromRate, toRate) => {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, buffer.length - 1);
    const frac = pos - left;
    result[i] = buffer[left] * (1 - frac) + buffer[right] * frac;
  }
  return result;
};

// ─── Float32 → Int16 PCM ─────────────────────────────────────────────────────
const toInt16 = (float32) => {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#060A11",
  surface: "#0C1220",
  surfaceHigh: "#101828",
  surfaceLow: "#080E1A",
  border: "rgba(255,255,255,0.06)",
  borderMid: "rgba(255,255,255,0.10)",
  borderBright: "rgba(255,255,255,0.16)",
  accent: "#00E5A0",
  accentDark: "#009E6E",
  accentDim: "rgba(0,229,160,0.09)",
  accentGlow: "rgba(0,229,160,0.20)",
  blue: "#3B8BFF",
  blueDim: "rgba(59,139,255,0.09)",
  amber: "#FFB547",
  amberDim: "rgba(255,181,71,0.09)",
  pink: "#FF6B9D",
  pinkDim: "rgba(255,107,157,0.09)",
  red: "#FF5C5C",
  redDim: "rgba(255,92,92,0.09)",
  text: "#EEF2FF",
  textSub: "#7E93B0",
  textMuted: "#3D5068",
  navH: 56,
};

// ─── Atoms ────────────────────────────────────────────────────────────────────

function PulseDot({ color = C.accent, size = 8 }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          opacity: 0.35,
          animation: "pingAnim 1.6s cubic-bezier(0,0,0.2,1) infinite",
        }}
      />
      <span
        style={{
          margin: "auto",
          position: "relative",
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: "50%",
          background: color,
          display: "block",
        }}
      />
    </span>
  );
}

function Tag({ color, bg, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: bg,
        border: `1px solid ${color}35`,
        color,
        borderRadius: 100,
        padding: "3px 10px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function PanelHeader({ icon, label, accent, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 18px",
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: accent ? `${accent}15` : C.surfaceHigh,
            border: `1px solid ${accent ? accent + "25" : C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent || C.textSub,
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div
      style={{
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: C.textMuted,
        }}
      />
      <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_SAMPLE_RATE = 16000; // Deepgram optimal
const CHUNK_SAMPLES = TARGET_SAMPLE_RATE / 4; // 1600 = 100ms per emit

// ─── Main ─────────────────────────────────────────────────────────────────────

const LiveCall = () => {
  const [connected, setConnected] = useState(false);
  const [interim, setInterim] = useState("");
  const [chunksCount, setChunksCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionShort, setSessionShort] = useState("—");
  const [sttReady, setSttReady] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");
  const [speakerMode, setSpeakerMode] = useState("customer");

  const [intent, setIntent] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [complianceFlags, setComplianceFlags] = useState([]);
  const [crm, setCrm] = useState({});
  const [actions, setActions] = useState([]);
  const [conversationState, setConversationState] = useState(null);

  const visualizerRef = useRef(null);
  const animIdRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const sessionIdRef = useRef(null);
  const seqRef = useRef(0);
  const socketRef = useRef(null);
  const isRecordingRef = useRef(false);
  const speakerModeRef = useRef("customer");
  const timerRef = useRef(null);
  const transcriptRef = useRef(null);

  // auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [interim]);

  // call timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const setSpeaker = (speaker) => {
    if (isRecording) return;
    speakerModeRef.current = speaker;
    setSpeakerMode(speaker);
  };

  // ── SOCKET ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sock = io("http://localhost:3000");
    socketRef.current = sock;

    sock.on("connect", () => {
      setConnected(true);
      setErrorNotice("");
      if (!sessionIdRef.current) sessionIdRef.current = `session-${Date.now()}`;
      setSessionShort("…" + sessionIdRef.current.slice(-8));
      sock.emit("join", { sessionId: sessionIdRef.current });
    });
    sock.on("disconnect", () => {
      setConnected(false);
      setSttReady(false);
      setErrorNotice("Backend disconnected.");
    });
    sock.on("stt-ready", () => {
      setSttReady(true);
      setErrorNotice("");
    });
    sock.on("agent-error", ({ message }) => {
      setErrorNotice(message || "Agent assist is temporarily unavailable.");
    });
    sock.on("conversation-state", (data) => setConversationState(data));
    sock.on("agent-intent", ({ intent }) => setIntent(intent));
    sock.on("agent-suggestions", ({ suggestions }) =>
      setSuggestions(suggestions),
    );
    sock.on("agent-compliance", ({ flags }) => setComplianceFlags(flags));
    sock.on("agent-crm", ({ fields }) => setCrm(fields));
    sock.on("agent-actions", ({ actions }) => setActions(actions));

    // FIX 4: only append final transcripts — no interim flicker
    sock.on("interim-transcript", (payload) => {
      if (!payload?.text?.trim()) return;
      if (payload.isFinal) {
        const speaker = payload.speaker === "agent" ? "Agent" : "Customer";
        setInterim((prev) =>
          prev
            ? `${prev}\n${speaker}: ${payload.text.trim()}`
            : `${speaker}: ${payload.text.trim()}`,
        );
      }
    });

    sock.on("call-ended", () => {
      setIsRecording(false);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      const c = visualizerRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    });

    return () => sock.disconnect();
  }, []);

  // FIX 5: removed /assist polling — analysis is triggered server-side
  // via socket events (agent-intent, agent-suggestions, etc.) instead of
  // a client-side setInterval hammering the REST endpoint every 1.5s.

  // ── START RECORDING ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!socketRef.current || isRecordingRef.current) return;
    isRecordingRef.current = true;
    setIsRecording(true);
    setCallDuration(0);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // FIX 2: enable all browser audio enhancements for better accuracy
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setErrorNotice("");
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setErrorNotice(
        err?.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Microphone could not start.",
      );
      return;
    }

    const audioContext = new AudioContext();
    const browserRate = audioContext.sampleRate;
    console.log(
      `🎙 Browser rate: ${browserRate}Hz → downsampling to ${TARGET_SAMPLE_RATE}Hz`,
    );

    const source = audioContext.createMediaStreamSource(stream);
    const gain = audioContext.createGain();
    gain.gain.value = 2.0; // FIX 3: raised from 1.5 to 2.0 for better signal
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;

    source.connect(gain);
    gain.connect(analyser);

    // ── Canvas visualizer ──
    const canvas = visualizerRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      canvas.width = canvas.height = 80;
      const data = new Uint8Array(analyser.fftSize);

      const draw = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
        ctx.clearRect(0, 0, 80, 80);
        ctx.save();
        ctx.translate(40, 40);
        [
          { r: 30 + level * 20, a: 0.07 + level * 0.1 },
          { r: 22 + level * 10, a: 0.14 + level * 0.1 },
        ].forEach(({ r, a }) => {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,229,160,${a})`;
          ctx.fill();
        });
        ctx.beginPath();
        ctx.arc(0, 0, 13 + level * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,229,160,${0.88 + level * 0.12})`;
        ctx.fill();
        ctx.restore();
        animIdRef.current = requestAnimationFrame(draw);
      };
      draw();
    }

    // ── Audio pipeline ──
    // Use AudioWorkletNode instead of deprecated ScriptProcessorNode.
    // We create a small inline worklet module via a blob URL so the app
    // does not require an extra static file. The worklet posts Float32
    // frames to the main thread where we downsample + chunk exactly like
    // the previous implementation.

    let accumulator = new Float32Array(0);

    // Inline worklet source. Keep this minimal.
    const workletCode = `
      class RecorderProcessor extends AudioWorkletProcessor {
        process (inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            // postMessage the Float32Array channel data to the main thread
            this.port.postMessage(input[0]);
          }
          return true;
        }
      }
      registerProcessor('recorder-processor', RecorderProcessor);
    `;

    // Register the worklet module from a blob URL
    const blob = new Blob([workletCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const processor = new AudioWorkletNode(audioContext, "recorder-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
    });

    // Connect the graph: source -> gain -> worklet. The worklet has no outputs.
    gain.connect(processor);

    processor.port.onmessage = (e) => {
      if (!isRecordingRef.current) return;

      // e.data is a Float32Array (frame) from the worklet
      const raw = e.data;
      const ds = downsample(raw, browserRate, TARGET_SAMPLE_RATE);

      const next = new Float32Array(accumulator.length + ds.length);
      next.set(accumulator, 0);
      next.set(ds, accumulator.length);
      accumulator = next;

      while (accumulator.length >= CHUNK_SAMPLES) {
        const chunk = accumulator.slice(0, CHUNK_SAMPLES);
        accumulator = accumulator.slice(CHUNK_SAMPLES);

        const pcm16 = toInt16(chunk);

        // send raw binary FIRST, metadata object second
        socketRef.current.emit("audio-chunk", pcm16.buffer, {
          sessionId: sessionIdRef.current,
          speaker: speakerModeRef.current,
          seq: seqRef.current++,
          sampleRate: TARGET_SAMPLE_RATE,
        });

        setChunksCount((c) => c + 1);
      }
    };

    // Keep the same shape in mediaRecorderRef for compatibility with cleanup
    mediaRecorderRef.current = {
      processor,
      source,
      stream,
      analyser,
      audioContext,
    };
  }; // ← closes startRecording

  // ── STOP RECORDING ─────────────────────────────────────────────────────────
  const stopRecording = () => {
    if (!sessionIdRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    const c = visualizerRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.processor?.disconnect();
      mediaRecorderRef.current.source?.disconnect();
      mediaRecorderRef.current.audioContext?.close();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    socketRef.current?.emit("end-call", { sessionId: sessionIdRef.current });
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        height: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pingAnim {
          0%       { transform:scale(1);   opacity:0.35; }
          75%,100% { transform:scale(2.5); opacity:0;    }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        ::-webkit-scrollbar          { width:3px; height:3px; }
        ::-webkit-scrollbar-track    { background:transparent; }
        ::-webkit-scrollbar-thumb    { background:rgba(255,255,255,0.07); border-radius:4px; }
      `}</style>

      {/* ══ TOPBAR ═══════════════════════════════════════════════════════════ */}
      <header
        style={{
          height: C.navH,
          flexShrink: 0,
          background: "rgba(6,10,17,0.95)",
          backdropFilter: "blur(24px)",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            paddingRight: 16,
            marginRight: 16,
            borderRight: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 9C4 6.2 6.2 4 9 4s5 2.2 5 5-2.2 5-5 5H4.5L3 15.5V9z"
                stroke="#060A11"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <circle cx="7" cy="9" r="1" fill="#060A11" />
              <circle cx="9" cy="9" r="1" fill="#060A11" />
              <circle cx="11" cy="9" r="1" fill="#060A11" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              samvaad
            </div>
            <div
              style={{
                fontSize: 9,
                color: C.textMuted,
                letterSpacing: "0.05em",
                fontWeight: 500,
              }}
            >
              संवाद · agent assist
            </div>
          </div>
        </div>

        {/* Call controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: C.surfaceLow,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 3,
            }}
          >
            {[
              { key: "customer", label: "Customer" },
              { key: "agent", label: "Agent" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSpeaker(key)}
                disabled={isRecording}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: isRecording ? "not-allowed" : "pointer",
                  color: speakerMode === key ? "#060A11" : C.textSub,
                  background: speakerMode === key ? C.accent : "transparent",
                  opacity: isRecording && speakerMode !== key ? 0.4 : 1,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={startRecording}
            disabled={isRecording}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: isRecording ? C.accentDim : C.accent,
              border: `1px solid ${isRecording ? C.accent + "28" : "transparent"}`,
              color: isRecording ? C.accent : "#060A11",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: isRecording ? "not-allowed" : "pointer",
              boxShadow: isRecording ? "none" : `0 0 18px ${C.accentGlow}`,
              opacity: isRecording ? 0.55 : 1,
              transition: "all 0.2s",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle
                cx="5.5"
                cy="5.5"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <circle cx="5.5" cy="5.5" r="2.2" fill="currentColor" />
            </svg>
            Start call
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: !isRecording ? "transparent" : C.redDim,
              border: `1px solid ${!isRecording ? C.border : C.red + "38"}`,
              color: !isRecording ? C.textMuted : C.red,
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: !isRecording ? "not-allowed" : "pointer",
              opacity: !isRecording ? 0.45 : 1,
              transition: "all 0.2s",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="8"
                height="8"
                rx="1.5"
                fill="currentColor"
              />
            </svg>
            End call
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Right status strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isRecording && (
            <Tag color={C.accent} bg={C.accentDim}>
              <PulseDot size={6} color={C.accent} />
              {fmt(callDuration)}
            </Tag>
          )}
          <Tag color={C.textSub} bg="rgba(255,255,255,0.04)">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path
                d="M5 1v2M5 7v2M1 5h2M7 5h2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle
                cx="5"
                cy="5"
                r="2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
            {chunksCount} chunks
          </Tag>
          <Tag
            color={connected ? C.accent : C.red}
            bg={connected ? C.accentDim : C.redDim}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                display: "inline-block",
                background: connected ? C.accent : C.red,
              }}
            />
            {connected ? "Connected" : "Disconnected"}
          </Tag>
          <Tag
            color={sttReady ? C.blue : C.textSub}
            bg={sttReady ? C.blueDim : "rgba(255,255,255,0.04)"}
          >
            {sttReady ? "STT ready" : "STT pending"}
          </Tag>
          {errorNotice && (
            <Tag color={C.red} bg={C.redDim}>
              {errorNotice.length > 42
                ? `${errorNotice.slice(0, 39)}...`
                : errorNotice}
            </Tag>
          )}
        </div>
      </header>

      {/* ══ 3-COLUMN GRID ════════════════════════════════════════════════════ */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "248px 1fr 296px",
          overflow: "hidden",
          gap: "0 1px",
          background: C.border,
        }}
      >
        {/* ── LEFT ─────────────────────────────────────────────────────── */}
        <div
          style={{
            background: C.bg,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Visualizer */}
          <div
            style={{
              padding: "28px 20px 22px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ position: "relative", width: 84, height: 84 }}>
              <canvas
                ref={visualizerRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  display: "block",
                  opacity: isRecording ? 1 : 0,
                  transition: "opacity 0.5s",
                  width: 84,
                  height: 84,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: C.accentDim,
                  border: `1px solid ${C.accent}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isRecording ? 0 : 1,
                  transition: "opacity 0.5s",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="9"
                    y="3"
                    width="6"
                    height="12"
                    rx="3"
                    stroke={C.textMuted}
                    strokeWidth="1.5"
                  />
                  <path
                    d="M5 12c0 3.87 3.13 7 7 7s7-3.13 7-7"
                    stroke={C.textMuted}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="12"
                    y1="19"
                    x2="12"
                    y2="22"
                    stroke={C.textMuted}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <div style={{ textAlign: "center", lineHeight: 1.2 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isRecording ? C.accent : C.textMuted,
                  marginBottom: isRecording ? 4 : 0,
                }}
              >
                {isRecording ? "Recording" : "Idle"}
              </div>
              {isRecording && (
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "-0.05em",
                    color: C.text,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {fmt(callDuration)}
                </div>
              )}
            </div>
          </div>

          {/* Session metadata */}
          <div
            style={{
              padding: "16px 18px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.textMuted,
                letterSpacing: "0.09em",
                marginBottom: 10,
              }}
            >
              SESSION
            </div>
            {[
              { k: "ID", v: sessionShort },
              { k: "Chunks sent", v: chunksCount },
              { k: "Sample rate", v: `${TARGET_SAMPLE_RATE / 1000}kHz` },
            ].map(({ k, v }) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 11, color: C.textMuted }}>{k}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.textSub,
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          {/* Conversation state */}
          <div
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.textMuted,
                letterSpacing: "0.09em",
                marginBottom: 2,
              }}
            >
              CONVERSATION STATE
            </div>
            {[
              {
                label: "Phase",
                value: conversationState?.phase,
                color: C.blue,
              },
              { label: "Risk", value: conversationState?.risk, color: C.red },
              {
                label: "Opportunity",
                value: conversationState?.opportunity,
                color: C.accent,
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: C.surfaceLow,
                  borderRadius: 10,
                  padding: "10px 13px",
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: C.textMuted,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    marginBottom: 3,
                  }}
                >
                  {label.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: value ? color : C.textMuted,
                  }}
                >
                  {value || "—"}
                </div>
              </div>
            ))}
            {conversationState?.reason && (
              <div
                style={{
                  background: C.surfaceLow,
                  borderRadius: 10,
                  padding: "10px 13px",
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: C.textMuted,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    marginBottom: 3,
                  }}
                >
                  REASON
                </div>
                <div
                  style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}
                >
                  {conversationState.reason}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: transcript ────────────────────────────────────────── */}
        <div
          style={{
            background: C.bg,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 22px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: C.accentDim,
                  border: `1px solid ${C.accent}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                }}
              >
                🎙️
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.accent,
                  letterSpacing: "0.06em",
                }}
              >
                LIVE TRANSCRIPT
              </span>
            </div>
            {isRecording ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.accent,
                }}
              >
                <PulseDot size={6} />
                Listening…
              </div>
            ) : (
              <span style={{ fontSize: 11, color: C.textMuted }}>Idle</span>
            )}
          </div>

          <div
            ref={transcriptRef}
            style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}
          >
            {interim.trim() ? (
              interim
                .trim()
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      marginBottom: 14,
                      animation: "fadeSlideUp 0.3s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: C.accent,
                        flexShrink: 0,
                        marginTop: 8,
                        opacity: 0.45,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'DM Mono','Fira Mono',monospace",
                        fontSize: 13,
                        color: C.text,
                        lineHeight: 1.75,
                      }}
                    >
                      {line}
                    </span>
                  </div>
                ))
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  opacity: 0.4,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: C.accentDim,
                    border: `1px solid ${C.accent}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  🎙️
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, color: C.textSub }}
                  >
                    No transcript yet
                  </div>
                  <div
                    style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}
                  >
                    Start a call to begin capturing
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: agent assist ───────────────────────────────────────── */}
        <div
          style={{
            background: C.bg,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textSub,
                letterSpacing: "0.07em",
              }}
            >
              AGENT ASSIST
            </span>
            {isRecording ? (
              <Tag color={C.accent} bg={C.accentDim}>
                <PulseDot size={6} />
                Active
              </Tag>
            ) : (
              <Tag color={C.textMuted} bg="rgba(255,255,255,0.03)">
                Standby
              </Tag>
            )}
          </div>

          {/* Intent */}
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <PanelHeader icon="⚡" label="INTENT" accent={C.amber} />
            <div style={{ padding: "12px 18px" }}>
              {intent?.label ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      lineHeight: 1.4,
                    }}
                  >
                    {intent.label}
                  </span>
                  {intent.confidence !== undefined && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.amber,
                        background: C.amberDim,
                        border: `1px solid ${C.amber}28`,
                        borderRadius: 100,
                        padding: "2px 9px",
                        flexShrink: 0,
                      }}
                    >
                      {Math.round((intent.confidence || 0) * 100)}%
                    </span>
                  )}
                </div>
              ) : (
                <EmptyState label="Awaiting analysis…" />
              )}
            </div>
          </div>

          {/* Reply suggestions */}
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <PanelHeader icon="💬" label="REPLY SUGGESTIONS" accent={C.blue} />
            <div
              style={{
                padding: "10px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {suggestions?.length > 0 ? (
                suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 12px",
                      borderBottom:
                        i < suggestions.length - 1
                          ? `1px solid ${C.border}`
                          : "none",
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.textSub }}>{s}</span>
                  </div>
                ))
              ) : (
                <EmptyState label="Suggestions appear during call…" />
              )}

              {/* CRM fields (render if present) */}
              {Object.keys(crm || {}).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {Object.entries(crm).map(([k, v], idx, arr) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 8,
                        padding: "8px 12px",
                        borderBottom:
                          idx < arr.length - 1
                            ? `1px solid ${C.border}`
                            : "none",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: C.textMuted,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          flexShrink: 0,
                        }}
                      >
                        {k.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: C.accent,
                          fontWeight: 600,
                          fontFamily: "'DM Mono',monospace",
                          textAlign: "right",
                          wordBreak: "break-word",
                        }}
                      >
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action items */}
          <div style={{ flex: 1 }}>
            <PanelHeader
              icon="✅"
              label="ACTION ITEMS"
              accent={C.pink}
              right={
                actions?.length > 0 ? (
                  <Tag color={C.pink} bg={C.pinkDim}>
                    {actions.length}
                  </Tag>
                ) : null
              }
            />
            <div
              style={{
                padding: "10px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {actions?.length > 0 ? (
                actions.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      animation: "fadeSlideUp 0.3s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: 4,
                        flexShrink: 0,
                        marginTop: 2,
                        border: `1.5px solid ${C.pink}45`,
                        background: `${C.pink}08`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: C.textSub,
                        lineHeight: 1.6,
                      }}
                    >
                      {a}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState label="Action items appear here…" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCall;
