import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

export type VibpeUiObservationInput = {
  capabilityId: string;
  target: string;
  passed: boolean;
  observedResult: string;
  routePath: string;
  correlationId?: string;
  evidence?: Record<string, unknown>;
};

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export const getVibpeUiAssurance = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const sql = await getSql();
    const [capabilities, coverage, exceptions] = await Promise.all([
      sql.query("select * from vyndi_vibpe_ui_capability_registry where active=true order by domain,route_path,capability_id"),
      sql.query("select * from vyndi_vibpe_ui_coverage_summary order by domain"),
      sql.query(`select * from vyndi_vibpe_ui_assurance_exceptions
                 order by case severity when 'critical' then 1 else 2 end, domain, entity_id`),
    ]);
    return { capabilities, coverage, exceptions };
  });

export const recordVibpeUiObservation = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .inputValidator((input: VibpeUiObservationInput) => input)
  .handler(async ({ data, context }) => {
    const actor = await requireBusinessActor(
      "edit",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const capabilityId = clean(data.capabilityId, 120);
    const target = clean(data.target, 120);
    const routePath = clean(data.routePath, 240);
    const observedResult = clean(data.observedResult, 1000);
    if (!capabilityId || !target || !routePath || !observedResult) throw new Error("Incomplete UI assurance observation.");

    const sql = await getSql();
    const registered = await sql.query<{ route_path: string }>(
      "select route_path from vyndi_vibpe_ui_capability_registry where capability_id=$1 and active=true",
      [capabilityId],
    );
    if (!registered[0]) throw new Error("Unknown or inactive UI assurance capability.");
    if (registered[0].route_path !== routePath && capabilityId !== "UI-AUTH-SESSION") {
      throw new Error("Observed route does not match the registered UI capability.");
    }

    const id = `VIBPE-UI-${crypto.randomUUID()}`;
    await sql.query(
      `insert into vyndi_vibpe_ui_observations
        (id,capability_id,target,actor_user_id,actor_role,passed,observed_result,route_path,correlation_id,evidence_json)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        id,
        capabilityId,
        target,
        actor.userId,
        actor.role,
        Boolean(data.passed),
        observedResult,
        routePath,
        clean(data.correlationId, 200) || null,
        JSON.stringify(data.evidence ?? {}),
      ],
    );
    return { id, capabilityId, target, passed: Boolean(data.passed) };
  });
