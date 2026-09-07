import type { InventoryLedgerId } from "@/lib/inventory-navigation";

export type LedgerIssue = { id: string; quantity: number; date: string };

export type MasterLedgerRow = {
  id: string;
  ledgerId: InventoryLedgerId;
  serialNo: string;
  description: string;
  category?: string;
  unit?: string;
  purchasePrice: number;
  purchaseDate: string;
  expiryDate: string;
  nextInspectionDate: string;
  quantity: number;
  mslLevel: number;
  plannedMonthlyUse?: number;
  source?: "component-catalogue" | "equipment-register" | "manual" | "server";
  issues: LedgerIssue[];
};

export type StockHealth = "Sufficient" | "At MSL" | "Below MSL" | "Out of stock";
export type ForecastStatus = "On plan" | "Replenish" | "Plan missing";

export type LedgerForecast = {
  quantity: number;
  mslLevel: number;
  monthlyDemand: number;
  firstReplenishmentMonth: number | null;
  plannedPurchaseQuantity: number;
  status: ForecastStatus;
};

export type InventoryItemSummary = LedgerForecast & {
  key: string;
  ledgerId: InventoryLedgerId;
  sku: string;
  description: string;
  category: string;
  unit: string;
  health: StockHealth;
  lotCount: number;
  stockValue: number;
  lastReceiptDate: string;
};

export function availableQuantity(row: MasterLedgerRow) {
  return Math.max(
    0,
    row.quantity - row.issues.reduce((sum, issue) => sum + Math.max(0, issue.quantity), 0),
  );
}

function normalizedSku(value: string) {
  return value.trim().toLocaleUpperCase();
}

function fifoDate(row: MasterLedgerRow) {
  return row.purchaseDate || "9999-12-31";
}

export function stockHealth(quantity: number, mslLevel: number): StockHealth {
  if (quantity <= 0) return "Out of stock";
  if (quantity < Math.max(0, mslLevel)) return "Below MSL";
  if (mslLevel > 0 && quantity === mslLevel) return "At MSL";
  return "Sufficient";
}

export function forecastStock(
  quantity: number,
  mslLevel: number,
  monthlyDemand: number,
  horizonMonths = 36,
): LedgerForecast {
  const minimum = Math.max(0, mslLevel);
  const demand = Math.max(0, monthlyDemand);
  let balance = Math.max(0, quantity);
  let firstReplenishmentMonth: number | null = null;
  let plannedPurchaseQuantity = 0;

  // A current shortage is month 0: it needs action before the next plan period.
  if (balance < minimum) {
    firstReplenishmentMonth = 0;
    plannedPurchaseQuantity = minimum - balance;
    balance = minimum;
  }

  for (let month = 1; month <= horizonMonths && demand > 0; month += 1) {
    balance -= demand;
    if (balance < minimum) {
      if (firstReplenishmentMonth === null) firstReplenishmentMonth = month;
      const purchase = minimum - balance;
      plannedPurchaseQuantity += purchase;
      balance += purchase;
    }
  }

  return {
    quantity: Math.max(0, quantity),
    mslLevel: minimum,
    monthlyDemand: demand,
    firstReplenishmentMonth,
    plannedPurchaseQuantity,
    status:
      firstReplenishmentMonth !== null ? "Replenish" : demand > 0 ? "On plan" : "Plan missing",
  };
}

/**
 * Issues only the requested SKU and always consumes its oldest dated purchase
 * lots first. Undated lots are used last; array order never controls FIFO.
 */
export function fifoIssue(
  rows: MasterLedgerRow[],
  ledgerId: InventoryLedgerId,
  sku: string,
  quantity: number,
  date: string,
  id: string,
): MasterLedgerRow[] {
  let remaining = Math.max(0, quantity);
  const requestedSku = normalizedSku(sku);
  const issueByRow = new Map<string, number>();
  rows
    .filter((row) => row.ledgerId === ledgerId && normalizedSku(row.serialNo) === requestedSku)
    .sort(
      (left, right) =>
        fifoDate(left).localeCompare(fifoDate(right)) || left.id.localeCompare(right.id),
    )
    .forEach((row) => {
      if (remaining <= 0) return;
      const issued = Math.min(availableQuantity(row), remaining);
      if (issued > 0) issueByRow.set(row.id, issued);
      remaining -= issued;
    });

  return rows.map((row) => {
    const issued = issueByRow.get(row.id) ?? 0;
    return issued > 0
      ? { ...row, issues: [...row.issues, { id: `${id}-${row.id}`, quantity: issued, date }] }
      : row;
  });
}

