import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const REQUIRED_KEYS = [
  "APP_ORIGIN",
  "AUTH_ADAPTER_MODE",
  "SESSION_TOKEN_PEPPER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DATABASE_EXPECTED_USER",
];

const RISKY_DB_USERS = ["postgres", "supabase_admin"];

function parseEnvFile(filePath) {
  const envMap = new Map();
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) {
      continue;
    }

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    envMap.set(key, value);
  }

  return envMap;
}

function maskSecret(value) {
  if (!value) {
    return "";
  }
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function maskUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname.endsWith(".supabase.co")) {
      return `${parsed.protocol}//****.supabase.co`;
    }

    const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return `${parsed.protocol}//${host}`;
  } catch {
    return "INVALID_URL";
  }
}

function maskDatabaseUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const username = decodeURIComponent(parsed.username || "");
    const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, "");
    return `postgresql://${username}:***@${host}/${dbName}`;
  } catch {
    return "INVALID_DATABASE_URL";
  }
}

function validateRuntimeEnv(envMap) {
  const items = [];

  for (const key of REQUIRED_KEYS) {
    const present = envMap.has(key);
    const value = envMap.get(key) ?? "";
    let maskedValue = "";
    let format = "ok";

    if (key === "APP_ORIGIN" || key === "NEXT_PUBLIC_SUPABASE_URL") {
      maskedValue = maskUrl(value);
      if (present && maskedValue === "INVALID_URL") {
        format = "invalid";
      }
    } else if (key === "DATABASE_URL") {
      maskedValue = maskDatabaseUrl(value);
      if (present && maskedValue === "INVALID_DATABASE_URL") {
        format = "invalid";
      }
    } else if (key === "AUTH_ADAPTER_MODE" || key === "DATABASE_EXPECTED_USER") {
      maskedValue = value;
    } else {
      maskedValue = maskSecret(value);
    }

    items.push({
      key,
      present,
      format,
      maskedValue,
    });
  }

  return items;
}

function parseDatabaseUser(databaseUrl) {
  if (!databaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(databaseUrl);
    return decodeURIComponent(parsed.username || "");
  } catch {
    return null;
  }
}

function parseDatabaseUrlParts(databaseUrl) {
  if (!databaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : null,
      username: decodeURIComponent(parsed.username || ""),
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

function detectHighRiskUser(username) {
  if (!username) {
    return false;
  }

  if (RISKY_DB_USERS.includes(username)) {
    return true;
  }

  if (/^postgres\./i.test(username)) {
    return true;
  }

  if (/(admin|owner)/i.test(username)) {
    return true;
  }

  return false;
}

async function runDatabaseChecks(databaseUrl) {
  if (!databaseUrl) {
    return {
      connected: false,
      reason: "DATABASE_URL missing",
    };
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
  });

  try {
    try {
      const basic = await pool.query(
        "select current_user, session_user, current_database() as current_database",
      );
      const roleMeta = await pool.query(
        `select rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
         from pg_roles
         where rolname = current_user`,
      );
      const schemaPrivilege = await pool.query(
        "select has_schema_privilege(current_user, 'public', 'CREATE') as can_create_public_schema",
      );
      const grants = await pool.query(
        `select table_name, privilege_type
         from information_schema.role_table_grants
         where grantee = current_user
           and table_schema = 'public'
           and table_name in (
             'user_accounts',
             'user_profiles',
             'app_sessions',
             'teacher_verification_requests',
             'teacher_verification_audit_logs'
           )
         order by table_name, privilege_type`,
      );
      const publicTables = await pool.query(
        `select table_name
         from information_schema.tables
         where table_schema = 'public'
         order by table_name`,
      );
      let tablePrivilegeMatrix = { rows: [] };
      let tablePrivilegeError = null;
      try {
        tablePrivilegeMatrix = await pool.query(
          `select table_name,
                  to_regclass('public.' || table_name) is not null as table_exists,
                  case when to_regclass('public.' || table_name) is null then null
                       else has_table_privilege(current_user, 'public.' || table_name, 'SELECT') end as can_select,
                  case when to_regclass('public.' || table_name) is null then null
                       else has_table_privilege(current_user, 'public.' || table_name, 'INSERT') end as can_insert,
                  case when to_regclass('public.' || table_name) is null then null
                       else has_table_privilege(current_user, 'public.' || table_name, 'UPDATE') end as can_update,
                  case when to_regclass('public.' || table_name) is null then null
                       else has_table_privilege(current_user, 'public.' || table_name, 'DELETE') end as can_delete
           from unnest($1::text[]) as table_name`,
          [
            [
              "user_accounts",
              "user_profiles",
              "app_sessions",
              "teacher_verification_requests",
              "teacher_verification_audit_logs",
            ],
          ],
        );
      } catch (error) {
        tablePrivilegeError = error instanceof Error ? error.message : String(error);
      }

      return {
        connected: true,
        basic: basic.rows[0] ?? null,
        roleMeta: roleMeta.rows[0] ?? null,
        schemaPrivilege: schemaPrivilege.rows[0] ?? null,
        grants: grants.rows ?? [],
        publicTables: publicTables.rows ?? [],
        tablePrivilegeMatrix: tablePrivilegeMatrix.rows ?? [],
        tablePrivilegeError,
        reason: null,
      };
    } catch (error) {
      return {
        connected: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }

  const envMap = parseEnvFile(envPath);
  const runtimeEnv = validateRuntimeEnv(envMap);
  const databaseUrl = envMap.get("DATABASE_URL") ?? "";
  const databaseUrlParts = parseDatabaseUrlParts(databaseUrl);
  const expectedUser = envMap.get("DATABASE_EXPECTED_USER") ?? "";
  const parsedDbUser = parseDatabaseUser(databaseUrl);
  const databaseChecks = await runDatabaseChecks(databaseUrl);

  const currentUser = databaseChecks.connected ? databaseChecks.basic?.current_user ?? null : null;
  const highRiskByUsername = detectHighRiskUser(parsedDbUser || "");
  const highRiskByCurrentUser = detectHighRiskUser(currentUser || "");
  const roleMeta = databaseChecks.connected ? databaseChecks.roleMeta : null;
  const canCreateSchema =
    databaseChecks.connected && databaseChecks.schemaPrivilege
      ? Boolean(databaseChecks.schemaPrivilege.can_create_public_schema)
      : null;

  const result = {
    runtimeEnv,
    databaseUrlParts,
    databaseUserCheck: {
      parsedDatabaseUser: parsedDbUser,
      databaseExpectedUser: expectedUser || null,
      matchesExpectedUser: Boolean(parsedDbUser && expectedUser && parsedDbUser === expectedUser),
      highRiskByUsername,
      currentUser,
      sessionUser: databaseChecks.connected ? databaseChecks.basic?.session_user ?? null : null,
      currentDatabase: databaseChecks.connected ? databaseChecks.basic?.current_database ?? null : null,
      highRiskByCurrentUser,
      roleMeta,
      canCreateSchema,
      grants: databaseChecks.connected ? databaseChecks.grants : [],
      publicTables: databaseChecks.connected ? databaseChecks.publicTables ?? [] : [],
      tablePrivilegeMatrix: databaseChecks.connected ? databaseChecks.tablePrivilegeMatrix ?? [] : [],
      tablePrivilegeError: databaseChecks.connected ? databaseChecks.tablePrivilegeError ?? null : null,
      connectionError: databaseChecks.connected ? null : databaseChecks.reason,
    },
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
