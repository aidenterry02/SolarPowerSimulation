import { useRef } from "react";
import { formatKwh, formatUsd } from "../lib/solarCalc";

interface Props {
  title: string;
  systemKw: number;
  annualKwh: number;
  savingsUsd: number;
  offsetPct: number;
  paybackYears: number | null;
  confidenceLabel: string;
}

export function ShareCard(props: Props) {
  const ref = useRef<HTMLDivElement>(null);

  async function copySummary() {
    const text = [
      `Hometown Solar Savings`,
      props.title,
      `System: ${props.systemKw.toFixed(1)} kW`,
      `Production: ${formatKwh(props.annualKwh)} kWh/yr`,
      `Offset: ${props.offsetPct.toFixed(0)}%`,
      `Year-1 savings: ${formatUsd(props.savingsUsd)}`,
      props.paybackYears != null
        ? `Simple payback: ~${props.paybackYears.toFixed(1)} years`
        : null,
      `Confidence: ${props.confidenceLabel}`,
      window.location.href,
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="share-card" ref={ref}>
      <div className="share-card-inner">
        <div className="share-kicker">Hometown Solar Savings</div>
        <div className="share-title">{props.title}</div>
        <div className="share-grid">
          <div>
            <div className="sk">System</div>
            <div className="sv">{props.systemKw.toFixed(1)} kW</div>
          </div>
          <div>
            <div className="sk">Offset</div>
            <div className="sv">{props.offsetPct.toFixed(0)}%</div>
          </div>
          <div>
            <div className="sk">Year-1 savings</div>
            <div className="sv money">{formatUsd(props.savingsUsd)}</div>
          </div>
          <div>
            <div className="sk">Payback</div>
            <div className="sv">
              {props.paybackYears != null
                ? `~${props.paybackYears.toFixed(1)} yr`
                : "—"}
            </div>
          </div>
        </div>
        <div className="share-foot">
          {formatKwh(props.annualKwh)} kWh/yr · {props.confidenceLabel}
        </div>
      </div>
      <div className="share-actions">
        <button type="button" className="btn-ghost" onClick={() => void copySummary()}>
          Copy summary
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void navigator.clipboard.writeText(window.location.href)}
        >
          Copy share link
        </button>
      </div>
    </div>
  );
}
