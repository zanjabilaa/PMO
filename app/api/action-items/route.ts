import { ensureSchema, insertActionItem, listActionItems } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const items = await listActionItems();
  return Response.json({ items });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();

  const initiativeId = Number(body.initiativeId);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;
  const source = typeof body.source === "string" ? body.source.trim() : "";

  if (!initiativeId || !description) {
    return Response.json(
      { error: "Initiative dan deskripsi action item wajib diisi." },
      { status: 400 }
    );
  }

  const item = await insertActionItem({ initiativeId, description, owner, dueDate, source });
  return Response.json({ item }, { status: 201 });
}
