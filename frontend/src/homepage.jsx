import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const colors = {
  bg: "#080C14",
  surface: "#0D1320",
  border: "rgba(255,255,255,0.07)",
  borderBright: "rgba(255,255,255,0.14)",
  accent: "#00E5A0",
  accentDim: "rgba(0,229,160,0.12)",
  accentGlow: "rgba(0,229,160,0.25)",
  blue: "#3B8BFF",
  blueDim: "rgba(59,139,255,0.12)",
  amber: "#FFB547",
  amberDim: "rgba(255,181,71,0.12)",
  pink: "#FF6B9D",
  pinkDim: "rgba(255,107,157,0.12)",
  textPrimary: "#F0F4FF",
  textSecondary: "#8A9BB5",
  textMuted: "#4A5970",
};

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Pulse() {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 10,
        height: 10,
        marginRight: 8,
      }}
    >
      <span
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: colors.accent,
          opacity: 0.4,
          animation: "pingAnim 1.5s cubic-bezier(0,0,0.2,1) infinite",
        }}
      />
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: colors.accent,
          display: "block",
        }}
      />
    </span>
  );
}

function WaveformBar({ delay, h }) {
  return (
    <div
      style={{
        width: 3,
        borderRadius: 2,
        background: colors.accent,
        animation: `waveAnim 1.2s ease-in-out ${delay}s infinite alternate`,
        height: h,
      }}
    />
  );
}

