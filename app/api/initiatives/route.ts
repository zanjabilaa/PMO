import { ensureSchema, sql, upsertInitiative, type Initiative } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");

  const initiatives = applicationId
    ? ((await sql`
        SELECT id, application_id, name, pic, current_rag, current_phase, archived, created_at FROM initiatives
        WHERE application_id = ${applicationId} AND archived = false
        ORDER BY name ASC
      `) as Initiative[])
    : ((await sql`
        SELECT id, application_id, name, pic, current_rag, current_phase, archived, created_at FROM initiatives
        WHERE archived = false
        ORDER BY name ASC
      `) as Initiative[]);

  return Response.json({ initiatives });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();
  const applicationId = Number(body.applicationId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const pic = typeof body.pic === "string" ? body.pic.trim() : "";

  if (!applicationId || !name) {
    return Response.json(
      { error: "Application dan nama initiative wajib diisi." },
      { status: 400 }
    );
  }

  const initiative = await upsertInitiative(applicationId, name, pic);
  return Response.json({ initiative }, { status: 201 });
}
