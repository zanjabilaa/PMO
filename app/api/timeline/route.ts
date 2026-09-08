import {
  clearTimelineEntry,
  ensureSchema,
  getTimelineForYear,
  setTimelineEntry,
  type TimelineStatus,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS: TimelineStatus[] = [
  "dev_uat",
  "prep_golive_golive",
  "hypercare",
  "delay",
];

export async function GET(request: Request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  const entries = await getTimelineForYear(year);
  return Response.json({ entries });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();

  const initiativeId = Number(body.initiativeId);
  const year = Number(body.year);
  const month = Number(body.month);
  const status = typeof body.status === "string" ? body.status : null;

  if (!initiativeId || !year || month < 1 || month > 12) {
    return Response.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  if (status === null) {
    await clearTimelineEntry(initiativeId, year, month);
    return Response.json({ entry: null });
  }

  if (!VALID_STATUS.includes(status as TimelineStatus)) {
    return Response.json({ error: "Status tidak valid." }, { status: 400 });
  }

  const entry = await setTimelineEntry(initiativeId, year, month, status as TimelineStatus);
  return Response.json({ entry });
}
