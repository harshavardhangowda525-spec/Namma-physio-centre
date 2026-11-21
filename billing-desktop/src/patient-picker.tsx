import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "./api";

export type PickedPatient = { id: number; name: string; patientCode?: string; phone?: string | null };

export function PatientPicker({ value, onChange, autoFocus }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const t = setTimeout(async () => {
      const r = await get<{ items: (PickedPatient & { anonymisedAt: string | null })[] }>(`/patients?q=${encodeURIComponent(q)}&limit=8`);
      setResults(r.items.filter((p) => !p.anonymisedAt));
      setActive(0);
      setOpen(true);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  if (value)
    return (
      <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm">
        <span><span className="font-semibold text-navy-900">{value.name}</span>{value.patientCode && <span className="ml-2 text-muted">{value.patientCode}</span>}</span>
        <button type="button" onClick={() => onChange(null)} aria-label="Change patient" className="text-muted hover:text-navy-900"><X className="h-4 w-4" /></button>
      </div>
    );
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        className="input pl-9"
        placeholder="Search patient by name, phone or ID"
        value={q}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-label="Search patient"
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
          if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          if (e.key === "Enter" && results[active]) (e.preventDefault(), onChange(results[active]));
        }}
      />
      {open && q && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-muted">No matching patients. Create the patient first.</li>}
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={() => onChange(p)} className={`flex w-full justify-between px-4 py-2.5 text-left text-sm ${i === active ? "bg-teal-50" : ""}`}>
                <span className="font-medium text-navy-900">{p.name}</span><span className="text-muted">{p.patientCode} · {p.phone ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
