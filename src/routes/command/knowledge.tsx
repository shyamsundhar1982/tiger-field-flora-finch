import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/kpi";
import {
  ALL_KNOWLEDGE,
  KNOWLEDGE_STATUS_LABELS,
  knowledgeSummary,
} from "@/lib/data/knowledge";
import {
  listVibpeWeeklyReviewKnowledge,
  refreshVibpeWeeklyReviewsFromDrive,
} from "@/lib/vibpe-weekly-review-knowledge";
import { listVayuShastrKnowledge, refreshVayuShastrDrive } from "@/lib/vibpe-vayu-shastr-drive";

export const Route = createFileRoute("/command/knowledge")({ component: Knowledge });

function Knowledge() {
  const summary = knowledgeSummary();
  const [reviewDocs, setReviewDocs] = useState<Array<{
    document_id: string;
    title: string;
    review_date: string | null;
    source_revision: string | null;
    external_url: string | null;
    ingested_at: string;
    claim_count: number;
    unresolved_count: number;
  }>>([]);
  const [reviewStatus, setReviewStatus] = useState("Loading governed review evidence…");
  const [refreshing, setRefreshing] = useState(false);
  const [vayuRefreshing, setVayuRefreshing] = useState(false);
  const [vayuStatus, setVayuStatus] = useState("Loading Vāyu Shastr Drive corpus…");
  const [vayuDocs, setVayuDocs] = useState<Array<{
    document_id: string;
    title: string;
    external_url: string | null;
    source_revision: string | null;
    ingested_at: string;
    claim_count: number;
    unresolved_count: number;
    path: string | null;
    knowledge_tier: string | null;
    binary_metadata_only: string | null;
  }>>([]);

  const loadReviewEvidence = useCallback(async () => {
    try {
      const rows = await listVibpeWeeklyReviewKnowledge();
      setReviewDocs(rows);
      setReviewStatus(rows.length ? `${rows.length} active review document${rows.length === 1 ? "" : "s"}` : "No review evidence ingested yet");
    } catch (error) {
      setReviewStatus(error instanceof Error ? error.message : "Unable to read review evidence");
    }
  }, []);

  const loadVayuEvidence = useCallback(async () => {
    try {
      const rows = await listVayuShastrKnowledge();
      setVayuDocs(rows);
      const controlled = rows.filter((row) => row.knowledge_tier === "controlled-reference").length;
      const metadataOnly = rows.filter((row) => row.binary_metadata_only === "true").length;
      setVayuStatus(`${rows.length} indexed files · ${controlled} controlled references · ${metadataOnly} metadata-only binaries`);
    } catch (error) {
      setVayuStatus(error instanceof Error ? error.message : "Unable to read Vāyu Shastr corpus");
    }
  }, []);

  useEffect(() => {
    void loadReviewEvidence();
    void loadVayuEvidence();
  }, [loadReviewEvidence, loadVayuEvidence]);
  // Founder-only records remain in the master register but are not rendered
  // in the general workspace until an authenticated founder view exists.
  const visibleRecords = ALL_KNOWLEDGE.filter((record) => record.sensitivity === "workspace");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Master control · Stage 2</p>
        <h1 className="font-display text-4xl">Knowledge base</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          One controlled view of the business baseline. Planning assumptions and unresolved engineering
          decisions are deliberately separated from confirmed evidence.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Records" value={summary.total} />
        <Stat label="Confirmed" value={summary.confirmed} />
        <Stat label="Planned" value={summary.planned} />
        <Stat label="Pending" value={summary.pending} />
        <Stat label="Conflicts" value={summary.conflict} />
      </div>

      <Panel title="Weekly review evidence" kicker={reviewStatus}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-sm text-muted">
            Google Drive weekly reviews are searchable VIBPE evidence. They remain advisory or unresolved and cannot override controlled master data.
          </p>
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              setReviewStatus("Refreshing Google Drive evidence…");
              try {
                const result = await refreshVibpeWeeklyReviewsFromDrive();
                setReviewStatus(`Drive refresh complete · ${result.scanned} document${result.scanned === 1 ? "" : "s"} scanned`);
                await loadReviewEvidence();
              } catch (error) {
                setReviewStatus(error instanceof Error ? error.message : "Google Drive refresh failed");
              } finally {
                setRefreshing(false);
              }
            }}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh Drive"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="py-3 pr-4">Review</th>
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Claims</th>
                <th className="py-3 pr-4">Unresolved</th>
                <th className="py-3 pr-4">Revision</th>
                <th className="py-3 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {reviewDocs.length ? reviewDocs.map((doc) => (
                <tr key={doc.document_id} className="border-b border-line/60 align-top">
                  <td className="py-3 pr-4 font-medium text-fg">{doc.title}</td>
                  <td className="py-3 pr-4 text-muted">{doc.review_date ?? "—"}</td>
                  <td className="py-3 pr-4 tabular-nums text-fg">{doc.claim_count}</td>
                  <td className="py-3 pr-4 tabular-nums text-fg">{doc.unresolved_count}</td>
                  <td className="py-3 pr-4 text-xs text-subtle">{doc.source_revision ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs">
                    {doc.external_url ? (
                      <a className="text-accent hover:underline" href={doc.external_url} target="_blank" rel="noreferrer">
                        Google Drive
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="py-4 text-sm text-subtle" colSpan={6}>{reviewStatus}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>


      <Panel title="Vāyu Shastr Drive corpus" kicker={vayuStatus}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-sm text-muted">
            Recursive governed reference access to the VAYU SHASTR Drive tree. Final-dossier/master-package paths are ranked as controlled references; legacy iterations are down-ranked. Secret and credential paths are excluded from ingestion.
          </p>
          <button
            type="button"
            disabled={vayuRefreshing}
            onClick={async () => {
              setVayuRefreshing(true);
              setVayuStatus("Refreshing Vāyu Shastr Drive corpus…");
              try {
                const result = await refreshVayuShastrDrive();
                setVayuStatus(`Drive refresh complete · ${result.scanned} scanned · ${result.excluded} excluded · ${result.claims} claims indexed`);
                await loadVayuEvidence();
              } catch (error) {
                setVayuStatus(error instanceof Error ? error.message : "Vāyu Shastr Drive refresh failed");
              } finally {
                setVayuRefreshing(false);
              }
            }}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {vayuRefreshing ? "Refreshing…" : "Refresh Vāyu Drive"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="py-3 pr-4">Tier</th>
                <th className="py-3 pr-4">Document</th>
                <th className="py-3 pr-4">Path</th>
                <th className="py-3 pr-4">Claims</th>
                <th className="py-3 pr-4">Unresolved</th>
                <th className="py-3 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {vayuDocs.length ? vayuDocs.slice(0, 100).map((doc) => (
                <tr key={doc.document_id} className="border-b border-line/60 align-top">
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-line px-2 py-1 text-xs text-fg">
                      {doc.knowledge_tier ?? "reference"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-medium text-fg">
                    {doc.title}
                    {doc.binary_metadata_only === "true" ? <span className="ml-2 text-xs text-subtle">metadata only</span> : null}
                  </td>
                  <td className="max-w-[420px] py-3 pr-4 text-xs text-subtle">{doc.path ?? "—"}</td>
                  <td className="py-3 pr-4 tabular-nums text-fg">{doc.claim_count}</td>
                  <td className="py-3 pr-4 tabular-nums text-fg">{doc.unresolved_count}</td>
                  <td className="py-3 pr-4 text-xs">
                    {doc.external_url ? (
                      <a className="text-accent hover:underline" href={doc.external_url} target="_blank" rel="noreferrer">
                        Google Drive
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              )) : (
                <tr><td className="py-4 text-sm text-subtle" colSpan={6}>{vayuStatus}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Controlled records" kicker={`${visibleRecords.length} workspace records · founder-only records withheld`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="py-3 pr-4">Domain</th>
                <th className="py-3 pr-4">Record</th>
                <th className="py-3 pr-4">Value</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id} className="border-b border-line/60 align-top">
                  <td className="py-3 pr-4 text-accent">{record.domain}</td>
                  <td className="py-3 pr-4 font-medium text-fg">{record.title}</td>
                  <td className="py-3 pr-4 text-muted">{record.value}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-line px-2 py-1 text-xs text-fg">
                      {KNOWLEDGE_STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-subtle">{record.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[11px] uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-2xl tabular-nums text-fg">{value}</p>
    </div>
  );
}
