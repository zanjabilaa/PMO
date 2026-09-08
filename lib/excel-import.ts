import type { Rag } from "@/lib/db";

// Column layout of the "Project Tracker" sheet in the PMO Excel tracker.
// Detected by header text rather than a hardcoded row number, so a stray
// inserted/removed row above the header doesn't silently break parsing.
const SHEET_NAME = "Project Tracker";
const COL_STREAM = 2;
const COL_APPLICATION = 4;
const COL_INITIATIVE = 8;
const COL_TPO = 10;
const COL_DELIVERY_LEAD = 11;
const COL_TIMELINE_STATUS = 15;
const COL_ACTUAL_PHASE = 18;

const RAG_MAP: Record<string, Rag> = { green: "green", amber: "amber", red: "red" };

export type ParsedInitiative = { name: string; pic: string; rag: Rag; phase: string };
export type ParsedApplication = { name: string; initiatives: ParsedInitiative[] };
export type ParsedStream = { stream: string; applications: ParsedApplication[] };

function cell(row: unknown[], index: number): string {
  const value = row[index];
  return value === undefined || value === null ? "" : String(value).trim();
}

export async function parseTrackerWorkbook(buffer: ArrayBuffer): Promise<ParsedStream[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(
      `Sheet "${SHEET_NAME}" tidak ditemukan di file ini. Pastikan nama sheet-nya persis sama.`
    );
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? [];
    if (cell(row, COL_STREAM) === "Stream" && cell(row, COL_INITIATIVE).startsWith("Project")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    throw new Error(
      `Baris header tidak dikenali di sheet "${SHEET_NAME}". Pastikan strukturnya sama seperti tracker sebelumnya (kolom "Stream" dan "Project/Initiative Name").`
    );
  }

  const streamMap = new Map<string, Map<string, Map<string, ParsedInitiative>>>();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const stream = cell(row, COL_STREAM);
    const application = cell(row, COL_APPLICATION);
    const initiative = cell(row, COL_INITIATIVE);
    if (!stream || !application || !initiative) continue;

    const pic = cell(row, COL_TPO) || cell(row, COL_DELIVERY_LEAD);
    const rag = RAG_MAP[cell(row, COL_TIMELINE_STATUS).toLowerCase()] ?? "green";
    const phase = cell(row, COL_ACTUAL_PHASE);

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
