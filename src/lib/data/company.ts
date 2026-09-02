export const COMPANY = {
  legal: "Vāyú Shastr Private Limited",
  brand: "VéLOXIS",
  tagline: "Wind, rendered in carbon.",
  city: "Coimbatore, Tamil Nadu",
  founder: "S. Shyam Sundhar",
  director: "R. Vyjayanthi",
  shareCapital: "₹1 Lakh",
  founderHold: 90,
  esopPool: 10,
  incubator: "PSG-STEP — incubatee application submitted",
  para58Trigger: "Month 3 — CAD geometry lock + FEA structural viability",
} as const;

export const TIERS = [
  {
    id: "core" as const,
    name: "Core",
    epithet: "Endurance",
    asp: 150000,
    cogs: 89900,
    image: "/bikes/core.jpg",
    weight: "890 g frame*",
    pitch:
      "All-day geometry. T700 layup tuned for fatigue life and comfort on 200–1200 km rides.",
    highlights: ["T700 high-modulus", "ISO 4210 path", "Lifetime-class fatigue target"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    epithet: "Race-endurance",
    asp: 180000,
    cogs: 124500,
    image: "/bikes/pro.jpg",
    weight: "820 g frame*",
    pitch:
      "The house bike. Stiffer front triangle, tighter stack/reach, satin carbon with titanium hardware.",
    highlights: ["T700/T800 mix", "Integrated cockpit", "Primary volume mix"],
  },
  {
    id: "apex" as const,
    name: "Apex",
    epithet: "Flagship",
    asp: 240000,
    cogs: 184600,
    image: "/bikes/apex.jpg",
    weight: "760 g frame*",
    pitch:
      "Exposed weave, fully integrated front end, T800 primary. Built for riders who already know.",
    highlights: ["T800 primary", "Raw weave option", "Limited allocation"],
  },
];

export type TierId = (typeof TIERS)[number]["id"];

export const TRANCHES = [
  {
    id: "T1",
    amount: 15,
    month: 1,
    name: "Foundation",
    deliverable: "Incorporation, DPIIT Deep Tech, banking, CAD seat, IP counsel retained",
  },
  {
    id: "T2",
    amount: 35,
    month: 3,
    name: "Engineering",
    deliverable: "CAD lock, FEA, provisional patents (M3 — before OEM), first layup",
  },
  {
    id: "T3",
    amount: 35,
    month: 6,
    name: "Validation",
    deliverable: "Physical prototypes, ISO 4210 submission, OEM deposit, factory visit",
  },
  {
    id: "T4",
    amount: 50,
    month: 10,
    name: "Tooling",
    deliverable: "Production moulds AFTER ISO go. Pilot batch. Moved from M9 so tests land first.",
  },
  {
    id: "STBY",
    amount: 25,
    month: 9,
    name: "Standby CN",
    deliverable: "Closes the M9 trough created by sliding tooling to M10. Cap ₹5 Cr, 20% discount. Drawn only if needed.",
  },
  {
    id: "T5",
    amount: 65,
    month: 14,
    name: "Scale",
    deliverable: "Inventory, launch WC, first 100 customers. Timing flexible M12–M16 with launch.",
  },
] as const;

export const MILESTONES = [
  "₹15 L",
  "₹50 L",
  "₹85 L",
  "₹1.35 Cr",
  "₹2.00 Cr",
] as const;
