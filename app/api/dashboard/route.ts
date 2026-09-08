import {
  ensureSchema,
  sql,
  type Application,
  type Initiative,
  type Stream,
  type Update,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export type DashboardInitiative = Initiative & {
  latestUpdate: Update | null;
  previousRag: Update["rag"] | null;
  updateCount: number;
};
export type DashboardApplication = Application & { initiatives: DashboardInitiative[] };
export type DashboardStream = Stream & { applications: DashboardApplication[] };

export async function GET() {
  await ensureSchema();

  const streams = (await sql`
    SELECT id, name, sort_order, archived, created_at FROM streams
    WHERE archived = false
    ORDER BY sort_order ASC, name ASC
  `) as Stream[];

  const applications = (await sql`
    SELECT id, stream_id, name, created_at FROM applications ORDER BY name ASC
  `) as Application[];

  const initiatives = (await sql`
    SELECT id, application_id, name, pic, current_rag, current_phase, archived, created_at
    FROM initiatives
    WHERE archived = false
    ORDER BY name ASC
  `) as Initiative[];

  // Ordered newest-first per initiative so the first entry is the latest
  // update and the second is the previous one (used for the RAG trend
  // indicator) without a second round-trip to the database.
  const allUpdates = (await sql`
    SELECT id, initiative_id, period_label, rag, key_highlight, progress_last_2wk,
           plan_next_2wk, risk_issue, unlocking_needed, created_at
    FROM updates
    ORDER BY initiative_id, created_at DESC
  `) as Update[];

  const updatesByInitiative = new Map<number, Update[]>();
  for (const update of allUpdates) {
    const list = updatesByInitiative.get(update.initiative_id) ?? [];
    list.push(update);
    updatesByInitiative.set(update.initiative_id, list);
  }

  const initiativesByApplication = new Map<number, DashboardInitiative[]>();
  for (const initiative of initiatives) {
    const list = initiativesByApplication.get(initiative.application_id) ?? [];
    const history = updatesByInitiative.get(initiative.id) ?? [];
    list.push({
      ...initiative,
      latestUpdate: history[0] ?? null,
      previousRag: history[1]?.rag ?? null,
      updateCount: history.length,
    });
    initiativesByApplication.set(initiative.application_id, list);
  }

  const applicationsByStream = new Map<number, DashboardApplication[]>();
  for (const application of applications) {
    const list = applicationsByStream.get(application.stream_id) ?? [];
    list.push({
      ...application,
      initiatives: initiativesByApplication.get(application.id) ?? [],
    });
    applicationsByStream.set(application.stream_id, list);
  }

  const result: DashboardStream[] = streams.map((stream) => ({
    ...stream,
    applications: applicationsByStream.get(stream.id) ?? [],
  }));

  return Response.json({ streams: result });
}
