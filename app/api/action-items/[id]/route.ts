import {
  deleteActionItem,
  ensureSchema,
  updateActionItem,
  type ActionItemStatus,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUS: ActionItemStatus[] = ["open", "in_progress", "done"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  const body = await request.json();

  const patch: Partial<{
    description: string;
    owner: string;
    dueDate: string | null;
    status: ActionItemStatus;
  }> = {};

  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.owner === "string") patch.owner = body.owner.trim();
  if (body.dueDate !== undefined) {
    patch.dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;
  }
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status as ActionItemStatus)) {
      return Response.json({ error: "Status tidak valid." }, { status: 400 });
    }
    patch.status = body.status as ActionItemStatus;
  }

  const item = await updateActionItem(Number(id), patch);
  if (!item) {
    return Response.json({ error: "Action item tidak ditemukan." }, { status: 404 });
  }
  return Response.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSchema();
  const { id } = await params;
  await deleteActionItem(Number(id));
  return Response.json({ ok: true });
}
