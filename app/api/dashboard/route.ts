import {
  ensureSchema,
  sql,
  type Application,
  type Initiative,
  type Stream,
  type Update,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export type DashboardInitiative = Initiative & { latestUpdate: Update | null };
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

  const latestUpdates = (await sql`
    SELECT DISTINCT ON (initiative_id)
      id, initiative_id, period_label, rag, key_highlight, progress_last_2wk,
      plan_next_2wk, risk_issue, unlocking_needed, created_at
    FROM updates
    ORDER BY initiative_id, created_at DESC
  `) as Update[];

  const updateByInitiative = new Map<number, Update>();
  for (const update of latestUpdates) {
    updateByInitiative.set(update.initiative_id, update);
  }

  const initiativesByApplication = new Map<number, DashboardInitiative[]>();
  for (const initiative of initiatives) {
    const list = initiativesByApplication.get(initiative.application_id) ?? [];
    list.push({ ...initiative, latestUpdate: updateByInitiative.get(initiative.id) ?? null });
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
