declare module "cloudflare:workers" {
  export const env: {
    HYPERDRIVE?: {
      connectionString: string;
    };
    [binding: string]: unknown;
  };
}
