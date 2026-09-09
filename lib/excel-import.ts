import type { Rag } from "@/lib/db";
import type { WorkBook } from "xlsx";

const RAG_MAP: Record<string, Rag> = { green: "green", amber: "amber", red: "red" };

export type ParsedInitiative = { name: string; pic: string; rag: Rag; phase: string };
export type ParsedApplication = { name: string; subStream: string; initiatives: ParsedInitiative[] };
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

// Reads the workbook only — which sheet to parse is a separate, explicit
// choice (see parseTrackerSheet), since the tracker's sheet name tends to
// change every cycle (e.g. carries a week number) while its column layout
// stays comparatively stable.
export async function readTrackerWorkbook(buffer: ArrayBuffer): Promise<WorkBook> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  if (workbook.SheetNames.length === 0) {
    throw new Error("File ini tidak punya sheet apa pun.");
  }
  return workbook;
}

export async function parseTrackerSheet(
  workbook: WorkBook,
  sheetName: string
): Promise<ParsedStream[]> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan di file ini.`);
  }

  // The module is already loaded at this point (readTrackerWorkbook awaited
  // it first) — dynamic import returns the cached module instantly, so this
  // doesn't re-fetch or re-parse anything.
  const XLSX = await import("xlsx");
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
      `Baris header tidak dikenali di sheet "${sheetName}" (dicek 20 baris pertama). Pastikan ` +
        `ada kolom berlabel "Stream" dan kolom nama project/initiative (mis. "Project/Initiative Name").`
    );
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const applicationCol = findColumn(headerRow, [/^application$/, /application/]);
  if (applicationCol === -1) {
    throw new Error(`Kolom "Application" tidak ditemukan di baris header sheet "${sheetName}".`);
  }
  const ownerCol = findColumn(headerRow, [/^owner$/, /^tpo$/]);
  const deliveryLeadCol = findColumn(headerRow, [/delivery.*lead/]);
  const timelineStatusCol = findColumn(headerRow, [/timeline.*status/, /^status$/]);
  const actualPhaseCol = findColumn(headerRow, [/actual.*phase/, /^phase$/]);
  const subStreamCol = findColumn(headerRow, [/sub.?stream/]);

  const streamMap = new Map<
    string,
    Map<string, { subStream: string; initiatives: Map<string, ParsedInitiative> }>
  >();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const stream = cell(row, streamCol);
    const application = cell(row, applicationCol);
    const initiative = cell(row, initiativeCol);
    if (!stream || !application || !initiative) continue;

    const pic =
      (ownerCol !== -1 ? cell(row, ownerCol) : "") ||
      (deliveryLeadCol !== -1 ? cell(row, deliveryLeadCol) : "");
    const rag =
      timelineStatusCol !== -1
        ? (RAG_MAP[cell(row, timelineStatusCol).toLowerCase()] ?? "green")
        : "green";
    const phase = actualPhaseCol !== -1 ? cell(row, actualPhaseCol) : "";
    const subStream = subStreamCol !== -1 ? cell(row, subStreamCol) : "";

    if (!streamMap.has(stream)) streamMap.set(stream, new Map());
    const appMap = streamMap.get(stream)!;
    if (!appMap.has(application)) {
      appMap.set(application, { subStream, initiatives: new Map() });
    }
    const appEntry = appMap.get(application)!;
    // Later rows win when the same initiative (or sub-stream label) repeats
    // across backlog-item rows, so the imported status reflects the last
    // (most complete) row.
    if (subStream) appEntry.subStream = subStream;
    appEntry.initiatives.set(initiative, { name: initiative, pic, rag, phase });
  }

  const result: ParsedStream[] = [];
  for (const [stream, appMap] of streamMap) {
    const applications: ParsedApplication[] = [];
    for (const [application, { subStream, initiatives }] of appMap) {
      applications.push({ name: application, subStream, initiatives: Array.from(initiatives.values()) });
    }
    result.push({ stream, applications });
  }
  return result;
}
