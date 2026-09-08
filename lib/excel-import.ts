import type { Rag } from "@/lib/db";

// Sheet name in the PMO Excel tracker that holds the full project list.
const SHEET_NAME = "2. All Project 2026";

const RAG_MAP: Record<string, Rag> = { green: "green", amber: "amber", red: "red" };

export type ParsedInitiative = { name: string; pic: string; rag: Rag; phase: string };
export type ParsedApplication = { name: string; initiatives: ParsedInitiative[] };
export type ParsedStream = { stream: string; applications: ParsedApplication[] };

function cell(row: unknown[], index: number): string {
  const value = row[index];
  return value === undefined || value === null ? "" : String(value).trim();
}

// Columns are located by matching header text against these patterns (tried
// in priority order) rather than a hardcoded index, so the parser survives a
// tracker where columns have been reordered or inserted/removed — only the
// header labels need to stay recognizable.
function findColumn(headerRow: unknown[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    for (let i = 0; i < headerRow.length; i++) {
      const label = cell(headerRow, i).toLowerCase();
      if (label && pattern.test(label)) return i;
    }
  }
  return -1;
}

export async function parseTrackerWorkbook(buffer: ArrayBuffer): Promise<ParsedStream[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    const available = workbook.SheetNames.join(", ") || "(tidak ada sheet)";
    throw new Error(
      `Sheet "${SHEET_NAME}" tidak ditemukan di file ini. Sheet yang tersedia: ${available}.`
    );
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  let headerRowIndex = -1;
  let streamCol = -1;
  let initiativeCol = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? [];
    const s = findColumn(row, [/^stream$/]);
    const init = findColumn(row, [/project.*initiative.*name|initiative.*name/, /^project$|^initiative$/]);
    if (s !== -1 && init !== -1) {
      headerRowIndex = i;
      streamCol = s;
      initiativeCol = init;
      break;
    }
  }
  if (headerRowIndex === -1) {
    throw new Error(
      `Baris header tidak dikenali di sheet "${SHEET_NAME}" (dicek 20 baris pertama). Pastikan ` +
        `ada kolom berlabel "Stream" dan kolom nama project/initiative (mis. "Project/Initiative Name").`
    );
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const applicationCol = findColumn(headerRow, [/^application$/, /application/]);
  if (applicationCol === -1) {
    throw new Error(
      `Kolom "Application" tidak ditemukan di baris header sheet "${SHEET_NAME}".`
    );
  }
  const tpoCol = findColumn(headerRow, [/^tpo$/]);
  const deliveryLeadCol = findColumn(headerRow, [/delivery.*lead/]);
  const timelineStatusCol = findColumn(headerRow, [/timeline.*status/, /^status$/]);
  const actualPhaseCol = findColumn(headerRow, [/actual.*phase/, /^phase$/]);

  const streamMap = new Map<string, Map<string, Map<string, ParsedInitiative>>>();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const stream = cell(row, streamCol);
    const application = cell(row, applicationCol);
    const initiative = cell(row, initiativeCol);
    if (!stream || !application || !initiative) continue;

    const pic =
      (tpoCol !== -1 ? cell(row, tpoCol) : "") ||
      (deliveryLeadCol !== -1 ? cell(row, deliveryLeadCol) : "");
    const rag =
      timelineStatusCol !== -1
        ? (RAG_MAP[cell(row, timelineStatusCol).toLowerCase()] ?? "green")
        : "green";
    const phase = actualPhaseCol !== -1 ? cell(row, actualPhaseCol) : "";

    if (!streamMap.has(stream)) streamMap.set(stream, new Map());
    const appMap = streamMap.get(stream)!;
    if (!appMap.has(application)) appMap.set(application, new Map());
    // Later rows win when the same initiative repeats across backlog-item
    // rows, so the imported status reflects the last (most complete) row.
    appMap.get(application)!.set(initiative, { name: initiative, pic, rag, phase });
  }

  const result: ParsedStream[] = [];
  for (const [stream, appMap] of streamMap) {
    const applications: ParsedApplication[] = [];
    for (const [application, initMap] of appMap) {
      applications.push({ name: application, initiatives: Array.from(initMap.values()) });
    }
    result.push({ stream, applications });
  }
  return result;
}
