import { ensureSchema, listDocumentTypes, upsertDocumentType } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const documentTypes = await listDocumentTypes();
  return Response.json({ documentTypes });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "Nama dokumen wajib diisi." }, { status: 400 });
  }

  const documentType = await upsertDocumentType(name);
  return Response.json({ documentType }, { status: 201 });
}
