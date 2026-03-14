import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

function napEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  napEnvLocal();
  if (!process.env.DATABASE_URL) {
    throw new Error("Khong tim thay DATABASE_URL de kiem tra DB runtime.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const tables = await pool.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('classes', 'class_members')
      order by table_name
    `);

    const policies = await pool.query(`
      select tablename, policyname
      from pg_policies
      where schemaname = 'public'
        and tablename in ('classes', 'class_members')
      order by tablename, policyname
    `);

    console.log(
      JSON.stringify(
        {
          ok: true,
          tables: tables.rows,
          policies: policies.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

await main();
