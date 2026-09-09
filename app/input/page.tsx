"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Rag } from "@/lib/db";
import { UpdateFormPanel, type UpdateFormInitial } from "@/app/components/UpdateFormPanel";

type DashUpdate = {
  period_label: string;
  rag: Rag;
  key_highlight: string;
  progress_last_2wk: string;
  plan_next_2wk: string;
  risk_issue: string;
  unlocking_needed: string;
};

type DashInitiative = { id: number; name: string; latestUpdate: DashUpdate | null };
type DashApplication = { id: number; name: string; initiatives: DashInitiative[] };
type DashStream = { id: number; name: string; applications: DashApplication[] };

type Option = { id: number; name: string };

const NEW_OPTION = "__new__";

function CascadingPicker({
  label,
  options,
  value,
  disabled,
  placeholder,
  onSelect,
  onCreate,
  extraField,
}: {
  label: string;
  options: Option[];
  value: number | null;
  disabled?: boolean;
  placeholder: string;
  onSelect: (id: number) => void;
  onCreate: (name: string, extra: string) => Promise<void>;
  extraField?: { label: string; placeholder: string };
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExtra, setNewExtra] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(newName.trim(), newExtra.trim());
      setNewName("");
      setNewExtra("");
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {!creating ? (
        <select
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => {
            if (e.target.value === NEW_OPTION) {
              setCreating(true);
              return;
            }
            onSelect(Number(e.target.value));
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
          <option value={NEW_OPTION}>+ Tambah baru…</option>
        </select>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Nama ${label.toLowerCase()} baru`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
          />
          {extraField && (
            <input
              type="text"
              value={newExtra}
              onChange={(e) => setNewExtra(e.target.value)}
              placeholder={extraField.placeholder}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting || !newName.trim()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {submitting ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewExtra("");
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InputForm() {
  const searchParams = useSearchParams();
  const editInitiativeId = searchParams.get("initiativeId");

  const [streams, setStreams] = useState<Option[]>([]);
  const [applications, setApplications] = useState<Option[]>([]);
  const [initiatives, setInitiatives] = useState<Option[]>([]);

  const [streamId, setStreamId] = useState<number | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [initiativeId, setInitiativeId] = useState<number | null>(null);

  const [initialForPanel, setInitialForPanel] = useState<UpdateFormInitial>(null);

  const [loadingEdit, setLoadingEdit] = useState(!!editInitiativeId);
  const [editLabel, setEditLabel] = useState<{
    stream: string;
    application: string;
    initiative: string;
  } | null>(null);
  const [editNotFound, setEditNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/streams")
      .then((r) => r.json())
      .then((d) => setStreams(d.streams ?? []));
  }, []);

  useEffect(() => {
    if (!editInitiativeId) return;
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const dashStreams = (d.streams ?? []) as DashStream[];
        for (const s of dashStreams) {
          for (const a of s.applications) {
            const init = a.initiatives.find((i) => String(i.id) === editInitiativeId);
            if (init) {
              setStreamId(s.id);
              setApplicationId(a.id);
              setInitiativeId(init.id);
              setEditLabel({ stream: s.name, application: a.name, initiative: init.name });
              if (init.latestUpdate) setInitialForPanel(init.latestUpdate);
              return;
            }
          }
        }
        setEditNotFound(true);
      })
      .finally(() => setLoadingEdit(false));
  }, [editInitiativeId]);

  useEffect(() => {
    if (!streamId) return;
    fetch(`/api/applications?streamId=${streamId}`)
      .then((r) => r.json())
      .then((d) => setApplications(d.applications ?? []));
  }, [streamId]);

  useEffect(() => {
    if (!applicationId) return;
    fetch(`/api/initiatives?applicationId=${applicationId}`)
      .then((r) => r.json())
      .then((d) => setInitiatives(d.initiatives ?? []));
  }, [applicationId]);

  function selectStream(id: number) {
    setStreamId(id);
    setApplicationId(null);
    setApplications([]);
    setInitiativeId(null);
    setInitiatives([]);
  }

  function selectApplication(id: number) {
    setApplicationId(id);
    setInitiativeId(null);
    setInitiatives([]);
  }

  async function createStream(name: string) {
    const res = await fetch("/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) {
      setStreams((prev) => [...prev, data.stream]);
      selectStream(data.stream.id);
    }
  }

  async function createApplication(name: string) {
    if (!streamId) return;
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamId, name }),
    });
    const data = await res.json();
    if (res.ok) {
      setApplications((prev) => [...prev, data.application]);
      selectApplication(data.application.id);
    }
  }

  async function createInitiative(name: string, pic: string) {
    if (!applicationId) return;
    const res = await fetch("/api/initiatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, name, pic }),
    });
    const data = await res.json();
    if (res.ok) {
      setInitiatives((prev) => [...prev, data.initiative]);
      setInitiativeId(data.initiative.id);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {editInitiativeId ? "Edit Update" : "Input Update"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {editInitiativeId
              ? "Ubah update terakhir, atau ganti periode untuk menambah entri baru."
              : "Isi update biweekly untuk satu initiative."}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
          >
            Ke Dashboard
          </Link>
          <Link
            href="/timeline"
            className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
          >
            Timeline
          </Link>
          <Link
            href="/risks"
            className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
          >
            Risk Register
          </Link>
          <Link
            href="/actions"
            className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
          >
            Action Items
          </Link>
          <Link
            href="/documents"
            className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
          >
            Documents
          </Link>
          <Link
            href="/report"
            className="text-sm font-medium text-slate-600 underline dark:text-slate-300"
          >
            Weekly Report
          </Link>
        </div>
      </header>

      {loadingEdit && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Memuat data update…</p>
      )}
      {editNotFound && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Initiative tidak ditemukan — isi sebagai update baru.
        </p>
      )}
      {editLabel && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
          Mengedit: <span className="font-medium">{editLabel.initiative}</span>{" "}
          <span className="text-slate-500 dark:text-slate-400">
            ({editLabel.application} · {editLabel.stream})
          </span>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Submit dengan periode yang sama akan memperbarui entri ini. Ubah periode dulu
            kalau ini untuk siklus 2 minggu berikutnya.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CascadingPicker
          label="Stream"
          options={streams}
          value={streamId}
          placeholder="Pilih stream"
          onSelect={selectStream}
          onCreate={createStream}
        />

        <CascadingPicker
          label="Application"
          options={applications}
          value={applicationId}
          disabled={!streamId}
          placeholder={streamId ? "Pilih application" : "Pilih stream dulu"}
          onSelect={selectApplication}
          onCreate={createApplication}
        />

        <CascadingPicker
          label="Project / Initiative"
          options={initiatives}
          value={initiativeId}
          disabled={!applicationId}
          placeholder={applicationId ? "Pilih initiative" : "Pilih application dulu"}
          onSelect={setInitiativeId}
          onCreate={createInitiative}
          extraField={{ label: "PIC", placeholder: "PIC (opsional)" }}
        />
      </div>

      {initiativeId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <UpdateFormPanel initiativeId={initiativeId} initial={initialForPanel} />
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Pilih Stream → Application → Project/Initiative dulu untuk mulai isi update.
        </p>
      )}
    </main>
  );
}

export default function InputPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat…</p>
        </main>
      }
    >
      <InputForm />
    </Suspense>
  );
}
