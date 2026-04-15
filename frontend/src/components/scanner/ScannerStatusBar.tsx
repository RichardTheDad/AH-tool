import { formatDateTime } from "../../utils/format";
import { StatusIndicator } from "../common/StatusIndicator";
import type { ScanReadiness, ScanRuntimeStatus, ScanSession } from "../../types/models";

interface ScannerStatusBarProps {
  readiness: ScanReadiness;
  scanStatus: ScanRuntimeStatus;
  latestScan: ScanSession | null;
  showingPersistedResults: boolean;
  nextScheduledScanLabel: string | null;
}

export function ScannerStatusBar({
  readiness,
  scanStatus,
  latestScan,
  showingPersistedResults,
  nextScheduledScanLabel,
}: ScannerStatusBarProps) {
  const scanRunning = scanStatus?.status === "running";

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-md backdrop-blur-xl space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-base font-semibold text-zinc-100">Current opportunities</h2>
            {scanRunning && (
              <div className="flex items-center gap-1.5 bg-sky-500/20 text-sky-300 px-2.5 py-1 rounded-full text-xs font-medium border border-sky-400/35">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
                Scanning…
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {latestScan 
              ? `From ${formatDateTime(latestScan.generated_at)}`
              : "No scan recorded yet"
            }
            {showingPersistedResults ? " (previous scan, latest returned no listings)" : ""}
          </p>
        </div>

        {/* Status badges: compact and informative */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 text-xs font-medium text-zinc-200 whitespace-nowrap">
            {readiness.realms_with_data}/{readiness.enabled_realm_count} realms
          </div>
          {readiness.realms_with_fresh_data > 0 && (
            <StatusIndicator
              status="success"
              size="sm"
              variant="badge"
              label={`${readiness.realms_with_fresh_data} fresh`}
            />
          )}
          <div className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 text-xs font-medium text-zinc-200 whitespace-nowrap">
            {readiness.unique_item_count} items
          </div>
        </div>
      </div>

      {/* Second row: additional status info */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
        {!scanRunning && scanStatus.finished_at && (
          <span>Last update: {formatDateTime(scanStatus.finished_at)}</span>
        )}
        {nextScheduledScanLabel && (
          <span>Next scan: {nextScheduledScanLabel}</span>
        )}
        {latestScan?.warning_text && !latestScan.warning_text.includes("incomplete item details") && (
          <span className="text-amber-700 font-medium">⚠️ {latestScan.warning_text}</span>
        )}
        {readiness.status === "caution" && !latestScan?.warning_text && (
          <span className="text-amber-700">⚠️ {readiness.message}</span>
        )}
      </div>
    </div>
  );
}