function Nav({ compact = false }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: scrolled ? "rgba(8,12,20,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled
          ? `1px solid ${colors.border}`
          : "1px solid transparent",
        transition: "all 0.3s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: compact ? "0 18px" : "0 48px",
        minHeight: 64,
        gap: compact ? 14 : 0,
        flexWrap: compact ? "wrap" : "nowrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: `linear-gradient(135deg, ${colors.accent} 0%, #009E6E 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M4 9C4 6.2 6.2 4 9 4s5 2.2 5 5-2.2 5-5 5H4.5L3 15.5V9z"
              stroke="#080C14"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="7" cy="9" r="1" fill="#080C14" />
            <circle cx="9" cy="9" r="1" fill="#080C14" />
            <circle cx="11" cy="9" r="1" fill="#080C14" />
          </svg>
        </div>
        <div>
          <span
            style={{
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-0.03em",
              color: colors.textPrimary,
            }}
          >
            samvaad
          </span>
          <span
            style={{
              fontSize: 10,
              color: colors.textMuted,
              letterSpacing: "0.06em",
              marginLeft: 6,
              fontWeight: 500,
            }}
          >
            संवाद
          </span>
        </div>
      </div>

      {!compact && (
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[
            { label: "Vision", id: "vision" },
            { label: "How it works", id: "how-it-works" },
            { label: "Features", id: "features" },
            { label: "Extension", id: "extension" },
            { label: "Contact", id: "contact" },
          ].map(({ label, id }) => {
            // Special-case the Contact link to open the user's mail client
            if (id === "contact") {
              const mailto = `mailto:dabbumothsera@gmail.com?subject=${encodeURIComponent("inquiry regarding samvaad")}`;
              return (
                <a
                  key={id}
                  href={mailto}
                  style={{
                    color: colors.textSecondary,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Contact via email"
                  onMouseEnter={(e) =>
                    (e.target.style.color = colors.textPrimary)
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.color = colors.textSecondary)
                  }
                >
                  {label}
                </a>
              );
            }

            return (
              <a
                key={id}
                href={`#${id}`}
                style={{
                  color: colors.textSecondary,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                }}
                onMouseEnter={(e) =>
                  (e.target.style.color = colors.textPrimary)
                }
                onMouseLeave={(e) =>
                  (e.target.style.color = colors.textSecondary)
                }
              >
                {label}
              </a>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,229,160,0.08)",
            border: "1px solid rgba(0,229,160,0.2)",
            borderRadius: 100,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: colors.accent,
          }}
        >
          <Pulse />
          In development
        </div>
        <button
          style={{
            background: colors.accent,
            border: "none",
            color: "#080C14",
            borderRadius: 8,
            padding: "8px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
          onClick={() =>
            window.open("https://github.com/lazerbeam47/Samvaad-", "_blank")
          }
          aria-label="Request early access"
        >
          Request early access
        </button>
      </div>
    </nav>
  );
}

function LiveDemoCard() {
  const [lines, setLines] = useState([
    {
      speaker: "Customer",
      text: "I've been waiting three weeks for my order and nobody has replied to my emails.",
    },
    {
      speaker: "Agent",
      text: "I completely understand — let me pull up your account right now.",
    },
  ]);
  const [typing, setTyping] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setTyping(true), 2200);
    const t2 = setTimeout(() => {
      setTyping(false);
      setLines((l) => [
        ...l,
        {
          speaker: "Customer",
          text: "Order #48291. I paid for express and it's still not here.",
        },
      ]);
    }, 4200);
    const t3 = setTimeout(() => setShowSuggestion(true), 5000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        overflow: "hidden",
        width: "100%",
        maxWidth: 520,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Pulse />
        <span
          style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}
        >
          Live call · 04:32
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
            height: 24,
          }}
        >
          {[0.3, 0.6, 0.2, 0.8, 0.4, 0.7, 0.3, 0.9, 0.2, 0.5].map((v, i) => (
            <WaveformBar key={i} delay={i * 0.09} h={`${5 + v * 16}px`} />
          ))}
        </div>
      </div>
      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                background:
                  l.speaker === "Customer" ? colors.blueDim : colors.accentDim,
                color: l.speaker === "Customer" ? colors.blue : colors.accent,
              }}
            >
              {l.speaker[0]}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: 3,
                  letterSpacing: "0.04em",
                }}
              >
                {l.speaker.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: colors.textPrimary,
                  lineHeight: 1.55,
                }}
              >
                {l.text}
              </div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                flexShrink: 0,
                background: colors.blueDim,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: colors.blue,
              }}
            >
              C
            </div>
            <div
              style={{
                display: "flex",
                gap: 5,
                alignItems: "center",
                paddingTop: 8,
              }}
            >
              {[0, 0.2, 0.4].map((d) => (
                <div
                  key={d}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: colors.textMuted,
                    animation: `dotAnim 1s ${d}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {showSuggestion && (
        <div
          style={{
            margin: "0 16px 16px",
            padding: 12,
            borderRadius: 10,
            background: colors.accentDim,
            border: `1px solid rgba(0,229,160,0.2)`,
            animation: "fadeUp 0.4s ease",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.accent,
              marginBottom: 6,
              letterSpacing: "0.07em",
            }}
          >
            SAMVAAD SUGGESTS
          </div>
          <div
            style={{
              fontSize: 13,
              color: colors.textPrimary,
              lineHeight: 1.55,
            }}
          >
            "I'm sorry for the delay on order #48291. I can see it's still in
            transit — let me escalate this immediately and get you a refund on
            the express shipping fee."
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ icon, label, color, bg, children, delay = 0 }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 28,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `all 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          fontSize: 20,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.7 }}
      >
        {children}
      </div>
    </div>
  );
}

function GapCard({ number, problem, gap, delay = 0 }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `all 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: colors.textMuted,
          letterSpacing: "0.1em",
          marginBottom: 14,
        }}
      >
        0{number}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: colors.textPrimary,
          letterSpacing: "-0.02em",
          lineHeight: 1.25,
          marginBottom: 12,
        }}
      >
        {problem}
      </div>
      <div
        style={{
          width: 32,
          height: 2,
          background: colors.accent,
          borderRadius: 2,
          marginBottom: 14,
        }}
      />
      <div
        style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 1.7 }}
      >
        {gap}
      </div>
    </div>
  );
}

function FutureCard({ icon, title, body, delay = 0 }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 28,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `all 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 16 }}>{icon}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: colors.textPrimary,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.7 }}
      >
        {body}
      </div>
    </div>
  );
}

