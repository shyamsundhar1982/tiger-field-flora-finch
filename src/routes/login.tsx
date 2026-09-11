import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useRef, useState } from "react";

type LoginSearch = {
  returnTo?: string;
  email?: string;
  created?: boolean;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    created: search.created === true || search.created === "true" || search.created === "1",
  }),
  component: LoginPage,
});

const BEARER_KEY = "grok-auth.bearer-token";

function safeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/command";
  try {
    const destination = new URL(value, "https://vyndi.local");
    if (destination.origin !== "https://vyndi.local") return "/command";
    if (destination.pathname === "/inventory" || destination.pathname.startsWith("/command")) {
      return destination.pathname;
    }
  } catch {
    // Invalid or external return targets always fall back to Command Centre.
  }
  return "/command";
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let raf = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = () => {
      const w = window.innerWidth,
        h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.58,
        cy = h * 0.48;
      ctx.strokeStyle = "rgba(92, 213, 232, .16)";
      ctx.lineWidth = 1;
      for (let ring = 0; ring < 7; ring++) {
        ctx.beginPath();
        const rx = Math.min(w, h) * (0.18 + ring * 0.045);
        const ry = rx * (0.24 + ring * 0.015);
        ctx.ellipse(cx, cy, rx, ry, -0.22 + Math.sin(frame / 180) * 0.02, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let strand = 0; strand < 8; strand++) {
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const t = i / 100;
          const angle = t * Math.PI * 2 + strand * 0.78 + frame / 900;
          const radius = Math.min(w, h) * (0.11 + strand * 0.018);
          const x = cx + Math.cos(angle) * radius * 1.65;
          const y = cy + Math.sin(angle) * radius * (0.38 + t * 0.12) + (t - 0.5) * h * 0.12;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strand % 3 === 0 ? "rgba(255, 150, 63, .3)" : "rgba(100, 220, 240, .28)";
        ctx.stroke();
      }
      if (!reduced) {
        frame += granted ? 3 : 1;
        raf = requestAnimationFrame(draw);
      }
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return (
    <main className={`command-entry command-entry--luxury ${granted ? "command-entry--granted" : ""}`}>
      <canvas ref={canvasRef} className="command-entry__canvas" aria-hidden="true" />
      <div className="command-entry__veil" aria-hidden="true" />
      <div className="command-entry__grain" aria-hidden="true" />

      <header className="command-entry__masthead">
        <Link to="/" className="command-entry__brand" aria-label="Return to VYNDI">
          <span className="command-entry__brand-mark">V</span>
          <span>
            <strong>VYNDI</strong>
            <small>VĀYÚ SHASTR PRIVATE LIMITED</small>
          </span>
        </Link>
        <div className="command-entry__system">
          <span className="command-entry__status-dot" />
          COMMAND SYSTEM · SECURE
        </div>
      </header>

      <section className="command-entry__stage">
        <div className="command-entry__story">
          <p className="command-entry__kicker">ENGINEERED IN INDIA · BUILT FOR DISTANCE</p>
          <h1>
            Precision,
            <span> without noise.</span>
          </h1>
          <p className="command-entry__story-copy">
            Enter the operating environment behind VYNDI — where product engineering,
            configuration, commercial control and execution converge.
          </p>
          <div className="command-entry__signature" aria-hidden="true">
            <span>01</span>
            <div />
            <p>CARBON PERFORMANCE SYSTEMS</p>
          </div>
        </div>

        <section className="command-entry__panel" aria-label="VYNDI Command Centre sign in">
          <div className="command-entry__panel-head">
            <p className="command-entry__eyebrow">COMMAND CENTRE</p>
            <p className="command-entry__panel-index">ACCESS / 01</p>
          </div>
          <h2>Authorised entry</h2>
          <p className="command-entry__intro">
            Sign in with your individual VYNDI identity.
          </p>

          {search.created ? (
            <p className="command-entry__success">
              Account created successfully. Use the new credentials to continue.
            </p>
          ) : null}

          <form onSubmit={submit} className="command-entry__form">
            <label>
              <span>Email address</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </label>

            {error && (
              <p role="alert" className="command-entry__error">
                {error}
              </p>
            )}

            <button disabled={busy || granted}>
              <span>{granted ? "ACCESS GRANTED" : busy ? "AUTHENTICATING" : "ENTER COMMAND CENTRE"}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="command-entry__trust">
            <span>Individual authority</span>
            <span>Protected session</span>
            <span>RBAC enforced</span>
          </div>

          <Link to="/" className="command-entry__back">
            Return to VYNDI
          </Link>
        </section>
      </section>

      <footer className="command-entry__footer">
        <span>VYNDI / VĀYÚ SHASTR</span>
        <span>PERFORMANCE · ENGINEERING · CONTROL</span>
      </footer>
    </main>
  );
}
