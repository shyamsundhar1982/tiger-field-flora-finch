export type SalesOrderStatus = "lead" | "confirmed" | "delivered" | "cancelled";

/** Commercial control rules shared by Sales and regression tests. */
export function isOrderBookStatus(status: SalesOrderStatus){ return status === "confirmed" || status === "delivered"; }
export function isRevenueStatus(status: SalesOrderStatus){ return status === "delivered"; }
