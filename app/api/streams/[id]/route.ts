import { ensureSchema, sql, type Stream } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json();

  if (typeof body.name === "string" && body.name.trim()) {
    const [stream] = (await sql`
      UPDATE streams SET name = ${body.name.trim()} WHERE id = ${id}
      RETURNING id, name, sort_order, archived, created_at
    `) as Stream[];
    if (!stream) {
      return Response.json({ error: "Stream tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ stream });
  }

  if (typeof body.archived === "boolean") {
    const [stream] = (await sql`
      UPDATE streams SET archived = ${body.archived} WHERE id = ${id}
      RETURNING id, name, sort_order, archived, created_at
    `) as Stream[];
    if (!stream) {
      return Response.json({ error: "Stream tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ stream });
  }

  if (body.move === "up" || body.move === "down") {
    const streams = (await sql`
      SELECT id, name, sort_order, archived, created_at
      FROM streams
      WHERE archived = false
      ORDER BY sort_order ASC, name ASC
    `) as Stream[];

    const index = streams.findIndex((s) => s.id === Number(id));
    if (index === -1) {
      return Response.json({ error: "Stream tidak ditemukan." }, { status: 404 });
    }
    const swapIndex = body.move === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= streams.length) {
      return Response.json({ streams });
    }

    const current = streams[index];
    const swapWith = streams[swapIndex];

    await sql`UPDATE streams SET sort_order = ${swapWith.sort_order} WHERE id = ${current.id}`;
    await sql`UPDATE streams SET sort_order = ${current.sort_order} WHERE id = ${swapWith.id}`;

    const updated = (await sql`
      SELECT id, name, sort_order, archived, created_at
      FROM streams
      WHERE archived = false
      ORDER BY sort_order ASC, name ASC
    `) as Stream[];
    return Response.json({ streams: updated });
  }

  return Response.json({ error: "Tidak ada perubahan yang valid." }, { status: 400 });
}
