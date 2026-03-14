import { Pool } from "pg";
import { layBienMoiTruongServer } from "@/server/config/env";

let cachedPool: Pool | null = null;
let daCanhBaoRoleQuyenRong = false;

function docTenUserTuConnectionString(connectionString: string): string | null {
  try {
    const parsed = new URL(connectionString);
    return parsed.username ? decodeURIComponent(parsed.username) : null;
  } catch {
    return null;
  }
}

function kiemTraLeastPrivilege(connectionString: string): void {
  const env = layBienMoiTruongServer();
  const userName = docTenUserTuConnectionString(connectionString);

  if (env.databaseExpectedUser) {
    if (!userName || userName !== env.databaseExpectedUser) {
      throw new Error(
        `[postgres] DATABASE_URL dang dung user '${userName ?? "khong-xac-dinh"}' khac DATABASE_EXPECTED_USER='${env.databaseExpectedUser}'.`,
      );
    }
    return;
  }

  const laUserQuyenRong = userName === "postgres" || userName === "supabase_admin";
  if (laUserQuyenRong && !daCanhBaoRoleQuyenRong) {
    // Canh bao de team van hanh bo sung role least-privilege cho app path.
    console.warn(
      `[postgres] Canh bao: DATABASE_URL dang dung user '${userName}' co kha nang quyen rong. Nen tach role least-privilege va cau hinh DATABASE_EXPECTED_USER.`,
    );
    daCanhBaoRoleQuyenRong = true;
  }
}

export function layPostgresPool(): Pool {
  if (cachedPool) {
    return cachedPool;
  }

  const env = layBienMoiTruongServer();
  if (!env.databaseUrl) {
    throw new Error("[postgres] Chua cau hinh DATABASE_URL cho app-service path.");
  }

  kiemTraLeastPrivilege(env.databaseUrl);

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
