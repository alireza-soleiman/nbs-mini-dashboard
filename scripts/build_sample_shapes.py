"""Give every sample NbS a real place: its shape is taken from OpenStreetMap.

    docker compose exec web python scripts/build_sample_shapes.py
    docker compose exec web python manage.py load_sample_nbs

The NbS are still FICTIONAL (names, costs, benefits are invented). Their shapes are real
OpenStreetMap features: the roof of a real building, one wall of it, a stretch of a real
street or river, a real car park, park or meadow. Each NbS gets an `osm` property such as
"way/646089952"; open https://www.openstreetmap.org/way/646089952 to see the source.

What the script does:
  1. reads data/sample/nbs_sample.geojson (names, types, descriptions, benefits)
  2. downloads the OSM elements named in SHAPES (once; cached in data/raw/osm/)
  3. builds each shape: a whole area, one wall, a stretch of a line, or one point
  4. cost = unit cost of the type x real size (m² or m), rounded to EUR 5,000
  5. writes the GeoJSON back, one feature per line

OSM data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
"""

import json
import math
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django  # noqa: E402  (Django must be set up before GEOS can be used)

django.setup()

from django.contrib.gis.geos import LineString, Point, Polygon  # noqa: E402

GEOJSON = ROOT / 'data' / 'sample' / 'nbs_sample.geojson'
CACHE = ROOT / 'data' / 'raw' / 'osm' / 'nbs_sources.json'
OSM_API = 'https://api.openstreetmap.org/api/0.6'
USER_AGENT = 'nbs-mini-dashboard/0.1 (learning project; github.com/alireza-soleiman/nbs-mini-dashboard)'
METRES = 25832  # calculate in metres (UTM 32N), store in degrees (4326)

# Euro per m² (areas) or per metre (lines). Rain gardens (points) keep their fixed price.
UNIT_COST = {
    'green_roof': 130,
    'permeable_paving': 95,
    'retention_pond': 120,
    'urban_park': 150,
    'wetland': 40,
    'street_trees': 250,
    'river_restoration': 1200,
    'green_facade': 5000,  # per metre of wall (about 10 m high x EUR 500/m²)
}


# --- Recipes: how each shape is made from OSM ---------------------------------------

def area(osm_id):
    """The whole area of a closed way (a roof, a car park, a park, a meadow)."""
    return {'kind': 'area', 'ids': [osm_id]}


def wall(osm_id):
    """The longest wall of a building outline (for green facades)."""
    return {'kind': 'wall', 'ids': [osm_id]}


def stretch(osm_ids, start, end):
    """The part of a street or river between two points (lon, lat). Several ways of the
    same street are joined first."""
    return {'kind': 'stretch', 'ids': osm_ids, 'start': start, 'end': end}


def middle(osm_ids, length):
    """A stretch of `length` metres from the middle of a street or path."""
    return {'kind': 'middle', 'ids': osm_ids, 'length': length}


def spot(osm_ids, near):
    """The point of a street or path closest to `near` (lon, lat): exactly on the way."""
    return {'kind': 'spot', 'ids': osm_ids, 'near': near}