export function summarizeInventoryRows(rows: MasterLedgerRow[]): InventoryItemSummary[] {
  const grouped = new Map<string, MasterLedgerRow[]>();
  for (const row of rows) {
    const sku = normalizedSku(row.serialNo) || row.id;
    const key = `${row.ledgerId}:${sku}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return [...grouped.entries()]
    .map(([key, lots]) => {
      const first = lots[0];
      const quantity = lots.reduce((sum, row) => sum + availableQuantity(row), 0);
      // MSL and demand are SKU controls, so repeated purchase lots must not add
      // duplicate thresholds. The highest configured value wins.
      const mslLevel = lots.reduce((level, row) => Math.max(level, Math.max(0, row.mslLevel)), 0);
      const monthlyDemand = lots.reduce(
        (demand, row) => Math.max(demand, Math.max(0, row.plannedMonthlyUse ?? 0)),
        0,
      );
      const forecast = forecastStock(quantity, mslLevel, monthlyDemand);
      const lastReceiptDate = lots.reduce(
        (latest, row) => (row.purchaseDate > latest ? row.purchaseDate : latest),
        "",
      );
      const stockValue = lots.reduce(
        (sum, row) => sum + availableQuantity(row) * Math.max(0, row.purchasePrice),
        0,
      );
      return {
        ...forecast,
        key,
        ledgerId: first.ledgerId,
        sku: normalizedSku(first.serialNo) || "UNASSIGNED",
        description: first.description,
        category: first.category?.trim() || "Uncategorised",
        unit: first.unit?.trim() || "ea",
        health: stockHealth(quantity, mslLevel),
        lotCount: lots.length,
        stockValue,
        lastReceiptDate,
      };
    })
    .sort(
      (left, right) =>
        left.ledgerId.localeCompare(right.ledgerId) ||
        left.category.localeCompare(right.category) ||
        left.description.localeCompare(right.description),
    );
}

export function forecastLedger(
  rows: MasterLedgerRow[],
  ledgerId: InventoryLedgerId,
): LedgerForecast {
  const items = summarizeInventoryRows(rows).filter((item) => item.ledgerId === ledgerId);
  const firstMonths = items
    .map((item) => item.firstReplenishmentMonth)
    .filter((month): month is number => month !== null);
  const monthlyDemand = items.reduce((sum, item) => sum + item.monthlyDemand, 0);
  return {
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    mslLevel: items.reduce((sum, item) => sum + item.mslLevel, 0),
    monthlyDemand,
    firstReplenishmentMonth: firstMonths.length ? Math.min(...firstMonths) : null,
    plannedPurchaseQuantity: items.reduce((sum, item) => sum + item.plannedPurchaseQuantity, 0),
    status: firstMonths.length ? "Replenish" : monthlyDemand > 0 ? "On plan" : "Plan missing",
  };
}

export function issueableSkus(rows: MasterLedgerRow[], ledgerId: InventoryLedgerId) {
  return summarizeInventoryRows(rows)
    .filter((item) => item.ledgerId === ledgerId && item.quantity > 0)
    .map((item) => ({ sku: item.sku, description: item.description, quantity: item.quantity }))
    .sort((left, right) => left.description.localeCompare(right.description));
}

export function migrateLegacyLedgerId(row: MasterLedgerRow): MasterLedgerRow {
  if (["stock", "movements", "fifo", "msl"].includes(row.ledgerId)) {
    return { ...row, ledgerId: "raw-materials" };
  }
  return row;
}

export function mergeLedgerDefaults(savedRows: MasterLedgerRow[], defaults: MasterLedgerRow[]) {
  const migrated = savedRows.map(migrateLegacyLedgerId);
  const savedIds = new Set(migrated.map((row) => row.id));
  return [...migrated, ...defaults.filter((row) => !savedIds.has(row.id))];
}

export function validateLedgerRows(rows: MasterLedgerRow[]): string[] {
  const errors: string[] = [];
  for (const row of rows) {
    if (!row.description.trim()) errors.push(`${row.id}: description is required`);
    if (row.quantity < 0) errors.push(`${row.id}: quantity cannot be negative`);
    if (row.mslLevel < 0) errors.push(`${row.id}: MSL cannot be negative`);
    if ((row.plannedMonthlyUse ?? 0) < 0) errors.push(`${row.id}: planned use cannot be negative`);
    const issued = row.issues.reduce((sum, issue) => sum + Math.max(0, issue.quantity), 0);
    if (issued > row.quantity) errors.push(`${row.id}: issues exceed receipt quantity`);
    if (row.issues.some((issue) => issue.quantity <= 0))
      errors.push(`${row.id}: issue quantity must be positive`);
    if (row.issues.some((issue) => !issue.date)) errors.push(`${row.id}: issue date is required`);
  }
  return errors;
}
