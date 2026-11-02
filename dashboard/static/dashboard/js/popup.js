// The NbS popup, shared by the 2D map (Leaflet) and the 3D map (MapLibre),
// so both explain a score in exactly the same way.

import { escapeHtml, euro, formatScore, formatSize } from './format.js';
import { CRITERIA } from './ranking.js';

/** HTML for one ranked NbS (a row from rankNbs) out of `total` shown NbS. */
export function popupHtml(row, total) {
  const p = row.feature.properties;
  const lines = CRITERIA.map((c) => {
    const value = c.kind === 'benefit' ? `${p[c.key]} / 5` : euro.format(p[c.key]);
    const points = row.score === null ? '–' : row.parts[c.key].toFixed(1);
    return `<tr><td>${c.label}</td><td>${value}</td><td class="num">${points}</td></tr>`;
  }).join('');
  return `<div class="popup">
    <div class="popup-code">${escapeHtml(p.code ?? '')}</div>
    <strong>${escapeHtml(p.name)}</strong>
    <div class="muted">${escapeHtml(p.nbs_type_label)} · ${escapeHtml(p.municipality ?? 'no municipality')}
      · ${formatSize(p)}</div>
    <p>${escapeHtml(p.description)}</p>
    <table>
      <thead><tr><th>Criterion</th><th>Value</th><th class="num">Points</th></tr></thead>
      <tbody>${lines}</tbody>
      <tfoot><tr><td colspan="2">Score · rank ${row.rank} of ${total}</td>
        <td class="num">${formatScore(row.score)}</td></tr></tfoot>
    </table>
  </div>`;
}
