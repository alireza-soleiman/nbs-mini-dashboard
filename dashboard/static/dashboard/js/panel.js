// The side panel of both map pages (2D Leaflet and 3D MapLibre): summary line, score
// legend and ranking list. Only HTML here; each map decides what a click or hover does.

import { SCORE_CLASSES, scoreClass } from './colors.js';
import { escapeHtml, euro, euroShort, formatScore, formatSize } from './format.js';

/** "29 NbS · €9.1M total cost · 11 municipalities" for the ranked rows. */
export function summaryHtml(rows) {
  const cost = rows.reduce((sum, r) => sum + r.feature.properties.cost_eur, 0);
  const places = new Set(rows.map((r) => r.feature.properties.municipality).filter(Boolean));
  return `
    <span><strong>${rows.length}</strong> NbS</span>
    <span><strong>${euroShort.format(cost)}</strong> total cost</span>
    <span><strong>${places.size}</strong> ${places.size === 1 ? 'municipality' : 'municipalities'}</span>`;
}

export function legendHtml() {
  const items = [...SCORE_CLASSES].reverse().map((c) =>
    `<span class="legend-item"><span class="swatch" style="background:${c.color}"></span>${c.from}–${c.to}</span>`);
  return `<span class="legend-title">Score</span>${items.join('')}`;
}

/**
 * The ranking list: one card per NbS, best first.
 * onSelect(id): a card was clicked · onHover(id, on): the pointer entered/left a card
 */
export function renderRanking(list, rows, { selectedId, onSelect, onHover }) {
  if (!rows.length) {
    list.innerHTML = '<li class="empty">No NbS match the filters.</li>';
    return;
  }
  list.replaceChildren(...rows.map((row) => {
    const id = row.feature.id;
    const p = row.feature.properties;
    const { color, ink } = scoreClass(row.score);
    const item = document.createElement('li');
    item.innerHTML = `<button type="button" class="nbs-card" data-id="${id}">
        <span class="rank-badge" style="background:${color};color:${ink}">${row.rank}</span>
        <span class="card-main">
          <span class="card-name">${escapeHtml(p.name)}</span>
          <span class="card-meta">${escapeHtml(p.nbs_type_label)} · ${escapeHtml(p.municipality ?? '–')}</span>
          <span class="card-meta">${euro.format(p.cost_eur)} · ${formatSize(p)}</span>
        </span>
        <span class="card-score">${formatScore(row.score)}
          <span class="bar"><span style="width:${row.score ?? 0}%;background:${color}"></span></span>
        </span>
      </button>`;
    const card = item.firstElementChild;
    card.classList.toggle('is-selected', id === selectedId);
    card.addEventListener('click', () => onSelect(id));
    card.addEventListener('mouseenter', () => onHover(id, true));
    card.addEventListener('mouseleave', () => onHover(id, false));
    return item;
  }));
}

/** Highlight the card of the selected NbS (null = none) and scroll it into view. */
export function markSelectedCard(list, id) {
  for (const card of list.querySelectorAll('.nbs-card')) {
    const on = Number(card.dataset.id) === id;
    card.classList.toggle('is-selected', on);
    if (on) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
