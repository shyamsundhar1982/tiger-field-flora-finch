import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TIERS } from "@/lib/data/company";
import { BOM, bomTotal } from "@/lib/data/bom";
import { inr, pct } from "@/lib/format";

export const Route = createFileRoute("/range/$tier")({ component: TierPage });

const GROUPSETS = [
  { id: "sora", name: "Shimano Sora R3000", detail: "2x9 mechanical", price: 45000 },
  { id: "tiagra", name: "Shimano Tiagra 4700", detail: "2x10 mechanical", price: 38000 },
  { id: "105-mech", name: "Shimano 105 R7120", detail: "2x12 mechanical", price: 90000 },
  { id: "rival-axs", name: "SRAM Rival AXS", detail: "2x12 wireless electronic", price: 140000 },
  { id: "105-di2", name: "Shimano 105 R7150 Di2", detail: "2x12 electronic", price: 150000 },
  { id: "force-axs", name: "SRAM Force AXS", detail: "2x12 wireless electronic", price: 200000 },
  { id: "ultegra-di2", name: "Shimano Ultegra R8170 Di2", detail: "2x12 electronic", price: 230000 },
  { id: "duraace-di2", name: "Shimano Dura-Ace R9200 Di2", detail: "2x12 electronic flagship", price: 340000 },
  { id: "red-axs", name: "SRAM RED AXS", detail: "2x12 wireless electronic flagship", price: 380000 },
] as const;
const TYRES = [
  { id: "ultra-sport", name: "Continental Ultra Sport III", detail: "Training / entry race · pair", price: 7590 },
  { id: "rubino-pro", name: "Vittoria Rubino Pro IV G2.0", detail: "Endurance · pair", price: 9800 },
  { id: "gp5000", name: "Continental Grand Prix 5000", detail: "Performance · pair", price: 17790 },
  { id: "corsa-pro", name: "Vittoria Corsa Pro G2.0", detail: "Race · pair", price: 19000 },
] as const;
const WHEELSETS = [
  { id: "alloy", name: "Performance Alloy", detail: "Training / everyday", price: 30000 },
  { id: "alloy-plus", name: "Light Alloy 30", detail: "Fast endurance", price: 45000 },
  { id: "carbon-50", name: "3T Carbon CW-3T2", detail: "50 mm carbon", price: 65000 },
  { id: "carbon-58", name: "Magene EXAR Pro DB58", detail: "58 mm carbon", price: 78900 },
] as const;
type Option = { id: string; name: string; detail: string; price: number };
const DEFAULTS = { core: { groupset: "105-mech", tyre: "rubino-pro", wheelset: "alloy" }, pro: { groupset: "105-di2", tyre: "rubino-pro", wheelset: "carbon-50" }, apex: { groupset: "ultegra-di2", tyre: "corsa-pro", wheelset: "carbon-58" } } as const;
function delta(option: Option, options: readonly Option[], defaultId: string) { return option.price - options.find((x) => x.id === defaultId)!.price; }

function TierPage() { throw new Error('preserved remainder omitted'); }