"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { EmptyState, Skeleton } from "@/components/ui/console";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { api } from "@/lib/api-client";

interface DrugReference {
  query: string;
  found: boolean;
  rxcui?: string;
  genericName?: string;
  brandNames: string[];
  sections: Array<{ heading: string; text: string }>;
  sources: Array<{ name: string; url: string }>;
  plainSummary?: string;
  exactMatch: boolean;
  fetchedAt: string;
  cached: boolean;
  notice: string;
}

/**
 * Medicine reference, fetched live from public medicines databases.
 *
 * Everything shown here came from a named source that is linked at the bottom.
 * The plain-language summary is a condensation of that fetched text and nothing
 * else — the model is not asked what it knows about the drug.
 */
export function DrugReferenceModal({
  name,
  open,
  onClose,
}: {
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["drug-reference", name.toLowerCase()],
    queryFn: () => api.get<DrugReference>(`/drug-reference?name=${encodeURIComponent(name)}`),
    enabled: open && name.trim().length > 1,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Reference · ${name}`}
      description="Retrieved from public medicines databases. Check it against your own formulary before prescribing."
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[color:var(--line)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
        >
          Close
        </button>
      }
    >
      {isLoading && <Skeleton rows={5} />}

      {isError && (
        <EmptyState
          title="The lookup did not complete"
          body="The medicines database could not be reached. Try again, or use your own formulary."
        />
      )}

      {data && !data.found && (
        <EmptyState
          title="No label found for this name"
          body={data.notice}
        />
      )}

      {data && data.found && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceChip grade="verified" />
            <span className="readout">
              Retrieved {new Date(data.fetchedAt).toLocaleDateString()}
              {data.cached ? " · cached" : ""}
            </span>
          </div>

          {/* Reading a combination's label for one ingredient is a real error,
              so a near-miss is called out before anything else on the page. */}
          {!data.exactMatch && (
            <p
              role="alert"
              className="rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2 text-[13px] leading-relaxed text-state-amber"
            >
              {data.notice}
            </p>
          )}

          {(data.genericName || data.brandNames.length > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {data.genericName && (
                <span className="flex flex-col">
                  <span className="readout">Generic name</span>
                  <span className="text-[14px] text-ink">{data.genericName}</span>
                </span>
              )}
              {data.brandNames.length > 0 && (
                <span className="flex min-w-0 flex-col">
                  <span className="readout">Brand names</span>
                  <span className="text-[14px] text-ink">{data.brandNames.join(", ")}</span>
                </span>
              )}
              {data.rxcui && (
                <span className="flex flex-col">
                  <span className="readout">RxCUI</span>
                  <span className="font-mono text-[13px] tabular-nums text-ink">{data.rxcui}</span>
                </span>
              )}
            </div>
          )}

          {data.plainSummary && (
            <section
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--line)", background: "var(--sunken)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="readout">In short</span>
                <ProvenanceChip grade="ai_interpretation" />
              </div>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-muted">
                {data.plainSummary}
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                Condensed from the label text below. Nothing was added to it.
              </p>
            </section>
          )}

          <div className="flex flex-col gap-4">
            {data.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="readout">{section.heading}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{section.text}</p>
              </section>
            ))}
          </div>

          <footer className="border-t border-[color:var(--line)] pt-3">
            <span className="readout">Sources</span>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[12px] text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal"
                  >
                    {source.name}
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        </div>
      )}
    </Modal>
  );
}
