"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Rag } from "@/lib/db";

type Update = {
  period_label: string;
  rag: Rag;
  risk_issue: string;
  unlocking_needed: string;
  created_at: string;
};

type DashInitiative = {
  id: number;
  name: string;
  pic: string;
  latestUpdate: Update | null;
};

type DashApplication = { id: number; name: string; initiatives: DashInitiative[] };
type DashStream = { id: number; name: string; applications: DashApplication[] };

type RiskRow = {
  streamName: string;
  appName: string;
  initiativeId: number;
  initiativeName: string;
  pic: string;
  update: Update;
};

const RAG_STYLE: Record<Rag, string> = {
  green: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-200",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
  red: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200",
};

const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red" };
const RAG_SEVERITY: Record<Rag, number> = { red: 0, amber: 1, green: 2 };

const POLL_INTERVAL_MS = 8000;

export default function RiskRegisterPage() {
  const [streams, setStreams] = useState<DashStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [ragFilter, setRagFilter] = useState<Rag | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setStreams(data.streams ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Risk register only makes sense for initiatives that actually have an
  // update to read a risk from — an Amber/Red status or a filled-in
  // Risk/Issue field on Green both qualify (a documented risk is worth
  // tracking even if the initiative is currently on track).
  const rows: RiskRow[] = streams.flatMap((stream) =>
    stream.applications.flatMap((app) =>
      app.initiatives
        .filter((init) => {
          const u = init.latestUpdate;
          if (!u) return false;
          return u.rag !== "green" || u.risk_issue.trim() !== "";
        })
        .map((init) => ({
          streamName: stream.name,
          appName: app.name,
          initiativeId: init.id,
          initiativeName: init.name,
          pic: init.pic,
          update: init.latestUpdate as Update,
        }))
    )
  );

  const q = query.trim().toLowerCase();
  const filteredRows = rows
    .filter((r) => ragFilter === "all" || r.update.rag === ragFilter)
    .filter(
      (r) =>
        !q ||
        r.initiativeName.toLowerCase().includes(q) ||
        r.pic.toLowerCase().includes(q) ||
        r.appName.toLowerCase().includes(q)
    )
    .sort((a, b) => RAG_SEVERITY[a.update.rag] - RAG_SEVERITY[b.update.rag]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Risk &amp; Issue Register</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filteredRows.length} initiative dengan status Amber/Red atau Risk/Issue yang
            tercatat — untuk follow-up unlocking.
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
            href="/timeline"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Timeline
          </Link>
          <Link
            href="/actions"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Action Items
          </Link>
          <Link
            href="/documents"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Documents
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
        <div className="flex gap-1.5">
          {(["all", "red", "amber", "green"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRagFilter(r)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                r === "all"
                  ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                  : RAG_STYLE[r]
              } ${ragFilter === r ? "ring-2 ring-slate-900 dark:ring-slate-100" : "opacity-60"}`}
            >
              {r === "all" ? "Semua" : RAG_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat risk register…</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-sm text-slate-500">
          Tidak ada risk/issue yang cocok — semua initiative Green tanpa catatan risiko.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-3 py-2">Stream / App</th>
                <th className="px-3 py-2">Initiative</th>
                <th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2">RAG</th>
                <th className="px-3 py-2">Periode</th>
                <th className="px-3 py-2">Risk / Issue</th>
                <th className="px-3 py-2">Unlocking Needed</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.initiativeId}
                  className="border-b border-slate-100 align-top dark:border-slate-800"
                >
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {r.streamName}
                    <br />
                    {r.appName}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.initiativeName}</td>
                  <td className="px-3 py-2">{r.pic || "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${RAG_STYLE[r.update.rag]}`}
                    >
                      {RAG_LABEL[r.update.rag]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {r.update.period_label}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap px-3 py-2">
                    {r.update.risk_issue || "—"}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap px-3 py-2">
                    {r.update.unlocking_needed || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/input?initiativeId=${r.initiativeId}`}
                      className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
