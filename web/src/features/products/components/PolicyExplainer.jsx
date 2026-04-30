export default function PolicyExplainer({ label, evaluation }) {
  if (!evaluation) return null;
  const cls = evaluation.allow ? 'policy-allow' : 'policy-deny';
  const icon = evaluation.allow ? '✓' : '✗';
  return (
    <div className={`policy-box ${cls}`}>
      <span className="policy-icon">{icon}</span>
      <span>
        <span className="policy-label">{label}:</span>
        {evaluation.reason}
      </span>
    </div>
  );
}
