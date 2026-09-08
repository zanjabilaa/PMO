import {
  ensureSchema,
  findInitiativeIdByNameInStream,
  insertUpdate,
  upsertApplication,
  upsertInitiative,
  upsertStream,
  type Rag,
} from "@/lib/db";
import deckUpdates from "@/scripts/deck-updates.json";

export const dynamic = "force-dynamic";

type DeckEntry = {
  application: string;
  initiative: string;
  pic: string;
  rag: Rag;
  keyHighlight: string;
  progressLast2wk: string;
  planNext2wk: string;
  riskIssue: string;
  unlockingNeeded: string;
};

type DeckStreamGroup = {
  stream: string;
  periodLabel: string;
  entries: DeckEntry[];
};

export async function POST() {
  await ensureSchema();

  const groups = deckUpdates as DeckStreamGroup[];
  let matched = 0;
  let created = 0;
  let updateCount = 0;

  for (const group of groups) {
    for (const entry of group.entries) {
      let initiativeId = await findInitiativeIdByNameInStream(
        group.stream,
        entry.initiative
      );

      if (initiativeId) {
        matched++;
      } else {
        const stream = await upsertStream(group.stream);
        const application = await upsertApplication(stream.id, entry.application);
        const initiative = await upsertInitiative(
          application.id,
          entry.initiative,
          entry.pic
        );
        initiativeId = initiative.id;
        created++;
      }

      await insertUpdate(initiativeId, {
        periodLabel: group.periodLabel,
        rag: entry.rag,
        keyHighlight: entry.keyHighlight,
        progressLast2wk: entry.progressLast2wk,
        planNext2wk: entry.planNext2wk,
        riskIssue: entry.riskIssue,
        unlockingNeeded: entry.unlockingNeeded,
      });
      updateCount++;
    }
  }

  return Response.json({ matched, created, updateCount });
}
