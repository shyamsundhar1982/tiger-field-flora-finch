export type Groupset = {
  id: string;
  brand: "Shimano" | "SRAM";
  name: string;
  detail: string;
  price: number;
};

/**
 * Single source of truth for groupset identity and component pricing.
 * Model ASPs live in models.ts; these prices are used only for configurator
 * upgrade/downgrade deltas.
 */
export const GROUPSETS = [
  { id: "sora", brand: "Shimano", name: "Shimano Sora R3000", detail: "2x9 mechanical", price: 45000 },
  { id: "tiagra", brand: "Shimano", name: "Shimano Tiagra 4700", detail: "2x10 mechanical", price: 38000 },
  { id: "105-mech", brand: "Shimano", name: "Shimano 105 R7120", detail: "2x12 mechanical", price: 90000 },
  { id: "rival-axs", brand: "SRAM", name: "SRAM Rival AXS", detail: "2x12 wireless electronic", price: 140000 },
  { id: "105-di2", brand: "Shimano", name: "Shimano 105 R7150 Di2", detail: "2x12 electronic", price: 150000 },
  { id: "force-axs", brand: "SRAM", name: "SRAM Force AXS", detail: "2x12 wireless electronic", price: 200000 },
  { id: "ultegra-di2", brand: "Shimano", name: "Shimano Ultegra R8170 Di2", detail: "2x12 electronic", price: 230000 },
  { id: "duraace-di2", brand: "Shimano", name: "Shimano Dura-Ace R9200 Di2", detail: "2x12 electronic flagship", price: 340000 },
  { id: "red-axs", brand: "SRAM", name: "SRAM RED AXS", detail: "2x12 wireless electronic flagship", price: 380000 },
] as const satisfies readonly Groupset[];

export function groupsetName(id: string): string {
  return GROUPSETS.find((groupset) => groupset.id === id)?.name ?? id;
}
