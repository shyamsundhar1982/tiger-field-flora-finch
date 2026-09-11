import { useLocation } from "@tanstack/react-router";
import { FileStack, Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { printControlledDocument } from "@/lib/controlled-document";
import { listDispatchRegister } from "@/lib/dispatch-authority";
import { lakh } from "@/lib/format";
import { getOperatingLineage } from "@/lib/operating-lineage";
import { getProductionJobCardView } from "@/lib/production-job-card-view";
import { getPurchaseExecutionData, getReceivingData } from "@/lib/procure-to-pay-authority";
import { listQualityAuthority } from "@/lib/quality-authority";
import { listSalesOrders } from "@/lib/sales-order-authority";
import { listShipmentRevenueLedger } from "@/lib/shipment-authority";

type Row = Record<string, unknown>;
type ProductionData = Awaited<ReturnType<typeof getProductionJobCardView>>;
type PurchaseData = Awaited<ReturnType<typeof getPurchaseExecutionData>>;
type ReceivingData = Awaited<ReturnType<typeof getReceivingData>>;
type QualityData = Awaited<ReturnType<typeof listQualityAuthority>>;
type RevenueData = Awaited<ReturnType<typeof listShipmentRevenueLedger>>;
type LineageData = Awaited<ReturnType<typeof getOperatingLineage>>;
type DispatchData = Awaited<ReturnType<typeof listDispatchRegister>>;

type ToolbarData = {
  orders?: Row[];
  production?: ProductionData;
  purchase?: PurchaseData;
  receiving?: ReceivingData;
  quality?: QualityData;
  revenue?: RevenueData;
  lineage?: LineageData;
  dispatch?: DispatchData;
};

const SUPPORTED_ROUTES = new Set([
  "/command/sales",
  "/command/production",
  "/command/purchase-execution",
  "/command/receiving",
  "/command/quality",
  "/command/operations",
  "/command/receivables",
]);

const text = (row: Row | undefined, ...keys: string[]) => {
  if (!row) return "";
  for (const key of keys) if (row[key] != null && row[key] !== "") return String(row[key]);
  return "";
};
const num = (row: Row | undefined, ...keys: string[]) => {
  if (!row) return 0;
  for (const key of keys) if (row[key] != null) return Number(row[key]) || 0;
  return 0;
};
const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function commercialOrderPrint(order: Row) {
  const configuration = order.configuration && typeof order.configuration === "object"
    ? Object.entries(order.configuration as Record<string, unknown>)
    : [];
  printControlledDocument({
    title: text(order, "id"),
    recordType: "Commercial Demand / Order",
    status: text(order, "status"),
    authority: "Commercial · central order ledger",
    sourceReference: `Commercial order ${text(order, "id")}`,
    fields: [
      { label: "Order", value: text(order, "id") },
      { label: "Revision", value: text(order, "revision") || "Current persisted revision" },
      { label: "Plan month", value: `M${num(order, "month")}` },
      { label: "Status", value: text(order, "status") },
      { label: "Model / variant", value: text(order, "variantName", "variant_name", "variantId", "variant_id", "product") },
      { label: "Family / tier", value: text(order, "modelTier", "model_tier") || "—" },
      { label: "Units", value: num(order, "units") },
      { label: "Channel", value: text(order, "channel") },
      { label: "ASP", value: lakh(num(order, "aspLakh", "asp_lakh")) },
      { label: "Order value", value: lakh(num(order, "units") * num(order, "aspLakh", "asp_lakh")) },
    ],
    lineage: [{ label: "Digital-thread root", value: text(order, "id") }],
    sections: [
      {
        title: "Controlled bicycle configuration",
        table: {
          columns: ["Category", "Selected controlled option"],
          rows: configuration.map(([key, value]) => [key.replaceAll("_", " "), value]),
        },
      },
    ],
  });
}

function productionCardPrint(card: Row, lines: Row[], travellers: Row[]) {
  const materialLines = lines.filter((line) => text(line, "job_card_id") === text(card, "id") && Boolean(text(line, "sku")));
  const linkedTravellers = travellers.filter((row) => text(row, "job_card_id") === text(card, "id") && text(row, "status") !== "rejected");
  const shortages = materialLines.filter((line) => num(line, "shortage_quantity") > 0).length;
  printControlledDocument({
    title: text(card, "id"),
    recordType: "Production Job Card",
    status: text(card, "status"),
    authority: "Production · controlled build authority",
    sourceReference: text(card, "approval_reference", "source_reference") || `Job Card ${text(card, "id")}`,
    orientation: "landscape",
    fields: [
      { label: "Job Card", value: text(card, "id") },
      { label: "Revision", value: text(card, "revision") || text(card, "sales_order_revision") },
      { label: "Bicycle / variant", value: text(card, "product_label", "variant_id") },
      { label: "Quantity", value: `${num(card, "units")} bike(s)` },
      { label: "Batch", value: text(card, "batch_code") || "—" },
      { label: "BOM", value: text(card, "bom_revision") || "—" },
      { label: "Approved by", value: text(card, "approved_by") || "Approval pending" },
      { label: "Approved at", value: text(card, "approved_at") || "—" },
      { label: "Material state", value: shortages ? `${shortages} shortage line(s)` : "Ready / fulfilled" },
      { label: "Traveller count", value: linkedTravellers.length },
      { label: "Draft PO count", value: num(card, "po_draft_count") },
    ],
    lineage: [
      { label: "Commercial order", value: `${text(card, "sales_order_id")} R${text(card, "sales_order_revision") || "—"}` },
      { label: "Job Card", value: text(card, "id") },
      { label: "Batch", value: text(card, "batch_code") || "—" },
    ],
    sections: [
      {
        title: "Material requirement / issue state",
        table: {
          columns: ["SKU", "Stage", "Required", "Reserved", "Issued", "Short", "Evidence"],
          rows: materialLines.map((line) => [
            text(line, "sku"),
            `${text(line, "stage_code")} · ${text(line, "stage_name")}`,
            num(line, "quantity"),
            text(line, "reservation_status") === "active" ? num(line, "reservation_quantity") : 0,
            text(line, "issue_status") === "issued" || text(line, "reservation_status") === "consumed" ? num(line, "reservation_quantity") || num(line, "quantity") : 0,
            num(line, "shortage_quantity"),
            text(line, "reservation_id") || "—",
          ]),
        },
      },
      {
        title: "Traveller genealogy",
        table: {
          columns: ["Traveller", "Serial", "Status", "Family", "BOM"],
          rows: linkedTravellers.map((row) => [
            text(row, "id"),
            text(row, "serial_number"),
            text(row, "status"),
            text(row, "model_name"),
            text(row, "bom_revision"),
          ]),
        },
      },
    ],
  });
}

function requisitionPrint(card: Row, lines: Row[], travellers: Row[]) {
  const materialLines = lines.filter((line) => text(line, "job_card_id") === text(card, "id") && Boolean(text(line, "sku")));
  const linkedTravellers = travellers.filter((row) => text(row, "job_card_id") === text(card, "id") && text(row, "status") !== "rejected");
  const requisitionId = `MR-${(text(card, "batch_code") || text(card, "id")).replace(/^BATCH-/, "")}`;
  const issued = materialLines.filter((line) => text(line, "issue_status") === "issued").length;
  printControlledDocument({
    title: requisitionId,
    recordType: "Material Requisition & Issue Record",
    status: issued === materialLines.length && materialLines.length ? "issued" : "open",
    authority: "Production / Stores · FIFO material issue authority",
    sourceReference: `Job Card ${text(card, "id")}`,
    orientation: "landscape",
    fields: [
      { label: "Requisition", value: requisitionId },
      { label: "Job Card", value: text(card, "id") },
      { label: "Batch", value: text(card, "batch_code") },
      { label: "BOM", value: text(card, "bom_revision") },
      { label: "Requested by", value: text(card, "created_by") || "—" },
      { label: "Approved by", value: text(card, "approved_by") || "Approval pending" },
      { label: "Issue progress", value: `${issued}/${materialLines.length} material line(s)` },
      { label: "Traveller serial(s)", value: linkedTravellers.map((row) => text(row, "serial_number")).join(", ") || "—" },
    ],
    lineage: [
      { label: "Commercial order", value: `${text(card, "sales_order_id")} R${text(card, "sales_order_revision") || "—"}` },
      { label: "Job Card", value: text(card, "id") },
      { label: "Traveller", value: linkedTravellers.map((row) => text(row, "id")).join(", ") || "—" },
    ],
    sections: [
      {
        title: "Material lines",
        table: {
          columns: ["SKU", "Required", "Reserved", "Issued", "Short", "Status", "Reservation / issue evidence"],
          rows: materialLines.map((line) => {
            const required = num(line, "quantity");
            const reservationQuantity = num(line, "reservation_quantity");
            const reserved = text(line, "reservation_status") === "active" ? reservationQuantity : 0;
            const issuedQuantity = text(line, "issue_status") === "issued" || text(line, "reservation_status") === "consumed" ? reservationQuantity || required : 0;
            const shortage = num(line, "shortage_quantity");
            return [
              text(line, "sku"),
              required,
              reserved,
              issuedQuantity,
              shortage,
              issuedQuantity > 0 ? "ISSUED" : shortage > 0 ? "SHORT" : "COVERED",
              `${text(line, "reservation_id") || "—"} · ${text(line, "consumed_by", "reserved_by") || "—"}`,
            ];
          }),
        },
      },
    ],
  });
}

function travellerPrint(traveller: Row, cards: Row[]) {
  const card = cards.find((row) => text(row, "id") === text(traveller, "job_card_id"));
  printControlledDocument({
    title: text(traveller, "serial_number") || text(traveller, "id"),
    recordType: "Traveller Card / Serial Genealogy",
    status: text(traveller, "status"),
    authority: "Production · serialized genealogy authority",
    sourceReference: text(traveller, "source_reference") || `Traveller ${text(traveller, "id")}`,
    fields: [
      { label: "Traveller", value: text(traveller, "id") },
      { label: "Serial", value: text(traveller, "serial_number") },
      { label: "Status", value: text(traveller, "status") },
      { label: "Family / model", value: text(traveller, "model_name") },
      { label: "BOM", value: text(traveller, "bom_revision") },
      { label: "Batch", value: text(card, "batch_code") || "—" },
      { label: "Job Card", value: text(traveller, "job_card_id") || "—" },
      { label: "Commercial order", value: text(traveller, "sales_order_id") || text(card, "sales_order_id") || "—" },
    ],
    lineage: [
      { label: "Commercial order", value: text(traveller, "sales_order_id") || text(card, "sales_order_id") || "—" },
      { label: "Job Card", value: text(traveller, "job_card_id") || "—" },
      { label: "Traveller / serial", value: `${text(traveller, "id")} · ${text(traveller, "serial_number")}` },
    ],
    sections: [
      {
        title: "Control boundary",
        text: "This traveller is the serialized production genealogy record. Material issue, Quality release and final dispatch remain separately controlled evidence stages.",
      },
    ],
  });
}

function purchaseOrderPrint(row: Row, lineage: LineageData = []) {
  const jobCardId = text(row, "job_card_id");
  const root = lineage.find((item) => item.jobCardId === jobCardId);
  printControlledDocument({
    title: text(row, "id"),
    recordType: "Purchase Order",
    status: text(row, "status"),
    authority: "Procurement · purchase-order authority",
    sourceReference: text(row, "source_reference") || `PO ${text(row, "id")}`,
    fields: [
      { label: "PO", value: text(row, "id") },
      { label: "Supplier", value: text(row, "supplier_name") || text(row, "supplier_id") },
      { label: "Supplier ID", value: text(row, "supplier_id") || "—" },
      { label: "Status", value: text(row, "status") },
      { label: "SKU", value: text(row, "sku") },
      { label: "Quantity", value: `${num(row, "quantity")} ${text(row, "unit")}` },
      { label: "Unit price", value: inr(num(row, "unit_price_inr")) },
      { label: "Order value", value: inr(num(row, "order_value_inr")) },
      { label: "Order date", value: text(row, "order_date") || "—" },
      { label: "Expected receipt", value: text(row, "expected_receipt_on") || "—" },
      { label: "Payment terms", value: `${num(row, "payment_terms_days")} days` },
      { label: "Requirement month", value: `M${num(row, "requirement_month")}` },
    ],
    lineage: [
      { label: "Commercial order", value: root ? `${root.salesOrderId} R${root.salesOrderRevision}` : "Manual / lineage not linked" },
      { label: "Job Card", value: jobCardId || "Manual / not linked" },
      { label: "PO", value: text(row, "id") },
      { label: "Source action", value: text(row, "source_action_id") || "Production shortage / manual" },
    ],
    sections: [
      {
        title: "Commercial evidence",
        fields: [
          { label: "Quote / RFQ / decision reference", value: text(row, "source_reference") || "—" },
          { label: "Notes", value: text(row, "notes") || "—" },
        ],
      },
    ],
  });
}

function goodsReceiptPrint(row: Row, purchaseOrders: Row[], lineage: LineageData = []) {
  const po = purchaseOrders.find((item) => text(item, "id") === text(row, "purchase_order_id"));
  const jobCardId = text(po, "job_card_id");
  const root = lineage.find((item) => item.jobCardId === jobCardId);
  printControlledDocument({
    title: text(row, "id"),
    recordType: "Goods Receipt Note / Incoming Inspection",
    status: text(row, "inspection_status"),
    authority: "Receiving · controlled GRN and inventory boundary",
    sourceReference: text(row, "source_reference") || `GRN ${text(row, "id")}`,
    fields: [
      { label: "GRN", value: text(row, "id") },
      { label: "PO", value: text(row, "purchase_order_id") },
      { label: "Supplier", value: text(row, "supplier_name") },
      { label: "SKU", value: text(row, "sku") },
      { label: "Received date", value: text(row, "received_on") },
      { label: "Received", value: `${num(row, "quantity_received")} ${text(row, "unit")}` },
      { label: "Accepted", value: num(row, "quantity_accepted") },
      { label: "Quarantine", value: num(row, "quantity_quarantined") },
      { label: "Rejected", value: num(row, "quantity_rejected") },
      { label: "Inspection", value: text(row, "inspection_status") },
      { label: "Inventory posting", value: num(row, "quantity_accepted") > 0 ? "Accepted quantity posted to FIFO" : "No accepted stock posting" },
    ],
    lineage: [
      { label: "Commercial order", value: root ? `${root.salesOrderId} R${root.salesOrderRevision}` : "—" },
      { label: "Job Card", value: jobCardId || "—" },
      { label: "Purchase Order", value: text(row, "purchase_order_id") },
      { label: "GRN", value: text(row, "id") },
    ],
    sections: [
      {
        title: "Receiving evidence",
        fields: [
          { label: "Delivery / inspection reference", value: text(row, "source_reference") || "—" },
          { label: "Notes", value: text(row, "notes") || "—" },
          { label: "Resolved on", value: text(row, "resolved_on") || "—" },
          { label: "Resolution reference", value: text(row, "resolution_reference") || "—" },
        ],
      },
    ],
  });
}

function qualityReleasePrint(row: Row) {
  printControlledDocument({
    title: text(row, "id"),
    recordType: "Serialized Quality Release",
    status: text(row, "status", "decision"),
    authority: "Quality · G10 serialized release authority",
    sourceReference: text(row, "evidence_ref", "evidenceReference") || `Quality release ${text(row, "id")}`,
    fields: [
      { label: "Release", value: text(row, "id") },
      { label: "Decision", value: text(row, "decision", "status") },
      { label: "Traveller", value: text(row, "traveller_id", "travellerId") },
      { label: "Serial", value: text(row, "serial_number", "serialNumber") },
      { label: "Job Card", value: text(row, "job_card_id", "jobCardId") },
      { label: "Commercial order", value: text(row, "sales_order_id", "salesOrderId") },
      { label: "Decision reason", value: text(row, "decision_reason", "decisionReason") || "—" },
      { label: "Evidence", value: text(row, "evidence_ref", "evidenceReference") || "—" },
      { label: "Decided by", value: text(row, "decided_by", "decidedBy") || "—" },
      { label: "Role", value: text(row, "decided_role", "decidedRole") || "—" },
      { label: "Decided at", value: text(row, "decided_at", "decidedAt") || "—" },
    ],
    lineage: [
      { label: "Commercial order", value: text(row, "sales_order_id", "salesOrderId") || "—" },
      { label: "Job Card", value: text(row, "job_card_id", "jobCardId") || "—" },
      { label: "Traveller / serial", value: `${text(row, "traveller_id", "travellerId") || "—"} · ${text(row, "serial_number", "serialNumber") || "—"}` },
      { label: "Quality release", value: text(row, "id") },
    ],
  });
}

function dispatchPrint(row: Row) {
  printControlledDocument({
    title: text(row, "shipmentId", "shipment_id"),
    recordType: "Dispatch / Shipment Record",
    status: text(row, "status"),
    authority: "Operations / Fulfilment · canonical dispatch authority",
    sourceReference: text(row, "sourceReference", "source_reference") || `Dispatch ${text(row, "shipmentId", "shipment_id")}`,
    fields: [
      { label: "Shipment", value: text(row, "shipmentId", "shipment_id") },
      { label: "Commercial order", value: `${text(row, "salesOrderId", "sales_order_id")} R${text(row, "salesOrderRevision", "sales_order_revision")}` },
      { label: "Job Card", value: text(row, "jobCardId", "job_card_id") || "—" },
      { label: "Units", value: num(row, "units") },
      { label: "Plan month", value: `M${num(row, "planMonth", "plan_month")}` },
      { label: "Quality releases", value: num(row, "qualityReleaseCount", "current_quality_release_count") },
      { label: "Invoice", value: text(row, "invoiceId", "invoice_id") || "Not yet posted" },
      { label: "Invoice status", value: text(row, "invoiceStatus", "invoice_status") || "—" },
    ],
    lineage: [
      { label: "Commercial order", value: text(row, "salesOrderId", "sales_order_id") },
      { label: "Job Card", value: text(row, "jobCardId", "job_card_id") || "—" },
      { label: "Dispatch", value: text(row, "shipmentId", "shipment_id") },
      { label: "Invoice", value: text(row, "invoiceId", "invoice_id") || "Pending" },
    ],
  });
}

function invoicePrint(row: Row, collections: Row[]) {
  const invoiceId = text(row, "id");
  const posted = collections.filter((item) => text(item, "invoiceId", "invoice_id") === invoiceId && text(item, "status") === "posted");
  const collected = posted.reduce((sum, item) => sum + num(item, "amountLakh", "amount_lakh"), 0);
  const amount = num(row, "amountLakh", "amount_lakh");
  printControlledDocument({
    title: invoiceId,
    recordType: "Customer Invoice / Receivable Record",
    status: text(row, "status"),
    authority: "Finance · shipment-derived receivable authority",
    sourceReference: text(row, "sourceReference", "source_reference") || `Invoice ${invoiceId}`,
    fields: [
      { label: "Invoice", value: invoiceId },
      { label: "Commercial order", value: text(row, "salesOrderId", "sales_order_id") },
      { label: "Shipment", value: text(row, "shipmentId", "shipment_id") },
      { label: "Plan month", value: `M${num(row, "planMonth", "plan_month")}` },
      { label: "Invoice value", value: lakh(amount) },
      { label: "Collected", value: lakh(collected) },
      { label: "Open", value: lakh(Math.max(amount - collected, 0)) },
      { label: "Evidence", value: text(row, "sourceReference", "source_reference") || "—" },
    ],
    lineage: [
      { label: "Commercial order", value: text(row, "salesOrderId", "sales_order_id") },
      { label: "Shipment", value: text(row, "shipmentId", "shipment_id") },
      { label: "Invoice", value: invoiceId },
      { label: "Collection(s)", value: posted.map((item) => text(item, "id")).join(", ") || "Pending" },
    ],
    sections: [
      {
        title: "Collection evidence",
        table: {
          columns: ["Collection", "Month", "Amount", "Bank / source reference"],
          rows: posted.map((item) => [
            text(item, "id"),
            `M${num(item, "planMonth", "plan_month")}`,
            lakh(num(item, "amountLakh", "amount_lakh")),
            text(item, "sourceReference", "source_reference") || "—",
          ]),
        },
      },
    ],
  });
}

function digitalThreadPrint(row: Row, qualityRows: Row[]) {
  const orderId = text(row, "salesOrderId", "sales_order_id");
  const jobCardId = text(row, "jobCardId", "job_card_id");
  const releases = qualityRows.filter((release) =>
    text(release, "sales_order_id", "salesOrderId") === orderId ||
    (jobCardId && text(release, "job_card_id", "jobCardId") === jobCardId),
  );
  const stageRows = [
    ["1", "Demand / Commercial Order", orderId, text(row, "orderStatus", "order_status") || "PERSISTED", `R${num(row, "salesOrderRevision", "sales_order_revision")} · M${num(row, "planMonth", "plan_month")} · ${num(row, "units")} unit(s)`],
    ["2", "Production Job Card", jobCardId || "—", jobCardId ? text(row, "jobCardStatus", "job_card_status") || "RAISED" : "PENDING", `${text(row, "batchCode", "batch_code") || "—"} · ${text(row, "bomRevision", "bom_revision") || "—"}`],
    ["3", "Material Requirement", `${num(row, "requirementLines", "requirement_lines")} line(s)`, num(row, "shortageLines", "shortage_lines") ? "SHORT" : "COVERED", `${num(row, "shortageLines", "shortage_lines")} shortage line(s) · ${num(row, "shortageUnits", "shortage_units")} unit(s)`],
    ["4", "Procurement / PO", text(row, "purchaseOrderIds", "purchase_order_ids") || "—", num(row, "purchaseOrderCount", "purchase_order_count") ? "RECORDED" : "PENDING", text(row, "purchaseOrderStatuses", "purchase_order_statuses") || "No PO"],
    ["5", "Receiving / GRN", text(row, "goodsReceiptIds", "goods_receipt_ids") || "—", num(row, "goodsReceiptCount", "goods_receipt_count") ? "RECORDED" : "PENDING", `${num(row, "acceptedReceiptUnits", "accepted_receipt_units")} accepted unit(s)`],
    ["6", "Traveller / Genealogy", text(row, "travellerIds", "traveller_ids") || "—", num(row, "travellerCount", "traveller_count") >= num(row, "units") && num(row, "units") > 0 ? "REGISTERED" : "PENDING", text(row, "travellerStatuses", "traveller_statuses") || "No traveller"],
    ["7", "Quality Release", releases.map((item) => text(item, "id")).join(", ") || "—", releases.some((item) => ["released", "release"].includes(text(item, "status", "decision"))) ? "RELEASED" : "PENDING", releases.map((item) => text(item, "serial_number", "serialNumber")).filter(Boolean).join(", ") || "No serialized release"],
    ["8", "Dispatch", text(row, "shipmentIds", "shipment_ids") || "—", num(row, "shipmentCount", "shipment_count") ? "POSTED" : "PENDING", `${num(row, "shipmentCount", "shipment_count")} dispatch record(s)`],
    ["9", "Invoice", text(row, "invoiceIds", "invoice_ids") || "—", num(row, "invoiceCount", "invoice_count") ? "ISSUED" : "PENDING", `${num(row, "invoiceCount", "invoice_count")} invoice(s)`],
    ["10", "Collection", text(row, "collectionIds", "collection_ids") || "—", num(row, "collectionCount", "collection_count") ? "POSTED" : "PENDING", `${num(row, "collectionCount", "collection_count")} collection(s) · ${lakh(num(row, "collectionAmountLakh", "collection_amount_lakh"))}`],
  ];
  printControlledDocument({
    title: `${orderId} · End-to-End Digital Thread`,
    recordType: "End-to-End Demand-to-Cash Digital Thread",
    status: num(row, "collectionCount", "collection_count") ? "closed loop" : "in progress",
    authority: "VYNDI canonical operating authorities · read-only lineage extract",
    sourceReference: `Order-to-cash lineage ${orderId} R${num(row, "salesOrderRevision", "sales_order_revision")}`,
    orientation: "landscape",
    fields: [
      { label: "Commercial order", value: orderId },
      { label: "Revision", value: num(row, "salesOrderRevision", "sales_order_revision") },
      { label: "Variant", value: text(row, "variantName", "variant_name") || text(row, "variantId", "variant_id") },
      { label: "Units", value: num(row, "units") },
      { label: "Job Card", value: jobCardId || "Pending" },
      { label: "BOM", value: text(row, "bomRevision", "bom_revision") || "—" },
      { label: "Batch", value: text(row, "batchCode", "batch_code") || "—" },
      { label: "Build approval", value: text(row, "buildApprovedAt", "build_approved_at") || "Pending" },
    ],
    lineage: [
      { label: "Root", value: orderId },
      { label: "Job Card", value: jobCardId || "Pending" },
      { label: "Traveller(s)", value: text(row, "travellerIds", "traveller_ids") || "Pending" },
      { label: "Downstream", value: `${text(row, "shipmentIds", "shipment_ids") || "No dispatch"} → ${text(row, "invoiceIds", "invoice_ids") || "No invoice"} → ${text(row, "collectionIds", "collection_ids") || "No collection"}` },
    ],
    sections: [
      {
        title: "Canonical stage-by-stage traceability",
        table: {
          columns: ["#", "Stage", "Persisted record(s)", "State", "Evidence summary"],
          rows: stageRows,
        },
      },
      {
        title: "Interpretation",
        text: "A stage is shown as pending when no persisted canonical record exists. This document does not infer completion from planning data or from a downstream stage alone.",
      },
    ],
  });
}

function RecordSelector({
  label,
  rows,
  getId,
  getLabel,
  onPrint,
}: {
  label: string;
  rows: Row[];
  getId: (row: Row) => string;
  getLabel: (row: Row) => string;
  onPrint: (row: Row) => void;
}) {
  const [selected, setSelected] = useState("");
  const selectedRow = rows.find((row) => getId(row) === selected) ?? rows[0];
  useEffect(() => {
    if (!selected && rows[0]) setSelected(getId(rows[0]));
    if (selected && !rows.some((row) => getId(row) === selected)) setSelected(rows[0] ? getId(rows[0]) : "");
  }, [rows, selected, getId]);
  if (!rows.length) return <p className="text-xs text-muted">{label}: no persisted record yet.</p>;
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <div className="flex gap-2">
        <select className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-xs" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {rows.map((row) => <option key={getId(row)} value={getId(row)}>{getLabel(row)}</option>)}
        </select>
        <button type="button" onClick={() => selectedRow && onPrint(selectedRow)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent px-2.5 py-1.5 text-xs font-semibold text-accent">
          <Printer className="size-3.5" /> Print
        </button>
      </div>
    </div>
  );
}

export function ControlledDocumentToolbar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ToolbarData>({});
  const supported = SUPPORTED_ROUTES.has(pathname);

  useEffect(() => {
    setOpen(false);
    setError("");
    setData({});
    if (!SUPPORTED_ROUTES.has(pathname)) return;
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        let next: ToolbarData = {};
        if (pathname === "/command/sales") {
          next = { orders: (await listSalesOrders()) as unknown as Row[] };
        } else if (pathname === "/command/production") {
          next = { production: await getProductionJobCardView() };
        } else if (pathname === "/command/purchase-execution") {
          const [purchase, lineage] = await Promise.all([getPurchaseExecutionData(), getOperatingLineage()]);
          next = { purchase, lineage };
        } else if (pathname === "/command/receiving") {
          const [receiving, lineage] = await Promise.all([getReceivingData(), getOperatingLineage()]);
          next = { receiving, lineage };
        } else if (pathname === "/command/quality") {
          next = { quality: await listQualityAuthority() };
        } else if (pathname === "/command/operations") {
          const [lineage, dispatch, quality] = await Promise.all([getOperatingLineage(), listDispatchRegister(), listQualityAuthority()]);
          next = { lineage, dispatch, quality };
        } else if (pathname === "/command/receivables") {
          next = { revenue: await listShipmentRevenueLedger() };
        }
        if (!cancelled) setData(next);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Controlled document data could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [pathname]);

  const panel = useMemo(() => {
    if (pathname === "/command/sales") {
      const orders = data.orders ?? [];
      return <RecordSelector label="Commercial Order" rows={orders} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "id")} · ${text(row, "variantName", "variant_id", "product")} · ${text(row, "status")}`} onPrint={commercialOrderPrint} />;
    }
    if (pathname === "/command/production" && data.production) {
      const cards = data.production.cards as unknown as Row[];
      const lines = data.production.lines as unknown as Row[];
      const travellers = data.production.travellers as unknown as Row[];
      return <div className="space-y-2">
        <RecordSelector label="Production Job Card" rows={cards} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "id")} · ${text(row, "product_label", "variant_id")}`} onPrint={(row) => productionCardPrint(row, lines, travellers)} />
        <RecordSelector label="Traveller Card" rows={travellers} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "serial_number")} · ${text(row, "status")}`} onPrint={(row) => travellerPrint(row, cards)} />
        <RecordSelector label="Material Requisition / Issue" rows={cards} getId={(row) => text(row, "id")} getLabel={(row) => `MR-${(text(row, "batch_code") || text(row, "id")).replace(/^BATCH-/, "")}`} onPrint={(row) => requisitionPrint(row, lines, travellers)} />
      </div>;
    }
    if (pathname === "/command/purchase-execution" && data.purchase) {
      const rows = data.purchase.purchaseOrders as Row[];
      return <RecordSelector label="Purchase Order" rows={rows} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "id")} · ${text(row, "supplier_name")} · ${text(row, "status")}`} onPrint={(row) => purchaseOrderPrint(row, data.lineage)} />;
    }
    if (pathname === "/command/receiving" && data.receiving) {
      const receipts = data.receiving.receipts as Row[];
      const purchaseOrders = data.receiving.purchaseOrders as Row[];
      return <RecordSelector label="GRN / Incoming Inspection" rows={receipts} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "id")} · ${text(row, "sku")} · ${text(row, "inspection_status")}`} onPrint={(row) => goodsReceiptPrint(row, purchaseOrders, data.lineage)} />;
    }
    if (pathname === "/command/quality" && data.quality) {
      const releases = data.quality.releases as Row[];
      return <RecordSelector label="Serialized Quality Release" rows={releases} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "id")} · ${text(row, "serial_number", "serialNumber")} · ${text(row, "status", "decision")}`} onPrint={qualityReleasePrint} />;
    }
    if (pathname === "/command/operations") {
      const dispatch = (data.dispatch ?? []) as unknown as Row[];
      const lineage = (data.lineage ?? []) as unknown as Row[];
      const releases = (data.quality?.releases ?? []) as Row[];
      return <div className="space-y-2">
        <RecordSelector label="Dispatch / Shipment" rows={dispatch} getId={(row) => text(row, "shipmentId", "shipment_id")} getLabel={(row) => `${text(row, "shipmentId", "shipment_id")} · ${text(row, "salesOrderId", "sales_order_id")} · ${text(row, "status")}`} onPrint={dispatchPrint} />
        <RecordSelector label="End-to-End Digital Thread" rows={lineage} getId={(row) => `${text(row, "salesOrderId", "sales_order_id")}-${num(row, "salesOrderRevision", "sales_order_revision")}`} getLabel={(row) => `${text(row, "salesOrderId", "sales_order_id")} R${num(row, "salesOrderRevision", "sales_order_revision")} · ${text(row, "variantName", "variant_name")}`} onPrint={(row) => digitalThreadPrint(row, releases)} />
      </div>;
    }
    if (pathname === "/command/receivables" && data.revenue) {
      const invoices = data.revenue.invoices as unknown as Row[];
      const collections = data.revenue.collections as unknown as Row[];
      return <RecordSelector label="Customer Invoice" rows={invoices} getId={(row) => text(row, "id")} getLabel={(row) => `${text(row, "id")} · ${text(row, "salesOrderId", "sales_order_id")} · ${text(row, "status")}`} onPrint={(row) => invoicePrint(row, collections)} />;
    }
    return null;
  }, [data, pathname]);

  if (!supported) return null;

  return (
    <div className="fixed right-4 top-20 z-[70] print:hidden">
      {open ? (
        <div className="w-[min(92vw,430px)] rounded-xl border border-border bg-bg/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-green">Controlled documents</p>
              <p className="mt-1 text-xs text-muted">Electronic record remains authoritative · print/PDF is an exact controlled representation.</p>
            </div>
            <button type="button" aria-label="Close controlled documents" onClick={() => setOpen(false)} className="rounded-md border border-border p-1.5 text-muted hover:text-fg"><X className="size-4" /></button>
          </div>
          {loading ? <p className="py-4 text-center text-xs text-muted">Loading canonical records…</p> : null}
          {error ? <p className="rounded-lg border border-danger/40 p-2 text-xs text-danger">{error}</p> : null}
          {!loading && !error ? panel : null}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-accent/60 bg-bg/95 px-3 py-2 text-xs font-semibold text-accent shadow-lg backdrop-blur hover:bg-surface">
          <FileStack className="size-4" /> Controlled documents
        </button>
      )}
    </div>
  );
}
