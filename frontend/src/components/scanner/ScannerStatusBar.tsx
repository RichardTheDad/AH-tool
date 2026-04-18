import { formatDateTime } from "../../utils/format";
import { Badge } from "../common/Badge";
import type { ScanReadiness, ScanRuntimeStatus, ScanSession } from "../../types/models";

interface ScannerStatusBarProps {
  readiness: ScanReadiness;
  readinessLoaded: boolean;
  scanStatus: ScanRuntimeStatus;
  latestScan: ScanSession | null;
  showingPersistedResults: boolean;
  nextScheduledScanLabel: string | null;
}

const FRESH_REALM_WARNING =
  "The scanner can run, but fewer than two enabled realms have fresh listings. Wait for the next Blizzard refresh cycle before trusting top results.";
const READINESS_FALLBACK_WARNING =
  "Readiness detail is temporarily unavailable, but the latest scheduled scan data is available.";

function visibleScannerWarning(value: string | null | undefined) {
  if (!value || value.includes("incomplete item details")) {
    return "";
  }
  return value
    .replace(FRESH_REALM_WARNING, "")
    .replace(READINESS_FALLBACK_WARNING, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function ScannerStatusBar({
  readiness,
  readinessLoaded,
  scanStatus,
  latestScan,
  showingPersistedResults,
  nextScheduledScanLabel,
}: ScannerStatusBarProps) {
  const scanRunning = scanStatus?.status === "running";
  const latestScanWarning = visibleScannerWarning(latestScan?.warning_text);
  const readinessWarning = visibleScannerWarning(readiness.message);
  const showReadinessCaution =
    readiness.status === "caution" &&
    readiness.message !== "Checking scanner readiness..." &&
    !latestScanWarning &&
    Boolean(readinessWarning);

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-md backdrop-blur-xl space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-base font-semibold text-zinc-100">Current opportunities</h2>
            {scanRunning && (
              <div className="flex items-center gap-1.5 bg-sky-500/20 text-sky-300 px-2.5 py-1 rounded-full text-xs font-medium border border-sky-400/35">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
                Scanning...
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {latestScan
              ? `From ${formatDateTime(latestScan.generated_at)}`
              : "No scan recorded yet"}
            {showingPersistedResults ? " (previous scan, latest returned no listings)" : ""}
          </p>
        </div>

        {readinessLoaded && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <Badge tone="neutral">{readiness.realms_with_data}/{readiness.enabled_realm_count} realms</Badge>
            {readiness.realms_with_fresh_data > 0 && (
              <Badge tone="success">{readiness.realms_with_fresh_data} fresh</Badge>
            )}
            <Badge tone="neutral">{readiness.unique_item_count} items</Badge>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
        {!scanRunning && scanStatus.finished_at && (
          <span>Last update: {formatDateTime(scanStatus.finished_at)}</span>
        )}
        {nextScheduledScanLabel && (
          <span>Next scan: {nextScheduledScanLabel}</span>
        )}
        {latestScanWarning && (
          <span className="text-amber-700 font-medium">Warning: {latestScanWarning}</span>
        )}
        {showReadinessCaution && (
          <span className="text-amber-700">Warning: {readinessWarning}</span>
        )}
      </div>
    </div>
  );
}
