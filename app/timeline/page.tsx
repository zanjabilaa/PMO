"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Rag, TimelineStatus } from "@/lib/db";

type DashInitiative = {
  id: number;
  name: string;
  pic: string;
  current_rag: Rag;
  current_phase: string;
};

type DashApplication = {
  id: number;
  name: string;
  initiatives: DashInitiative[];
};

type DashStream = {
  id: number;
  name: string;
  applications: DashApplication[];
};

type TimelineEntry = {
  initiative_id: number;
  year: number;
  month: number;
  status: TimelineStatus;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Des",
];

const CYCLE: (TimelineStatus | null)[] = [
  null,
  "dev_uat",
  "prep_golive_golive",
  "hypercare",
  "delay",
];

const STATUS_STYLE: Record<TimelineStatus, string> = {
  dev_uat: "bg-blue-300 dark:bg-blue-800/70",
  prep_golive_golive: "bg-green-400 dark:bg-green-600/80",
  hypercare: "bg-slate-300 dark:bg-slate-600",
  delay: "bg-red-300 dark:bg-red-700/70",
};

const STATUS_LABEL: Record<TimelineStatus, string> = {
  dev_uat: "Dev, UAT",
  prep_golive_golive: "Prep Go Live, Go Live",
  hypercare: "Hypercare",
  delay: "Delay",
};

const RAG_STYLE: Record<Rag, string> = {
  green: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-200",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
  red: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200",
};

const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red" };

export default function TimelinePage() {
  const [streams, setStreams] = useState<DashStream[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<Map<string, TimelineStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/timeline?year=${year}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([dashData, timelineData]) => {
      setStreams(dashData.streams ?? []);
      const map = new Map<string, TimelineStatus>();
      for (const e of (timelineData.entries ?? []) as TimelineEntry[]) {
        map.set(`${e.initiative_id}-${e.month}`, e.status);
      }
      setEntries(map);
      setLoading(false);
    });
  }, [year]);

  async function cycleCell(initiativeId: number, month: number) {
    const key = `${initiativeId}-${month}`;
    const current = entries.get(key) ?? null;
    const currentIndex = CYCLE.indexOf(current);
    const next = CYCLE[(currentIndex + 1) % CYCLE.length];

    const updated = new Map(entries);
    if (next === null) updated.delete(key);
    else updated.set(key, next);
    setEntries(updated);

    await fetch("/api/timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initiativeId, year, month, status: next }),
    });
  }

  const q = query.trim().toLowerCase();
  const filteredStreams = streams
    .map((stream) => ({
      ...stream,
      applications: stream.applications
        .map((app) => ({
          ...app,
          initiatives: app.initiatives.filter((init) => {
            if (!q) return true;
            return (
              init.name.toLowerCase().includes(q) ||
              init.pic.toLowerCase().includes(q) ||
              app.name.toLowerCase().includes(q)
            );
          }),
        }))
        .filter((app) => app.initiatives.length > 0),
    }))
    .filter((stream) => stream.applications.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Timeline Project Active</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Klik tiap sel bulan untuk ganti status — siklus: kosong → Dev/UAT → Prep Go
            Live/Go Live → Hypercare → Delay.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Ke Dashboard
          </Link>
          <Link
            href="/risks"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Risk Register
          </Link>
          <Link
            href="/input"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            + Input Update
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari initiative, application, atau PIC…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600"
          >
            ←
          </button>
          <span className="text-sm font-medium">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600"
          >
            →
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(Object.keys(STATUS_LABEL) as TimelineStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded ${STATUS_STYLE[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat timeline…</p>
      ) : filteredStreams.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada initiative yang cocok.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredStreams.map((stream) => (
            <details
              key={stream.id}
              open
              className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <summary className="cursor-pointer px-4 py-3 text-lg font-semibold">
                {stream.name}
              </summary>
              <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-3 py-2">App</th>
                      <th className="px-3 py-2">Initiative</th>
                      <th className="px-3 py-2">PIC</th>
                      <th className="px-3 py-2">RAG</th>
                      <th className="px-3 py-2">Phase</th>
                      {MONTHS.map((m) => (
                        <th key={m} className="w-10 px-1 py-2 text-center">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stream.applications.map((app) =>
                      app.initiatives.map((init) => (
                        <tr
                          key={init.id}
                          className="border-b border-slate-100 dark:border-slate-800"
                        >
                          <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                            {app.name}
                          </td>
                          <td className="px-3 py-1.5 font-medium">{init.name}</td>
                          <td className="px-3 py-1.5">{init.pic}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${RAG_STYLE[init.current_rag]}`}
                            >
                              {RAG_LABEL[init.current_rag]}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                            {init.current_phase || "—"}
                          </td>
                          {MONTHS.map((_, idx) => {
                            const month = idx + 1;
                            const status = entries.get(`${init.id}-${month}`);
                            return (
                              <td key={month} className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => cycleCell(init.id, month)}
                                  title={status ? STATUS_LABEL[status] : "Kosong"}
                                  className={`h-6 w-8 rounded border border-slate-200 dark:border-slate-700 ${
                                    status ? STATUS_STYLE[status] : "bg-transparent"
                                  }`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