export default function SamvaadHome({ onStart }) {
  const navigate = useNavigate();
  const [heroRef, heroVisible] = useInView(0.05);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const isMobile = viewportWidth < 900;
  const isTablet = viewportWidth >= 900 && viewportWidth < 1180;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Modal state and helpers for Privacy / Terms popups
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState(null);

  const openModal = (title, body) => {
    setModalTitle(title);
    setModalBody(body);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalTitle("");
    setModalBody(null);
  };

  const privacyBody = (
    <div>
      <p>
        Samvaad collects audio, transcripts, and limited metadata (session
        timestamps, speaker role annotations, and device information) to provide
        real-time transcription, conversation intelligence, and post-call
        summaries. We retain data to enable session playback, improve
        transcription quality, and provide features such as CRM autofill and
        action-item extraction.
      </p>

      <p>
        We do not sell personal data. Aggregated and anonymized usage metrics
        may be shared with partners for product improvement, but these do not
        identify individual users. To request data export or deletion, contact
        us at dabbumothsera@gmail.com and we'll respond to verified requests.
      </p>

      <p>
        Security: Samvaad uses industry-standard protections for data in transit
        (TLS) and at rest. Access to production data is restricted to authorized
        personnel and audited. For high-sensitivity use cases, we recommend
        redaction or filtering before sharing sensitive data in calls.
      </p>

      <p>
        Third parties: Samvaad may use third-party providers (STT vendors, LLM
        providers, analytics) who process data on our behalf under contract.
        Review provider-specific terms if required for compliance.
      </p>
    </div>
  );

  const termsBody = (
    <div>
      <p>
        By using Samvaad you agree to these Terms of Service. Use the product
        lawfully and only with the rights to process any audio you submit. You
        are responsible for obtaining any required consents for recording and
        processing conversations.
      </p>

      <p>
        Service scope: Samvaad provides conversation intelligence features
        (real-time transcription, suggested replies, intent detection,
        compliance flags, and post-call summaries). Features are provided
        "as-is" and may evolve over time; we do not guarantee specific outputs
        from using the product.
      </p>

      <p>
        Acceptable use: Do not use Samvaad for unlawful activities or attempts
        to reverse-engineer integrations. We may suspend or terminate access for
        abusive behaviour, security risks, or repeated violations of these
        terms.
      </p>

      <p>
        Liability: to the extent permitted by law, Samvaad and its providers are
        not liable for indirect, incidental, or consequential damages resulting
        from use of the service. For enterprise licensing or support, contact
        dabbumothsera@gmail.com.
      </p>
    </div>
  );

  return (
    <div
      style={{
        background: colors.bg,
        color: colors.textPrimary,
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pingAnim { 0% { transform:scale(1); opacity:0.4; } 75%,100% { transform:scale(2.2); opacity:0; } }
        @keyframes waveAnim { from { transform:scaleY(0.35); } to { transform:scaleY(1.2); } }
        @keyframes dotAnim { 0%,100% { opacity:0.3; transform:translateY(0); } 50% { opacity:1; transform:translateY(-4px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes heroIn { from { opacity:0; transform:translateY(36px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glowPulse { 0%,100% { opacity:0.45; transform:scale(1); } 50% { opacity:0.75; transform:scale(1.06); } }

        /* Ensure full-page background matches app and prevent white flash on overscroll */
        html, body, #root {
          height: 100%;
          background: #080C14;
          overscroll-behavior: contain;
        }

        html { scroll-behavior:smooth; }
        a { text-decoration:none; }
      `}</style>

      <Nav compact={isMobile || isTablet} />

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "112px 18px 56px" : "120px 48px 80px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "50%",
            transform: "translateX(-50%)",
            width: isMobile ? 360 : 700,
            height: isMobile ? 360 : 700,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors.accentGlow} 0%, transparent 68%)`,
            pointerEvents: "none",
            animation: "glowPulse 7s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: `linear-gradient(${colors.border} 1px, transparent 1px), linear-gradient(90deg, ${colors.border} 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 75% 70% at 50% 50%, black 20%, transparent 100%)",
          }}
        />

        <div
          style={{
            maxWidth: 1160,
            width: "100%",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            ref={heroRef}
            style={{
              textAlign: "center",
              animation: heroVisible
                ? "heroIn 0.85s cubic-bezier(0.16,1,0.3,1) forwards"
                : "none",
              opacity: 0,
            }}
          >
            <div
              style={{
                marginBottom: 28,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(0,229,160,0.08)",
                  border: "1px solid rgba(0,229,160,0.22)",
                  borderRadius: 100,
                  padding: "6px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.accent,
                }}
              >
                <Pulse />
                Currently in development · early access open
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(46px, 7vw, 90px)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                marginBottom: 8,
                color: colors.textPrimary,
              }}
            >
              The intelligence layer
            </h1>
            <h1
              style={{
                fontSize: "clamp(46px, 7vw, 90px)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                marginBottom: 32,
                color: colors.accent,
              }}
            >
              every call is missing.
            </h1>

            <p
              style={{
                fontSize: "clamp(16px, 2vw, 20px)",
                color: colors.textSecondary,
                lineHeight: 1.65,
                maxWidth: 580,
                margin: "0 auto 48px",
              }}
            >
              Samvaad — <em>संवाद</em>, Hindi for <em>conversation</em> —
              listens live alongside your agents and surfaces what they need,
              exactly when they need it.
            </p>

            <div
              style={{
                display: "flex",
                gap: 14,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                style={{
                  background: colors.accent,
                  border: "none",
                  color: "#080C14",
                  borderRadius: 10,
                  padding: "14px 34px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: `0 0 44px ${colors.accentGlow}`,
                }}
                onClick={() => navigate("/demo")}
              >
                Try Live Demo
              </button>

              <button
                style={{
                  background: "transparent",
                  border: `1px solid ${colors.borderBright}`,
                  color: colors.textPrimary,
                  borderRadius: 10,
                  padding: "14px 34px",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() =>
                  document
                    .getElementById("extension")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Get extension ↓
              </button>
            </div>
          </div>

          {/* Live demo row */}
          <div
            style={{
              marginTop: isMobile ? 52 : 72,
              display: "flex",
              gap: 20,
              justifyContent: "center",
              alignItems: "flex-start",
              width: "100%",
              flexWrap: "wrap",
              animation: heroVisible
                ? "heroIn 0.85s cubic-bezier(0.16,1,0.3,1) 0.18s forwards"
                : "none",
              opacity: 0,
            }}
          >
            <LiveDemoCard />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: isMobile ? "100%" : 256,
                flexShrink: 0,
              }}
            >
              {[
                {
                  icon: "⚡",
                  label: "Intent",
                  value: "Shipping dispute · high urgency",
                  color: colors.amber,
                  bg: colors.amberDim,
                },
                {
                  icon: "🛡️",
                  label: "Compliance",
                  value: "Resolve within 30 days per §4.2",
                  color: colors.pink,
                  bg: colors.pinkDim,
                },
                {
                  icon: "📋",
                  label: "CRM autofill",
                  value: "Order #48291 · Express · 3 wk delay",
                  color: colors.blue,
                  bg: colors.blueDim,
                },
              ].map(({ icon, label, value, color, bg }) => (
                <div
                  key={label}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      {icon}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label.toUpperCase()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── THE GAP ── */}
      <section
        id="how-it-works"
        style={{
          padding: isMobile ? "72px 18px" : "96px 48px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 72 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.accent,
                letterSpacing: "0.1em",
                marginBottom: 16,
              }}
            >
              THE PROBLEM SPACE
            </div>
            <h2
              style={{
                fontSize: "clamp(32px, 4.5vw, 58px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                maxWidth: 700,
                color: colors.textPrimary,
              }}
            >
              Every live call is a black box. We're changing that.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 64,
            }}
          >
            <GapCard
              number={1}
              problem="Agents are on their own mid-call."
              gap="There's no co-pilot in the room when a frustrated customer pushes back, a compliance line gets crossed, or a sales moment appears. Training helps before the call. Samvaad helps during it."
              delay={0}
            />
            <GapCard
              number={2}
              problem="Knowledge is buried, not surfaced."
              gap="Every org has playbooks, policy docs, and CRM data — but none of it reaches the agent while they're speaking. Tabbing between windows mid-conversation costs focus and loses trust."
              delay={0.1}
            />
            <GapCard
              number={3}
              problem="Post-call work is manual and error-prone."
              gap="After a call ends, agents reconstruct from memory — logging details, writing summaries, noting action items. Critical things slip. CRM data stays incomplete. Follow-through breaks down."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        style={{
          padding: isMobile ? "72px 18px" : "96px 48px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.accent,
                letterSpacing: "0.1em",
                marginBottom: 16,
              }}
            >
              WHAT SAMVAAD DOES
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 52px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                marginBottom: 16,
              }}
            >
              Six things. One sidebar.
            </h2>
            <p
              style={{
                fontSize: 17,
                color: colors.textSecondary,
                maxWidth: 460,
                margin: "0 auto",
              }}
            >
              Everything lives in a lightweight panel beside the call — no new
              tabs, no alt-tabbing, no disruption.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            <FeatureCard
              icon="🎙️"
              label="Live transcript"
              bg={colors.accentDim}
              delay={0}
            >
              Word-by-word transcription as the call happens. Scroll back,
              search, and read — without interrupting the customer to repeat
              themselves.
            </FeatureCard>
            <FeatureCard
              icon="💬"
              label="Reply suggestions"
              bg={colors.blueDim}
              delay={0.07}
            >
              Context-aware response options in real time. Maintain tone, speed
              up resolution, and never blank on what to say next.
            </FeatureCard>
            <FeatureCard
              icon="⚡"
              label="Intent detection"
              bg={colors.amberDim}
              delay={0.14}
            >
              Classifies the call within seconds — churn risk, billing dispute,
              upsell window — so agents lead with the right energy from the
              start.
            </FeatureCard>
            <FeatureCard
              icon="🛡️"
              label="Compliance flags"
              bg={colors.pinkDim}
              delay={0.21}
            >
              Alerts the moment a conversation edges toward regulatory risk.
              Custom rules sit alongside GDPR, PCI, and HIPAA defaults.
            </FeatureCard>
            <FeatureCard
              icon="📋"
              label="CRM autofill hints"
              bg={colors.blueDim}
              delay={0.28}
            >
              Key details — names, order numbers, issue types — are extracted
              and suggested as CRM fields in real time, ready to confirm with
              one click.
            </FeatureCard>
            <FeatureCard
              icon="✅"
              label="Action items"
              bg={colors.accentDim}
              delay={0.35}
            >
              Every commitment and next step is logged automatically. Nothing
              falls through the gap between what was said and what gets done.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* ── VISION / FUTURE ── */}
      <section
        id="vision"
        style={{
          padding: isMobile ? "72px 18px" : "96px 48px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 72 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.accent,
                letterSpacing: "0.1em",
                marginBottom: 16,
              }}
            >
              WHERE THIS IS GOING
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 4.5vw, 58px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
                maxWidth: 740,
              }}
            >
              The phone call is still the most human channel businesses have. We
              think it deserves the best AI.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <FutureCard
              icon="🧠"
              title="From reactive to predictive"
              body="Today, agents respond to what's happening. Tomorrow, Samvaad will anticipate where a conversation is going — flagging churn signals 60 seconds before the customer even voices them."
              delay={0}
            />
            <FutureCard
              icon="🌐"
              title="Any language, any accent"
              body="Contact centers don't operate in one language or one region. Samvaad is being built for multilingual environments from day one — starting where the need is biggest."
              delay={0.1}
            />
            <FutureCard
              icon="📊"
              title="Insights that outlast the call"
              body="Thousands of calls per day are an untapped source of product feedback, market signals, and operational intelligence. Samvaad will surface what customers are actually saying — at scale."
              delay={0.2}
            />
            <FutureCard
              icon="🤝"
              title="Agent augmentation, not replacement"
              body="The goal was never to automate the human out. It's to make every agent as sharp as your best one — with real-time knowledge, confidence, and clarity on every call they take."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* ── EXTENSION ── */}
      <section
        id="extension"
        style={{
          padding: isMobile ? "72px 18px" : "96px 48px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 20,
              padding: isMobile ? "32px 22px" : "44px 40px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -80,
                right: -40,
                width: 240,
                height: 240,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${colors.blueDim} 0%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.blue,
                letterSpacing: "0.1em",
                marginBottom: 18,
              }}
            >
              BROWSER EXTENSION
            </div>
            <h3
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 14,
                maxWidth: 540,
              }}
            >
              Keep the web app. Launch it from any tab.
            </h3>
            <p
              style={{
                fontSize: 15,
                color: colors.textSecondary,
                lineHeight: 1.7,
                marginBottom: 28,
                maxWidth: 620,
              }}
            >
              Samvaad stays as the main product UI. The extension just makes it
              faster to try from the browser by opening the live copilot in a
              dedicated popup or tab.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 26,
              }}
            >
              {[
                "Launch home or live demo",
                "Open a narrow testing popup",
                "Optional floating launcher on pages",
                "Point it at local or deployed Samvaad",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                    background: "rgba(255,255,255,0.02)",
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            <a
              href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: colors.accent,
                color: "#080C14",
                borderRadius: 10,
                padding: "13px 24px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Load unpacked extension
            </a>
          </div>

          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 20,
              padding: isMobile ? "32px 22px" : "44px 36px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.accent,
                letterSpacing: "0.1em",
                marginBottom: 18,
              }}
            >
              QUICK SETUP
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {[
                {
                  step: "01",
                  text: "Run the Samvaad backend and frontend locally.",
                },
                {
                  step: "02",
                  text: "Load the extension folder in Chrome or another Chromium browser.",
                },
                {
                  step: "03",
                  text: "Set the web app URL in the extension popup and launch the live demo.",
                },
              ].map(({ step, text }) => (
                <div
                  key={step}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "42px 1fr",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: colors.accentDim,
                      color: colors.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {step}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: colors.textSecondary,
                      lineHeight: 1.65,
                      paddingTop: 6,
                    }}
                  >
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRIVACY / TERMS (static content) ── */}
      {/* Conditionally rendered modal for Privacy / Terms */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 20,
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              width: "min(920px, 96%)",
              maxHeight: "80vh",
              overflow: "auto",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3
                style={{ margin: 0, fontSize: 18, color: colors.textPrimary }}
              >
                {modalTitle}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.textSecondary,
                  fontSize: 18,
                  cursor: "pointer",
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {modalBody}
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer
        id="contact"
        style={{
          borderTop: `1px solid ${colors.border}`,
          padding: isMobile ? "28px 18px" : "40px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `linear-gradient(135deg, ${colors.accent}, #009E6E)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 9C4 6.2 6.2 4 9 4s5 2.2 5 5-2.2 5-5 5H4.5L3 15.5V9z"
                stroke="#080C14"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}
          >
            samvaad
          </span>
          <span
            style={{
              fontSize: 10,
              color: colors.textMuted,
              marginLeft: 4,
              fontWeight: 500,
              letterSpacing: "0.05em",
            }}
          >
            संवाद
          </span>
          <span
            style={{ color: colors.textMuted, fontSize: 13, marginLeft: 16 }}
          >
            © 2025
          </span>
        </div>
        <div
          style={{ fontSize: 13, color: colors.textMuted, fontStyle: "italic" }}
        >
          Real-time AI for the conversations that matter.
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openModal("Privacy Policy", privacyBody);
            }}
            style={{ color: colors.textMuted, fontSize: 13 }}
          >
            Privacy
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openModal("Terms of Service", termsBody);
            }}
            style={{ color: colors.textMuted, fontSize: 13 }}
          >
            Terms
          </a>
          <a
            href={`mailto:dabbumothsera@gmail.com?subject=${encodeURIComponent("inquiry regarding samvaad")}`}
            style={{ color: colors.textMuted, fontSize: 13 }}
          >
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}
