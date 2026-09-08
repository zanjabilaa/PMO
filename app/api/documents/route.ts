import {
  ensureSchema,
  listDocumentChecklist,
  setDocumentChecklistStatus,
  type DocChecklistStatus,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS: DocChecklistStatus[] = [
  "not_started",
  "in_progress",
  "done",
  "not_applicable",
];

export async function GET() {
  await ensureSchema();
  const entries = await listDocumentChecklist();
  return Response.json({ entries });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();

  const initiativeId = Number(body.initiativeId);
  const documentTypeId = Number(body.documentTypeId);
  const status = typeof body.status === "string" ? body.status : null;

  if (!initiativeId || !documentTypeId || !status || !VALID_STATUS.includes(status as DocChecklistStatus)) {
    return Response.json({ error: "Data tidak lengkap atau status tidak valid." }, { status: 400 });
  }

  const entry = await setDocumentChecklistStatus(
    initiativeId,
    documentTypeId,
    status as DocChecklistStatus
  );
  return Response.json({ entry });
}
