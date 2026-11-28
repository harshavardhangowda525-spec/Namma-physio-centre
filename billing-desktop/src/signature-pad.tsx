import { CheckCircle2, Eraser, Eye, PenTool, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSignatureRecord, SavedSignatureInfo, SignableDocumentType } from "../shared/types";
import { del, get, post, put } from "./api";
import { useAuth } from "./auth";
import { Button, ErrorNote, Field, Modal, fmtDateTime, useLoad, useToast } from "./ui";

type Point = { x: number; y: number };

/**
 * Touchscreen-compatible handwritten signature pad supporting smartphone finger,
 * tablet stylus, and desktop mouse input without scrolling the page.
 */
export function SignatureCanvasPad({
  onChange,
  height = 190,
}: {
  onChange: (pngDataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activeStrokeRef = useRef<Point[] | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1f3a";
    ctx.lineWidth = 2.4;

    const all = activeStrokeRef.current
      ? [...strokesRef.current, activeStrokeRef.current]
      : strokesRef.current;

    for (const stroke of all) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, 1.3, 0, Math.PI * 2);
        ctx.fillStyle = "#0b1f3a";
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const midX = (stroke[i].x + stroke[i + 1].x) / 2;
        const midY = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const emitCroppedDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || strokesRef.current.length === 0) {
      setPreviewUrl(null);
      onChange(null);
      return;
    }
    // Export clean transparent PNG normalized to 480x160 for crisp PDF embedding
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 520;
    exportCanvas.height = 170;
    const ectx = exportCanvas.getContext("2d");
    if (!ectx) return;
    ectx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    const url = exportCanvas.toDataURL("image/png");
    setPreviewUrl(url);
    onChange(url);
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(280, Math.floor(rect.width));
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      redrawAll();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [height, redrawAll]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activeStrokeRef.current = [getPoint(e)];
    redrawAll();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    e.preventDefault();
    activeStrokeRef.current.push(getPoint(e));
    redrawAll();
  }

  function finishStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    e.preventDefault();
    if (activeStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
      setStrokeCount(strokesRef.current.length);
    }
    activeStrokeRef.current = null;
    redrawAll();
    emitCroppedDataUrl();
  }

  function undo() {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redrawAll();
    emitCroppedDataUrl();
  }

  function clear() {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    setShowPreview(false);
    redrawAll();
    emitCroppedDataUrl();
  }

  return (
    <div className="space-y-2.5">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-teal-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px`, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          aria-label="Draw handwritten signature here using finger, stylus or mouse"
          className="block w-full cursor-crosshair select-none"
        />
        {strokeCount === 0 && (
          <p className="pointer-events-none absolute inset-x-4 bottom-3 text-center text-xs text-muted">
            Sign above using your finger (smartphone), stylus, or mouse
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={undo} disabled={strokeCount === 0}>
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={clear} disabled={strokeCount === 0}>
            <Eraser className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowPreview((p) => !p)}
            disabled={!previewUrl}
          >
            <Eye className="h-3.5 w-3.5" /> {showPreview ? "Hide Preview" : "Preview"}
          </Button>
        </div>
        <span className="text-xs text-muted">
          {strokeCount === 0 ? "Canvas empty" : `${strokeCount} stroke${strokeCount === 1 ? "" : "s"}`}
        </span>
      </div>

      {showPreview && previewUrl && (
        <div className="rounded-xl border border-line bg-ivory p-3 text-center">
          <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Signature Preview</p>
          <img src={previewUrl} alt="Handwritten signature preview" className="mx-auto mt-1 h-16 object-contain" />
        </div>
      )}
    </div>
  );
}

/**
 * Reusable modal to sign any billing document (Detailed Bill, Invoice, Receipt, Session Statement)
 * using either a freshly drawn smartphone/touch signature or an encrypted saved clinician signature.
 */
export function DocumentSignatureModal({
  open,
  onClose,
  docType,
  docId,
  docLabel,
  defaultSignerName = "Sunil Kumar",
  defaultQualification = "",
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  docType: SignableDocumentType;
  docId: number;
  docLabel: string;
  defaultSignerName?: string;
  defaultQualification?: string;
  onSigned: (sig: DocumentSignatureRecord) => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: saved, reload: reloadSaved } = useLoad(
    () => (open && can("signatures.manage") ? get<SavedSignatureInfo>("/signatures/me") : Promise.resolve(null)),
    [open],
  );

  const [tab, setTab] = useState<"draw" | "saved">("draw");
  const [drawnPng, setDrawnPng] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerQual, setSignerQual] = useState(defaultQualification);
  const [saveForReuse, setSaveForReuse] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (saved) {
      setSignerName(saved.signerName || defaultSignerName);
      setSignerQual(saved.signerQualification || defaultQualification);
      if (saved.hasSaved) setTab("saved");
      else setTab("draw");
    }
  }, [saved, defaultSignerName, defaultQualification]);

  useEffect(() => {
    if (!open) {
      setAuthorized(false);
      setErr(null);
      setDrawnPng(null);
    }
  }, [open]);

  async function saveSignatureOnly() {
    if (!drawnPng) return setErr("Please draw your signature on the pad first.");
    setBusy(true);
    setErr(null);
    try {
      await put("/signatures/me", {
        imageDataUrl: drawnPng,
        signerName: signerName.trim() || defaultSignerName,
        signerQualification: signerQual.trim(),
      });
      toast("Reusable handwritten signature saved securely");
      reloadSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSavedSignature() {
    setBusy(true);
    setErr(null);
    try {
      await del("/signatures/me");
      toast("Saved signature deleted");
      setTab("draw");
      reloadSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applySignature() {
    setErr(null);
    if (!authorized) {
      return setErr("Please check the authorization confirmation box before applying your signature.");
    }
    if (tab === "draw" && !drawnPng) {
      return setErr("Please draw your handwritten signature first.");
    }
    if (tab === "saved" && !saved?.hasSaved) {
      return setErr("No saved signature available. Switch to 'Draw New Signature'.");
    }

    setBusy(true);
    try {
      const payload =
        tab === "draw"
          ? {
              mode: "drawn" as const,
              imageDataUrl: drawnPng!,
              signerName: signerName.trim() || defaultSignerName,
              signerQualification: signerQual.trim(),
              saveForReuse,
              confirmAuthorization: true as const,
            }
          : {
              mode: "saved" as const,
              signerName: signerName.trim() || defaultSignerName,
              signerQualification: signerQual.trim(),
              confirmAuthorization: true as const,
            };

      const res = await post<{ signature: DocumentSignatureRecord }>(
        `/documents/${docType}/${docId}/sign`,
        payload,
      );
      toast("Electronic handwritten signature applied");
      onSigned(res.signature);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Sign ${docLabel}`} wide>
      <div className="space-y-4 text-sm">
        <p className="flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-xs text-teal-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
          <span>
            <strong>Electronic Handwritten Signature:</strong> Sign directly using your smartphone touchscreen, stylus, or mouse. Once signed, this document version is locked against silent modification.
          </span>
        </p>

        {/* Mode Tabs */}
        <div className="flex gap-2 rounded-xl bg-cream p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "draw"}
            onClick={() => setTab("draw")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              tab === "draw" ? "bg-navy-900 text-white" : "text-navy-800"
            }`}
          >
            <PenTool className="mr-1.5 inline h-3.5 w-3.5" />
            Draw Signature
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "saved"}
            onClick={() => setTab("saved")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              tab === "saved" ? "bg-navy-900 text-white" : "text-navy-800"
            }`}
          >
            Use Saved Signature {saved?.hasSaved ? "✓" : ""}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Authorized Physiotherapist Name">
            <input
              className="input"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
            />
          </Field>
          <Field label="Verified Qualification (optional)">
            <input
              className="input"
              value={signerQual}
              onChange={(e) => setSignerQual(e.target.value)}
              placeholder="Leave blank unless verified"
            />
          </Field>
        </div>

        {tab === "draw" ? (
          <div className="space-y-3">
            <SignatureCanvasPad onChange={setDrawnPng} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-navy-900">
                <input
                  type="checkbox"
                  className="accent-teal-600"
                  checked={saveForReuse}
                  onChange={(e) => setSaveForReuse(e.target.checked)}
                />
                Save / replace as my reusable signature for future bills
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={busy}
                disabled={!drawnPng}
                onClick={saveSignatureOnly}
              >
                Save Signature Only
              </Button>
            </div>
          </div>
        ) : saved?.hasSaved && saved.imageDataUrl ? (
          <div className="rounded-2xl border border-line bg-ivory p-5 text-center">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Saved Handwritten Signature Preview</p>
            <img
              src={saved.imageDataUrl}
              alt="Saved handwritten signature"
              className="mx-auto my-3 h-20 object-contain"
            />
            <p className="text-xs text-muted">
              {saved.signerName}
              {saved.signerQualification ? ` · ${saved.signerQualification}` : ""} · Saved {fmtDateTime(saved.updatedAt)}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setTab("draw")}>
                Replace Signature
              </Button>
              <Button type="button" size="sm" variant="ghost" className="!text-rose-700" onClick={deleteSavedSignature}>
                <Trash2 className="h-3.5 w-3.5" /> Delete Saved
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-cream/60 p-6 text-center text-xs text-muted">
            No saved signature is stored for your account yet. Switch to <strong>Draw Signature</strong> to create one.
          </div>
        )}

        {/* Mandatory Explicit Authorization Confirmation */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 text-xs text-navy-900">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
          />
          <span>
            I explicitly authorize applying my handwritten electronic signature to <strong>{docLabel}</strong> and confirm that the treatment dates and charges shown are accurate.
          </span>
        </label>

        <ErrorNote error={err} />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={busy}
            disabled={!authorized || (tab === "draw" ? !drawnPng : !saved?.hasSaved)}
            onClick={applySignature}
          >
            <CheckCircle2 className="h-4 w-4" /> Apply Signature
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Displays signature + clinic stamp cleanly in A4 HTML document previews & printouts. */
export function RenderedSignatureBlock({
  clinicName,
  showSignature = true,
  showStamp = true,
  stampDataUrl,
  signature,
}: {
  clinicName: string;
  showSignature?: boolean;
  showStamp?: boolean;
  stampDataUrl?: string | null;
  signature?: DocumentSignatureRecord | null;
}) {
  if (!showSignature && !showStamp && !signature) return null;
  const signedDate = signature?.signedAt
    ? new Date(signature.signedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="mt-10 flex items-end justify-between gap-6 pt-4">
      {showStamp ? (
        stampDataUrl ? (
          <img src={stampDataUrl} alt="Clinic stamp" className="h-24 w-24 object-contain" />
        ) : (
          <div className="grid h-22 w-22 place-items-center rounded-full border-2 border-dashed border-line text-center text-[10px] text-muted">
            Clinic Stamp
          </div>
        )
      ) : (
        <span />
      )}

      {(showSignature || signature) && (
        <div className="w-60 text-center">
          {signature?.imageDataUrl ? (
            <img
              src={signature.imageDataUrl}
              alt={`Signed by ${signature.signerName}`}
              className="mx-auto mb-1 h-14 object-contain"
            />
          ) : (
            <div className="h-12" />
          )}
          <div className="border-t border-navy-900 pt-1.5 text-xs font-bold text-navy-900">
            {signature ? signature.signerName : "Authorised Signatory"}
          </div>
          {signature?.signerQualification && (
            <p className="text-[10.5px] font-medium text-ink">{signature.signerQualification}</p>
          )}
          <p className="text-[10.5px] text-muted">{clinicName}</p>
          {signedDate && <p className="text-[10px] text-muted">Signed on: {signedDate}</p>}
        </div>
      )}
    </div>
  );
}
