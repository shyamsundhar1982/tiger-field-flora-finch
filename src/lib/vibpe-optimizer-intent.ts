export const GOVERNED_OPTIMIZER_ROUTE = "/command/ibpe-operating-workspace/optimizer";

export function isGovernedOptimizerExecutionRequest(question: string) {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const asksExecution = /\b(run|execute|start|invoke|launch)\b/.test(q);
  const namesOptimizer = /\b(optimizer|optimiser|optimization|optimisation|highs|milp)\b/.test(q);
  const asksPlanOptimization = /\boptimi[sz]e\b/.test(q)
    && /\b(plan|planning|procurement|production|supply|ibpe|vibpe)\b/.test(q);
  return (asksExecution && namesOptimizer) || asksPlanOptimization;
}
