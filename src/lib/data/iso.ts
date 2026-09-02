export const ISO_TESTS = [
  {
    id: "T01",
    item: "Frame — static strength (ISO 4210-6)",
    samples: "2 frames",
    weeks: "1–2",
    cost: 1.2,
    accept: "No fracture / crack beyond limit at proof load",
  },
  {
    id: "T02",
    item: "Frame — fatigue (pedalling + horizontal)",
    samples: "2 frames",
    weeks: "3–5",
    cost: 2.8,
    accept: "Survive specified cycles without failure",
  },
  {
    id: "T03",
    item: "Frame — impact (falling mass / frame)",
    samples: "1–2 frames",
    weeks: "1",
    cost: 0.9,
    accept: "Residual strength after impact within spec",
  },
  {
    id: "T04",
    item: "Fork — static + fatigue + impact",
    samples: "2 forks",
    weeks: "2–4",
    cost: 2.1,
    accept: "ISO 4210-6 fork clauses met",
  },
  {
    id: "T05",
    item: "Handlebar / stem assembly",
    samples: "2 assemblies",
    weeks: "1–2",
    cost: 0.8,
    accept: "No slip, crack, or clamp failure",
  },
  {
    id: "T06",
    item: "Seatpost",
    samples: "2 posts",
    weeks: "1",
    cost: 0.5,
    accept: "Clamp and fatigue clauses met",
  },
  {
    id: "T07",
    item: "Steering / headset assembly",
    samples: "1 system",
    weeks: "1",
    cost: 0.4,
    accept: "Steering torque and security",
  },
  {
    id: "T08",
    item: "Braking (system, ISO 4210-4)",
    samples: "1 complete bike",
    weeks: "1",
    cost: 0.7,
    accept: "Stopping distance / control",
  },
  {
    id: "T09",
    item: "Environmental conditioning",
    samples: "1 frame",
    weeks: "1–2",
    cost: 0.6,
    accept: "No delamination after heat/humidity",
  },
  {
    id: "T10",
    item: "Retest reserve (20–30% probability)",
    samples: "as needed",
    weeks: "2–4",
    cost: 2.0,
    accept: "Pass on second article after FEA-guided fix",
  },
] as const;

export const ISO_BUDGET = ISO_TESTS.reduce((s, t) => s + t.cost, 0);

export const ISO_GATES = [
  "FEA closed — no red stress hotspots at ISO loads (M4)",
  "Non-destructive bench overlap during M6 prototype build",
  "Lab slot booked 4 weeks before articles are ready",
  "Articles submitted M7 — results expected M8–M9",
  "Design freeze only on pass. Tooling (T4) releases at M10, not M9.",
] as const;

export const LABS = [
  { name: "ARAI, Pune", fit: "Primary India option — confirm ISO 4210 bicycle capability this week" },
  { name: "ICAT, Manesar", fit: "Parallel quote — lead time and fixture availability" },
  { name: "International (TW / EU)", fit: "Backup if India slots are full. Budget freight + 2 weeks" },
] as const;
