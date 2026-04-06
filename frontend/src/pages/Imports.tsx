import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { importListings } from "../api/imports";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { formatDateTime, formatGold } from "../utils/format";

export function Imports() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: ({ file, commit }: { file: File; commit: boolean }) => importListings(file, commit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "latest"] });
      setPreviewError(null);
    },
    onError: (error: Error) => setPreviewError(error.message),
  });

  const response = importMutation.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card title="Listing imports" subtitle="Upload real CSV or JSON listing snapshots for scanner-ready local data.">
        <div className="space-y-4">
          <label className="block text-sm text-slate-700">
            Listing file
            <input
              type="file"
              accept=".csv,.json"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => selectedFile && importMutation.mutate({ file: selectedFile, commit: false })}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => selectedFile && importMutation.mutate({ file: selectedFile, commit: true })}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Commit import
            </button>
          </div>
          {previewError ? <ErrorState message={previewError} /> : null}
          {response?.summary ? <p className="text-sm text-slate-600">{response.summary}</p> : null}
          {response?.warning ? <p className="text-sm text-amber-700">{response.warning}</p> : null}
          {response?.untracked_realms?.length ? (
            <p className="text-sm text-slate-600">Imported realms not currently tracked: {response.untracked_realms.join(", ")}</p>
          ) : null}
          {response?.committed ? (
            <p className="text-sm text-emerald-700">
              Imported {response.inserted_count} listing rows{response.skipped_duplicates ? ` and skipped ${response.skipped_duplicates} duplicates` : ""}.
            </p>
          ) : null}
        </div>
      </Card>

      <Card title="Preview" subtitle="Validated rows land here before you commit them into the SQLite cache.">
        {response?.errors?.length ? (
          <div className="space-y-2">
            {response.errors.map((error) => (
              <div key={`${error.row_number}-${error.message}`} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Row {error.row_number}: {error.message}
              </div>
            ))}
          </div>
        ) : response?.preview_rows?.length ? (
          <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-card">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Realm</th>
                  <th className="px-4 py-3">Lowest</th>
                  <th className="px-4 py-3">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {response.preview_rows.map((row) => (
                  <tr key={row.row_number}>
                    <td className="px-4 py-3">{row.row_number}</td>
                    <td className="px-4 py-3">{row.item_id}</td>
                    <td className="px-4 py-3">{row.realm}</td>
                    <td className="px-4 py-3">{formatGold(row.lowest_price)}</td>
                    <td className="px-4 py-3">{formatDateTime(row.captured_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No preview yet" description="Choose a file, preview the parsed rows, then commit the import when the data looks clean." />
        )}
      </Card>
    </div>
  );
}
