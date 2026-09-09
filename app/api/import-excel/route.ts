import {
  ensureSchema,
  upsertApplication,
  upsertInitiativeStatus,
  upsertStream,
  type Rag,
  type Application,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_RAG: Rag[] = ["green", "amber", "red"];

type PayloadInitiative = { name: string; pic: string; rag: Rag; phase: string };
type PayloadApplication = { name: string; subStream?: string; initiatives: PayloadInitiative[] };
type PayloadStream = { stream: string; applications: PayloadApplication[] };

// A full tracker upload can carry hundreds of initiatives across dozens of
// applications/streams. Upserting them one row at a time, fully sequential,
// means a real tracker's total wall-clock time is the sum of every
// individual round trip to Postgres — easily enough to blow past the
// serverless function's timeout. Siblings at the same level (e.g. every
// application within a stream) don't depend on each other, only on their
// parent's id, so they're safe to upsert concurrently; a small concurrency
// cap keeps this from opening hundreds of simultaneous connections at once.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json();
  const streams = body.streams as PayloadStream[] | undefined;

  if (!Array.isArray(streams)) {
    return Response.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const validStreams = streams
    .map((s) => ({ stream: typeof s.stream === "string" ? s.stream.trim() : "", applications: s.applications }))
    .filter((s): s is { stream: string; applications: PayloadApplication[] } =>
      Boolean(s.stream) && Array.isArray(s.applications)
    );

  const streamRows = await mapWithConcurrency(validStreams, 10, (s) => upsertStream(s.stream));
  const streamIdByName = new Map(streamRows.map((row, i) => [validStreams[i].stream, row.id]));

  const appJobs = validStreams.flatMap((s) =>
    (s.applications ?? [])
      .map((a) => ({
        name: typeof a.name === "string" ? a.name.trim() : "",
        subStream: typeof a.subStream === "string" ? a.subStream.trim() : "",
        initiatives: a.initiatives,
      }))
      .filter((a): a is { name: string; subStream: string; initiatives: PayloadInitiative[] } =>
        Boolean(a.name) && Array.isArray(a.initiatives)
      )
      .map((a) => ({ streamId: streamIdByName.get(s.stream)!, ...a }))
  );

  const appRows = await mapWithConcurrency(appJobs, 15, (job) =>
    upsertApplication(job.streamId, job.name, job.subStream)
  );
  const appRowByJobIndex = new Map<number, Application>(appRows.map((row, i) => [i, row]));

  const initiativeJobs = appJobs.flatMap((job, jobIndex) =>
    job.initiatives
      .map((init) => ({
        name: typeof init.name === "string" ? init.name.trim() : "",
        pic: typeof init.pic === "string" ? init.pic.trim() : "",
        rag: (VALID_RAG.includes(init.rag) ? init.rag : "green") as Rag,
        phase: typeof init.phase === "string" ? init.phase.trim() : "",
      }))
      .filter((init) => Boolean(init.name))
      .map((init) => ({ applicationId: appRowByJobIndex.get(jobIndex)!.id, ...init }))
  );

  await mapWithConcurrency(initiativeJobs, 20, (job) =>
    upsertInitiativeStatus(job.applicationId, job.name, job.pic, job.rag, job.phase)
  );

  return Response.json({
    streamCount: streamRows.length,
    appCount: appRows.length,
    initiativeCount: initiativeJobs.length,
  });
}
