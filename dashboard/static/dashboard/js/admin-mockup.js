// Team demo: the Admin page ("Mockup – nothing is saved"). An idea for a simple admin
// area in three steps: Data, Criteria, Display. The buttons switch screens and change
// what is on the page, but nothing is sent to the server. The table shows the real
// sample NbS from /api/nbs/; everything else on this page is example content.

import { getJSON } from './api.js';
import { escapeHtml, euro } from './format.js';
import { setupPlaceMap, showPlace } from './place-map.js';
import { resetPlaceSources, setupPlaceSources } from './place-sources.js';
import { CRITERIA } from './ranking.js';

const API = document.body.dataset;
const $ = (id) => document.getElementById(id);

// The file check shows what an upload could answer (invented rows)
const CHECK_ROWS = [
  ['Green roof on a fire station – Lana', 'Green roof', 140000, null],
  ['Street trees along the cycle path – Marlengo', 'Street trees', 45000, null],
  ['Rain garden in a school yard – Scena', 'Rain garden', 35000, null],
  ['Pond in the sports area – Tirolo', 'Retention pond', 210000, null],
  ['Green facade on a car park – Merano', 'Green facade', null, 'The cost is missing.'],
  ['Permeable paving on the market square – Naturno', 'Permeable paving', 95000, null],
  ['Wetland at the river bend – Postal', 'Wetland', 380000, null],
  ['Roof garden on a library – Merano', 'Green rooof', 120000, 'The type “Green rooof” is not known. Did you mean “Green roof”?'],
  ['Pocket park at the station – Lagundo', 'Urban park', 160000, null],
  ['Stream restoration in the gorge – Parcines', 'River restoration', 540000, null],
];

// Step 2: the five criteria of the dashboard, plus two that could be added
const CRITERIA_ROWS = [
  ...CRITERIA.map((c) => ({
    name: c.kind === 'cost' ? 'Cost' : c.label, unit: c.kind === 'cost' ? '€' : 'score 0–5',
    more: c.kind !== 'cost', weight: 5, on: true,
  })),
  { name: 'CO₂ storage', unit: 't CO₂ per year', more: true, weight: 5, on: false },
  { name: 'Maintenance effort', unit: 'hours per year', more: false, weight: 5, on: false },
];

// Step 3: the sections of the Overview page (on) and the other chart ideas (off)
const SECTIONS = [
  { name: 'Key figures', form: 'Number tiles', icon: 'tiles', on: true },
  { name: 'NbS per type', form: 'Sorted bars', icon: 'bars', on: true },
  { name: 'Estimated cost', form: 'Bars per municipality', icon: 'bars', on: true },
  { name: 'Benefit profile per type', form: 'Coloured table', icon: 'table', on: true },
  { name: 'Cost and benefit', form: 'Dot chart', icon: 'scatter', on: true },
  { name: 'Top 5', form: 'Ranked list', icon: 'list', on: true },
  { name: 'NbS per type', form: 'Donut chart', icon: 'donut', on: false },
  { name: 'Estimated cost', form: 'Budget share per type (donut)', icon: 'donut', on: false },
  { name: 'Benefit profile per type', form: 'Table with dots', icon: 'dots', on: false },
  { name: 'Benefit profile per type', form: 'Radar charts', icon: 'radar', on: false },
  { name: 'Cost and benefit', form: '“Benefit per euro” bars', icon: 'bars', on: false },
  { name: 'Cost and benefit', form: 'Four fields', icon: 'quad', on: false },
  { name: 'Top 5', form: 'List with the score split by criterion', icon: 'split', on: false },
];

async function init() {
  setupSteps();
  setupButtons();
  drawCheckRows();
  drawCriteria();
  drawDisplay();
  try {
    const [nbs, types, municipalities] = await Promise.all([
      getJSON(API.nbsUrl), getJSON(API.typesUrl), getJSON(API.municipalitiesUrl),
    ]);
    drawTable(nbs.features);
    setupPlaceMap(municipalities); // the map in the form (place-map.js)
    setupPlaceSources();           // search, coordinates, file (place-sources.js)
    buildForm(types);
    $('status').hidden = true;
  } catch (error) {
    console.error(error);
    $('status').textContent = `Could not load the data: ${error.message}`;
    $('status').classList.add('error');
  }
}

// --- Moving between steps and screens -------------------------------------------------

function setupSteps() {
  $('steps').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-step]');
    if (!button) return;
    for (const other of $('steps').children) {
      other.toggleAttribute('aria-current', other === button);
      if (other === button) other.setAttribute('aria-current', 'step');
    }
    for (const step of document.querySelectorAll('.step')) step.hidden = step.id !== `step-${button.dataset.step}`;
    showView('table'); // step 1 always starts with its table
  });
}

/** Step 1 has four screens: table, form, upload, check. Show one of them. */
function showView(name) {
  for (const view of document.querySelectorAll('#step-data [data-view]')) view.hidden = view.dataset.view !== name;
}

