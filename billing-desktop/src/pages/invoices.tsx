import { FilePlus2, FileText, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { get } from "../api";
import { useAuth } from "../auth";
import { Button, Empty, PageTitle, StatusBadge, fmtDate, money, useLoad } from "../ui";

type Row = { id: number; invoice_no: string; invoice_date: string; total: number; paid: number; status: string; patient_name: string; patient_code: string };

export function InvoicesPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => (setDq(q), setPage(0)), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading } = useLoad(
    () => get<{ total: number; items: Row[] }>(`/invoices?q=${encodeURIComponent(dq)}&status=${status}&from=${from}&to=${to}&limit=50&offset=${page * 50}`),
    [dq, status, from, to, page],
  );
  return (
    <div>
      <PageTitle title="Invoices" subtitle={data ? `${data.total} invoice${data.total === 1 ? "" : "s"}` : " "} actions={can("invoices.write") && <Button onClick={() => nav("/invoices/new")}><FilePlus2 className="h-4 w-4" /> New invoice</Button>} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search invoices</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Invoice number, patient name, ID or phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="input sm:!w-40" value={status} onChange={(e) => (setStatus(e.target.value), setPage(0))} aria-label="Status">
            <option value="">All statuses</option><option value="outstanding">Outstanding</option><option value="unpaid">Unpaid</option><option value="partial">Part-paid</option><option value="paid">Paid</option><option value="void">Void</option>
          </select>
          <input className="input sm:!w-40" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(0))} aria-label="From date" />
          <input className="input sm:!w-40" type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(0))} aria-label="To date" />
        </div>
        {data && data.items.length === 0 ? <Empty icon={<FileText className="h-5 w-5" />} title="No invoices found" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Patient</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
              <tbody className={loading ? "opacity-60" : ""}>
                {data?.items.map((i) => (
                  <tr key={i.id} className="row-link" onClick={() => nav(`/invoices/${i.id}`)}>
                    <td className="font-medium text-navy-900">{i.invoice_no}</td>
                    <td>{fmtDate(i.invoice_date)}</td>
                    <td>{i.patient_name} <span className="text-xs text-muted">{i.patient_code}</span></td>
                    <td className="num text-right">{money(i.total)}</td>
                    <td className={`num text-right ${i.status !== "void" && i.total - i.paid > 0 ? "font-semibold text-rose-700" : "text-muted"}`}>{i.status === "void" ? "—" : money(i.total - i.paid)}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 50 && (
          <div className="flex items-center justify-end gap-2 p-4 text-sm">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-muted">Page {page + 1} of {Math.ceil(data.total / 50)}</span>
            <Button size="sm" variant="secondary" disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
