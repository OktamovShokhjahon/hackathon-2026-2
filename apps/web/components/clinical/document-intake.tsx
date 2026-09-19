"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, EmptyState, Skeleton } from "@/components/ui/console";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { inputClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { formatDate, formatRelative, humanizeEnum } from "@/lib/format";

interface DocumentRow {
  _id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractionMethod?: "pdf_text_layer" | "docx" | "plain_text" | "pasted" | "none";
  extractionNote?: string;
  analyzedAt?: string;
  createdAt: string;
}

interface CandidateRecord {
  _id: string;
  type: string;
  eventDate: string;
  verificationStatus: string;
  data: { description?: string; value?: number | string; unit?: string; confidence?: string; field?: string };
  sourceReferences?: Array<{ span?: string }>;
}

const EXTRACTION_LABEL: Record<string, string> = {
  pdf_text_layer: "Read from the PDF text layer",
  docx: "Read from the Word document",
  plain_text: "Read as plain text",
  pasted: "Pasted by a clinician",
  none: "No readable text",
};

/**
 * Document intake, verification queue and nothing in between. A file is stored,
 * its text is read deterministically where that is possible, candidate facts
 * come back with the line they came from, and every one of them waits here as
 * unverified until a doctor approves it. Nothing on this panel reaches the
 * patient snapshot or a clinical rule before that.
 */
