import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!connectionString) {
      throw new Error(
        "Database belum di-setup. Tambahkan environment variable DATABASE_URL (lihat README.md)."
      );
    }

    client = neon(connectionString);
  }
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getClient()(strings, ...values);
}

let schemaReady: Promise<unknown> | null = null;

async function createSchema() {
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
  // current_rag/current_phase reflect the Excel tracker's status as of the last
  // import — distinct from `updates.rag`, which is the RAG attached to a specific
  // biweekly narrative report. Added via ALTER so it backfills on already-deployed
  // databases without a separate migration step.
  await sql`
    ALTER TABLE initiatives
      ADD COLUMN IF NOT EXISTS current_rag TEXT NOT NULL DEFAULT 'green'
        CHECK (current_rag IN ('green', 'amber', 'red'))
  `;
  await sql`
    ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS current_phase TEXT NOT NULL DEFAULT ''
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
  // One cell of the monthly Gantt-style "Project Active" view per initiative.
  // Directly editable (click to cycle) rather than derived from target dates,
  // since the Excel tracker has no Go-Live target date columns to compute it from.
  await sql`
    CREATE TABLE IF NOT EXISTS timeline_entries (
      id SERIAL PRIMARY KEY,
      initiative_id INT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
      year INT NOT NULL,
      month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
      status TEXT NOT NULL CHECK (status IN ('dev_uat', 'prep_golive_golive', 'hypercare', 'delay')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(initiative_id, year, month)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS applications_stream_id_idx ON applications(stream_id)`;
  await sql`CREATE INDEX IF NOT EXISTS initiatives_application_id_idx ON initiatives(application_id)`;
  await sql`CREATE INDEX IF NOT EXISTS updates_initiative_id_idx ON updates(initiative_id)`;
  await sql`CREATE INDEX IF NOT EXISTS updates_created_at_idx ON updates(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS timeline_entries_initiative_year_idx ON timeline_entries(initiative_id, year)`;
}

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = createSchema();
  }
  return schemaReady;
}

export type Rag = "green" | "amber" | "red";

export type Stream = {
  id: number;
  name: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
};

export type Application = {
  id: number;
  stream_id: number;
  name: string;
  created_at: string;
};

export type Initiative = {
  id: number;
  application_id: number;
  name: string;
  pic: string;
  current_rag: Rag;
  current_phase: string;
  archived: boolean;
  created_at: string;
};

export type Update = {
  id: number;
  initiative_id: number;
  period_label: string;
  rag: Rag;
  key_highlight: string;
  progress_last_2wk: string;
  plan_next_2wk: string;
  risk_issue: string;
  unlocking_needed: string;
  created_at: string;
};

export type TimelineStatus = "dev_uat" | "prep_golive_golive" | "hypercare" | "delay";

export type TimelineEntry = {
  id: number;
  initiative_id: number;
  year: number;
  month: number;
  status: TimelineStatus;
};

export async function upsertStream(name: string): Promise<Stream> {
  const [{ next_order }] = (await sql`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM streams
  `) as { next_order: number }[];

  const [stream] = (await sql`
    INSERT INTO streams (name, sort_order)
    VALUES (${name}, ${next_order})
    ON CONFLICT (name) DO UPDATE SET archived = false
    RETURNING id, name, sort_order, archived, created_at
  `) as Stream[];
  return stream;
}

export async function upsertApplication(
  streamId: number,
  name: string
): Promise<Application> {
  const [application] = (await sql`
    INSERT INTO applications (stream_id, name)
    VALUES (${streamId}, ${name})
    ON CONFLICT (stream_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, stream_id, name, created_at
  `) as Application[];
  return application;
}

export async function upsertInitiative(
  applicationId: number,
  name: string,
  pic: string
): Promise<Initiative> {
  const [initiative] = (await sql`
    INSERT INTO initiatives (application_id, name, pic)
    VALUES (${applicationId}, ${name}, ${pic})
    ON CONFLICT (application_id, name) DO UPDATE SET
      pic = CASE WHEN EXCLUDED.pic <> '' THEN EXCLUDED.pic ELSE initiatives.pic END,
      archived = false
    RETURNING id, application_id, name, pic, current_rag, current_phase, archived, created_at
  `) as Initiative[];
  return initiative;
}

// Used by the Excel tracker import: unlike upsertInitiative(), this always
// overwrites current_rag/current_phase, since a fresh Excel upload is meant
// to refresh the tracker status regardless of what was there before.
export async function upsertInitiativeStatus(
  applicationId: number,
  name: string,
  pic: string,
  rag: Rag,
  phase: string
): Promise<Initiative> {
  const [initiative] = (await sql`
    INSERT INTO initiatives (application_id, name, pic, current_rag, current_phase)
    VALUES (${applicationId}, ${name}, ${pic}, ${rag}, ${phase})
    ON CONFLICT (application_id, name) DO UPDATE SET
      pic = CASE WHEN EXCLUDED.pic <> '' THEN EXCLUDED.pic ELSE initiatives.pic END,
      current_rag = EXCLUDED.current_rag,
      current_phase = EXCLUDED.current_phase,
      archived = false
    RETURNING id, application_id, name, pic, current_rag, current_phase, archived, created_at
  `) as Initiative[];
  return initiative;
}

// Matches by name within a stream regardless of which application it's
// filed under, so imports from a source that names the application
// differently (e.g. a deck vs. the Excel tracker) still land on the same
// initiative instead of creating a duplicate.
export async function findInitiativeIdByNameInStream(
  streamName: string,
  initiativeName: string
): Promise<number | null> {
  const [row] = (await sql`
    SELECT initiatives.id FROM initiatives
    JOIN applications ON applications.id = initiatives.application_id
    JOIN streams ON streams.id = applications.stream_id
    WHERE streams.name = ${streamName}
      AND lower(regexp_replace(trim(initiatives.name), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(${initiativeName}), '\s+', ' ', 'g'))
    LIMIT 1
  `) as { id: number }[];
  return row?.id ?? null;
}

export async function insertUpdate(
  initiativeId: number,
  data: {
    periodLabel: string;
    rag: Rag;
    keyHighlight: string;
    progressLast2wk: string;
    planNext2wk: string;
    riskIssue: string;
    unlockingNeeded: string;
  }
): Promise<Update> {
  const [update] = (await sql`
    INSERT INTO updates (
      initiative_id, period_label, rag, key_highlight,
      progress_last_2wk, plan_next_2wk, risk_issue, unlocking_needed
    )
    VALUES (
      ${initiativeId}, ${data.periodLabel}, ${data.rag}, ${data.keyHighlight},
      ${data.progressLast2wk}, ${data.planNext2wk}, ${data.riskIssue}, ${data.unlockingNeeded}
    )
    RETURNING id, initiative_id, period_label, rag, key_highlight, progress_last_2wk,
              plan_next_2wk, risk_issue, unlocking_needed, created_at
  `) as Update[];
  return update;
}

// Used by the manual Input form: submitting the same (initiative, period)
// again updates that entry in place (correction), while a new period always
// inserts a fresh row so update history is preserved. Deliberately no
// DB-level UNIQUE constraint on (initiative_id, period_label) — adding one
// now risks failing migration against any duplicate rows already present in
// deployed data, so the same-period check happens here instead.
export async function upsertUpdateForPeriod(
  initiativeId: number,
  data: {
    periodLabel: string;
    rag: Rag;
    keyHighlight: string;
    progressLast2wk: string;
    planNext2wk: string;
    riskIssue: string;
    unlockingNeeded: string;
  }
): Promise<Update> {
  const [existing] = (await sql`
    SELECT id FROM updates
    WHERE initiative_id = ${initiativeId} AND period_label = ${data.periodLabel}
    ORDER BY created_at DESC
    LIMIT 1
  `) as { id: number }[];

  if (existing) {
    const [update] = (await sql`
      UPDATE updates SET
        rag = ${data.rag},
        key_highlight = ${data.keyHighlight},
        progress_last_2wk = ${data.progressLast2wk},
        plan_next_2wk = ${data.planNext2wk},
        risk_issue = ${data.riskIssue},
        unlocking_needed = ${data.unlockingNeeded}
      WHERE id = ${existing.id}
      RETURNING id, initiative_id, period_label, rag, key_highlight, progress_last_2wk,
                plan_next_2wk, risk_issue, unlocking_needed, created_at
    `) as Update[];
    return update;
  }

  return insertUpdate(initiativeId, data);
}

export async function getTimelineForYear(year: number): Promise<TimelineEntry[]> {
  return (await sql`
    SELECT id, initiative_id, year, month, status FROM timeline_entries
    WHERE year = ${year}
  `) as TimelineEntry[];
}

export async function setTimelineEntry(
  initiativeId: number,
  year: number,
  month: number,
  status: TimelineStatus
): Promise<TimelineEntry> {
  const [entry] = (await sql`
    INSERT INTO timeline_entries (initiative_id, year, month, status)
    VALUES (${initiativeId}, ${year}, ${month}, ${status})
    ON CONFLICT (initiative_id, year, month) DO UPDATE SET status = EXCLUDED.status
    RETURNING id, initiative_id, year, month, status
  `) as TimelineEntry[];
  return entry;
}

export async function clearTimelineEntry(
  initiativeId: number,
  year: number,
  month: number
): Promise<void> {
  await sql`
    DELETE FROM timeline_entries
    WHERE initiative_id = ${initiativeId} AND year = ${year} AND month = ${month}
  `;
}
