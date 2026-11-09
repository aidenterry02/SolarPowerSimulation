import type { ConfidenceLevel } from "../lib/confidence";

export function ConfidenceBadge({
  level,
  label,
  detail,
  score,
}: {
  level: ConfidenceLevel;
  label: string;
  detail: string;
  score: number;
}) {
  return (
    <div className={`confidence conf-${level}`}>
      <div className="conf-top">
        <span className="conf-label">{label}</span>
        <span className="conf-score">{score}</span>
      </div>
      <div className="conf-bar">
        <div className="conf-fill" style={{ width: `${score}%` }} />
      </div>
      <p className="conf-detail">{detail}</p>
    </div>
  );
}
