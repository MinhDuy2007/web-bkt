import { Pool } from "pg";
import { layBienMoiTruongServer } from "@/server/config/env";

let cachedPool: Pool | null = null;

export function layPostgresPool(): Pool {
  if (cachedPool) {
    return cachedPool;
  }

  const env = layBienMoiTruongServer();
  if (!env.databaseUrl) {
    throw new Error("[postgres] Chua cau hinh DATABASE_URL cho app-service path.");
  }

  cachedPool = new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: env.databaseUrl.includes("sslmode=")
      ? undefined
      : process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  return cachedPool;
}
