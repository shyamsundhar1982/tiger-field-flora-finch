export type Groupset = {
  id: string;
  brand: "Shimano" | "SRAM";
  name: string;
  detail: string;
  price: number;
};

/**
 * Reference groupset catalogue. The live range configurator reads the inventory
 * master so stock and range eligibility stay in one place; this catalogue is
 * retained for other planning views.
 */
export const GROUPSETS = [
  { id: "sora", brand: "Shimano", name: "Shimano Sora R3000", detail: "2x9 mechanical", price: 45000 },
  { id: "tiagra", brand: "Shimano", name: "Shimano Tiagra 4700", detail: "2x10 mechanical", price: 45000 },
  { id: "105-mech", brand: "Shimano", name: "Shimano 105 R7000", detail: "2x11 mechanical", price: 70000 },
  { id: "rival-axs", brand: "SRAM", name: "SRAM Rival AXS", detail: "2x12 wireless electronic", price: 175000 },
  { id: "105-di2", brand: "Shimano", name: "Shimano 105 R7150 Di2", detail: "2x12 electronic", price: 138000 },
  { id: "force-axs", brand: "SRAM", name: "SRAM Force AXS", detail: "2x12 wireless electronic", price: 250000 },
  { id: "ultegra-di2", brand: "Shimano", name: "Shimano Ultegra R8170 Di2", detail: "2x12 electronic", price: 210000 },
  { id: "duraace-di2", brand: "Shimano", name: "Shimano Dura-Ace R9270 Di2", detail: "2x12 electronic flagship", price: 353000 },
  { id: "red-axs", brand: "SRAM", name: "SRAM RED AXS", detail: "2x12 wireless electronic flagship", price: 380000 },
] as const satisfies readonly Groupset[];

export function groupsetName(id: string): string {
  return GROUPSETS.find((groupset) => groupset.id === id)?.name ?? id;
}
