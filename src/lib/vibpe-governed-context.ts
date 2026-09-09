import { vibpeBusinessOperatorContext } from "@/lib/vibpe-business-operator";

export type VibpeGovernedContext = {
  doctrine: string;
  truthPriority: readonly ["governed-internal", "scenario-assumption", "external-reference", "model-inference"];
  externalAuthority: "advisory-only";
  scenarioAuthority: "advisory-only";
};

export function getVibpeGovernedContext(): VibpeGovernedContext {
  return {
    doctrine: vibpeBusinessOperatorContext(),
    truthPriority: ["governed-internal", "scenario-assumption", "external-reference", "model-inference"],
    externalAuthority: "advisory-only",
    scenarioAuthority: "advisory-only",
  };
}
