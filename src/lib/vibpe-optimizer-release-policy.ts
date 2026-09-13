export type ReleaseLineageInput = {
  deployedSourceSha: string | null | undefined;
  ibpeSourceSha: string | null | undefined;
  packetSourceSha: string | null | undefined;
  packetId: string | null | undefined;
  runParentPacketId: string | null | undefined;
};

function normalized(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function isReleaseMathAndCashReady(
  optimizationStatus: string | null | undefined,
  cashGuardrailStatus: string | null | undefined,
) {
  return (optimizationStatus === "optimal" || optimizationStatus === "feasible")
    && cashGuardrailStatus === "feasible";
}

export function isReleaseGovernanceReady(governance: Record<string, unknown> | null | undefined) {
  return Boolean(
    governance
      && governance.advisoryOnly === true
      && governance.mayCreateTransactions === false
      && governance.humanApprovalRequiredForBusinessAction === true,
  );
}

export function hasExactReleaseLineage(input: ReleaseLineageInput) {
  const deployed = normalized(input.deployedSourceSha);
  const ibpe = normalized(input.ibpeSourceSha);
  const packet = normalized(input.packetSourceSha);
  const packetId = String(input.packetId ?? "").trim();
  const runParentPacketId = String(input.runParentPacketId ?? "").trim();

  if (deployed.length < 7 || ibpe.length < 7 || packet.length < 7) return false;
  if (!packetId || !runParentPacketId) return false;
  return deployed === ibpe && ibpe === packet && packetId === runParentPacketId;
}
