import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";

export type CanonicalProductFamily = {
  familyCode: "longitude" | "latitude" | "altitude";
  familyName: string;
  materialClass: string;
  familyStatus: string;
  familyRevision: number;
};

export type CanonicalProductVariant = CanonicalProductFamily & {
  variantId: string;
  businessCode: string;
  variantName: string;
  brand: string;
  groupset: string;
  wheelset: string;
  tyres: string;
  aspInr: number;
  variantStatus: string;
  variantRevision: number;
  active: boolean;
};

async function requireView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Product authority view permission denied.");
  return role;
}

const variantLookupSchema = z.object({
  variantId: z.string().min(1).max(100),
});

const tierLookupSchema = z.object({
  compatibilityTier: z.enum(["core", "pro", "apex"]),
});

export const listCanonicalProductCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const rows = await sql<{
    familyCode: CanonicalProductFamily["familyCode"];
    familyName: string;
    materialClass: string;
    familyStatus: string;
    familyRevision: number;
    variantId: string;
    businessCode: string;
    variantName: string;
    brand: string;
    groupset: string;
    wheelset: string;
    tyres: string;
    aspInr: string | number;
    variantStatus: string;
    variantRevision: number;
    active: boolean;
  }>`
    select
      family_code as "familyCode",
      family_name as "familyName",
      material_class as "materialClass",
      family_status as "familyStatus",
      family_revision as "familyRevision",
      variant_id as "variantId",
      business_code as "businessCode",
      variant_name as "variantName",
      brand,
      groupset,
      wheelset,
      tyres,
      asp_inr as "aspInr",
      variant_status as "variantStatus",
      variant_revision as "variantRevision",
      active
    from vyndi_product_catalog
    order by
      case family_code when 'longitude' then 1 when 'latitude' then 2 when 'altitude' then 3 else 99 end,
      business_code
  `;
  return (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, aspInr: Number(row.aspInr) })) as CanonicalProductVariant[];
});

/** Resolve either the stable current variant ID or its explicit compatibility ID. */
export const resolveCanonicalProductVariant = createServerFn({ method: "GET" })
  .validator(variantLookupSchema)
  .handler(async ({ data }) => {
    await requireView();
    const sql = await getSql();
    const rows = await sql<CanonicalProductVariant & { aspInr: string | number }>`
      select
        f.family_code as "familyCode",
        f.display_name as "familyName",
        f.material_class as "materialClass",
        f.status as "familyStatus",
        f.revision as "familyRevision",
        v.variant_id as "variantId",
        v.business_code as "businessCode",
        v.display_name as "variantName",
        v.brand,
        v.groupset,
        v.wheelset,
        v.tyres,
        v.asp_inr as "aspInr",
        v.status as "variantStatus",
        v.revision as "variantRevision",
        v.active
      from vyndi_product_variants v
      join vyndi_product_families f on f.family_code=v.family_code
      where (v.variant_id=${data.variantId} or v.compatibility_variant_id=${data.variantId})
        and v.active=true
      order by v.revision desc
      limit 1
    `;
    const row = rows[0];
    return row ? { ...row, aspInr: Number(row.aspInr) } : null;
  });

/**
 * Compatibility lookup for legacy tier-based calculations. This is deliberately
 * server-side so core/pro/apex remains an implementation alias rather than the
 * user-facing business identity.
 */
export const resolveCanonicalFamilyByCompatibilityTier = createServerFn({ method: "GET" })
  .validator(tierLookupSchema)
  .handler(async ({ data }) => {
    await requireView();
    const sql = await getSql();
    const rows = await sql<{
      familyCode: CanonicalProductFamily["familyCode"];
      familyName: string;
      materialClass: string;
      familyStatus: string;
      familyRevision: number;
    }>`
      select
        family_code as "familyCode",
        display_name as "familyName",
        material_class as "materialClass",
        status as "familyStatus",
        revision as "familyRevision"
      from vyndi_product_families
      where compatibility_tier=${data.compatibilityTier}
      limit 1
    `;
    return rows[0] ?? null;
  });
