import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  GitBranchPlus,
  MessageCircle,
  PenTool,
  Plus,
  Printer,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type { Settings } from "../../server/settings";
import {
  dayOfWeekName,
  formatRefHeaderDate,
  formatRefSessionDate,
  formatRupeeNumber,
  rupeesInWords,
  rupeesToPaise,
} from "../../shared/billing";
import type {
  DetailedBillFull,
  DetailedBillStatus,
  DetailedBillSummary,
  DocumentSignatureRecord,
} from "../../shared/types";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { PatientPicker, type PickedPatient } from "../patient-picker";
import {
  downloadDetailedBillPdf,
  generateDetailedBillPdfFile,
  shareOrDownloadPdfFile,
} from "../pdf";
import { DocumentSignatureModal, RenderedSignatureBlock } from "../signature-pad";
import {
  Button,
  Empty,
  ErrorNote,
  Field,
  Modal,
  PageTitle,
  fmtDate,
  money,
  todayLocal,
  useLoad,
  useToast,
} from "../ui";
import { PatientForm } from "./patients";

const STATUS_BADGE: Record<DetailedBillStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-100 text-amber-900" },
  ready_for_signature: { label: "Ready for Signature", cls: "bg-cyan-100 text-navy-900" },
  signed: { label: "Signed", cls: "bg-teal-100 text-teal-800" },
  finalized: { label: "Finalized", cls: "bg-emerald-100 text-emerald-900" },
  shared: { label: "Shared", cls: "bg-indigo-100 text-indigo-900" },
  cancelled: { label: "Cancelled", cls: "bg-rose-100 text-rose-800" },
  superseded: { label: "Superseded", cls: "bg-slate-200 text-slate-700" },
};