function setupButtons() {
  // A mockup form is never sent (Enter in a text field would reload the page)
  $('nbs-form').addEventListener('submit', (event) => event.preventDefault());
  // data-go="screen" switches the screen; data-toast="text" says what WOULD happen
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-go], [data-toast]');
    if (!button) return;
    if (button.dataset.go) {
      showView(button.dataset.go);
      // After showView: the map in the form needs a visible box
      if (button.dataset.go === 'form') fillForm(button.dataset.id ? nbsById.get(Number(button.dataset.id)) : null);
      window.scrollTo({ top: 0 });
    }
    if (button.dataset.toast) toast(button.dataset.toast);
  });
}

let toastTimer = null;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

// --- Step 1: Data ---------------------------------------------------------------------

const nbsById = new Map(); // NbS id -> GeoJSON feature (for "Edit")

function drawTable(features) {
  const sorted = [...features].sort((a, b) => (a.properties.code ?? '').localeCompare(b.properties.code ?? ''));
  // Example statuses: the last two are still drafts
  const drafts = new Set(sorted.slice(-2).map((f) => f.id));
  $('nbs-rows').innerHTML = sorted.map((f) => {
    const p = f.properties;
    nbsById.set(f.id, f);
    const draft = drafts.has(f.id);
    return `<tr><td class="code">${escapeHtml(p.code ?? '')}</td><td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.nbs_type_label)}</td><td>${escapeHtml(p.municipality ?? '–')}</td>
      <td class="num">${euro.format(p.cost_eur)}</td>
      <td><span class="pill ${draft ? 'is-draft' : 'is-published'}">${draft ? 'Draft' : 'Published'}</span></td>
      <td><button type="button" class="demo-button is-small" data-go="form" data-id="${f.id}">Edit</button></td></tr>`;
  }).join('');
  $('table-count').textContent = `${sorted.length} NbS · ${sorted.length - drafts.size} published · ${drafts.size} drafts`;
}

function buildForm(types) {
  $('form-type').innerHTML = types.map((t) => `<option value="${t.value}">${escapeHtml(t.label)}</option>`).join('');
  $('form-benefits').insertAdjacentHTML('beforeend', CRITERIA.filter((c) => c.kind === 'benefit').map((c) => `
    <label>${c.label}
      <select class="demo-input" name="${c.key}">${[0, 1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select>
    </label>`).join(''));
}

/** Empty form and empty map for "Add"; the values and the shape of the NbS for "Edit". */
function fillForm(feature) {
  const form = $('nbs-form');
  const properties = feature?.properties;
  form.reset();
  $('form-title').textContent = properties ? `Edit ${properties.code ?? 'NbS'}` : 'Add an NbS';
  resetPlaceSources();
  showPlace(feature);
  if (!properties) return;
  for (const field of form.elements) {
    if (field.name && properties[field.name] !== undefined) field.value = properties[field.name];
  }
}

function drawCheckRows() {
  $('check-rows').innerHTML = CHECK_ROWS.map(([name, type, cost, problem], i) => `
    <tr class="${problem ? 'has-problem' : ''}"><td>${i + 2}</td><td>${name}</td><td>${type}</td>
      <td class="num">${cost === null ? '–' : euro.format(cost)}</td>
      <td>${problem ? `<span class="check-mark is-problem">!</span> ${problem}` : '<span class="check-mark is-ok">✓</span> OK'}</td></tr>`).join('');
}

// --- Step 2: Criteria -----------------------------------------------------------------

function drawCriteria() {
  $('criteria-rows').innerHTML = CRITERIA_ROWS.map(criterionRow).join('');
  // Switching a criterion off greys its row out (only on this page)
  $('criteria-rows').addEventListener('input', (event) => {
    const row = event.target.closest('tr');
    if (event.target.type === 'checkbox') row.classList.toggle('is-off', !event.target.checked);
    if (event.target.type === 'range') row.querySelector('output').textContent = event.target.value;
  });
  $('add-criterion').addEventListener('click', () => {
    $('criteria-rows').insertAdjacentHTML('beforeend',
      criterionRow({ name: '', unit: '', more: true, weight: 5, on: true }));
    $('criteria-rows').lastElementChild.querySelector('input[type="text"]').focus();
    toast('Mockup: a new criterion would also need its values for every NbS.');
  });
}

function criterionRow(c) {
  return `<tr class="${c.on ? '' : 'is-off'}">
    <td><label class="switch"><input type="checkbox" ${c.on ? 'checked' : ''}><span></span>
      <span class="visually-hidden">Show ${c.name || 'this criterion'}</span></label></td>
    <td><input class="demo-input" type="text" value="${c.name}" placeholder="Name of the criterion" aria-label="Name"></td>
    <td><input class="demo-input" type="text" value="${c.unit}" placeholder="Unit" aria-label="Unit"></td>
    <td><select class="demo-input" aria-label="Direction">
      <option ${c.more ? 'selected' : ''}>More is better</option>
      <option ${c.more ? '' : 'selected'}>Less is better</option></select></td>
    <td><span class="weight-input"><input type="range" min="0" max="10" value="${c.weight}" aria-label="Default weight">
      <output>${c.weight}</output></span></td></tr>`;
}

