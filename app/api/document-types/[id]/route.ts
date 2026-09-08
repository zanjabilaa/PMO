import { ensureSchema, sql, type DocumentType } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json();

  if (typeof body.name === "string" && body.name.trim()) {
    const [documentType] = (await sql`
      UPDATE document_types SET name = ${body.name.trim()} WHERE id = ${id}
      RETURNING id, name, sort_order, archived, created_at
    `) as DocumentType[];
    if (!documentType) {
      return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ documentType });
  }

  if (typeof body.archived === "boolean") {
    const [documentType] = (await sql`
      UPDATE document_types SET archived = ${body.archived} WHERE id = ${id}
      RETURNING id, name, sort_order, archived, created_at
    `) as DocumentType[];
    if (!documentType) {
      return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ documentType });
  }

  if (body.move === "up" || body.move === "down") {
    const documentTypes = (await sql`
      SELECT id, name, sort_order, archived, created_at
      FROM document_types
      WHERE archived = false
      ORDER BY sort_order ASC, name ASC
    `) as DocumentType[];

    const index = documentTypes.findIndex((d) => d.id === Number(id));
    if (index === -1) {
      return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    const swapIndex = body.move === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= documentTypes.length) {
      return Response.json({ documentTypes });
    }

    const current = documentTypes[index];
    const swapWith = documentTypes[swapIndex];

    await sql`UPDATE document_types SET sort_order = ${swapWith.sort_order} WHERE id = ${current.id}`;
    await sql`UPDATE document_types SET sort_order = ${current.sort_order} WHERE id = ${swapWith.id}`;

    const updated = (await sql`
      SELECT id, name, sort_order, archived, created_at
      FROM document_types
      WHERE archived = false
      ORDER BY sort_order ASC, name ASC
    `) as DocumentType[];
    return Response.json({ documentTypes: updated });
  }

  return Response.json({ error: "Tidak ada perubahan yang valid." }, { status: 400 });
}
