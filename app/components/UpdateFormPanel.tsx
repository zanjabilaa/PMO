"use client";

import { useState, type FormEvent } from "react";
import type { Rag } from "@/lib/db";

export type UpdateFormInitial = {
  period_label: string;
  rag: Rag;
  key_highlight: string;
  progress_last_2wk: string;
  plan_next_2wk: string;
  risk_issue: string;
  unlocking_needed: string;
} | null;

const RAG_OPTIONS: { value: Rag; label: string; style: string }[] = [
  {
    value: "green",
    label: "Green",
    style: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-200",
  },
  {
    value: "amber",
    label: "Amber",
    style: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
  },
  {
    value: "red",
    label: "Red",
    style: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200",
  },
];

export function defaultPeriodLabel(): string {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
      />
    </div>
  );
}

// Shared by the standalone /input page and the Table View's edit drawer — one
// place for "what fields make up a biweekly update" so both stay in sync.
// Whether fields clear after a successful save follows the same rule the
// original /input page used: a fresh entry (no `initial`) clears the content
// fields for the next entry, editing an existing one (`initial` present)
// doesn't.
export function UpdateFormPanel({
  initiativeId,
  initial,
  onSaved,
}: {
  initiativeId: number;
  initial: UpdateFormInitial;
  onSaved?: () => void;
}) {
  const isNew = initial === null;

  const [periodLabel, setPeriodLabel] = useState(initial?.period_label ?? defaultPeriodLabel());
  const [rag, setRag] = useState<Rag>(initial?.rag ?? "green");
  const [keyHighlight, setKeyHighlight] = useState(initial?.key_highlight ?? "");
  const [progressLast2wk, setProgressLast2wk] = useState(initial?.progress_last_2wk ?? "");
  const [planNext2wk, setPlanNext2wk] = useState(initial?.plan_next_2wk ?? "");
  const [riskIssue, setRiskIssue] = useState(initial?.risk_issue ?? "");
  const [unlockingNeeded, setUnlockingNeeded] = useState(initial?.unlocking_needed ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!periodLabel.trim()) {
      setError("Isi periode terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiativeId,
          periodLabel,
          rag,
          keyHighlight,
          progressLast2wk,
          planNext2wk,
          riskIssue,
          unlockingNeeded,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan update.");
      }
      setSuccess(true);
      if (isNew) {
        setKeyHighlight("");
        setProgressLast2wk("");
        setPlanNext2wk("");
        setRiskIssue("");
        setUnlockingNeeded("");
        setRag("green");
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan update.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Periode</label>
        <input
          type="text"
          value={periodLabel}
          onChange={(e) => setPeriodLabel(e.target.value)}
          placeholder="mis. 27 Jul – 9 Agu 2026"
          className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">RAG Status</label>
        <div className="flex gap-2">
          {RAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRag(opt.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${opt.style} ${
                rag === opt.value ? "ring-2 ring-slate-900 dark:ring-slate-100" : "opacity-60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <TextArea label="Key Highlight" value={keyHighlight} onChange={setKeyHighlight} />
      <TextArea
        label="Progress Last 2 Weeks"
        value={progressLast2wk}
        onChange={setProgressLast2wk}
      />
      <TextArea label="Plan Next 2 Weeks" value={planNext2wk} onChange={setPlanNext2wk} />
      <TextArea label="Risk / Issue" value={riskIssue} onChange={setRiskIssue} />
      <TextArea label="Unlocking Needed" value={unlockingNeeded} onChange={setUnlockingNeeded} />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {isNew ? "Update tersimpan. Bisa langsung isi update lain." : "Update tersimpan."}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-slate-900 px-4 py-2 text-base font-medium text-white active:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {submitting ? "Menyimpan…" : "Simpan Update"}
      </button>
    </form>
  );
}
