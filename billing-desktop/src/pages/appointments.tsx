import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "../../shared/types";
import { ApiError, get, post, put } from "../api";
import { useAuth } from "../auth";
import { PatientPicker, type PickedPatient } from "../patient-picker";
import { Button, Empty, ErrorNote, Field, Modal, PageTitle, StatusBadge, fmtDate, todayLocal, useLoad, useToast } from "../ui";

type Appt = { id: number; patient_id: number; patient_name: string; patient_code: string; patient_phone: string | null; visit_type: "clinic" | "home"; date: string; time: string; physiotherapist: string | null; status: AppointmentStatus; notes: string | null };

export function AppointmentForm({ patient, initial, onDone, onCancel }: { patient?: PickedPatient; initial?: Appt; onDone: () => void; onCancel: () => void }) {
  const { data: settings } = useLoad(() => get<{ physiotherapists: string[] }>("/settings"), []);
  const [p, setP] = useState<PickedPatient | null>(patient ?? (initial ? { id: initial.patient_id, name: initial.patient_name, patientCode: initial.patient_code } : null));
  const [f, setF] = useState({
    visitType: initial?.visit_type ?? "clinic", date: initial?.date ?? todayLocal(), time: initial?.time ?? "10:00",
    physiotherapist: initial?.physiotherapist ?? "", status: initial?.status ?? "confirmed", notes: initial?.notes ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [clash, setClash] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    if (!p) return setErr("Choose a patient");
    setBusy(true);
    setErr(null);
    try {
      const body = { ...f, patientId: p.id, physiotherapist: f.physiotherapist || null };
      if (initial) await put(`/appointments/${initial.id}`, body);
      else await post(`/appointments${force ? "?force=1" : ""}`, body);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setClash(e instanceof ApiError && e.status === 409);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Patient" className="sm:col-span-2"><PatientPicker value={p} onChange={setP} autoFocus={!p} /></Field>
      <Field label="Visit type">
        <select className="input" value={f.visitType} onChange={(e) => setF({ ...f, visitType: e.target.value as "clinic" | "home" })}><option value="clinic">Clinic visit</option><option value="home">Home visit</option></select>
      </Field>
      <Field label="Status">
        <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AppointmentStatus })}>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", "-")}</option>)}</select>
      </Field>
      <Field label="Date"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
      <Field label="Time"><input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} required /></Field>
      <Field label="Physiotherapist" className="sm:col-span-2">
        <select className="input" value={f.physiotherapist} onChange={(e) => setF({ ...f, physiotherapist: e.target.value })}><option value="">Not assigned</option>{settings?.physiotherapists.map((n) => <option key={n}>{n}</option>)}</select>
      </Field>
      <Field label="Notes (optional, non-clinical)" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="sm:col-span-2"><ErrorNote error={err} /></div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>{initial ? "Save" : "Add appointment"}</Button>
        {clash && !initial && <Button type="button" variant="secondary" onClick={(e) => submit(e as unknown as FormEvent, true)}>Book anyway</Button>}
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA").format(d);
};

export function AppointmentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [start, setStart] = useState(todayLocal());
  const [status, setStatus] = useState("");
  const end = addDays(start, 6);
  const { data, reload } = useLoad(() => get<Appt[]>(`/appointments?from=${start}&to=${end}&status=${status}`), [start, status]);
  const [editing, setEditing] = useState<Appt | "new" | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  async function quickStatus(a: Appt, s: AppointmentStatus) {
    await put(`/appointments/${a.id}`, { patientId: a.patient_id, visitType: a.visit_type, date: a.date, time: a.time, physiotherapist: a.physiotherapist, status: s, notes: a.notes });
    toast(`Marked ${s.replace("_", "-")}`);
    reload();
  }

  return (
    <div>
      <PageTitle title="Appointments" subtitle="Local appointment register. Website booking requests are managed separately on the website's admin page." actions={can("appointments.write") && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New appointment</Button>} />
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="secondary" size="sm" onClick={() => setStart(todayLocal())}>Today</Button>
        <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
        <span className="font-semibold text-navy-900">{fmtDate(start)} – {fmtDate(end)}</span>
        <select className="input ml-auto !w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", "-")}</option>)}
        </select>
      </div>
      {data && data.length === 0 && <div className="card"><Empty icon={<CalendarDays className="h-5 w-5" />} title="No appointments this week" /></div>}
      <div className="space-y-4">
        {days.map((d) => {
          const list = data?.filter((a) => a.date === d) ?? [];
          if (!list.length) return null;
          return (
            <div key={d} className="card">
              <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">{new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h2>
              <table className="table"><tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td className="w-20 font-semibold text-navy-900">{a.time}</td>
                    <td><Link to={`/patients/${a.patient_id}`} className="font-medium text-navy-900 hover:underline">{a.patient_name}</Link><p className="text-xs text-muted">{a.patient_phone}</p></td>
                    <td className="capitalize">{a.visit_type}</td>
                    <td>{a.physiotherapist ?? "—"}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="text-right whitespace-nowrap">
                      {can("appointments.write") && <>
                        {a.status === "confirmed" && <Button size="sm" variant="ghost" onClick={() => quickStatus(a, "completed")}>Complete</Button>}
                        {a.status === "requested" && <Button size="sm" variant="ghost" onClick={() => quickStatus(a, "confirmed")}>Confirm</Button>}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          );
        })}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New appointment" : "Edit appointment"}>
        {editing && <AppointmentForm initial={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onDone={() => (setEditing(null), reload(), toast("Appointment saved"))} />}
      </Modal>
    </div>
  );
}
