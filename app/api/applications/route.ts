import { ensureSchema, sql, upsertApplication, type Application } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSchema();
  const { searchParams } = new URL(request.url);
  const streamId = searchParams.get("streamId");

  const applications = streamId
    ? ((await sql`
        SELECT id, stream_id, name, created_at FROM applications
        WHERE stream_id = ${streamId}
        ORDER BY name ASC
      `) as Application[])
    : ((await sql`
        SELECT id, stream_id, name, created_at FROM applications
        ORDER BY name ASC
      `) as Application[]);

  return Response.json({ applications });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();
  const streamId = Number(body.streamId);
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!streamId || !name) {
    return Response.json(
      { error: "Stream dan nama application wajib diisi." },
      { status: 400 }
    );
  }

  const application = await upsertApplication(streamId, name);
  return Response.json({ application }, { status: 201 });
}
