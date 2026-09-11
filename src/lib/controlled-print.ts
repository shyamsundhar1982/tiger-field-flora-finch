export type ControlledPrintOptions = {
  title: string;
  recordType?: string;
  subtitle?: string;
  authority?: string;
  orientation?: "portrait" | "landscape";
  sourceReference?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(control: Element) {
  if (control instanceof HTMLSelectElement) {
    return control.selectedOptions[0]?.textContent?.trim() || control.value || "—";
  }
  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox" || control.type === "radio") return control.checked ? "Yes" : "No";
    return control.value || "—";
  }
  if (control instanceof HTMLTextAreaElement) return control.value || "—";
  return control.textContent?.trim() || "—";
}

function sanitiseClone(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement;

  const sourceControls = Array.from(source.querySelectorAll("input, select, textarea"));
  const cloneControls = Array.from(clone.querySelectorAll("input, select, textarea"));
  sourceControls.forEach((control, index) => {
    const target = cloneControls[index];
    if (!target) return;
    const span = document.createElement("span");
    span.className = "control-value";
    span.textContent = displayValue(control);
    target.replaceWith(span);
  });

  clone.querySelectorAll("details").forEach((detail) => detail.setAttribute("open", ""));
  clone.querySelectorAll('[data-print-exclude="true"], button, script, style, svg').forEach((node) => node.remove());
  clone.querySelectorAll("a").forEach((link) => {
    const span = document.createElement("span");
    span.textContent = link.textContent?.trim() || "";
    link.replaceWith(span);
  });

  clone.querySelectorAll("table").forEach((table) => {
    const headerRow = table.querySelector("thead tr");
    if (!headerRow) return;
    const removeIndexes = Array.from(headerRow.children)
      .map((cell, index) => ({ index, label: cell.textContent?.trim() || "" }))
      .filter(({ label }) => /^(action|actions|control|controls)$/i.test(label))
      .map(({ index }) => index)
      .sort((a, b) => b - a);
    if (!removeIndexes.length) return;
    table.querySelectorAll("tr").forEach((row) => {
      removeIndexes.forEach((index) => row.children[index]?.remove());
    });
  });

  return clone;
}

function formatGeneratedAt() {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export function printControlledElement(element: HTMLElement, options: ControlledPrintOptions) {
  const printWindow = window.open("", "_blank", "width=1180,height=860");
  if (!printWindow) {
    throw new Error("The controlled print window was blocked. Allow pop-ups for VYNDI and try again.");
  }
  printWindow.opener = null;

  const clone = sanitiseClone(element);
  const rowCount = clone.querySelectorAll("tbody tr").length;
  const route = `${window.location.pathname}${window.location.search}`;
  const generatedAt = formatGeneratedAt();
  const recordType = options.recordType || "Controlled Ledger / Register Extract";
  const authority = options.authority || "VYNDI Business Operator";
  const sourceReference = options.sourceReference || route;
  const orientation = options.orientation || "landscape";

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
    .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #bbb; margin-bottom: 10px; }
    .meta > div { padding: 6px 7px; border-right: 1px solid #ddd; min-height: 42px; }
    .meta > div:last-child { border-right: 0; }
    .label { display: block; color: #666; font-size: 7px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 3px; }
    .value { font-size: 9px; font-weight: 700; overflow-wrap: anywhere; }
    .extract { margin-top: 8px; }
    .extract section, .extract article, .extract details, .extract div { break-inside: auto; }
    .extract h1, .extract h2, .extract h3, .extract h4 { margin: 8px 0 5px; color: #111; font-family: Arial, Helvetica, sans-serif; }
    .extract h1 { font-size: 17px; } .extract h2 { font-size: 14px; } .extract h3 { font-size: 11px; }
    .extract p { margin: 3px 0 6px; color: #444; line-height: 1.35; }
    .extract table { width: 100%; border-collapse: collapse; table-layout: auto; margin: 6px 0 10px; font-size: 8px; }
    .extract thead { display: table-header-group; }
    .extract tr { break-inside: avoid; }
    .extract th, .extract td { border: 1px solid #bbb; padding: 4px 5px; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
    .extract th { background: #f2f2f2; font-size: 7px; letter-spacing: .04em; text-transform: uppercase; }
    .extract summary { font-weight: 700; margin: 7px 0 4px; }
    .extract .control-value { display: inline-block; min-width: 24px; padding: 2px 4px; border: 1px solid #ddd; background: #fafafa; }
    .extract [class*="grid"] { display: block !important; }
    .extract [class*="flex"] { display: block !important; }
    .extract [class*="overflow"] { overflow: visible !important; }
    .authority { margin-top: 10px; padding: 7px 8px; border: 1px solid #bbb; color: #444; line-height: 1.4; }
    .footer { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #bbb; margin-top: 10px; padding-top: 6px; color: #666; font-size: 7px; }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="brand">
      <div><h1>VYNDI</h1><div class="company">Vāyú Shastr Pvt Ltd · Controlled Business Record</div></div>
      <div class="document"><h2>${escapeHtml(recordType)}</h2><p><strong>${escapeHtml(options.title)}</strong></p></div>
    </section>
    <section class="meta">
      <div><span class="label">Record / ledger</span><span class="value">${escapeHtml(options.title)}</span></div>
      <div><span class="label">Authority</span><span class="value">${escapeHtml(authority)}</span></div>
      <div><span class="label">Rows represented</span><span class="value">${rowCount || "—"}</span></div>
      <div><span class="label">Generated</span><span class="value">${escapeHtml(generatedAt)} IST</span></div>
    </section>
    ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ""}
    <div class="extract">${clone.outerHTML}</div>
    <section class="authority"><strong>Source / extract reference:</strong> ${escapeHtml(sourceReference)}<br /><strong>Control rule:</strong> Electronic VYNDI system record is authoritative. Printed copy is uncontrolled unless specifically issued as a controlled copy.</section>
    <footer class="footer"><span>${escapeHtml(options.title)} · ${escapeHtml(route)}</span><span>VYNDI · Vāyú Shastr Pvt Ltd</span></footer>
  </main>
  <script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),80)});window.addEventListener("afterprint",()=>window.close(),{once:true});<\/script>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
}
