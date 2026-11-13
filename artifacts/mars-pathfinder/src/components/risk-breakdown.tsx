import type { MarsRiskAssessment } from '@workspace/api-client-react';

export function RiskBreakdown({ risk }: { risk: MarsRiskAssessment }) {
  return <section className="mt-4 rounded-md border bg-card p-3 text-xs space-y-3" data-testid="cell-risk-breakdown">
    <h3 className="font-display text-lg">Experimental cell risk: {risk.riskScore.toFixed(2)} / 100</h3>
    <p>Inverse model score: {risk.modelSafetyScore.toFixed(2)} / 100 · DF: {risk.movementCost.toFixed(4)}</p>
    <p className="text-muted-foreground">Dimensionless model scores, not probabilities. Physical traversability: unknown.</p>
    <table className="w-full text-left"><thead><tr><th>Factor</th><th>Weight</th><th>Raw</th><th>Points</th></tr></thead>
      <tbody>{risk.factors.map(f => <tr key={f.id} className="border-t"><td className="py-2">{f.name}<p className="text-[10px] text-muted-foreground">{f.basis}</p></td><td>{f.weight}</td><td>{f.rawScore}</td><td>{f.contribution.toFixed(2)}</td></tr>)}</tbody>
    </table>
    <p className="font-mono">R = 45T + 35M + 20U</p>
    {!risk.geologyCovered && <p>Excluded from model routing: midpoint geology unavailable. Not a physical obstacle classification.</p>}
    <details><summary className="cursor-pointer">Evidence · {risk.evidence.length} source features</summary><ul className="mt-2 space-y-2 max-h-52 overflow-y-auto">{risk.evidence.map((e,i)=><li key={i}>{e.value}<div className="font-mono text-[10px]">{e.filename} · {e.layer} · feature {e.featureId}</div></li>)}</ul></details>
    <p>Still unknown: {risk.unknowns.join(', ')}.</p><p className="text-muted-foreground">{risk.warning}</p>
    <p className="font-mono text-[10px]">{risk.modelVersion}</p>
  </section>;
}
