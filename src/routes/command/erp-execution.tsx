import { createFileRoute, Link } from "@tanstack/react-router";
import { Phase6AAuthGate } from "@/components/phase6a-auth-gate";

export const Route = createFileRoute("/command/erp-execution")({ component: ErpExecution });

function ErpExecution() {
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Link to="/command/control-tower" className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent">
          Control Tower →
        </Link>
      </div>
      <Phase6AAuthGate />
    </>
  );
}
