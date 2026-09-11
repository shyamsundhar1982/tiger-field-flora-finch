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
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [granted]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      // Keep the Better Auth client out of the server-render path. This page is
      // shared by Node/Vercel and Cloudflare Workers, while authentication itself
      // is only required after the browser submits the form.
      const { authClient } = await import("@/lib/auth/client");
      const normalizedEmail = email.trim().toLowerCase();
      const result = await authClient.signIn.email(
        { email: normalizedEmail, password },
        {
          onSuccess(ctx) {
            if (!window.location.hostname.endsWith(".grok-sandbox.com")) return;
            const token = ctx.response.headers.get("set-auth-token");
            if (token) window.sessionStorage.setItem(BEARER_KEY, token);
          },
        },
      );
      if (result.error) {
        setError(result.error.message ?? "Sign-in failed.");
        return;
      }
      try {
        await authClient.getSession();
      } catch {
        // The preview bearer is used only inside the embedded sandbox. Deployed
        // hosts authenticate through their first-party HttpOnly cookie.
      }

      const destination = safeReturnTo(search.returnTo);
      setGranted(true);
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      await navigate({ to: destination as never });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`command-entry ${granted ? "command-entry--granted" : ""}`}>
      <canvas ref={canvasRef} className="command-entry__canvas" aria-hidden="true" />
      <div className="command-entry__grid" aria-hidden="true" />
      <div className="command-entry__hud command-entry__hud--top">
        CARBON COMPOSITE SYSTEM <span>·</span> VYNDI OS
      </div>
      <div className="command-entry__hud command-entry__hud--bottom">
        STRUCTURAL ENGINEERING / CONFIGURATION CONTROL
      </div>
      <section className="command-entry__panel" aria-label="VYNDI Command Centre sign in">
        <p className="command-entry__eyebrow">
          VINDY <span>///</span> COMMAND CENTRE
        </p>
        <p className="command-entry__legal">VĀYÚ SHASTR PRIVATE LIMITED</p>
        <h1>Engineering Command Entry</h1>
        <p className="command-entry__intro">
          Authenticate your individual authority to enter the operating system.
        </p>
        {search.created ? (
          <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
            Account created successfully. Sign in with the new credentials to continue.
          </p>
        ) : null}
        <form onSubmit={submit} className="command-entry__form">
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="command-entry__error">
              {error}
            </p>
          )}
          <button disabled={busy || granted}>
            {granted ? "ACCESS GRANTED" : busy ? "AUTHORIZING…" : "AUTHORIZE ACCESS"}
          </button>
        </form>
        {granted ? (
          <p className="command-entry__welcome">WELCOME TO VYNDI COMMAND CENTRE</p>
        ) : (
          <p className="command-entry__note">
            Individual authority · Session protected · RBAC enforced
          </p>
        )}
        <Link to="/" className="command-entry__back">
          ← Return to VYNDI
        </Link>
      </section>
    </main>
  );
}
