import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useRef, useState } from "react";

type LoginSearch = {
  returnTo?: string;
  email?: string;
  created?: boolean;
};

type WelcomePhase = "idle" | "appear" | "disperse";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    created: search.created === true || search.created === "true" || search.created === "1",
  }),
  component: LoginPage,
});

const BEARER_KEY = "grok-auth.bearer-token";
const THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

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

function ensureThreeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as typeof window & { THREE?: unknown }).THREE) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${THREE_CDN}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load visual engine.")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = THREE_CDN;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load visual engine.")), { once: true });
    document.head.appendChild(script);
  });
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<WelcomePhase>("idle");
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const travelSpeedRef = useRef(0.012);

  useEffect(() => {
    const host = sceneHostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    void ensureThreeScript()
      .then(() => {
        if (disposed || !sceneHostRef.current) return;
        const THREE = (window as typeof window & { THREE?: any }).THREE;
        if (!THREE) return;

        const container = sceneHostRef.current;
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x010208, 0.012);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
        camera.position.set(0, 1.8, 28);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.setAttribute("aria-hidden", "true");
        container.replaceChildren(renderer.domElement);

        const resources: Array<{ dispose?: () => void }> = [];

        function createRing(innerRadius: number, outerRadius: number, particleCount: number, color: number, opacity: number) {
          const positions = new Float32Array(particleCount * 3);
          const colors = new Float32Array(particleCount * 3);
          const colorObj = new THREE.Color(color);

          for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
            const y = (Math.random() - 0.5) * 0.35;
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            const variation = 0.75 + Math.random() * 0.25;
            colors[i * 3] = colorObj.r * variation;
            colors[i * 3 + 1] = colorObj.g * variation;
            colors[i * 3 + 2] = colorObj.b * variation;
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          const material = new THREE.PointsMaterial({
            size: 0.045,
            vertexColors: true,
            transparent: true,
            opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
          });
          resources.push(geometry, material);
          return new THREE.Points(geometry, material);
        }

        const ringGroup = new THREE.Group();
        ringGroup.rotation.x = 0.38;
        ringGroup.add(createRing(6.5, 9.8, 9000, 0x66e0ff, 0.75));
        ringGroup.add(createRing(11.2, 15.5, 11000, 0x44ccff, 0.65));
        ringGroup.add(createRing(16.2, 19.5, 5000, 0x2288cc, 0.4));
        scene.add(ringGroup);

        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(1200 * 3);
        for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 300;
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        const starMaterial = new THREE.PointsMaterial({
          color: 0xaaccff,
          size: 0.15,
          transparent: true,
          opacity: 0.6,
        });
        resources.push(starGeo, starMaterial);
        scene.add(new THREE.Points(starGeo, starMaterial));

        let travelProgress = 0;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const animate = () => {
          if (disposed) return;
          if (!reducedMotion) raf = requestAnimationFrame(animate);
          ringGroup.rotation.y += reducedMotion ? 0 : 0.0009;
          travelProgress += reducedMotion ? 0 : travelSpeedRef.current;
          camera.position.z = 28 - travelProgress * 1.15;
          camera.position.y = 1.8 + Math.sin(travelProgress * 0.3) * 0.45;
          camera.lookAt(0, 0, camera.position.z - 14);
          camera.rotation.z = Math.sin(travelProgress * 0.22) * 0.05;
          renderer.render(scene, camera);
        };

        const resize = () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener("resize", resize);
        animate();

        cleanup = () => {
          window.removeEventListener("resize", resize);
          cancelAnimationFrame(raf);
          for (const resource of resources) resource.dispose?.();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        // CSS background remains as a graceful fallback if the visual engine cannot load.
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
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
        // Embedded previews use the bearer token above; deployed hosts use their first-party HttpOnly cookie.
      }

      const destination = safeReturnTo(search.returnTo);
      setGranted(true);
      setWelcomePhase("appear");
      await new Promise((resolve) => window.setTimeout(resolve, 3200));
      travelSpeedRef.current = 0.085;
      setWelcomePhase("disperse");
      await new Promise((resolve) => window.setTimeout(resolve, 1700));
      await navigate({ to: destination as never });
    } catch (cause) {
      setGranted(false);
      setWelcomePhase("idle");
      travelSpeedRef.current = 0.012;
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`command-entry ${granted ? "command-entry--granted" : ""}`}>
      <div ref={sceneHostRef} className="command-entry__scene" aria-hidden="true" />
      <div className="command-entry__vignette" aria-hidden="true" />

      <div className="command-entry__hud command-entry__hud--top">
        VYNDI <span>·</span> VĀYÚ SHASTR PRIVATE LIMITED
      </div>

      <section className="command-entry__panel" aria-label="VYNDI Command Centre sign in">
        <p className="command-entry__eyebrow">COMMAND CENTRE</p>
        <p className="command-entry__legal">VĀYÚ SHASTR PRIVATE LIMITED</p>
        <h1>Authorised Entry</h1>
        <p className="command-entry__intro">Authenticate your individual authority to enter the VYNDI operating system.</p>

        {search.created ? (
          <p className="command-entry__success">Account created successfully. Sign in with the new credentials to continue.</p>
        ) : null}

        <form onSubmit={submit} className="command-entry__form">
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p role="alert" className="command-entry__error">{error}</p> : null}
          <button disabled={busy || granted}>
            {granted ? "ACCESS GRANTED" : busy ? "AUTHORIZING…" : "AUTHORIZE ACCESS"}
          </button>
        </form>

        <p className="command-entry__note">Individual authority · Session protected · RBAC enforced</p>
        <Link to="/" className="command-entry__back">← Return to VYNDI</Link>
      </section>

      <div className={`command-entry__welcome ${welcomePhase === "appear" ? "appear" : ""} ${welcomePhase === "disperse" ? "disperse" : ""}`} aria-live="polite">
        Welcome to the Command Centre
        <span>Vāyú Shastr</span>
      </div>
    </main>
  );
}
