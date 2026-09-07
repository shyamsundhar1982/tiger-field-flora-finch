import type { InventoryLedgerId } from "@/lib/inventory-navigation";

export type LedgerIssue = { id: string; quantity: number; date: string };

export type MasterLedgerRow = {
  id: string;
  ledgerId: InventoryLedgerId;
  serialNo: string;
  description: string;
  purchasePrice: number;
  purchaseDate: string;
  expiryDate: string;
  nextInspectionDate: string;
  quantity: number;
  mslLevel: number;
  issues: LedgerIssue[];
};

export type LedgerForecast = {
  quantity: number;
  mslLevel: number;
  monthlyDemand: number;
  firstReplenishmentMonth: number | null;
  plannedPurchaseQuantity: number;
  status: "Healthy" | "Replenish" | "No demand";
};

export function availableQuantity(row: MasterLedgerRow) {
  return Math.max(0, row.quantity - row.issues.reduce((sum, issue) => sum + Math.max(0, issue.quantity), 0));
}

export function fifoIssue(rows: MasterLedgerRow[], ledgerId: InventoryLedgerId, quantity: number, date: string, id: string): MasterLedgerRow[] {
  let remaining = Math.max(0, quantity);
  return rows.map((row) => {
    if (row.ledgerId !== ledgerId || remaining <= 0) return row;
    const available = availableQuantity(row);
    const issued = Math.min(available, remaining);
    remaining -= issued;
    return issued > 0 ? { ...row, issues: [...row.issues, { id: `${id}-${row.id}`, quantity: issued, date }] } : row;
  });
}

export function forecastLedger(rows: MasterLedgerRow[], ledgerId: InventoryLedgerId): LedgerForecast {
  const relevant = rows.filter((row) => row.ledgerId === ledgerId);
  const quantity = relevant.reduce((sum, row) => sum + availableQuantity(row), 0);
  const mslLevel = relevant.reduce((sum, row) => sum + Math.max(0, row.mslLevel), 0);
  // Explicit planning rule: monthly demand is half the MSL, rounded up, with a
  // minimum of one unit whenever a ledger has stock or an MSL configured.
  const monthlyDemand = mslLevel > 0 || quantity > 0 ? Math.max(1, Math.ceil(mslLevel / 2)) : 0;
  let balance = quantity;
  let firstReplenishmentMonth: number | null = null;
  let plannedPurchaseQuantity = 0;
  for (let month = 1; month <= 36; month += 1) {
    balance -= monthlyDemand;
    if (balance < mslLevel) {
      if (firstReplenishmentMonth === null) firstReplenishmentMonth = month;
      plannedPurchaseQuantity += Math.max(0, mslLevel - balance);
      balance += Math.max(0, mslLevel - balance);
    }
  }
  return {
    quantity,
    mslLevel,
    monthlyDemand,
    firstReplenishmentMonth,
    plannedPurchaseQuantity,
    status: monthlyDemand === 0 ? "No demand" : firstReplenishmentMonth === null ? "Healthy" : "Replenish",
  };
}