// --- Step 3: Display ------------------------------------------------------------------

function drawDisplay() {
  $('display-list').replaceChildren(...SECTIONS.map((section, i) => {
    const item = document.createElement('li');
    item.className = section.on ? '' : 'is-off';
    item.innerHTML = `<label class="switch"><input type="checkbox" ${section.on ? 'checked' : ''}><span></span>
        <span class="visually-hidden">Show ${section.name}: ${section.form}</span></label>
      <span class="display-name"><strong>${section.name}</strong><small>${section.form}</small></span>
      <button type="button" class="demo-button is-small" data-move="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button type="button" class="demo-button is-small" data-move="1" aria-label="Move down" ${i === SECTIONS.length - 1 ? 'disabled' : ''}>▼</button>`;
    item.querySelector('input').addEventListener('change', (event) => {
      section.on = event.target.checked;
      drawDisplay();
    });
    for (const button of item.querySelectorAll('[data-move]')) {
      button.addEventListener('click', () => {
        const to = i + Number(button.dataset.move);
        [SECTIONS[i], SECTIONS[to]] = [SECTIONS[to], SECTIONS[i]];
        drawDisplay();
      });
    }
    return item;
  }));
  // The preview: one small tile per switched-on section, in the chosen order
  $('display-preview').innerHTML = SECTIONS.filter((s) => s.on).map((s) => `
    <div class="preview-tile">${icon(s.icon)}<span><strong>${s.name}</strong><small>${s.form}</small></span></div>`).join('')
    || '<p class="empty">No section is switched on.</p>';
}

/** A tiny picture of a chart form, for the preview. */
function icon(kind) {
  const shapes = {
    tiles: '<rect x="2" y="9" width="8" height="10" rx="1.5"/><rect x="12" y="9" width="8" height="10" rx="1.5"/><rect x="22" y="9" width="8" height="10" rx="1.5"/>',
    bars: '<rect x="2" y="5" width="26" height="4" rx="1"/><rect x="2" y="12" width="18" height="4" rx="1"/><rect x="2" y="19" width="10" height="4" rx="1"/>',
    table: '<rect x="2" y="4" width="8" height="6"/><rect x="12" y="4" width="8" height="6" opacity=".6"/><rect x="22" y="4" width="8" height="6" opacity=".3"/><rect x="2" y="12" width="8" height="6" opacity=".4"/><rect x="12" y="12" width="8" height="6"/><rect x="22" y="12" width="8" height="6" opacity=".7"/><rect x="2" y="20" width="8" height="6" opacity=".8"/><rect x="12" y="20" width="8" height="6" opacity=".3"/><rect x="22" y="20" width="8" height="6" opacity=".5"/>',
    scatter: '<circle cx="6" cy="20" r="2.5"/><circle cx="12" cy="10" r="2.5"/><circle cx="19" cy="15" r="2.5"/><circle cx="26" cy="7" r="2.5"/>',
    list: '<rect x="2" y="5" width="4" height="4" rx="1"/><rect x="9" y="6" width="20" height="2"/><rect x="2" y="12" width="4" height="4" rx="1"/><rect x="9" y="13" width="16" height="2"/><rect x="2" y="19" width="4" height="4" rx="1"/><rect x="9" y="20" width="12" height="2"/>',
    donut: '<circle cx="16" cy="14" r="8" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="30 21"/><circle cx="16" cy="14" r="8" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="21 30" stroke-dashoffset="-30" opacity=".45"/>',
    dots: '<circle cx="5" cy="8" r="2"/><circle cx="11" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="23" cy="8" r="2" opacity=".3"/><circle cx="5" cy="15" r="2"/><circle cx="11" cy="15" r="2"/><circle cx="17" cy="15" r="2" opacity=".3"/><circle cx="23" cy="15" r="2" opacity=".3"/><circle cx="5" cy="22" r="2"/><circle cx="11" cy="22" r="2"/><circle cx="17" cy="22" r="2"/><circle cx="23" cy="22" r="2"/>',
    radar: '<polygon points="16,3 28,12 23,25 9,25 4,12" fill="none" stroke="currentColor" stroke-width="1" opacity=".45"/><polygon points="16,7 24,13 19,21 11,22 9,13" opacity=".8"/>',
    quad: '<rect x="3" y="3" width="12" height="10" rx="1.5"/><rect x="17" y="3" width="12" height="10" rx="1.5" opacity=".4"/><rect x="3" y="15" width="12" height="10" rx="1.5" opacity=".4"/><rect x="17" y="15" width="12" height="10" rx="1.5" opacity=".25"/>',
    split: '<rect x="2" y="6" width="9" height="4"/><rect x="11" y="6" width="7" height="4" opacity=".6"/><rect x="18" y="6" width="6" height="4" opacity=".35"/><rect x="2" y="16" width="7" height="4"/><rect x="9" y="16" width="5" height="4" opacity=".6"/><rect x="14" y="16" width="6" height="4" opacity=".35"/>',
  };
  return `<svg class="preview-icon" viewBox="0 0 32 28" aria-hidden="true">${shapes[kind]}</svg>`;
}

init();