SHAPES = {
    # Merano
    'MER-01': area('way/316906322'),                # building of the Pascoli primary school, Maia Bassa
    'MER-02': middle(['way/239777109'], 260),       # Passerpromenade (footway along the Passer)
    'MER-03': area('way/469956673'),                # asphalt public car park in Sinigo
    'MER-04': wall('way/200237344'),                # office building in the centre
    'MER-05': area('way/1120111473'),               # grass lot in Maia Alta
    'MER-06': spot(['way/22749449'], (11.1700, 46.6560)),  # St.-Florian-Straße, Maia Bassa
    'MER-07': area('way/176050442'),                # sports hall of the school complex, Merano west
    # Lana
    'LAN-01': spot(['way/42860970'], (11.148725, 46.617697)),  # crossroads Franz-Höfler-Str./Lorenzer Weg
    'LAN-02': area('way/165440213'),                # supermarket building in the centre
    'LAN-03': middle(['way/167123742'], 300),       # Andreas-Hofer-Straße (main road)
    'LAN-04': area('way/238557990'),                # meadow at the southern edge
    # Naturno
    'NAT-01': stretch(['way/1346718911'], (11.0030, 46.6457), (11.0180, 46.6487)),  # Adige
    'NAT-02': area('way/59046925'),                 # town hall
    'NAT-03': middle(['way/177376205'], 200),       # Rathausstraße
    # Marlengo
    'MAR-01': area('way/97170260'),                 # grass plot
    'MAR-02': wall('way/365282437'),                # primary school
    # Lagundo
    'LAG-01': middle(['way/426420409'], 260),       # Josef-Weingartner-Straße (main road)
    'LAG-02': area('way/305460401'),                # asphalt public car park in the centre
    'LAG-03': area('way/353126834'),                # grass plot, 75 m from a public fountain
    # Postal
    'POS-01': area('way/451188237'),                # meadow on the valley floor
    # Adige south of the village: further north the river is the border and belongs to Lana
    'POS-02': stretch(['way/158959635', 'way/159826976'], (11.1826, 46.6066), (11.1868, 46.5968)),
    # Scena
    'SCE-01': stretch(['way/331348963'], (11.1953, 46.6930), (11.1884, 46.6919)),  # Schnuggenbach
    'SCE-02': area('way/59072516'),                 # Vereinshaus (club house)
    # Tirolo
    'TIR-01': spot(['way/224894057'], (11.1544, 46.6890)),  # Falknerpromenade (footway)
    'TIR-02': area('way/292552017'),                # meadow in the village
    # Cermes, Avelengo, Parcines
    'CER-01': stretch(['way/441734560', 'way/79538614', 'way/1434410373', 'way/220921084'],
                      (11.1452, 46.6327), (11.1478, 46.6317)),  # Trojenweg, past the primary school
    'AVE-01': area('way/270647659'),                # meadow near the village
    'PAR-01': stretch(['way/36781481'], (11.0638, 46.6859), (11.0652, 46.6811)),  # Zielbach
    'PAR-02': middle(['way/26464203'], 200),        # Gaudententurmstraße in the centre
}


# --- OpenStreetMap ----------------------------------------------------------------------

def download(ids):
    """Each way with the positions of its nodes, from the OpenStreetMap API
    (one small request per way: /api/0.6/way/<id>/full)."""
    elements = []
    for osm_id in ids:
        kind, number = osm_id.split('/')
        if kind != 'way':
            raise SystemExit(f'Only ways are supported, not {osm_id}')
        request = urllib.request.Request(f'{OSM_API}/way/{number}/full.json',
                                         headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))['elements']
        nodes = {e['id']: e for e in data if e['type'] == 'node'}
        way = next(e for e in data if e['type'] == 'way')
        elements.append({'type': 'way', 'id': way['id'], 'tags': way.get('tags', {}),
                         'geometry': [{'lon': nodes[n]['lon'], 'lat': nodes[n]['lat']} for n in way['nodes']]})
    return {'elements': elements}


def load_elements(ids):
    if not CACHE.exists() or not set(ids) <= set(json.loads(CACHE.read_text())['ids']):
        print(f'Downloading {len(ids)} OSM elements …')
        data = download(ids)
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps({'ids': sorted(ids), 'osm': data}), encoding='utf-8')
    data = json.loads(CACHE.read_text())['osm']
    return {f"{e['type']}/{e['id']}": e for e in data['elements']}


def coords(element):
    return [(p['lon'], p['lat']) for p in element['geometry']]


# --- Geometry helpers (in metres) -----------------------------------------------------

def to_metres(geom):
    geom.srid = 4326
    geom.transform(METRES)
    return geom


def join(lines):
    """Join ways that touch end to end into one line (a street is often split into parts)."""
    chain = list(lines[0])
    rest = [list(line) for line in lines[1:]]
    while rest:
        for line in rest:
            if line[0] == chain[-1]:
                chain += line[1:]
            elif line[-1] == chain[-1]:
                chain += line[-2::-1]
            elif line[-1] == chain[0]:
                chain = line[:-1] + chain
            elif line[0] == chain[0]:
                chain = line[:0:-1] + chain
            else:
                continue
            rest.remove(line)
            break
        else:
            raise ValueError('these ways do not touch end to end')
    return chain


