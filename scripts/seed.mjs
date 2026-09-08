// One-time import: populates Stream / Application / Initiative from
// scripts/seed-data.json (dummy sample data) so the dashboard and input form
// aren't empty on first use.
//
// Usage:
//   node --env-file=.env.local scripts/seed.mjs
//
// Safe to re-run: every insert is an upsert (ON CONFLICT), so running this
// again just refreshes names/PIC without creating duplicates.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  console.error(
    "DATABASE_URL tidak ditemukan. Jalankan dengan: node --env-file=.env.local scripts/seed.mjs"
  );
  process.exit(1);
}

const sql = neon(connectionString);

const dataPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "seed-data.json"
);
const streams = JSON.parse(readFileSync(dataPath, "utf-8"));

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS streams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INT NOT NULL DEFAULT 0,
      archived BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      stream_id INT NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(stream_id, name)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS initiatives (
      id SERIAL PRIMARY KEY,
      application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      pic TEXT NOT NULL DEFAULT '',
      archived BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(application_id, name)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS updates (
      id SERIAL PRIMARY KEY,
      initiative_id INT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
      period_label TEXT NOT NULL,
      rag TEXT NOT NULL DEFAULT 'green' CHECK (rag IN ('green', 'amber', 'red')),
      key_highlight TEXT NOT NULL DEFAULT '',
      progress_last_2wk TEXT NOT NULL DEFAULT '',
      plan_next_2wk TEXT NOT NULL DEFAULT '',
      risk_issue TEXT NOT NULL DEFAULT '',
      unlocking_needed TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function upsertStream(name) {
  const [{ next_order }] = await sql`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM streams
  `;
  const [row] = await sql`
    INSERT INTO streams (name, sort_order)
    VALUES (${name}, ${next_order})
    ON CONFLICT (name) DO UPDATE SET archived = false
    RETURNING id
  `;
  return row.id;
}

async function upsertApplication(streamId, name) {
  const [row] = await sql`
    INSERT INTO applications (stream_id, name)
    VALUES (${streamId}, ${name})
    ON CONFLICT (stream_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  return row.id;
}

async function upsertInitiative(applicationId, name, pic) {
  await sql`
    INSERT INTO initiatives (application_id, name, pic)
    VALUES (${applicationId}, ${name}, ${pic})
    ON CONFLICT (application_id, name) DO UPDATE SET
      pic = CASE WHEN EXCLUDED.pic <> '' THEN EXCLUDED.pic ELSE initiatives.pic END,
      archived = false
  `;
}

async function main() {
  await ensureSchema();

  let streamCount = 0;
  let appCount = 0;
  let initiativeCount = 0;

  for (const s of streams) {
    const streamId = await upsertStream(s.stream);
    streamCount++;
    for (const a of s.applications) {
      const applicationId = await upsertApplication(streamId, a.name);
      appCount++;
      for (const init of a.initiatives) {
        await upsertInitiative(applicationId, init.name, init.pic || "");
        initiativeCount++;
      }
    }
  }

  console.log(
    `Selesai: ${streamCount} stream, ${appCount} application, ${initiativeCount} initiative ditambahkan/diperbarui.`
  );
}

main().catch((err) => {
  console.error("Seed gagal:", err);
  process.exit(1);
});
