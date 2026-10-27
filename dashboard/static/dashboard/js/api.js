// Talking to the Django API.

/**
 * GET a URL and return its JSON.
 * params: {type: ['green_roof', 'rain_garden'], municipality: '021051'}
 *   -> ?type=green_roof&type=rain_garden&municipality=021051
 * Empty values ('' or null) are left out.
 */
export async function getJSON(url, params = {}) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    for (const item of [].concat(value)) {
      if (item !== '' && item != null) query.append(name, item);
    }
  }
  const fullUrl = query.toString() ? `${url}?${query}` : url;
  // Accept: application/json -> DRF answers with JSON, not the browsable HTML page
  const response = await fetch(fullUrl, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${fullUrl} answered HTTP ${response.status}`);
  }
  return response.json();
}
