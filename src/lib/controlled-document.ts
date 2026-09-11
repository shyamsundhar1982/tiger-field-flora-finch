export type ControlledDocumentField = {
  label: string;
  value: unknown;
};

export type ControlledDocumentTable = {
  title?: string;
  columns: string[];
  rows: unknown[][];
};

export type ControlledDocumentSection = {
  title: string;
  text?: string;
  fields?: ControlledDocumentField[];
  table?: ControlledDocumentTable;
};

export type ControlledDocumentOptions = {
  title: string;
  recordType: string;
  status?: string;
  authority?: string;
  sourceReference?: string;
  subtitle?: string;
  fields?: ControlledDocumentField[];
  lineage?: ControlledDocumentField[];
  sections?: ControlledDocumentSection[];
  orientation?: "portrait" | "landscape";
};

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generatedAt() {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function renderFields(fields: ControlledDocumentField[] = []) {
  if (!fields.length) return "";
  return `<section class="fields">${fields
    .map(
      (field) =>
        `<div><span class="label">${escapeHtml(field.label)}</span><span class="value">${escapeHtml(field.value)}</span></div>`,
    )
    .join("")}</section>`;
}

function renderTable(table?: ControlledDocumentTable) {
  if (!table) return "";
  const heading = table.title ? `<h3>${escapeHtml(table.title)}</h3>` : "";
  const head = table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = table.rows.length
    ? table.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td colspan="${Math.max(table.columns.length, 1)}">No persisted record for this stage.</td></tr>`;
  return `${heading}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderSections(sections: ControlledDocumentSection[] = []) {
  return sections
    .map(
      (section) => `<section class="section">
        <h3>${escapeHtml(section.title)}</h3>
        ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
        ${renderFields(section.fields)}
        ${renderTable(section.table)}
      </section>`,
    )
    .join("");
}

export function printControlledDocument(options: ControlledDocumentOptions) {
  const printWindow = window.open("", "_blank", "width=1180,height=860");
  if (!printWindow) {
    throw new Error("The controlled document window was blocked. Allow pop-ups for VYNDI and try again.");
  }
  printWindow.opener = null;

  const route = `${window.location.pathname}${window.location.search}`;
  const authority = options.authority || "VYNDI Business Operator";
  const sourceReference = options.sourceReference || route;
  const orientation = options.orientation || "portrait";
  const status = (options.status || "CONTROLLED RECORD").replaceAll("_", " ").toUpperCase();

  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)} · VYNDI</title>
  <style>
    @page { size: A4 ${orientation}; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #171717; font-family: Arial, Helvetica, sans-serif; font-size: 9px; }
    .sheet { width: 100%; }
    .brand { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
    .brand h1 { margin: 0; font-size: 22px; letter-spacing: .06em; }
    .company { margin-top: 3px; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .document { text-align: right; }
    .document h2 { margin: 0; font-size: 15px; }
    .document p { margin: 3px 0 0; color: #555; }
    .status { display: inline-block; margin-top: 5px; padding: 3px 7px; border: 1px solid #555; border-radius: 999px; font-size: 7px; font-weight: 700; letter-spacing: .08em; }
    .fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #bbb; margin: 0 0 10px; }
    .fields > div { min-height: 42px; padding: 6px 7px; border-right: 1px solid #ddd; border-bottom: 1px solid #ddd; }
    .fields > div:nth-child(4n) { border-right: 0; }
    .label { display: block; color: #666; font-size: 7px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 3px; }
    .value { display: block; font-size: 9px; font-weight: 700; overflow-wrap: anywhere; }
    .lineage { margin: 8px 0 12px; padding-top: 7px; border-top: 1px solid #bbb; }
    .lineage h3, .section h3 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
    .section { break-inside: auto; margin: 12px 0; }
    .section p { margin: 0 0 7px; color: #444; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; margin: 6px 0 10px; font-size: 8px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { border: 1px solid #bbb; padding: 4px 5px; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
    th { background: #f2f2f2; font-size: 7px; letter-spacing: .04em; text-transform: uppercase; }
    .authority { margin-top: 12px; padding: 7px 8px; border: 1px solid #bbb; color: #444; line-height: 1.45; }
    .footer { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #bbb; margin-top: 10px; padding-top: 6px; color: #666; font-size: 7px; }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="brand">
      <div><h1>VYNDI</h1><div class="company">Vāyú Shastr Pvt Ltd · Controlled Business Record</div></div>
      <div class="document"><h2>${escapeHtml(options.recordType)}</h2><p><strong>${escapeHtml(options.title)}</strong></p><span class="status">${escapeHtml(status)}</span></div>
    </section>
    ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ""}
    ${renderFields(options.fields)}
    ${options.lineage?.length ? `<section class="lineage"><h3>Digital thread / lineage</h3>${renderFields(options.lineage)}</section>` : ""}
    ${renderSections(options.sections)}
    <section class="authority"><strong>Authority:</strong> ${escapeHtml(authority)}<br /><strong>Source / evidence:</strong> ${escapeHtml(sourceReference)}<br /><strong>Generated:</strong> ${escapeHtml(generatedAt())} IST<br /><strong>Control rule:</strong> Electronic VYNDI system record is authoritative. Printed copy is uncontrolled unless specifically issued as a controlled copy.</section>
    <footer class="footer"><span>${escapeHtml(options.title)} · ${escapeHtml(route)}</span><span>VYNDI · Vāyú Shastr Pvt Ltd</span></footer>
  </main>
  <script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),80)});window.addEventListener("afterprint",()=>window.close(),{once:true});</script>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
}