export function DetailedBillStatusPill({ status }: { status: DetailedBillStatus }) {
  const b = STATUS_BADGE[status] ?? { label: status, cls: "bg-cream text-navy-900" };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.cls}`}>{b.label}</span>;
}

/* ============================================================================
   1. DETAILED BILL MANAGEMENT DASHBOARD (/detailed-bills)
   ============================================================================ */

export function DetailedBillsPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading, reload } = useLoad(
    () =>
      get<{ total: number; items: DetailedBillSummary[] }>(
        `/detailed-bills?q=${encodeURIComponent(dq)}&status=${status}&from=${from}&to=${to}&limit=100`,
      ),
    [dq, status, from, to],
  );
  const { data: settings } = useLoad(() => get<Settings>("/settings"), []);

  async function quickDownload(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!settings) return;
    const full = await get<DetailedBillFull>(`/detailed-bills/${id}`);
    downloadDetailedBillPdf(
      {
        billNo: full.billNo,
        billDate: full.billDate,
        treatmentStartDate: full.treatmentStartDate,
        treatmentEndDate: full.treatmentEndDate,
        patientName: full.patientName,
        ageGender: full.patientAgeGender,
        referredBy: full.referredBy,
        sessions: full.sessions.map((s) => ({
          date: s.sessionDate,
          particulars: s.particulars,
          amount: s.amount,
        })),
        signature: full.signature,
      },
      settings,
      `Detailed-Bill-${full.billNo.replace(/[^\w-]+/g, "_")}-${full.patientCode}.pdf`,
    );
    toast("Detailed physiotherapy bill PDF downloaded");
  }

  async function quickDuplicate(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    const copy = await post<DetailedBillFull>(`/detailed-bills/${id}/duplicate`);
    toast(`Duplicated as new draft ${copy.billNo}`);
    nav(`/detailed-bills/${copy.id}`);
  }

  return (
    <div>
      <PageTitle
        title="Detailed Physiotherapy Bills"
        subtitle="Generate date-wise physiotherapy treatment statements and detailed bills for insurance reimbursement and patient documentation."
        actions={
          can("detailed_bills.write") && (
            <Button onClick={() => nav("/detailed-bills/new")}>
              <FilePlus2 className="h-4 w-4" /> New Detailed Bill
            </Button>
          )
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search detailed bills</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              placeholder="Search bill no., patient name, ID or mobile"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            className="input sm:!w-48"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by document status"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ready_for_signature">Ready for Signature</option>
            <option value="signed">Signed</option>
            <option value="finalized">Finalized</option>
            <option value="shared">Shared</option>
            <option value="cancelled">Cancelled</option>
            <option value="superseded">Superseded</option>
          </select>
          <input
            className="input sm:!w-40"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Treatment period from"
            title="Treatment period from"
          />
          <input
            className="input sm:!w-40"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Treatment period to"
            title="Treatment period to"
          />
        </div>

        {data && data.items.length === 0 ? (
          <Empty
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="No detailed physiotherapy bills yet"
          >
            Create date-wise insurance reimbursement statements in under 5 minutes without opening Excel or Word — and without duplicating existing invoice revenue.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Patient</th>
                  <th>Treatment Period</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Total Charges</th>
                  <th>Generated</th>
                  <th>Signature</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={loading ? "opacity-60" : ""}>
                {data?.items.map((b) => (
                  <tr
                    key={b.id}
                    className="row-link"
                    onClick={() => nav(`/detailed-bills/${b.id}`)}
                  >
                    <td className="font-medium text-navy-900">
                      {b.billNo}
                      {b.version > 1 && (
                        <span className="ml-1.5 rounded bg-cream px-1.5 py-0.5 text-[10px] font-semibold text-navy-700">
                          v{b.version}
                        </span>
                      )}
                    </td>
                    <td>
                      <p className="font-medium text-navy-900">{b.patientName}</p>
                      <p className="text-xs text-muted">{b.patientCode}</p>
                    </td>
                    <td className="text-xs">
                      {fmtDate(b.treatmentStartDate)} – {fmtDate(b.treatmentEndDate)}
                    </td>
                    <td className="num text-right font-medium">{b.totalSessions}</td>
                    <td className="num text-right font-semibold">{money(b.totalAmount)}</td>
                    <td className="text-xs text-muted">{fmtDate(b.billDate)}</td>
                    <td className="text-xs">
                      {b.signedAt ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Signed
                        </span>
                      ) : (
                        <span className="text-muted">Unsigned</span>
                      )}
                    </td>
                    <td>
                      <DetailedBillStatusPill status={b.status} />
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Download PDF"
                          onClick={(e) => void quickDownload(b.id, e)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {can("detailed_bills.write") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Duplicate as new draft"
                            onClick={(e) => void quickDuplicate(b.id, e)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <p className="mt-3 text-xs text-muted">Note: Detailed physiotherapy statements support patient insurance reimbursement claims and do not create duplicate financial revenue entries in your invoice ledger.</p>}
      <button type="button" className="hidden" onClick={reload} aria-hidden />
    </div>
  );
}

/* ============================================================================
   2. INTERACTIVE MULTI-DATE TAP CALENDAR (Mobile-First, Persistent Across Months)
   ============================================================================ */

function MultiDateSessionCalendar({
  selectedDates,
  onToggleDate,
  onAddSameDaySession,
  focusMonthIso,
}: {
  selectedDates: string[];
  onToggleDate: (isoDate: string) => void;
  onAddSameDaySession: (isoDate: string) => void;
  focusMonthIso?: string;
}) {
  const initialYm = (focusMonthIso && /^\d{4}-\d{2}/.test(focusMonthIso) ? focusMonthIso : todayLocal()).slice(0, 7);
  const [ym, setYm] = useState(initialYm);

  const countsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of selectedDates) m.set(d, (m.get(d) ?? 0) + 1);
    return m;
  }, [selectedDates]);

  const [year, month] = ym.split("-").map(Number);
  const firstDayOffset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthTitle = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function shiftMonth(delta: number) {
    const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYm(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, idx) => `${year}-${String(month).padStart(2, "0")}-${String(idx + 1).padStart(2, "0")}`,
    ),
  ];

  const lastSelected = selectedDates[selectedDates.length - 1] ?? null;

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2 pb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="grid h-10 w-10 place-items-center rounded-xl border border-line hover:bg-cream"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-navy-900">{monthTitle}</p>
          <p className="text-[11px] text-muted">Tap dates attended · Selections persist across months</p>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="grid h-10 w-10 place-items-center rounded-xl border border-line hover:bg-cream"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((iso, idx) => {
          if (!iso) return <div key={`empty-${idx}`} />;
          const count = countsByDate.get(iso) ?? 0;
          const dayNum = Number(iso.slice(-2));
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onToggleDate(iso)}
              aria-pressed={count > 0}
              aria-label={`${iso}${count > 0 ? ` (${count} session${count > 1 ? "s" : ""} selected)` : ""}`}
              className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-sm font-semibold transition select-none ${
                count > 0
                  ? "bg-teal-600 text-white shadow-xs hover:bg-teal-700"
                  : "border border-line/70 bg-ivory text-navy-900 hover:border-teal-300 hover:bg-teal-50/50"
              }`}
            >
              <span>{dayNum}</span>
              {count > 1 && (
                <span className="rounded-full bg-white/95 px-1.5 text-[9px] font-bold text-teal-800">
                  ×{count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lastSelected && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <span className="text-muted">
            Need a second genuine session on <strong>{fmtDate(lastSelected)}</strong>?
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onAddSameDaySession(lastSelected)}
          >
            <Plus className="h-3.5 w-3.5" /> Add extra session on {lastSelected.slice(5)}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   3. FIVE-MINUTE SINGLE-PAGE BUILDER, PREVIEW, SIGN & SHARE (/detailed-bills/new & /:id)
   ============================================================================ */

type EditableSession = {
  uid: string;
  sessionDate: string;
  particulars: string;
  amountText: string; // rupees string e.g. "1200"
  sourceAppointmentId: number | null;
};

type PatientDetailMini = {
  patient: {
    id: number;
    patientCode: string;
    name: string;
    phone: string | null;
    gender: string | null;
    dateOfBirth: string | null;
  };
};

function computeAgeFromDob(dob: string | null | undefined): string {
  if (!dob) return "";
  const d = new Date(dob + "T00:00:00");
  if (isNaN(+d)) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : "";
}

let uidCounter = 1;
const makeUid = () => `s_${Date.now()}_${uidCounter++}`;

export function DetailedBillBuilderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();

  const { data: settings } = useLoad(() => get<Settings>("/settings"), []);

  const [billId, setBillId] = useState<number | null>(id ? Number(id) : null);
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState<DetailedBillStatus>("draft");
  const [supersededById, setSupersededById] = useState<number | null>(null);
  const [signature, setSignature] = useState<DocumentSignatureRecord | null>(null);

  const [pickedPatient, setPickedPatient] = useState<PickedPatient | null>(null);
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const [creatingPatient, setCreatingPatient] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [ageGender, setAgeGender] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [startDate, setStartDate] = useState(todayLocal());
  const [endDate, setEndDate] = useState(todayLocal());
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(todayLocal());
  const [defaultRateText, setDefaultRateText] = useState("1200");
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<EditableSession[]>([]);

  const [importedCandidates, setImportedCandidates] = useState<
    {
      sourceAppointmentId: number;
      sessionDate: string;
      time: string;
      visitType: string;
      particulars: string;
      amount: number;
      checked: boolean;
    }[]
  >([]);
  const [importLoaded, setImportLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [whatsappFallbackHint, setWhatsappFallbackHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const locked = !["draft", "ready_for_signature"].includes(status);

  // Load existing bill when editing/viewing `/detailed-bills/:id`
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    get<DetailedBillFull>(`/detailed-bills/${id}`)
      .then((b) => {
        if (!mounted) return;
        setBillId(b.id);
        setVersion(b.version);
        setStatus(b.status);
        setSupersededById(b.supersededById);
        setSignature(b.signature);
        setPickedPatient({ id: b.patientId, name: b.patientName, patientCode: b.patientCode, phone: b.patientPhone });
        setPatientPhone(b.patientPhone);
        setPatientName(b.patientName);
        setAgeGender(b.patientAgeGender);
        setReferredBy(b.referredBy);
        setStartDate(b.treatmentStartDate);
        setEndDate(b.treatmentEndDate);
        setBillNo(b.billNo);
        setBillDate(b.billDate);
        setDefaultRateText(String(Math.round(b.defaultCharge / 100)));
        setNotes(b.notes ?? "");
        setSessions(
          b.sessions.map((s) => ({
            uid: makeUid(),
            sessionDate: s.sessionDate,
            particulars: s.particulars,
            amountText: formatRupeeNumber(s.amount, false),
            sourceAppointmentId: s.sourceAppointmentId,
          })),
        );
        if (!["draft", "ready_for_signature"].includes(b.status)) {
          setActiveTab("preview");
        }
      })
      .catch((e) => mounted && setErr((e as Error).message));
    return () => {
      mounted = false;
    };
  }, [id]);

  // Pre-fill next bill number and default rate when creating a new Detailed Bill
  useEffect(() => {
    if (id) return;
    get<{ billNo: string }>(`/detailed-bills/next-number?date=${billDate}`)
      .then((r) => setBillNo((cur) => cur || r.billNo))
      .catch(() => {});
  }, [id, billDate]);

  useEffect(() => {
    if (!id && settings?.invoice.defaultSessionChargePaise) {
      setDefaultRateText(String(Math.round(settings.invoice.defaultSessionChargePaise / 100)));
    }
  }, [id, settings]);

  // Pre-select patient from `?patient=<id>` query parameter (e.g. from PatientDetailPage)
  const preselectPatientId = searchParams.get("patient");
  useEffect(() => {
    if (id || !preselectPatientId) return;
    const pid = Number(preselectPatientId);
    if (!pid) return;
    void loadPatientInfo(pid, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, preselectPatientId]);

  async function loadPatientInfo(pid: number, autoFetchSessions = false) {
    try {
      const detail = await get<PatientDetailMini & { appointments?: { id: number; date: string; status: string }[] }>(
        `/patients/${pid}`,
      );
      const p = detail.patient;
      setPickedPatient({ id: p.id, name: p.name, patientCode: p.patientCode, phone: p.phone });
      setPatientPhone(p.phone);
      setPatientName(p.name);
      const age = computeAgeFromDob(p.dateOfBirth);
      setAgeGender([age ? `${age} Years` : "", p.gender ?? ""].filter(Boolean).join(" / "));

      if (autoFetchSessions && detail.appointments) {
        const completed = detail.appointments
          .filter((a) => a.status === "completed")
          .sort((a, b) => a.date.localeCompare(b.date));
        if (completed.length > 0) {
          const first = completed[0].date;
          const last = completed[completed.length - 1].date;
          setStartDate(first);
          setEndDate(last);
          setSessions(
            completed.map((c) => ({
              uid: makeUid(),
              sessionDate: c.date,
              particulars: "Physiotherapy Charges",
              amountText: defaultRateText,
              sourceAppointmentId: c.id,
            })),
          );
        }
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Keep sessions sorted chronologically for serial numbering & live preview
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
    [sessions],
  );

  const totalPaise = useMemo(
    () =>
      sortedSessions.reduce((acc, s) => {
        const p = rupeesToPaise(s.amountText || "0");
        return acc + (p ?? 0);
      }, 0),
    [sortedSessions],
  );

  const wordsDisplay = useMemo(() => rupeesInWords(totalPaise), [totalPaise]);

  const outOfRangeSessions = useMemo(
    () => sortedSessions.filter((s) => s.sessionDate < startDate || s.sessionDate > endDate),
    [sortedSessions, startDate, endDate],
  );

  function syncPeriodToSelectedDates() {
    if (sortedSessions.length === 0) return;
    setStartDate(sortedSessions[0].sessionDate);
    setEndDate(sortedSessions[sortedSessions.length - 1].sessionDate);
  }

  function handleToggleCalendarDate(isoDate: string) {
    if (locked) return;
    setSessions((prev) => {
      const exists = prev.some((s) => s.sessionDate === isoDate);
      let next: EditableSession[];
      if (exists) {
        next = prev.filter((s) => s.sessionDate !== isoDate);
      } else {
        next = [
          ...prev,
          {
            uid: makeUid(),
            sessionDate: isoDate,
            particulars: "Physiotherapy Charges",
            amountText: defaultRateText || "1200",
            sourceAppointmentId: null,
          },
        ];
      }
      if (next.length > 0) {
        const dates = next.map((x) => x.sessionDate).sort();
        setStartDate((cur) => (dates[0] < cur || prev.length === 0 ? dates[0] : cur));
        setEndDate((cur) => (dates[dates.length - 1] > cur || prev.length === 0 ? dates[dates.length - 1] : cur));
      }
      return next;
    });
  }

  function handleAddExtraSameDaySession(isoDate: string) {
    if (locked) return;
    setSessions((prev) => [
      ...prev,
      {
        uid: makeUid(),
        sessionDate: isoDate,
        particulars: "Physiotherapy Charges",
        amountText: defaultRateText || "1200",
        sourceAppointmentId: null,
      },
    ]);
    toast(`Added additional session on ${fmtDate(isoDate)}`);
  }

  async function fetchCompletedSessionsInRange() {
    if (!pickedPatient) return setErr("Select a patient first.");
    setErr(null);
    try {
      const res = await get<{
        sessions: {
          sourceAppointmentId: number;
          sessionDate: string;
          time: string;
          visitType: string;
          particulars: string;
          amount: number;
        }[];
      }>(`/detailed-bills/completed-sessions?patientId=${pickedPatient.id}&from=${startDate}&to=${endDate}`);
      const existingIds = new Set(sessions.map((s) => s.sourceAppointmentId).filter(Boolean));
      setImportedCandidates(
        res.sessions.map((s) => ({
          ...s,
          checked: !existingIds.has(s.sourceAppointmentId),
        })),
      );
      setImportLoaded(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function confirmImportSelected() {
    const chosen = importedCandidates.filter((c) => c.checked);
    if (!chosen.length) {
      setImportLoaded(false);
      return;
    }
    const existingIds = new Set(sessions.map((s) => s.sourceAppointmentId).filter(Boolean));
    const additions: EditableSession[] = chosen
      .filter((c) => !existingIds.has(c.sourceAppointmentId))
      .map((c) => ({
        uid: makeUid(),
        sessionDate: c.sessionDate,
        particulars: c.particulars || "Physiotherapy Charges",
        amountText: defaultRateText || formatRupeeNumber(c.amount, false),
        sourceAppointmentId: c.sourceAppointmentId,
      }));
    setSessions((prev) => [...prev, ...additions]);
    setImportLoaded(false);
    toast(`Imported ${additions.length} completed session${additions.length === 1 ? "" : "s"}`);
  }

  function applyDefaultChargeToAll() {
    if (locked) return;
    const paise = rupeesToPaise(defaultRateText);
    if (paise === null) return setErr("Enter a valid default session charge.");
    setSessions((prev) => prev.map((s) => ({ ...s, amountText: defaultRateText })));
    toast(`Applied ₹${defaultRateText} to all ${sessions.length} sessions`);
  }

  // Gentle auto-save for existing draft bills after idle edits
  const autoSaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!billId || locked || !pickedPatient || sortedSessions.length === 0 || outOfRangeSessions.length > 0) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      void saveBill(status === "ready_for_signature" ? "ready_for_signature" : "draft", true);
    }, 3500);
    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientName, ageGender, referredBy, startDate, endDate, billNo, billDate, notes, sessions]);

  async function saveBill(targetStatus: "draft" | "ready_for_signature" = "draft", silent = false): Promise<DetailedBillFull | null> {
    if (!silent) setErr(null);
    if (!pickedPatient) {
      if (!silent) setErr("Step 1: Please select or create a patient.");
      return null;
    }
    if (!patientName.trim()) {
      if (!silent) setErr("Step 2: Enter the patient's name.");
      return null;
    }
    if (endDate < startDate) {
      if (!silent) setErr("Step 2: Treatment End Date cannot be earlier than Treatment Start Date.");
      return null;
    }
    if (sortedSessions.length === 0) {
      if (!silent) setErr("Step 3: Select at least one treatment date from the calendar or import completed sessions.");
      return null;
    }
    if (outOfRangeSessions.length > 0) {
      if (!silent) {
        setErr(
          `${outOfRangeSessions.length} session date(s) fall outside ${startDate} to ${endDate}. Click 'Sync Period to Selected Dates' or remove out-of-range dates.`,
        );
      }
      return null;
    }

    const mappedSessions = [];
    for (const s of sortedSessions) {
      const paise = rupeesToPaise(s.amountText || "0");
      if (paise === null) {
        if (!silent) setErr(`Invalid charge "${s.amountText}" on ${s.sessionDate}`);
        return null;
      }
      mappedSessions.push({
        sessionDate: s.sessionDate,
        particulars: s.particulars.trim() || "Physiotherapy Charges",
        amount: paise,
        sourceAppointmentId: s.sourceAppointmentId,
      });
    }

    const defPaise = rupeesToPaise(defaultRateText || "0") ?? 120_000;
    const payload = {
      patientId: pickedPatient.id,
      patientName: patientName.trim(),
      patientAgeGender: ageGender.trim(),
      referredBy: referredBy.trim(),
      treatmentStartDate: startDate,
      treatmentEndDate: endDate,
      billNo: billNo.trim() || undefined,
      billDate,
      defaultCharge: defPaise,
      status: targetStatus,
      notes: notes.trim() || null,
      sessions: mappedSessions,
    };

    if (!silent) setBusy(true);
    try {
      const saved = billId
        ? await put<DetailedBillFull>(`/detailed-bills/${billId}`, payload)
        : await post<DetailedBillFull>("/detailed-bills", payload);
      setBillId(saved.id);
      setBillNo(saved.billNo);
      setStatus(saved.status);
      setVersion(saved.version);
      setAutoSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      if (!id) {
        nav(`/detailed-bills/${saved.id}`, { replace: true });
      }
      if (!silent) {
        toast(targetStatus === "ready_for_signature" ? "Saved & marked Ready for Signature" : "Draft saved");
      }
      return saved;
    } catch (e) {
      if (!silent) setErr((e as Error).message);
      return null;
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function openSignFlow() {
    if (!billId) {
      const saved = await saveBill("ready_for_signature", false);
      if (!saved) return;
    } else if (!locked) {
      const saved = await saveBill("ready_for_signature", false);
      if (!saved) return;
    }
    setSignModalOpen(true);
  }

  function buildPdfPayload() {
    return {
      billNo: billNo.trim() || "DRAFT",
      billDate,
      treatmentStartDate: startDate,
      treatmentEndDate: endDate,
      patientName: patientName.trim(),
      ageGender: ageGender.trim(),
      referredBy: referredBy.trim(),
      sessions: sortedSessions.map((s) => ({
        date: s.sessionDate,
        particulars: s.particulars || "Physiotherapy Charges",
        amount: rupeesToPaise(s.amountText || "0") ?? 0,
      })),
      signature,
    };
  }

  function pdfFileName() {
    const code = pickedPatient?.patientCode || "Patient";
    return `Detailed-Physiotherapy-Bill-${(billNo || "Draft").replace(/[^\w-]+/g, "_")}-${code}.pdf`;
  }

  async function handleDownloadPdf() {
    if (!settings) return;
    if (!locked && pickedPatient && sortedSessions.length > 0 && outOfRangeSessions.length === 0) {
      await saveBill(status === "ready_for_signature" ? "ready_for_signature" : "draft", true);
    }
    downloadDetailedBillPdf(buildPdfPayload(), settings, pdfFileName());
    toast("Detailed Physiotherapy Bill PDF downloaded");
  }

  async function handleSharePdf() {
    if (!settings) return;
    setWhatsappFallbackHint(false);
    if (!locked && pickedPatient && sortedSessions.length > 0 && outOfRangeSessions.length === 0) {
      await saveBill(status === "ready_for_signature" ? "ready_for_signature" : "draft", true);
    }
    const file = generateDetailedBillPdfFile(buildPdfPayload(), settings, pdfFileName());
    const result = await shareOrDownloadPdfFile({
      file,
      title: `Detailed Physiotherapy Bill - ${patientName}`,
    });
    if (result.method === "native_share") {
      if (billId && (status === "signed" || status === "finalized")) {
        const upd = await post<DetailedBillFull>(`/detailed-bills/${billId}/status`, { status: "shared" }).catch(() => null);
        if (upd) setStatus(upd.status);
      }
      toast("Document shared via device share menu");
    } else if (result.method === "downloaded") {
      setWhatsappFallbackHint(true);
      toast("PDF downloaded — attach the downloaded file manually in WhatsApp");
    }
  }

  async function handleFinalize() {
    if (!billId) return;
    const upd = await post<DetailedBillFull>(`/detailed-bills/${billId}/status`, { status: "finalized" });
    setStatus(upd.status);
    toast("Detailed bill marked Finalized");
  }

  async function handleCreateRevision() {
    if (!billId) return;
    const rev = await post<DetailedBillFull>(`/detailed-bills/${billId}/revise`);
    toast(`Created editable revision ${rev.billNo} (v${rev.version})`);
    nav(`/detailed-bills/${rev.id}`);
  }

  const cleanPhoneDigits = (patientPhone ?? pickedPatient?.phone ?? "").replace(/\D/g, "");
  const waDigits = cleanPhoneDigits.length === 10 ? `91${cleanPhoneDigits}` : cleanPhoneDigits;

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/detailed-bills" className="mb-1.5 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
            <ArrowLeft className="h-4 w-4" /> Detailed Physiotherapy Bills
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl">{billNo || "New Detailed Physiotherapy Bill"}</h1>
            <DetailedBillStatusPill status={status} />
            {version > 1 && (
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold text-navy-800">
                Revision v{version}
              </span>
            )}
            {autoSavedAt && !locked && (
              <span className="text-xs text-muted">Auto-saved {autoSavedAt}</span>
            )}
          </div>
        </div>

        {/* Primary Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "edit"}
              onClick={() => setActiveTab("edit")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "edit" ? "bg-navy-900 text-white" : "text-navy-800"
              }`}
            >
              1. Edit Details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "preview" ? "bg-navy-900 text-white" : "text-navy-800"
              }`}
            >
              2. Reference Preview ({sortedSessions.length})
            </button>
          </div>

          {!locked && can("detailed_bills.write") && (
            <Button variant="secondary" loading={busy} onClick={() => void saveBill("draft", false)}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
          )}

          {!signature && status !== "cancelled" && status !== "superseded" && can("signatures.manage") && (
            <Button
              variant="secondary"
              onClick={() => void openSignFlow()}
              disabled={sortedSessions.length === 0 || !pickedPatient}
            >
              <PenTool className="h-4 w-4" /> Sign Bill
            </Button>
          )}

          {status === "signed" && can("detailed_bills.write") && (
            <Button variant="secondary" onClick={() => void handleFinalize()}>
              <FileCheck2 className="h-4 w-4" /> Finalize
            </Button>
          )}

          {locked && status !== "superseded" && can("detailed_bills.write") && (
            <Button variant="secondary" onClick={() => void handleCreateRevision()}>
              <GitBranchPlus className="h-4 w-4" /> Revise Bill
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => {
              setActiveTab("preview");
              setTimeout(() => window.print(), 80);
            }}
            disabled={sortedSessions.length === 0}
          >
            <Printer className="h-4 w-4" /> Print
          </Button>

          <Button onClick={() => void handleDownloadPdf()} disabled={sortedSessions.length === 0}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>

          <Button variant="secondary" onClick={() => void handleSharePdf()} disabled={sortedSessions.length === 0}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </div>

      {supersededById && (
        <p className="no-print mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          This signed version has been superseded by a newer revision.{" "}
          <Link to={`/detailed-bills/${supersededById}`} className="font-semibold underline">
            Open latest revision →
          </Link>
        </p>
      )}

      {whatsappFallbackHint && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-sm text-teal-950">
          <span>
            <strong>PDF downloaded to your device.</strong> Standard WhatsApp web links cannot auto-attach local files — open the patient&apos;s chat below and attach the downloaded PDF manually.
          </span>
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Hello ${patientName}, please find attached your Detailed Physiotherapy Bill (${billNo}) from Namma Physiotherapy Centre.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1fa855] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#199249]"
            >
              <MessageCircle className="h-4 w-4" /> Open Patient WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="no-print mb-4">
        <ErrorNote error={err} />
      </div>

      {activeTab === "edit" ? (
        <div className="no-print grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          {/* Left Column: Steps 1, 2 & 4 */}
          <div className="space-y-6">
            {/* Step 1 — Patient Selection */}
            <section className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-navy-900">Step 1 — Select Patient</h2>
                {!locked && can("patients.write") && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingPatient(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Quick New Patient
                  </Button>
                )}
              </div>
              <div className="mt-3">
                {locked ? (
                  <p className="rounded-xl bg-cream p-3 text-sm font-semibold text-navy-900">
                    {patientName} ({pickedPatient?.patientCode})
                  </p>
                ) : (
                  <PatientPicker
                    value={pickedPatient}
                    onChange={(p) => {
                      setPickedPatient(p);
                      if (p) void loadPatientInfo(p.id, sessions.length === 0);
                    }}
                  />
                )}
              </div>
            </section>

            {/* Step 2 — Treatment & Bill Information */}
            <section className="card p-5">
              <h2 className="font-semibold text-navy-900">Step 2 — Patient &amp; Treatment Information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Name of the patient">
                  <input
                    className="input"
                    value={patientName}
                    disabled={locked}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </Field>
                <Field label="Patient Age and Gender" hint="e.g. 42 Years / Male">
                  <input
                    className="input"
                    value={ageGender}
                    disabled={locked}
                    onChange={(e) => setAgeGender(e.target.value)}
                    placeholder="e.g. 42 / Male"
                  />
                </Field>
                <Field label="Referred by">
                  <input
                    className="input"
                    value={referredBy}
                    disabled={locked}
                    onChange={(e) => setReferredBy(e.target.value)}
                    placeholder="e.g. Dr. Consulting Orthopaedic Surgeon"
                  />
                </Field>
                <Field label="Bill No.">
                  <input
                    className="input font-mono"
                    value={billNo}
                    disabled={locked}
                    onChange={(e) => setBillNo(e.target.value)}
                  />
                </Field>
                <Field label="Treatment Start Date">
                  <input
                    className="input"
                    type="date"
                    value={startDate}
                    disabled={locked}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="Treatment End Date">
                  <input
                    className="input"
                    type="date"
                    value={endDate}
                    disabled={locked}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
                <Field label="Bill Date">
                  <input
                    className="input"
                    type="date"
                    value={billDate}
                    disabled={locked}
                    onChange={(e) => setBillDate(e.target.value)}
                  />
                </Field>
                <Field label="Default Session Charge (₹)">
                  <div className="flex gap-2">
                    <input
                      className="input num"
                      inputMode="decimal"
                      value={defaultRateText}
                      disabled={locked}
                      onChange={(e) => setDefaultRateText(e.target.value)}
                    />
                    {!locked && (
                      <Button type="button" size="sm" variant="secondary" onClick={applyDefaultChargeToAll}>
                        Apply All
                      </Button>
                    )}
                  </div>
                </Field>
              </div>

              {outOfRangeSessions.length > 0 && !locked && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-950 ring-1 ring-amber-200">
                  <span>
                    {outOfRangeSessions.length} selected session(s) fall outside {startDate} – {endDate}.
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={syncPeriodToSelectedDates}>
                    Sync Start/End Dates
                  </Button>
                </div>
              )}
            </section>

            {/* Step 4 — Selected Sessions & Real-Time Totals Table */}
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
                <div>
                  <h2 className="font-semibold text-navy-900">
                    Step 4 — Confirm Sessions &amp; Charges ({sortedSessions.length})
                  </h2>
                  <p className="text-xs text-muted">
                    Total: <strong className="num text-navy-900">{money(totalPaise)}</strong> · {wordsDisplay}
                  </p>
                </div>
                {!locked && sortedSessions.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="!text-rose-700"
                    onClick={() => setSessions([])}
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {sortedSessions.length === 0 ? (
                <Empty icon={<Calendar className="h-5 w-5" />} title="No treatment dates selected yet">
                  Tap treatment dates on the calendar or click &ldquo;Import Completed Sessions&rdquo; on the right.
                </Empty>
              ) : (
                <div className="max-h-[460px] overflow-auto">
                  <table className="table">
                    <thead className="sticky top-0 bg-ivory">
                      <tr>
                        <th>Sl.</th>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Particulars</th>
                        <th className="text-right">Amount (₹)</th>
                        {!locked && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSessions.map((s, idx) => (
                        <tr key={s.uid}>
                          <td className="num text-muted">{idx + 1}</td>
                          <td className="whitespace-nowrap font-medium">{formatRefSessionDate(s.sessionDate)}</td>
                          <td className="text-xs text-muted">{dayOfWeekName(s.sessionDate)}</td>
                          <td>
                            <input
                              className="input !py-1.5 text-sm"
                              value={s.particulars}
                              disabled={locked}
                              onChange={(e) =>
                                setSessions((prev) =>
                                  prev.map((x) => (x.uid === s.uid ? { ...x, particulars: e.target.value } : x)),
                                )
                              }
                            />
                          </td>
                          <td className="w-28">
                            <input
                              className="input num !py-1.5 text-right text-sm"
                              inputMode="decimal"
                              value={s.amountText}
                              disabled={locked}
                              onChange={(e) =>
                                setSessions((prev) =>
                                  prev.map((x) => (x.uid === s.uid ? { ...x, amountText: e.target.value } : x)),
                                )
                              }
                            />
                          </td>
                          {!locked && (
                            <td className="w-10 text-right">
                              <button
                                type="button"
                                aria-label={`Remove session ${idx + 1}`}
                                onClick={() => setSessions((prev) => prev.filter((x) => x.uid !== s.uid))}
                                className="rounded p-1 text-muted hover:text-rose-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Step 3 — Import Completed Sessions + Multi-Date Tap Calendar */}
          <div className="space-y-6">
            <section className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-navy-900">Step 3A — Import Completed Sessions</h2>
                  <p className="text-xs text-muted">
                    Retrieves only completed sessions recorded for this patient (excludes cancelled or scheduled visits).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={locked || !pickedPatient}
                  onClick={() => void fetchCompletedSessionsInRange()}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Import Sessions
                </Button>
              </div>

              {importLoaded && (
                <div className="mt-4 rounded-xl border border-line bg-ivory p-3.5 text-xs">
                  {importedCandidates.length === 0 ? (
                    <p className="text-muted">
                      No completed treatment sessions recorded for this patient between {startDate} and {endDate}. Use the tap calendar below to select dates directly.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 font-semibold text-navy-900">
                        Select completed sessions to include ({importedCandidates.filter((c) => c.checked).length} of {importedCandidates.length}):
                      </p>
                      <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                        {importedCandidates.map((c, idx) => (
                          <li key={c.sourceAppointmentId} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="accent-teal-600"
                                checked={c.checked}
                                onChange={(e) =>
                                  setImportedCandidates((prev) =>
                                    prev.map((x, j) => (j === idx ? { ...x, checked: e.target.checked } : x)),
                                  )
                                }
                              />
                              <span className="font-medium text-navy-900">{formatRefSessionDate(c.sessionDate)}</span>
                              <span className="text-muted">({dayOfWeekName(c.sessionDate)} · {c.visitType})</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setImportLoaded(false)}>
                          Close
                        </Button>
                        <Button type="button" size="sm" onClick={confirmImportSelected}>
                          Add Selected
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-navy-900">Step 3B — Tap Treatment Dates on Calendar</h2>
              <MultiDateSessionCalendar
                selectedDates={sortedSessions.map((s) => s.sessionDate)}
                onToggleDate={handleToggleCalendarDate}
                onAddSameDaySession={handleAddExtraSameDaySession}
                focusMonthIso={startDate}
              />
            </section>

            {/* Quick Step Summary Card */}
            <div className="card bg-gradient-to-br from-teal-50 to-white p-5">
              <p className="text-xs font-semibold tracking-wider text-teal-800 uppercase">Summary &amp; Next Step</p>
              <p className="num mt-2 font-display text-3xl text-navy-900">
                {sortedSessions.length} session{sortedSessions.length === 1 ? "" : "s"} · {money(totalPaise)}
              </p>
              <p className="mt-1 text-xs text-muted">Amount in Words: {wordsDisplay}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => setActiveTab("preview")} disabled={sortedSessions.length === 0}>
                  Preview Reference Bill →
                </Button>
                {!signature && can("signatures.manage") && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void openSignFlow()}
                    disabled={sortedSessions.length === 0 || !pickedPatient}
                  >
                    <PenTool className="h-4 w-4" /> Sign Now
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ---------------- EXACT REFERENCE-MATCHED A4 PREVIEW & PRINT AREA ---------------- */
        <div className="overflow-x-auto pb-8">
          <div
            className="print-area card mx-auto min-h-[297mm] w-[210mm] bg-white p-[18mm] text-black"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
          >
            {settings && (
              <div className="mb-4 text-center">
                <p className="text-lg font-bold tracking-wide uppercase">{settings.clinic.name}</p>
                <p className="text-xs text-neutral-700">
                  {settings.clinic.address} {settings.clinic.phone ? `| Ph: ${settings.clinic.phone}` : ""}
                </p>
              </div>
            )}

            <table className="w-full border-collapse border border-black text-[13.5px] leading-snug">
              <colgroup>
                <col style={{ width: "18.47%" }} />
                <col style={{ width: "15.02%" }} />
                <col style={{ width: "13.89%" }} />
                <col style={{ width: "35.41%" }} />
                <col style={{ width: "17.21%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td colSpan={4} className="border border-black px-2.5 py-1.5 font-bold">
                    DETAILED PHYSIOTHERAPY BILL
                  </td>
                  <td className="border border-black px-2 py-1.5" />
                </tr>
                {[
                  ["Name of the patient", patientName],
                  ["Patient Age and Gender", ageGender],
                  ["Referred by", referredBy],
                  ["Treatment Start Date", startDate ? formatRefHeaderDate(startDate) : ""],
                  ["Treatment End Date", endDate ? formatRefHeaderDate(endDate) : ""],
                  ["Bill No.", billNo],
                  ["Bill Date", billDate ? formatRefHeaderDate(billDate) : ""],
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td colSpan={2} className="border border-black px-2.5 py-1 text-right font-bold">
                      {label}
                    </td>
                    <td colSpan={2} className="border border-black px-2.5 py-1 text-center">
                      {val}
                    </td>
                    <td className="border border-black px-2 py-1" />
                  </tr>
                ))}

                {/* Spacer Row */}
                <tr className="h-6">
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                </tr>

                {/* Shaded Header Row */}
                <tr style={{ backgroundColor: "#bebcbc" }} className="font-bold">
                  <td className="border border-black px-2 py-1.5 text-center">Sl. No</td>
                  <td className="border border-black px-2 py-1.5 text-center">Date</td>
                  <td className="border border-black px-2 py-1.5 text-center">Day</td>
                  <td className="border border-black px-2 py-1.5 text-center">Particulars</td>
                  <td className="border border-black px-2 py-1.5 text-left">Amount (Rs.)</td>
                </tr>

                {/* Session Rows */}
                {sortedSessions.map((s, idx) => {
                  const paise = rupeesToPaise(s.amountText || "0") ?? 0;
                  return (
                    <tr key={s.uid}>
                      <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                      <td className="border border-black px-2 py-1">{formatRefSessionDate(s.sessionDate)}</td>
                      <td className="border border-black px-2 py-1">{dayOfWeekName(s.sessionDate)}</td>
                      <td className="border border-black px-2 py-1">{s.particulars || "Physiotherapy Charges"}</td>
                      <td className="border border-black px-2 py-1 text-right">{formatRupeeNumber(paise, false)}</td>
                    </tr>
                  );
                })}

                {/* Spacer Row before Total */}
                <tr className="h-6">
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                </tr>

                {/* Total Sessions Row */}
                <tr className="font-bold">
                  <td className="border border-black px-2 py-1.5 text-center">
                    Total {sortedSessions.length} session{sortedSessions.length === 1 ? "" : "s"}
                  </td>
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black" />
                  <td className="border border-black px-2 py-1.5 text-right">{formatRupeeNumber(totalPaise, true)}</td>
                </tr>

                {/* Amount in Words Row */}
                <tr className="font-bold">
                  <td colSpan={5} className="border border-black px-2.5 py-2">
                    Amount in Words: {wordsDisplay}
                  </td>
                </tr>
              </tbody>
            </table>

            {settings && (
              <RenderedSignatureBlock
                clinicName={settings.clinic.name}
                showSignature={settings.invoice.showSignature}
                showStamp={settings.invoice.showStamp}
                stampDataUrl={settings.clinic.stampDataUrl}
                signature={signature}
              />
            )}
          </div>
        </div>
      )}

      {/* Quick New Patient Modal */}
      <Modal open={creatingPatient} onClose={() => setCreatingPatient(false)} title="Quick New Patient" wide>
        <PatientForm
          onCancel={() => setCreatingPatient(false)}
          onSaved={(newPid) => {
            setCreatingPatient(false);
            toast("Patient created");
            void loadPatientInfo(newPid, false);
          }}
        />
      </Modal>

      {/* Smartphone Electronic Handwritten Signature Modal */}
      {billId && (
        <DocumentSignatureModal
          open={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          docType="detailed_bill"
          docId={billId}
          docLabel={`Detailed Bill ${billNo}`}
          defaultSignerName={settings?.clinic.signerName || "Sunil Kumar"}
          defaultQualification={settings?.clinic.signerQualification || ""}
          onSigned={(sig) => {
            setSignature(sig);
            setStatus("signed");
            setActiveTab("preview");
          }}
        />
      )}
    </div>
  );
}
