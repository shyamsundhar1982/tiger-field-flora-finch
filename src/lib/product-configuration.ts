import { SEED_INVENTORY, type InventoryCategory, type InventoryItem } from "./data/inventory.ts";
import { MODELS, type Model } from "./data/models.ts";

export type ProductTier = Model["tier"];
export type ProductConfiguration = Partial<Record<InventoryCategory, string>>;

export const CONFIGURATION_CATEGORIES: {
  key: InventoryCategory;
  label: string;
  quantityPerBike: number;
}[] = [
  { key: "groupset", label: "Groupset", quantityPerBike: 1 },
  { key: "wheelset", label: "Wheelset", quantityPerBike: 1 },
  { key: "tyre", label: "Tyres (pair)", quantityPerBike: 1 },
  { key: "handlebar", label: "Handlebar", quantityPerBike: 1 },
  { key: "stem", label: "Stem", quantityPerBike: 1 },
  { key: "saddle", label: "Saddle", quantityPerBike: 1 },
  { key: "thruaxle", label: "Thru-axle set", quantityPerBike: 1 },
  { key: "bottom-bracket", label: "Bottom bracket", quantityPerBike: 1 },
  { key: "bottle-cage", label: "Bottle cage", quantityPerBike: 1 },
  { key: "tool-pouch", label: "Tool pouch", quantityPerBike: 1 },
  { key: "bracket", label: "Accessory bracket", quantityPerBike: 1 },
  { key: "colour", label: "Frame colour", quantityPerBike: 1 },
];

const DEFAULTS: Record<ProductTier, ProductConfiguration> = {
  core: {
    groupset: "gs-105-r7000",
    wheelset: "ws-alloy",
    tyre: "ty-rubino-pro",
    handlebar: "hb-alloy-420",
    stem: "stem-90",
    saddle: "sad-men-broad-long",
    thruaxle: "ta-core",
    "bottom-bracket": "bb-bsa",
    "bottle-cage": "cage-plastic",
    "tool-pouch": "tool-pouch",
    bracket: "bracket-computer",
    colour: "colour-bright-1",
  },
  pro: {
    groupset: "gs-105-r7150",
    wheelset: "ws-carbon-50",
    tyre: "ty-gp5000",
    handlebar: "hb-carbon-420",
    stem: "stem-integrated-100",
    saddle: "sad-men-narrow-long",
    thruaxle: "ta-premium",
    "bottom-bracket": "bb-t47i-85",
    "bottle-cage": "cage-carbon",
    "tool-pouch": "tool-pouch",
    bracket: "bracket-computer",
    colour: "colour-metal-2",
  },
  apex: {
    groupset: "gs-ultegra-r8170",
    wheelset: "ws-carbon-58",
    tyre: "ty-corsa-pro",
    handlebar: "hb-carbon-420",
    stem: "stem-integrated-100",
    saddle: "sad-men-narrow-short",
    thruaxle: "ta-premium",
    "bottom-bracket": "bb-t47i-85",
    "bottle-cage": "cage-carbon",
    "tool-pouch": "tool-pouch",
    bracket: "bracket-computer",
    colour: "colour-metal-5",
  },
};

const VARIANT_GROUPSET: Record<string, string> = {
  "core-tiagra": "gs-tiagra-4700",
  "core-105": "gs-105-r7000",
  "core-105-elite": "gs-105-r7000",
  "pro-105-di2": "gs-105-r7150",
  "pro-rival-axs": "gs-rival-axs",
  "pro-ultegra-di2": "gs-ultegra-r8170",
  "pro-force-axs": "gs-force-axs",
  "apex-ultegra-di2": "gs-ultegra-r8170",
  "apex-duraace-di2": "gs-duraace-r9270",
  "apex-red-axs": "gs-red-axs",
};

export function isEligible(item: InventoryItem, tier: ProductTier) {
  return tier === "core" ? item.coreEnabled : tier === "pro" ? item.proEnabled : item.apexEnabled;
}

export function optionsFor(tier: ProductTier, category: InventoryCategory) {
  return SEED_INVENTORY.filter((item) => item.category === category && isEligible(item, tier));
}

export function defaultConfiguration(variantId: string): ProductConfiguration {
  const model = MODELS.find((entry) => entry.id === variantId);
  if (!model) throw new Error("Unknown product variant.");
  return { ...DEFAULTS[model.tier], groupset: VARIANT_GROUPSET[variantId] };
}

export function validateConfiguration(variantId: string, configuration: ProductConfiguration) {
  const model = MODELS.find((entry) => entry.id === variantId);
  if (!model) throw new Error("Unknown product variant.");
  return CONFIGURATION_CATEGORIES.map(({ key, label, quantityPerBike }) => {
    const item = SEED_INVENTORY.find((entry) => entry.id === configuration[key]);
    if (!item || item.category !== key || !isEligible(item, model.tier))
      throw new Error(`${label} is missing or is not allowed for ${model.name}.`);
    if (key === "groupset" && item.id !== VARIANT_GROUPSET[variantId])
      throw new Error(`Groupset must match the selected ${model.name} variant.`);
    return { ...item, quantityPerBike };
  });
}

export function modelFamily(tier: ProductTier) {
  return tier === "core" ? "Longitude" : tier === "pro" ? "Latitude" : "Altitude";
}