def cut(line, start, end):
    """The part of `line` (metres) between the points closest to `start` and `end`.
    project() = how far along the line a point is; interpolate() = the point at a distance."""
    return cut_between(line, line.project(start), line.project(end))


def cut_between(line, a, b):
    """The part of `line` between distance a and distance b from its start."""
    a, b = sorted((a, b))
    points, walked = [line.interpolate(a).coords], 0.0
    for p, q in zip(line.coords, line.coords[1:]):
        walked += math.dist(p, q)  # distance from the line's start to vertex q
        if a < walked < b:
            points.append(q)
    points.append(line.interpolate(b).coords)
    return LineString(points, srid=METRES)


def build(recipe, elements):
    parts = [elements[osm_id] for osm_id in recipe['ids']]
    if recipe['kind'] == 'area':
        return to_metres(Polygon(coords(parts[0])))
    if recipe['kind'] == 'wall':
        ring = to_metres(LineString(coords(parts[0]))).coords
        p, q = max(zip(ring, ring[1:]), key=lambda edge: math.dist(*edge))
        return LineString([p, q], srid=METRES)
    line = to_metres(LineString(join([coords(part) for part in parts])))
    if recipe['kind'] == 'stretch':
        return cut(line, to_metres(Point(recipe['start'])), to_metres(Point(recipe['end'])))
    if recipe['kind'] == 'middle':
        half = min(recipe['length'], line.length) / 2
        return cut_between(line, line.length / 2 - half, line.length / 2 + half)
    near = to_metres(Point(recipe['near']))
    return line.interpolate(line.project(near))  # 'spot'


def size(geom):
    return geom.area if geom.dims == 2 else geom.length  # dims: 0 point, 1 line, 2 area


def rounded(geom):
    """Back to degrees for GeoJSON, 6 decimals (about 0.1 m)."""
    geom.transform(4326)
    data = json.loads(geom.geojson)

    def r(c):
        return [round(c[0], 6), round(c[1], 6)] if isinstance(c[0], float) else [r(x) for x in c]

    data['coordinates'] = r(data['coordinates'])
    return data


# --- Main --------------------------------------------------------------------------------

def main():
    collection = json.loads(GEOJSON.read_text(encoding='utf-8'))
    codes = [f['properties']['code'] for f in collection['features']]
    missing = sorted(set(codes) - set(SHAPES))
    if missing:
        raise SystemExit(f'No recipe for: {", ".join(missing)}')
    elements = load_elements(sorted({i for recipe in SHAPES.values() for i in recipe['ids']}))

    for feature in collection['features']:
        p = feature['properties']
        recipe = SHAPES[p['code']]
        geom = build(recipe, elements)
        if p['nbs_type'] in UNIT_COST:
            p['cost_eur'] = max(5000, round(UNIT_COST[p['nbs_type']] * size(geom) / 5000) * 5000)
        p['osm'] = ' '.join(recipe['ids'])
        unit = {2: 'm²', 1: 'm'}.get(geom.dims, '')
        print(f"{p['code']:7} {geom.geom_type:10} {size(geom):8.0f} {unit:2} EUR {p['cost_eur']:>9,}  "
              f"{p['osm']}")
        feature['geometry'] = rounded(geom)

    collection['description'] = ('FICTIONAL sample NbS around Merano for a learning project; '
                                 'shapes from OpenStreetMap (© OpenStreetMap contributors, ODbL). '
                                 'See README.md.')
    head = {k: v for k, v in collection.items() if k != 'features'}
    lines = [json.dumps(f, ensure_ascii=False) for f in collection['features']]
    text = json.dumps(head, ensure_ascii=False, indent=0)[:-2] + ',\n"features": [\n' + ',\n'.join(lines) + '\n]\n}\n'
    GEOJSON.write_text(text, encoding='utf-8')
    print(f'Wrote {len(lines)} features to {GEOJSON.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
