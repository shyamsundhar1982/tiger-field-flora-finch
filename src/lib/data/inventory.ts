import { useEffect, useState } from "react";

export type InventoryItem = {
  id: string;
  category: "groupset" | "wheelset" | "tyre";
  subcategory: string;
  brand: string;
  model: string;
  detail: string;
  sku: string;
  priceInr: number;
  stockQty: number;
  reorderLevel: number;
  coreEnabled: boolean;
  proEnabled: boolean;
  apexEnabled: boolean;
  source: string;
  notes: string;
  updatedAt: string;
};

export const SEED_INVENTORY: InventoryItem[] = [
  { id:"gs-tiagra-4700",category:"groupset",subcategory:"Mechanical",brand:"Shimano",model:"Tiagra 4700",detail:"2x10 mechanical",sku:"SHI-TIA-4700",priceInr:45000,stockQty:6,reorderLevel:2,coreEnabled:true,proEnabled:false,apexEnabled:false,source:"India market reference / internal target",notes:"Core entry Shimano option.",updatedAt:"" },
  { id:"gs-105-r7000",category:"groupset",subcategory:"Mechanical",brand:"Shimano",model:"105 R7000",detail:"2x11 mechanical",sku:"SHI-105-R7000",priceInr:70000,stockQty:8,reorderLevel:2,coreEnabled:true,proEnabled:true,apexEnabled:false,source:"India market reference / internal target",notes:"Core and Pro entry specification.",updatedAt:"" },
  { id:"gs-105-r7150",category:"groupset",subcategory:"Electronic",brand:"Shimano",model:"105 R7150 Di2",detail:"2x12 electronic",sku:"SHI-105-R7150",priceInr:138000,stockQty:4,reorderLevel:1,coreEnabled:false,proEnabled:true,apexEnabled:false,source:"BUMSONTHESADDLE India reference",notes:"Current retail reference about ₹137,860; verify supplier/OEM quote.",updatedAt:"" },
  { id:"gs-ultegra-r8170",category:"groupset",subcategory:"Electronic",brand:"Shimano",model:"Ultegra R8170 Di2",detail:"2x12 electronic",sku:"SHI-ULT-R8170",priceInr:210000,stockQty:3,reorderLevel:1,coreEnabled:false,proEnabled:true,apexEnabled:true,source:"Mastermind Bicycle Studio India reference",notes:"Premium Pro / Apex drivetrain.",updatedAt:"" },
  { id:"gs-duraace-r9270",category:"groupset",subcategory:"Electronic",brand:"Shimano",model:"Dura-Ace R9270 Di2",detail:"2x12 electronic flagship",sku:"SHI-DA-R9270",priceInr:353000,stockQty:1,reorderLevel:1,coreEnabled:false,proEnabled:false,apexEnabled:true,source:"Mastermind Bicycle Studio India reference",notes:"Apex-only flagship.",updatedAt:"" },
  { id:"gs-rival-axs",category:"groupset",subcategory:"Electronic",brand:"SRAM",model:"Rival AXS",detail:"2x12 wireless electronic",sku:"SRAM-RIV-AXS",priceInr:175000,stockQty:3,reorderLevel:1,coreEnabled:false,proEnabled:true,apexEnabled:false,source:"Internal India target — supplier verify",notes:"Pro alternative.",updatedAt:"" },
  { id:"gs-force-axs",category:"groupset",subcategory:"Electronic",brand:"SRAM",model:"Force AXS",detail:"2x12 wireless electronic",sku:"SRAM-FORCE-AXS",priceInr:250000,stockQty:2,reorderLevel:1,coreEnabled:false,proEnabled:true,apexEnabled:true,source:"Internal India target — supplier verify",notes:"Premium Pro / Apex alternative.",updatedAt:"" },
  { id:"gs-red-axs",category:"groupset",subcategory:"Electronic",brand:"SRAM",model:"RED AXS",detail:"2x12 wireless flagship",sku:"SRAM-RED-AXS",priceInr:380000,stockQty:1,reorderLevel:1,coreEnabled:false,proEnabled:false,apexEnabled:true,source:"Internal India target — supplier verify",notes:"Apex-only flagship.",updatedAt:"" },
  { id:"ws-alloy",category:"wheelset",subcategory:"Alloy",brand:"Performance",model:"Performance Alloy",detail:"Training / everyday",sku:"WH-ALLOY-01",priceInr:30000,stockQty:10,reorderLevel:3,coreEnabled:true,proEnabled:false,apexEnabled:false,source:"Internal estimate",notes:"Core-only entry wheel.",updatedAt:"" },
  { id:"ws-alloy-plus",category:"wheelset",subcategory:"Alloy",brand:"Light Alloy 30",model:"Light Alloy 30",detail:"Fast endurance / tubeless-ready",sku:"WH-ALLOY-30",priceInr:45000,stockQty:8,reorderLevel:2,coreEnabled:true,proEnabled:true,apexEnabled:false,source:"Internal estimate",notes:"Core and Pro transition option.",updatedAt:"" },
  { id:"ws-carbon-50",category:"wheelset",subcategory:"Carbon Aero",brand:"3T",model:"Carbon CW-3T2",detail:"50 mm carbon aero",sku:"WH-CARB-50",priceInr:65000,stockQty:5,reorderLevel:1,coreEnabled:false,proEnabled:true,apexEnabled:true,source:"Internal estimate",notes:"Pro/Apex baseline carbon option.",updatedAt:"" },
  { id:"ws-carbon-58",category:"wheelset",subcategory:"Carbon Aero",brand:"Magene",model:"EXAR Pro DB58",detail:"58 mm carbon aero",sku:"WH-CARB-58",priceInr:78900,stockQty:3,reorderLevel:1,coreEnabled:false,proEnabled:true,apexEnabled:true,source:"Internal estimate",notes:"Apex higher-depth option; supplier verification required.",updatedAt:"" },
  { id:"ty-ultra-sport",category:"tyre",subcategory:"Performance",brand:"Continental",model:"Ultra Sport III",detail:"Training / entry race · pair",sku:"TY-ULT-SPORT-PAIR",priceInr:7590,stockQty:12,reorderLevel:3,coreEnabled:true,proEnabled:false,apexEnabled:false,source:"Internal India price reference",notes:"Core training tyre.",updatedAt:"" },
  { id:"ty-rubino-pro",category:"tyre",subcategory:"Endurance",brand:"Vittoria",model:"Rubino Pro IV G2.0",detail:"Endurance · pair",sku:"TY-RUBINO-PRO-PAIR",priceInr:9800,stockQty:10,reorderLevel:3,coreEnabled:true,proEnabled:true,apexEnabled:false,source:"Internal India price reference",notes:"Core/Pro standard.",updatedAt:"" },
  { id:"ty-gp5000",category:"tyre",subcategory:"Performance",brand:"Continental",model:"Grand Prix 5000",detail:"Performance · pair",sku:"TY-GP5000-PAIR",priceInr:17790,stockQty:7,reorderLevel:2,coreEnabled:false,proEnabled:true,apexEnabled:true,source:"Internal India price reference",notes:"Pro/Apex premium standard.",updatedAt:"" },
  { id:"ty-corsa-pro",category:"tyre",subcategory:"Race",brand:"Vittoria",model:"Corsa Pro G2.0",detail:"Race · pair",sku:"TY-CORSA-PRO-PAIR",priceInr:19000,stockQty:4,reorderLevel:1,coreEnabled:false,proEnabled:false,apexEnabled:true,source:"Internal India price reference",notes:"Apex race option.",updatedAt:"" },
];

const KEY = "veloxis-component-inventory-v1";

export function readInventory(): InventoryItem[] {
  if (typeof window === "undefined") return SEED_INVENTORY;
  try {
    const saved = window.localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) as InventoryItem[] : SEED_INVENTORY;
  } catch { return SEED_INVENTORY; }
}

export function writeInventory(items: InventoryItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("veloxis-inventory-updated"));
}

export function useInventory(seed = SEED_INVENTORY) {
  const [items, setItems] = useState<InventoryItem[]>(seed);
  useEffect(() => {
    setItems(readInventory());
    const sync = () => setItems(readInventory());
    window.addEventListener("storage", sync);
    window.addEventListener("veloxis-inventory-updated", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("veloxis-inventory-updated", sync); };
  }, []);
  return [items, (next: InventoryItem[]) => { setItems(next); writeInventory(next); }] as const;
}
