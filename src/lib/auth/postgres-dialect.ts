import {
  CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  type TransactionSettings,
} from "kysely";
import { Client } from "pg";

type PostgresClient = Pick<Client, "connect" | "end" | "query">;
type PostgresClientFactory = () => PostgresClient;

/**
 * Better Auth is initialized once per Worker isolate, so a normal pg.Pool can
 * retain request-owned sockets after the request that created them has ended.
 * This dialect keeps only a connection factory at module scope. Every Kysely
 * acquisition creates a fresh client and every release closes it, which makes
 * a session lookup after the cookie-cache boundary safe in a later request.
 */
export function requestSafePostgresDialect(
  connectionString: string,
  createClient: PostgresClientFactory = () => new Client({ connectionString }),
): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new RequestSafePostgresDriver(createClient),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector => new PostgresIntrospector(db),
  };
}

class RequestSafePostgresDriver implements Driver {
  private readonly createClient: PostgresClientFactory;

  constructor(createClient: PostgresClientFactory) {
    this.createClient = createClient;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    const client = this.createClient();
    try {
      await client.connect();
      return new RequestSafePostgresConnection(client);
    } catch (error) {
      await client.end().catch(() => undefined);
      throw error;
    }
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    await (connection as RequestSafePostgresConnection).close();
  }

  async beginTransaction(
    connection: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    const isolation = settings.isolationLevel ? ` isolation level ${settings.isolationLevel}` : "";
    await connection.executeQuery(CompiledQuery.raw(`begin${isolation}`));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }

  async destroy(): Promise<void> {
    // No connection is retained by the driver between acquisitions.
  }
}

class RequestSafePostgresConnection implements DatabaseConnection {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const result = await this.client.query(compiledQuery.sql, [...compiledQuery.parameters]);
    return {
      ...(typeof result.rowCount === "number" ? { numAffectedRows: BigInt(result.rowCount) } : {}),
      rows: result.rows as O[],
    };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await this.executeQuery<O>(compiledQuery);
    for (let index = 0; index < result.rows.length; index += chunkSize) {
      yield { rows: result.rows.slice(index, index + chunkSize) };
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
