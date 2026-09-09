import {
  ensureSchema,
  listDocumentChecklist,
  listDocumentTypes,
  sql,
  type ActionItemStatus,
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
  openActionItems: number;
  overdueActionItems: number;
  docsDone: number;
  docsTotal: number;
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
    SELECT id, stream_id, name, sub_stream, created_at FROM applications ORDER BY name ASC
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

  const actionItems = (await sql`
    SELECT initiative_id, status, due_date FROM action_items
  `) as { initiative_id: number; status: ActionItemStatus; due_date: string | null }[];

  const today = new Date().toISOString().slice(0, 10);
  const actionStatsByInitiative = new Map<number, { open: number; overdue: number }>();
  for (const item of actionItems) {
    if (item.status === "done") continue;
    const stats = actionStatsByInitiative.get(item.initiative_id) ?? { open: 0, overdue: 0 };
    stats.open++;
    if (item.due_date && item.due_date < today) stats.overdue++;
    actionStatsByInitiative.set(item.initiative_id, stats);
  }

  const activeDocumentTypeIds = new Set((await listDocumentTypes()).map((d) => d.id));
  const checklistEntries = await listDocumentChecklist();
  // Denominator starts at every active document type (a missing entry is
  // "not started", not "excluded"), then not_applicable entries shrink it
  // and done entries fill the numerator.
  const docStatsByInitiative = new Map<number, { done: number; notApplicable: number }>();
  for (const entry of checklistEntries) {
    if (!activeDocumentTypeIds.has(entry.document_type_id)) continue;
    const stats = docStatsByInitiative.get(entry.initiative_id) ?? { done: 0, notApplicable: 0 };
    if (entry.status === "done") stats.done++;
    if (entry.status === "not_applicable") stats.notApplicable++;
    docStatsByInitiative.set(entry.initiative_id, stats);
  }

  const initiativesByApplication = new Map<number, DashboardInitiative[]>();
  for (const initiative of initiatives) {
    const list = initiativesByApplication.get(initiative.application_id) ?? [];
    const history = updatesByInitiative.get(initiative.id) ?? [];
    const actionStats = actionStatsByInitiative.get(initiative.id) ?? { open: 0, overdue: 0 };
    const docAgg = docStatsByInitiative.get(initiative.id) ?? { done: 0, notApplicable: 0 };
    list.push({
      ...initiative,
      latestUpdate: history[0] ?? null,
      previousRag: history[1]?.rag ?? null,
      updateCount: history.length,
      openActionItems: actionStats.open,
      overdueActionItems: actionStats.overdue,
      docsDone: docAgg.done,
      docsTotal: activeDocumentTypeIds.size - docAgg.notApplicable,
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
