import { ensureSchema, sql, upsertStream, type Stream } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const streams = (await sql`
    SELECT id, name, sort_order, archived, created_at
    FROM streams
    WHERE archived = false
    ORDER BY sort_order ASC, name ASC
  `) as Stream[];
  return Response.json({ streams });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Nama stream wajib diisi." }, { status: 400 });
  }

  const stream = await upsertStream(name);
  return Response.json({ stream }, { status: 201 });
}
