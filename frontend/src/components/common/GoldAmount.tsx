import { formatGoldParts } from "../../utils/format";

interface GoldAmountProps {
  value: number | null | undefined;
  className?: string;
}

function Coin({ type }: { type: "gold" | "silver" | "copper" }) {
  const style = {
    gold: "bg-yellow-400 border-yellow-500 shadow-sm",
    silver: "bg-zinc-300 border-zinc-400",
    copper: "bg-orange-400 border-orange-500",
  }[type];
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 flex-shrink-0 rounded-full border ${style}`}
    />
  );
}

/**
 * Displays a WoW copper value as gold/silver/copper with colored coin indicators.
 * Hides copper unless it's the only denomination. Hides silver if zero and gold is present.
 */
export function GoldAmount({ value, className }: GoldAmountProps) {
  const parts = formatGoldParts(value);
  if (!parts) return <span className={className ?? ""}>--</span>;
  const { sign, gold, silver, copper } = parts;
  const onlyCopper = gold === 0 && silver === 0;

  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className ?? ""}`}>
      {sign && <span>{sign}</span>}
      {gold > 0 && (
        <>
          <span>{gold.toLocaleString("en-US")}</span>
          <Coin type="gold" />
        </>
      )}
      {silver > 0 && (
        <>
          <span>{silver}</span>
          <Coin type="silver" />
        </>
      )}
      {onlyCopper && (
        <>
          <span>{copper}</span>
          <Coin type="copper" />
        </>
      )}
    </span>
  );
}
