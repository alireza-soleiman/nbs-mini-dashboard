// Formatting helpers shared by the overview page and the map page.

export const euro = new Intl.NumberFormat('en', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

// €8.6M, €175K: for tiles and chart labels
export const euroShort = new Intl.NumberFormat('en', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
});

export const number = new Intl.NumberFormat('en');

export function formatArea(m2) {
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(1)} ha` : `${number.format(m2)} m²`;
}

export function formatLength(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${number.format(m)} m`;
}

/** Size of one NbS from its API properties: area, length or "single site". */
export function formatSize(props) {
  if (props.area_m2) return formatArea(props.area_m2);
  if (props.length_m) return formatLength(props.length_m);
  return 'single site';
}

export function formatScore(score) {
  return score === null ? '–' : Math.round(score);
}

/** Text from the database must never be read as HTML (someone could type <script> in the admin). */
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
