import {
  ensureSchema,
  upsertApplication,
  upsertInitiative,
  upsertStream,
} from "@/lib/db";
import seedData from "@/scripts/seed-data.json";

export const dynamic = "force-dynamic";

type SeedInitiative = { name: string; pic: string };
type SeedApplication = { name: string; initiatives: SeedInitiative[] };
type SeedStream = { stream: string; applications: SeedApplication[] };

export async function POST() {
  await ensureSchema();

  const streams = seedData as SeedStream[];
  let streamCount = 0;
  let appCount = 0;
  let initiativeCount = 0;

  for (const s of streams) {
    const stream = await upsertStream(s.stream);
    streamCount++;
    for (const a of s.applications) {
      const application = await upsertApplication(stream.id, a.name);
      appCount++;
      for (const init of a.initiatives) {
        await upsertInitiative(application.id, init.name, init.pic || "");
        initiativeCount++;
      }
    }
  }

  return Response.json({ streamCount, appCount, initiativeCount });
}
