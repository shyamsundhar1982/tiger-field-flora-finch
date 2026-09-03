export type Model = {
  id: string;
  tier: "core" | "pro" | "apex";
  name: string;
  brand: "Shimano" | "SRAM";
  groupset: string;
  wheelset: string;
  tyres: string;
  asp: number;
};

export const MODELS: Model[] = [
  // =========================
  // CORE
  // =========================

  {
    id: "core-tiagra",
    tier: "core",
    name: "Core Tiagra",
    brand: "Shimano",
    groupset: "Shimano Tiagra 4700",
    wheelset: "Performance Alloy",
    tyres: "Continental Ultra Sport III",
    asp: 111900,
  },

  {
    id: "core-105",
    tier: "core",
    name: "Core 105",
    brand: "Shimano",
    groupset: "Shimano 105 R7000",
    wheelset: "Performance Alloy",
    tyres: "Vittoria Rubino Pro IV",
    asp: 145300,
  },

  {
    id: "core-105-elite",
    tier: "core",
    name: "Core 105 Elite",
    brand: "Shimano",
    groupset: "Shimano 105 R7000",
    wheelset: "Light Alloy 30",
    tyres: "Continental GP5000",
    asp: 158100,
  },

  // =========================
  // PRO
  // =========================

  {
    id: "pro-105-di2",
    tier: "pro",
    name: "Pro 105 Di2",
    brand: "Shimano",
    groupset: "Shimano 105 R7150 Di2",
    wheelset: "3T Carbon CW-3T2",
    tyres: "Vittoria Rubino Pro IV",
    asp: 215000,
  },

  {
    id: "pro-rival-axs",
    tier: "pro",
    name: "Pro Rival AXS",
    brand: "SRAM",
    groupset: "SRAM Rival AXS",
    wheelset: "3T Carbon CW-3T2",
    tyres: "Vittoria Rubino Pro IV",
    asp: 205000,
  },

  {
    id: "pro-ultegra-di2",
    tier: "pro",
    name: "Pro Ultegra Di2",
    brand: "Shimano",
    groupset: "Shimano Ultegra R8170 Di2",
    wheelset: "3T Carbon CW-3T2",
    tyres: "Continental GP5000",
    asp: 255000,
  },

  {
    id: "pro-force-axs",
    tier: "pro",
    name: "Pro Force AXS",
    brand: "SRAM",
    groupset: "SRAM Force AXS",
    wheelset: "3T Carbon CW-3T2",
    tyres: "Continental GP5000",
    asp: 245000,
  },

  // =========================
  // APEX
  // =========================

  {
    id: "apex-ultegra-di2",
    tier: "apex",
    name: "Apex Ultegra Di2",
    brand: "Shimano",
    groupset: "Shimano Ultegra R8170 Di2",
    wheelset: "Magene EXAR Pro DB58",
    tyres: "Vittoria Corsa Pro",
    asp: 295000,
  },

  {
    id: "apex-duraace-di2",
    tier: "apex",
    name: "Apex Dura-Ace Di2",
    brand: "Shimano",
    groupset: "Shimano Dura-Ace R9200 Di2",
    wheelset: "Magene EXAR Pro DB58",
    tyres: "Vittoria Corsa Pro",
    asp: 395000,
  },

  {
    id: "apex-red-axs",
    tier: "apex",
    name: "Apex RED AXS",
    brand: "SRAM",
    groupset: "SRAM RED AXS",
    wheelset: "Magene EXAR Pro DB58",
    tyres: "Vittoria Corsa Pro",
    asp: 425000,
  },
];
