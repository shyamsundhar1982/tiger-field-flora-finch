import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import "../login-rev1.css";

type LoginSearch = {
  returnTo?: string;
  email?: string;
  created?: boolean;
};

type SceneControls = {
  startWarp: () => Promise<void>;
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
  const [bootMessage, setBootMessage] = useState<string | null>(null);
  const [introVisible, setIntroVisible] = useState(true);
  const [cinematic, setCinematic] = useState(false);
  const [warping, setWarping] = useState(false);
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLFormElement>(null);
  const sceneControlsRef = useRef<SceneControls | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIntroVisible(false);
      setCinematic(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setIntroVisible(false);
      setCinematic(true);
    }, 3300);
    return () => window.clearTimeout(timer);
  }, []);

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
        scene.fog = new THREE.FogExp2(0x030508, 0.02);
        const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
        camera.position.set(0, 3.4, 26);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.setAttribute("aria-hidden", "true");
        container.replaceChildren(renderer.domElement);

        scene.add(new THREE.AmbientLight(0x252b30, 1.35));
        const keyLight = new THREE.PointLight(0xff7417, 1.55, 140);
        keyLight.position.set(0, 16, 14);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0x7fff00, 1.15, 160);
        rimLight.position.set(-26, 4, -18);
        scene.add(rimLight);
        const fillLight = new THREE.PointLight(0xdff4ff, 0.55, 110);
        fillLight.position.set(18, 8, 4);
        scene.add(fillLight);

        function makeCarbonTexture(repX: number, repY: number) {
          const size = 256;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d");
          if (!context) return null;
          context.fillStyle = "#06080b";
          context.fillRect(0, 0, size, size);
          const cells = 8;
          const cell = size / cells;
          for (let row = 0; row < cells; row++) {
            for (let col = 0; col < cells; col++) {
              const horizontal = (row + col) % 2 === 0;
              const gradient = horizontal
                ? context.createLinearGradient(0, row * cell, 0, (row + 1) * cell)
                : context.createLinearGradient(col * cell, 0, (col + 1) * cell, 0);
              gradient.addColorStop(0, "#04060a");
              gradient.addColorStop(0.42, "#1b2229");
              gradient.addColorStop(0.55, "#343d45");
              gradient.addColorStop(1, "#04060a");
              context.fillStyle = gradient;
              context.fillRect(col * cell, row * cell, cell, cell);
              context.strokeStyle = "rgba(0,0,0,.5)";
              context.lineWidth = 1;
              for (let fiber = 1; fiber < 4; fiber++) {
                context.beginPath();
                if (horizontal) {
                  context.moveTo(col * cell, row * cell + (fiber * cell) / 4);
                  context.lineTo((col + 1) * cell, row * cell + (fiber * cell) / 4);
                } else {
                  context.moveTo(col * cell + (fiber * cell) / 4, row * cell);
                  context.lineTo(col * cell + (fiber * cell) / 4, (row + 1) * cell);
                }
                context.stroke();
              }
            }
          }
          const sheen = context.createLinearGradient(0, 0, size, size);
          sheen.addColorStop(0, "rgba(255,116,23,0)");
          sheen.addColorStop(0.47, "rgba(255,116,23,.08)");
          sheen.addColorStop(0.56, "rgba(127,255,0,.035)");
          sheen.addColorStop(1, "rgba(127,255,0,0)");
          context.fillStyle = sheen;
          context.fillRect(0, 0, size, size);
          const texture = new THREE.CanvasTexture(canvas);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(repX, repY);
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          return texture;
        }

        const carbonBase = makeCarbonTexture(1, 1);
        const carbonMaterial = (length: number) => {
          const texture = carbonBase?.clone();
          if (texture) {
            texture.needsUpdate = true;
            texture.repeat.set(Math.max(2, Math.round(length * 2.2)), Math.max(1, Math.round(length * 1.6)));
          }
          return new THREE.MeshPhysicalMaterial({
            ...(texture ? { map: texture } : {}),
            color: 0xbfc8d4,
            roughness: 0.34,
            metalness: 0.55,
            clearcoat: 1,
            clearcoatRoughness: 0.24,
          });
        };

        const strandCount = 700;
        const strandPositions = new Float32Array(strandCount * 6);
        const strandSpeed = new Float32Array(strandCount);
        const strandLength = new Float32Array(strandCount);
        for (let i = 0; i < strandCount; i++) {
          const x = (Math.random() - 0.5) * 180;
          const y = (Math.random() - 0.5) * 70;
          const z = (Math.random() - 0.5) * 120;
          const length = 1.5 + Math.random() * 4;
          strandPositions[i * 6] = x;
          strandPositions[i * 6 + 1] = y;
          strandPositions[i * 6 + 2] = z;
          strandPositions[i * 6 + 3] = x + length;
          strandPositions[i * 6 + 4] = y;
          strandPositions[i * 6 + 5] = z;
          strandSpeed[i] = 0.25 + Math.random() * 0.9;
          strandLength[i] = length;
        }
        const strandGeometry = new THREE.BufferGeometry();
        strandGeometry.setAttribute("position", new THREE.BufferAttribute(strandPositions, 3));
        const strandMaterial = new THREE.LineBasicMaterial({ color: 0x64717a, transparent: true, opacity: 0.44 });
        const strands = new THREE.LineSegments(strandGeometry, strandMaterial);
        scene.add(strands);

        const sheetGeometry = new THREE.PlaneGeometry(44, 9, 140, 10);
        const sheetBase = sheetGeometry.attributes.position.array.slice();
        const sheetTexture = carbonBase?.clone();
        if (sheetTexture) {
          sheetTexture.needsUpdate = true;
          sheetTexture.repeat.set(12, 2);
        }
        const sheetMaterial = new THREE.MeshPhysicalMaterial({
          ...(sheetTexture ? { map: sheetTexture } : {}),
          color: 0xaeb9c6,
          roughness: 0.32,
          metalness: 0.58,
          clearcoat: 1,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.93,
        });
        const sheet = new THREE.Mesh(sheetGeometry, sheetMaterial);
        sheet.position.set(0, 2.2, 9);
        scene.add(sheet);

        const bike = new THREE.Group();
        const tube = (p1: any, p2: any, radius: number, material?: any) => {
          const direction = new THREE.Vector3().subVectors(p2, p1);
          const length = direction.length();
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 20, 1), material ?? carbonMaterial(length));
          mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
          bike.add(mesh);
          return mesh;
        };
        const vector = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
        const bb = vector(0, 0);
        const ht = vector(1.1, 1.3);
        const hb = vector(1, 1.02);
        const st = vector(-0.22, 1.42);
        const rearAxle = vector(-1.38, 0);
        const frontAxle = vector(1.62, 0);
        tube(bb, st, 0.055);
        tube(ht, st, 0.05);
        tube(hb, bb, 0.068);
        tube(hb, ht, 0.075);
        tube(vector(0, 0, -0.06), vector(-1.38, 0, -0.06), 0.032);
        tube(vector(0, 0, 0.06), vector(-1.38, 0, 0.06), 0.032);
        tube(vector(-0.22, 1.42, -0.06), vector(-1.38, 0, -0.06), 0.026);
        tube(vector(-0.22, 1.42, 0.06), vector(-1.38, 0, 0.06), 0.026);
        tube(vector(1, 1.02, -0.07), vector(1.62, 0, -0.07), 0.038);
        tube(vector(1, 1.02, 0.07), vector(1.62, 0, 0.07), 0.038);
        tube(st, vector(-0.26, 1.6), 0.028);
        tube(ht, vector(1.18, 1.48), 0.03);
        tube(vector(1.18, 1.48, -0.3), vector(1.18, 1.48, 0.3), 0.026);

        const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0xff7417, wireframe: true, transparent: true, opacity: 0.09 });
        tube(bb, st, 0.075, ghostMaterial);
        tube(ht, st, 0.068, ghostMaterial);
        tube(hb, bb, 0.086, ghostMaterial);

        const addWheel = (axle: any) => {
          const wheel = new THREE.Group();
          wheel.position.copy(axle);
          const rim = new THREE.Mesh(
            new THREE.TorusGeometry(0.72, 0.045, 14, 60),
            new THREE.MeshStandardMaterial({ color: 0x141a22, metalness: 0.9, roughness: 0.28 }),
          );
          wheel.add(rim);
          bike.add(wheel);
          return wheel;
        };
        const frontWheel = addWheel(frontAxle);
        const rearWheel = addWheel(rearAxle);
        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(2.5, 2.7, 0.1, 48),
          new THREE.MeshPhysicalMaterial({ color: 0x20272d, roughness: 0.35, metalness: 0.62, clearcoat: 1 }),
        );
        platform.position.y = -0.85;
        bike.add(platform);
        const platformRing = new THREE.Mesh(
          new THREE.TorusGeometry(2.6, 0.02, 8, 80),
          new THREE.MeshBasicMaterial({ color: 0x7fff00, transparent: true, opacity: 0.48 }),
        );
        platformRing.rotation.x = Math.PI / 2;
        platformRing.position.y = -0.79;
        bike.add(platformRing);
        bike.position.set(0, 0.95, -0.5);
        bike.rotation.y = -0.5;
        scene.add(bike);

        let mode: "terminal" | "warp" = "terminal";
        let strandBoost = 1;
        let mouseX = 0;
        let mouseY = 0;
        let targetMouseX = 0;
        let targetMouseY = 0;
        let last = performance.now();
        let warpStart = 0;
        let resolveWarp: (() => void) | null = null;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const pointerMove = (event: globalThis.MouseEvent) => {
          targetMouseX = (event.clientX / window.innerWidth - 0.5) * 2;
          targetMouseY = (event.clientY / window.innerHeight - 0.5) * 2;
        };
        window.addEventListener("mousemove", pointerMove);

        sceneControlsRef.current = {
          startWarp: () => {
            if (reducedMotion) return Promise.resolve();
            mode = "warp";
            strandBoost = 15;
            warpStart = performance.now();
            return new Promise<void>((resolve) => {
              resolveWarp = resolve;
            });
          },
        };

        const animate = (now: number) => {
          if (disposed) return;
          raf = requestAnimationFrame(animate);
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          const time = now / 1000;
          mouseX += (targetMouseX - mouseX) * 0.05;
          mouseY += (targetMouseY - mouseY) * 0.05;

          if (!reducedMotion) {
            for (let i = 0; i < strandCount; i++) {
              let x = strandPositions[i * 6] + strandSpeed[i] * strandBoost;
              if (x > 90) {
                x = -90;
                const y = (Math.random() - 0.5) * 70;
                const z = (Math.random() - 0.5) * 120;
                strandPositions[i * 6 + 1] = y;
                strandPositions[i * 6 + 4] = y;
                strandPositions[i * 6 + 2] = z;
                strandPositions[i * 6 + 5] = z;
              }
              strandPositions[i * 6] = x;
              strandPositions[i * 6 + 3] = x + strandLength[i];
            }
            strandGeometry.attributes.position.needsUpdate = true;

            const position = sheetGeometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
              const baseX = sheetBase[i * 3];
              const baseY = sheetBase[i * 3 + 1];
              const angle = baseX * 0.22 + time * 0.7;
              position.array[i * 3 + 1] = baseY * Math.cos(angle);
              position.array[i * 3 + 2] = baseY * Math.sin(angle) * 0.8;
            }
            position.needsUpdate = true;
            sheetGeometry.computeVertexNormals();
            sheet.rotation.z = Math.sin(time * 0.18) * 0.08;
            bike.position.y = 0.95 + Math.sin(time * 0.9) * 0.05;
            frontWheel.rotation.z -= dt * 2.2;
            rearWheel.rotation.z -= dt * 2.2;
            platformRing.material.opacity = 0.34 + Math.sin(time * 2.2) * 0.18;
            keyLight.intensity = 1.45 + Math.sin(time * 2.1) * 0.24;
          }

          if (mode === "terminal") {
            const targetX = mouseX * 3.5 + Math.sin(time * 0.12) * 1.1;
            const targetY = 3.4 - mouseY * 2.2;
            camera.position.x += (targetX - camera.position.x) * 0.05;
            camera.position.y += (targetY - camera.position.y) * 0.05;
            camera.position.z += (26 - camera.position.z) * 0.05;
            camera.fov += (62 - camera.fov) * 0.12;
            camera.lookAt(0, 1.9, -4);
          } else {
            const elapsed = Math.min((now - warpStart) / 1150, 1);
            const eased = elapsed * elapsed * elapsed;
            camera.position.set(0, 3.4 - eased * 1.25, 26 - eased * 20.4);
            camera.fov = 62 + eased * 40;
            camera.lookAt(0, 1.4, -8);
            sheet.position.z = 9 - eased * 5.5;
            if (elapsed >= 1 && resolveWarp) {
              const resolve = resolveWarp;
              resolveWarp = null;
              resolve();
            }
          }

          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };

        const resize = () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener("resize", resize);
        raf = requestAnimationFrame(animate);

        cleanup = () => {
          sceneControlsRef.current = null;
          window.removeEventListener("mousemove", pointerMove);
          window.removeEventListener("resize", resize);
          cancelAnimationFrame(raf);
          scene.traverse((object: any) => {
            object.geometry?.dispose?.();
            if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.());
            else object.material?.dispose?.();
          });
          carbonBase?.dispose?.();
          sheetTexture?.dispose?.();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        sceneControlsRef.current = { startWarp: () => Promise.resolve() };
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  function beginCinematic() {
    setIntroVisible(false);
    setCinematic(true);
  }

  function tiltCard(event: ReactMouseEvent<HTMLFormElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = cardRef.current;
    if (!card || busy || warping) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  }

  function resetCardTilt() {
    if (cardRef.current) cardRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setBootMessage("Verifying credentials");

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
        setBootMessage(null);
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
      setBootMessage("Clearance granted · session sealed");
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      setBootMessage(null);
      setWarping(true);
      await (sceneControlsRef.current?.startWarp() ?? Promise.resolve());
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      await navigate({ to: destination as never });
    } catch (cause) {
      setGranted(false);
      setWarping(false);
      setBootMessage(null);
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  const classes = ["vy-login", cinematic ? "is-cinematic" : "", granted ? "is-granted" : "", warping ? "is-warping" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={classes}>
      <div ref={sceneHostRef} className="vy-login__scene" aria-hidden="true" />
      <div className="vy-login__vignette" aria-hidden="true" />
      <div className="vy-login__scanlines" aria-hidden="true" />
      <div className="vy-login__grain" aria-hidden="true" />
      <div className="vy-login__bar vy-login__bar--top" aria-hidden="true" />
      <div className="vy-login__bar vy-login__bar--bottom" aria-hidden="true" />
      <div className="vy-login__warp" aria-hidden="true" />
      <div className="vy-login__flash" aria-hidden="true" />

      <section className={`vy-login__intro ${introVisible ? "" : "is-gone"}`} aria-label="VYNDI introduction">
        <div className="vy-login__intro-company">VĀYÚ <strong>SHASTR</strong> PVT. LTD.</div>
        <div className="vy-login__intro-sub">Advanced Carbon Composite Division</div>
        <div className="vy-login__intro-brand">VYNDI</div>
        <div className="vy-login__intro-tag">Wind — Rendered in Carbon</div>
        <button type="button" className="vy-login__skip" onClick={beginCinematic}>Skip Intro</button>
      </section>

      <div className="vy-login__corner vy-login__corner--tl" aria-hidden="true" />
      <div className="vy-login__corner vy-login__corner--tr" aria-hidden="true" />
      <div className="vy-login__corner vy-login__corner--bl" aria-hidden="true" />
      <div className="vy-login__corner vy-login__corner--br" aria-hidden="true" />

      <header className="vy-login__header">
        <div className="vy-login__brand">
          <div className="vy-login__brand-mark" aria-hidden="true"><span>VY</span></div>
          <div className="vy-login__brand-copy">
            <strong>VĀYÚ SHASTR</strong>
            <small>Advanced Carbon Composite Division</small>
          </div>
        </div>
        <div className="vy-login__status"><span className="vy-login__status-dot" />Governed System · Online</div>
      </header>

      <div className="vy-login__main">
        <section className="vy-login__welcome" aria-label="VYNDI Command Centre">
          <div className="vy-login__eyebrow">Secure Access · VYNDI Operating System</div>
          <h1>WIND<span className="vy-login__tagline">— RENDERED IN CARBON —</span></h1>
          <p className="vy-login__desc">
            Enter the governed VYNDI business operating system for engineering, planning, supply and production, commercial, finance, and governance.
          </p>
          <div className="vy-login__metrics" aria-label="System scope">
            <div className="vy-login__metric"><strong>36</strong><span>Month Master Plan</span></div>
            <div className="vy-login__metric"><strong>7</strong><span>Core Workspaces</span></div>
            <div className="vy-login__metric"><strong>RBAC</strong><span>Access Control</span></div>
          </div>
        </section>

        <div className="vy-login__login-wrap">
          <form
            ref={cardRef}
            onSubmit={submit}
            onMouseMove={tiltCard}
            onMouseLeave={resetCardTilt}
            className="vy-login__card"
            aria-label="VYNDI Command Centre sign in"
          >
            <div className="vy-login__card-tag">Controlled Access</div>
            <h2>AUTHENTICATE</h2>
            <p className="vy-login__card-sub">VYNDI Program Access</p>

            {search.created ? <p className="vy-login__success">Account created successfully. Sign in with the new credentials.</p> : null}
            {error ? <p role="alert" className="vy-login__error">{error}</p> : null}

            <div className="vy-login__field">
              <Mail aria-hidden="true" />
              <input
                id="vyndi-email"
                required
                type="email"
                autoComplete="email"
                placeholder=" "
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="vyndi-email">Authorised Email</label>
            </div>

            <div className="vy-login__field">
              <LockKeyhole aria-hidden="true" />
              <input
                id="vyndi-password"
                required
                type="password"
                autoComplete="current-password"
                placeholder=" "
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <label htmlFor="vyndi-password">Password</label>
            </div>

            <div className="vy-login__access-note"><span>Individual authority</span><span>RBAC enforced</span></div>

            <button className="vy-login__launch" disabled={busy || warping} aria-busy={busy || warping}>
              {granted ? "Clearance Granted" : busy ? "Authorizing" : "Authorize · Enter Command"}
            </button>

            <div className="vy-login__secure"><ShieldCheck aria-hidden="true" />Session protected · governed access</div>
            <Link to="/" className="vy-login__back">Return to VYNDI</Link>
          </form>
        </div>
      </div>

      {bootMessage ? (
        <div className="vy-login__boot" role="status" aria-live="polite">
          <div className="vy-login__boot-ring" aria-hidden="true" />
          <p>{bootMessage}</p>
        </div>
      ) : null}
    </main>
  );
}
