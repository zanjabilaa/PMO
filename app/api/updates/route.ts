import { ensureSchema, upsertUpdateForPeriod, sql, type Rag, type Update } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_RAG: Rag[] = ["green", "amber", "red"];

export async function GET(request: Request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const initiativeId = searchParams.get("initiativeId");

  if (!initiativeId) {
    return Response.json({ error: "initiativeId wajib diisi." }, { status: 400 });
  }

  const updates = (await sql`
    SELECT id, initiative_id, period_label, rag, key_highlight, progress_last_2wk,
           plan_next_2wk, risk_issue, unlocking_needed, created_at
    FROM updates
    WHERE initiative_id = ${initiativeId}
    ORDER BY created_at DESC
  `) as Update[];

  return Response.json({ updates });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();

  const initiativeId = Number(body.initiativeId);
  const periodLabel = typeof body.periodLabel === "string" ? body.periodLabel.trim() : "";
  const rag: Rag = VALID_RAG.includes(body.rag) ? body.rag : "green";
  const keyHighlight = typeof body.keyHighlight === "string" ? body.keyHighlight.trim() : "";
  const progressLast2wk =
    typeof body.progressLast2wk === "string" ? body.progressLast2wk.trim() : "";
  const planNext2wk = typeof body.planNext2wk === "string" ? body.planNext2wk.trim() : "";
  const riskIssue = typeof body.riskIssue === "string" ? body.riskIssue.trim() : "";
  const unlockingNeeded =
    typeof body.unlockingNeeded === "string" ? body.unlockingNeeded.trim() : "";

  if (!initiativeId || !periodLabel) {
    return Response.json(
      { error: "Initiative dan periode wajib diisi." },
      { status: 400 }
    );
  }

  const update = await upsertUpdateForPeriod(initiativeId, {
    periodLabel,
    rag,
    keyHighlight,
    progressLast2wk,
    planNext2wk,
    riskIssue,
    unlockingNeeded,
  });

  return Response.json({ update }, { status: 201 });
}