export function DocumentIntake({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractionSource, setExtractionSource] = useState<"model" | "deterministic_parser" | null>(null);

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", patientId],
    queryFn: () => api.get<DocumentRow[]>(`/patients/${patientId}/documents`),
  });

  const { data: records } = useQuery({
    queryKey: ["records", patientId],
    queryFn: () => api.get<CandidateRecord[]>(`/patients/${patientId}/records`),
  });

  const pending = (records ?? []).filter((record) => record.verificationStatus === "ai_unverified");

  const analyze = useMutation({
    mutationFn: (params: { documentId: string; text?: string }) =>
      api.post<{ extractionSource: "model" | "deterministic_parser"; createdRecordIds: string[] }>(
        `/documents/${params.documentId}/analyze`,
        params.text ? { extractedText: params.text } : {},
      ),
    onSuccess: (result) => {
      setExtractionSource(result.extractionSource);
      setError(null);
      setPastedText("");
      toast(
        result.createdRecordIds.length > 0
          ? `${result.createdRecordIds.length} candidate facts need your review`
          : "No candidate facts were found in this document",
        result.createdRecordIds.length > 0 ? "success" : "info",
      );
      queryClient.invalidateQueries({ queryKey: ["records", patientId] });
      queryClient.invalidateQueries({ queryKey: ["documents", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The document could not be analyzed"),
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.upload<DocumentRow>(`/patients/${patientId}/documents`, file),
    onSuccess: (document) => {
      setError(null);
      setActiveDocumentId(document._id);
      queryClient.invalidateQueries({ queryKey: ["documents", patientId] });
      if (document.extractionMethod && document.extractionMethod !== "none") {
        // Text was read from the file, so the extraction can run straight away.
        analyze.mutate({ documentId: document._id });
      } else {
        toast(document.extractionNote ?? "Paste the text from this document to analyze it", "info");
      }
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The document could not be uploaded"),
  });

  const verify = useMutation({
    mutationFn: (params: { recordId: string; approve: boolean }) =>
      api.patch(`/records/${params.recordId}`, { approve: params.approve }),
    onSuccess: (_result, params) => {
      toast(params.approve ? "Added to the verified history" : "Rejected — kept out of the snapshot");
      queryClient.invalidateQueries({ queryKey: ["records", patientId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The record could not be updated"),
  });

  return (
    <Panel
      title={`Documents${pending.length > 0 ? ` · ${pending.length} to verify` : ""}`}
      className="mt-4"
      action={
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
          className="rounded border border-[color:var(--line-strong)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink transition hover:bg-ink/[0.04] disabled:opacity-60"
        >
          {upload.isPending ? "Uploading…" : "Upload file"}
        </button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = "";
        }}
      />

      <p className="max-w-readable text-[13px] leading-relaxed text-ink-muted">
        PDF and Word files are read automatically. A scan or a photo has no text to read, so paste
        its text instead. Everything extracted waits for your approval before it counts.
      </p>

      {/* ------------------------------------------------------ paste path */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const documentId = activeDocumentId ?? documents?.[0]?._id;
          if (!documentId) {
            setError("Upload the source file first, then paste its text here.");
            return;
          }
          analyze.mutate({ documentId, text: pastedText });
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1.5">
          <span className="readout">Paste document text</span>
          <textarea
            rows={3}
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            placeholder="Paste a lab report, discharge summary or prescription here."
            className={`${inputClass} resize-y font-mono text-[12px]`}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pastedText.trim().length < 10 || analyze.isPending}
            className="rounded bg-ai px-4 py-2 text-sm font-medium text-white transition hover:bg-ai/90 disabled:opacity-50"
          >
            {analyze.isPending ? "Extracting…" : "Extract facts"}
          </button>
          <span className="text-[12px] text-ink-faint">
            Attaches to {activeDocumentId ? "the document you just uploaded" : documents?.[0]?.fileName ?? "an uploaded file"}
          </span>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
          {error}
        </p>
      )}

      {extractionSource === "deterministic_parser" && (
        <p className="mt-3 rounded border border-[color:var(--line-strong)] bg-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
          The model was unavailable. A literal parser read the values it recognises and quoted the
          line each one came from — nothing was generated, and everything still needs your approval.
        </p>
      )}

      {/* ----------------------------------------------- verification queue */}
      <div className="mt-5">
        <h3 className="readout mb-2">Awaiting verification</h3>
        <AnimatePresence initial={false}>
          {pending.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {pending.map((record) => (
                <motion.li
                  key={record._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="rounded border p-3"
                  style={{ borderColor: "color-mix(in srgb, var(--ai) 30%, transparent)", background: "color-mix(in srgb, var(--ai) 4%, transparent)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] text-ink">
                        {record.data.description ?? humanizeEnum(record.type)}
                        {record.data.value !== undefined && (
                          <span className="ml-2 font-mono tabular-nums text-ink-muted">
                            {record.data.value}
                            {record.data.unit ? ` ${record.data.unit}` : ""}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        {humanizeEnum(record.type)} · {formatDate(record.eventDate)}
                        {record.data.confidence ? ` · confidence ${record.data.confidence}` : ""}
                      </p>
                    </div>
                    <ProvenanceChip grade="ai_unverified" />
                  </div>

                  {record.sourceReferences?.[0]?.span && (
                    <blockquote className="mt-2 border-l-2 pl-2.5 font-mono text-[11px] leading-relaxed text-ink-muted" style={{ borderColor: "var(--ai)" }}>
                      “{record.sourceReferences[0].span}”
                    </blockquote>
                  )}

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() => verify.mutate({ recordId: record._id, approve: true })}
                      disabled={verify.isPending}
                      className="rounded border border-state-green/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-state-green transition hover:bg-state-green/10 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => verify.mutate({ recordId: record._id, approve: false })}
                      disabled={verify.isPending}
                      className="rounded border border-[color:var(--line-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted transition hover:bg-ink/[0.04] disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nothing waiting"
              body="Extracted facts appear here for approval before they enter the verified history."
            />
          )}
        </AnimatePresence>
      </div>

      {/* --------------------------------------------------------- file list */}
      <div className="mt-5">
        <h3 className="readout mb-2">Uploaded files</h3>
        {documentsLoading ? (
          <Skeleton rows={2} />
        ) : documents && documents.length > 0 ? (
          <ul className="flex flex-col divide-y divide-[color:var(--line)]">
            {documents.map((document) => (
              <li key={document._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-ink">{document.fileName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {Math.max(1, Math.round(document.sizeBytes / 1024))} KB · {formatRelative(document.createdAt)}
                    {document.extractionMethod ? ` · ${EXTRACTION_LABEL[document.extractionMethod]}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveDocumentId(document._id);
                    analyze.mutate({ documentId: document._id });
                  }}
                  disabled={analyze.isPending}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-signal hover:underline disabled:text-ink-faint"
                >
                  {document.analyzedAt ? "Re-extract" : "Extract facts"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No documents yet" body="Upload a lab report or a discharge summary to start." />
        )}
      </div>
    </Panel>
  );
}
