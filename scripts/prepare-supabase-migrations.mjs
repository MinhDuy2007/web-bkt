import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PROJECT_ROOT = process.cwd();
const SUPABASE_MIGRATIONS_DIR = resolve(PROJECT_ROOT, "supabase", "migrations");
const GENERATED_MARKER = "-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs";
const SOURCE_DIRS = [
  { kind: "migration", dir: resolve(PROJECT_ROOT, "db", "migrations") },
  { kind: "policy", dir: resolve(PROJECT_ROOT, "db", "policies") },
];

function docTatCaFileSql(dirPath) {
  if (!statSync(dirPath, { throwIfNoEntry: false })?.isDirectory?.()) {
    return [];
  }

  return readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => join(dirPath, fileName));
}

function parseTenMigrationNguon(filePath) {
  const fileName = filePath.split(/[\\/]/).pop() ?? "";
  const match = fileName.match(
    /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})--([a-z0-9-]+)\.sql$/i,
  );

  if (!match) {
    throw new Error(
      `Ten migration/policy khong dung dinh dang mong doi: ${relative(PROJECT_ROOT, filePath)}`,
    );
  }

  const version = `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}${match[6]}`;
  const slug = match[7].toLowerCase();
  return { version, slug };
}

function taoTenMigrationSupabase(sourceKind, version, slug) {
  if (sourceKind === "policy") {
    return `${version}__policy-${slug}.sql`;
  }

  return `${version}__${slug}.sql`;
}

function taoNoiDungMigration(targetName, sourceRelativePath, sourceSql) {
  const body = sourceSql.trimEnd();
  return `-- Migration: ${targetName}
-- Nguon: ${sourceRelativePath}
${GENERATED_MARKER}

${body}
`;
}

function dongBoMigration() {
  mkdirSync(SUPABASE_MIGRATIONS_DIR, { recursive: true });

  const generatedMap = new Map();

  for (const { kind, dir } of SOURCE_DIRS) {
    const sqlFiles = docTatCaFileSql(dir);
    for (const filePath of sqlFiles) {
      const { version, slug } = parseTenMigrationNguon(filePath);
      const targetName = taoTenMigrationSupabase(kind, version, slug);
      const targetPath = join(SUPABASE_MIGRATIONS_DIR, targetName);
      const sourceRelativePath = relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
      const sql = readFileSync(filePath, "utf8");
      const nextContent = taoNoiDungMigration(targetName, sourceRelativePath, sql);

      if (generatedMap.has(targetName)) {
        throw new Error(`Trung ten migration sau khi dong bo: ${targetName}`);
      }

      generatedMap.set(targetName, { targetPath, content: nextContent });
    }
  }

  const existingMigrationFiles = readdirSync(SUPABASE_MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  let removedCount = 0;
  for (const fileName of existingMigrationFiles) {
    if (generatedMap.has(fileName)) {
      continue;
    }

    const filePath = join(SUPABASE_MIGRATIONS_DIR, fileName);
    const content = readFileSync(filePath, "utf8");
    if (content.includes(GENERATED_MARKER)) {
      rmSync(filePath);
      removedCount += 1;
    }
  }

  let writtenCount = 0;
  for (const payload of Array.from(generatedMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((entry) => entry[1])) {
    const { targetPath, content } = payload;
    const currentContent = statSync(targetPath, { throwIfNoEntry: false })?.isFile?.()
      ? readFileSync(targetPath, "utf8")
      : null;

    if (currentContent !== content) {
      writeFileSync(targetPath, content, "utf8");
      writtenCount += 1;
    }
  }

  process.stdout.write(
    [
      `[db:prepare-migrations] Tong file nguon: ${generatedMap.size}`,
      `[db:prepare-migrations] Da ghi/cap nhat: ${writtenCount}`,
      `[db:prepare-migrations] Da xoa file generated cu: ${removedCount}`,
      `[db:prepare-migrations] Thu muc dich: ${relative(PROJECT_ROOT, SUPABASE_MIGRATIONS_DIR).replace(/\\/g, "/")}`,
    ].join("\n") + "\n",
  );
}

dongBoMigration();
