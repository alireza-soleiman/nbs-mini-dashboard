"""How static files (CSS, JavaScript) are stored on the server."""

from whitenoise.storage import CompressedManifestStaticFilesStorage


class StaticStorage(CompressedManifestStaticFilesStorage):
    """`collectstatic` writes each file twice: map.js and map.3f9a1c.js (+ .gz copies).

    Templates use {% static %} and get the hashed name. The hash is made from the
    file's content, so a changed file gets a new name: browsers may keep a file for a
    year (WhiteNoise tells them so) and still never use an old copy. This is the
    lasting fix for the "stale cache" problem of the team demo.
    """

    # Our JavaScript files are ES modules: map.js contains `import … from './api.js'`.
    # With this switch (Django 4.2+) collectstatic also rewrites those imports to the
    # hashed names; otherwise a changed api.js could still be cached under its old name.
    support_js_module_import_aggregation = True
