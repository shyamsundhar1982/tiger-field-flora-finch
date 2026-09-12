export type PostgresTransportSource = "hyperdrive" | "database-url";

export type PostgresTransport = {
  source: PostgresTransportSource;
  connectionString: string;
};

type TransportCandidates = {
  hyperdriveConnectionString?: string;
  databaseUrl?: string;
};

type CloudflareRuntimeEnv = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
};

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Pure precedence rule used by both runtime resolution and tests.
 * Hyperdrive must win when the Worker binding is present; DATABASE_URL remains
 * the portable Vercel/Node fallback and local development can still use PGLite.
 */
export function selectPostgresTransport(candidates: TransportCandidates): PostgresTransport | null {
  const hyperdriveConnectionString = nonBlank(candidates.hyperdriveConnectionString);
  if (hyperdriveConnectionString) {
    return { source: "hyperdrive", connectionString: hyperdriveConnectionString };
  }

  const databaseUrl = nonBlank(candidates.databaseUrl);
  if (databaseUrl) {
    return { source: "database-url", connectionString: databaseUrl };
  }

  return null;
}

async function cloudflareHyperdriveConnectionString(): Promise<string | undefined> {
  try {
    // TanStack Start on Cloudflare exposes platform bindings through this
    // runtime module. Dynamic import keeps Node/Vercel builds portable.
    const workers = await import("cloudflare:workers");
    const runtimeEnv = workers.env as CloudflareRuntimeEnv | undefined;
    return nonBlank(runtimeEnv?.HYPERDRIVE?.connectionString);
  } catch {
    // Outside Cloudflare Workers the platform module is intentionally absent.
    return undefined;
  }
}

/** Resolve the deployed Postgres transport at runtime, not at module load. */
export async function resolvePostgresTransport(): Promise<PostgresTransport | null> {
  const hyperdriveConnectionString = await cloudflareHyperdriveConnectionString();
  const databaseUrl =
    typeof process !== "undefined" ? nonBlank(process.env.DATABASE_URL) : undefined;

  return selectPostgresTransport({ hyperdriveConnectionString, databaseUrl });
}
