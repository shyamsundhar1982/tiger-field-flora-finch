import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/command/engineering-cad-rev-5-2")({
  component: EngineeringCadRev52,
});

function EngineeringCadRev52() {
  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          Engineering reference · historical / pre-DSS+
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-accent">VEDM-301 Rev 5.2 CAD / GA Drawing</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
              Five-sheet XS–XL general-arrangement reference for the conventional upper seat-cluster
              seatstay architecture. Dimension text is sourced from VEDM-301 Rev 5.2; the graphic is NTS.
              Rev 5.3.8 remains the later controlling geometry master.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <Link to="/command/engineering" className="text-accent">← Engineering</Link>
            <a
              href="/engineering/VEDM-301-Rev-5.2-Conventional-Seatstay-GA.html"
              target="_blank"
              rel="noreferrer"
              className="text-accent"
            >
              Open print-ready drawing ↗
            </a>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <iframe
          title="VEDM-301 Rev 5.2 conventional-seatstay general arrangement"
          src="/engineering/VEDM-301-Rev-5.2-Conventional-Seatstay-GA.html"
          className="h-[78vh] min-h-[760px] w-full border-0 bg-white"
        />
      </section>

      <p className="text-xs leading-5 text-muted">
        Offline copy: <code>public/offline-preview.html</code>. Fork offset remains proposed in the source;
        the schematic fork leg does not establish axle-to-crown or tooling geometry.
      </p>
    </div>
  );
}
