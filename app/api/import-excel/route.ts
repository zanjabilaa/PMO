import {
  ensureSchema,
  upsertApplication,
  upsertInitiativeStatus,
  upsertStream,
  type Rag,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_RAG: Rag[] = ["green", "amber", "red"];

type PayloadInitiative = { name: string; pic: string; rag: Rag; phase: string };
type PayloadApplication = { name: string; initiatives: PayloadInitiative[] };
type PayloadStream = { stream: string; applications: PayloadApplication[] };

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();
  const streams = body.streams as PayloadStream[] | undefined;

  if (!Array.isArray(streams)) {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  let streamCount = 0;
  let appCount = 0;
  let initiativeCount = 0;

  for (const s of streams) {
    const streamName = typeof s.stream === "string" ? s.stream.trim() : "";
    if (!streamName || !Array.isArray(s.applications)) continue;

    const stream = await upsertStream(streamName);
    streamCount++;

    for (const a of s.applications) {
      const appName = typeof a.name === "string" ? a.name.trim() : "";
      if (!appName || !Array.isArray(a.initiatives)) continue;

      const application = await upsertApplication(stream.id, appName);
      appCount++;

      for (const init of a.initiatives) {
        const initName = typeof init.name === "string" ? init.name.trim() : "";
        if (!initName) continue;
        const pic = typeof init.pic === "string" ? init.pic.trim() : "";
        const rag: Rag = VALID_RAG.includes(init.rag) ? init.rag : "green";
        const phase = typeof init.phase === "string" ? init.phase.trim() : "";

        await upsertInitiativeStatus(application.id, initName, pic, rag, phase);
        initiativeCount++;
      }
    }
  }

  return Response.json({ streamCount, appCount, initiativeCount });
}
