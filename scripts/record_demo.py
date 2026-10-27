"""Record a ~40 s demo video of the dashboard (for LinkedIn) and 4 clean screenshots.

A real browser (headless Chromium, driven by Playwright) clicks through the dashboard
like a person, with captions and a visible mouse pointer, and records it as a video.

Needs tools that are NOT part of the project (install them in a temporary folder):
    python -m venv %TEMP%\\nbsvid\\venv
    %TEMP%\\nbsvid\\venv\\Scripts\\python -m pip install playwright imageio-ffmpeg
    set PLAYWRIGHT_BROWSERS_PATH=%TEMP%\\nbsvid\\browsers
    %TEMP%\\nbsvid\\venv\\Scripts\\python -m playwright install chromium --only-shell

Run it while the dashboard is running at http://localhost:8000:
    %TEMP%\\nbsvid\\venv\\Scripts\\python scripts\\record_demo.py

Output in linkedin/ (ignored by Git):
    nbs-dashboard-demo.mp4   1920 x 1080, H.264, no sound
    1-overview.png, 2-map.png, 3-popup.png, 4-phone.png
"""

import subprocess
import tempfile
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8000'
OUT = Path(__file__).resolve().parent.parent / 'linkedin'
VIEWPORT = {'width': 1280, 'height': 720}  # CSS pixels; x 1.5 = 1920 x 1080
SCALE = 1.5
CLICK_TARGET = 'AVE-01'  # an NbS polygon that stands alone on the map

# Added to every page of the recording: a caption box and a visible mouse pointer
# (a headless browser has no pointer of its own).
OVERLAY_JS = r"""
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    #demo-caption { position: fixed; left: 50%; bottom: 34px; z-index: 100000; max-width: 82%;
      padding: 12px 24px; border-radius: 14px; background: rgba(18, 28, 22, .88); color: #fff;
      font: 650 22px/1.3 system-ui, sans-serif; text-align: center; pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,.25); opacity: 0;
      transform: translate(-50%, 12px); transition: opacity .35s ease, transform .35s ease; }
    #demo-caption.on { opacity: 1; transform: translate(-50%, 0); }
    #demo-caption small { display: block; margin-top: 4px; font-size: 15px; font-weight: 500; opacity: .82; }
    #demo-cursor { position: fixed; left: 0; top: 0; z-index: 100001; pointer-events: none;
      transform: translate(-200px, -200px); }
    #demo-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
    .demo-ripple { position: fixed; z-index: 100000; width: 36px; height: 36px; margin: -18px 0 0 -18px;
      border-radius: 50%; border: 3px solid #2e6b3a; pointer-events: none;
      animation: demo-ripple .6s ease-out forwards; }
    @keyframes demo-ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.7); opacity: 0 } }`;
  document.head.append(style);
  const caption = Object.assign(document.createElement('div'), { id: 'demo-caption' });
  const cursor = Object.assign(document.createElement('div'), { id: 'demo-cursor' });
  cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" '
    + 'fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.append(caption, cursor);
  document.addEventListener('mousemove', (e) => {
    cursor.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`;
  }, true);
  document.addEventListener('mousedown', (e) => {
    const ring = Object.assign(document.createElement('div'), { className: 'demo-ripple' });
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    document.body.append(ring);
    setTimeout(() => ring.remove(), 700);
  }, true);
  window.demo = {
    caption(html) { caption.innerHTML = html; caption.classList.add('on'); },
    hide() { caption.classList.remove('on'); },
  };
});
"""

# Where an NbS marker is on the screen (page coordinates)
MARKER_POSITION_JS = """code => {
  const f = dashboard.state.features.find(x => x.properties.code === code);
  const [lon, lat] = f.properties.marker;
  const p = dashboard.map.latLngToContainerPoint([lat, lon]);
  const box = dashboard.map.getContainer().getBoundingClientRect();
  return { x: box.left + p.x, y: box.top + p.y, id: f.id };
}"""

# Fly back out so that all NbS are visible, and scroll the panel back to the sliders
SHOW_ALL_JS = """() => {
  dashboard.map.closePopup();
  const points = dashboard.state.features.map(f => [f.properties.marker[1], f.properties.marker[0]]);
  dashboard.map.flyToBounds(L.latLngBounds(points), { padding: [50, 50], duration: 1.2 });
  document.getElementById('sidebar').scrollTo({ top: 0, behavior: 'smooth' });
}"""


class Demo:
    """Small helpers to move the pointer smoothly, click and show captions."""

    def __init__(self, page):
        self.page = page
        self.x, self.y = 640, 420

    def wait(self, seconds):
        self.page.wait_for_timeout(int(seconds * 1000))

    def caption(self, text, small=None):
        html = text + (f'<small>{small}</small>' if small else '')
        self.page.evaluate('html => window.demo.caption(html)', html)

    def hide_caption(self):
        self.page.evaluate('() => window.demo.hide()')

    def show_pointer(self):
        self.page.mouse.move(self.x, self.y)

    def move_to(self, x, y, seconds=0.8):
        steps = max(int(seconds * 50), 1)
        x0, y0 = self.x, self.y
        for i in range(1, steps + 1):
            t = i / steps
            ease = t * t * (3 - 2 * t)  # slow start, slow end
            self.page.mouse.move(x0 + (x - x0) * ease, y0 + (y - y0) * ease)
            self.page.wait_for_timeout(20)
        self.x, self.y = x, y

    def click_at(self, x, y):
        self.move_to(x, y)
        self.wait(0.15)
        self.page.mouse.down()
        self.wait(0.08)
        self.page.mouse.up()

    def click(self, selector):
        box = self.page.locator(selector).first.bounding_box()
        self.click_at(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)

    def scroll(self, pixels, seconds=1.5):
        """Scroll with the mouse wheel in small steps, like a person."""
        steps = max(int(seconds * 25), 1)
        for _ in range(steps):
            self.page.mouse.wheel(0, pixels / steps)
            self.page.wait_for_timeout(40)

    def drag_slider(self, selector, to_value, seconds=1.6):
        info = self.page.locator(selector).evaluate(
            'el => ({ ...el.getBoundingClientRect().toJSON(), value: Number(el.value) })')
        thumb = 9  # half the slider thumb width (CSS px)

        def x_for(value):
            return info['x'] + thumb + value / 10 * (info['width'] - 2 * thumb)

        y = info['y'] + info['height'] / 2
        self.move_to(x_for(info['value']), y)
        self.page.mouse.down()
        self.move_to(x_for(to_value), y, seconds)
        self.page.mouse.up()


def record_video(browser, raw_dir):
    # The recording has the page's own size (1280 x 720); to_mp4() scales it to 1920 x 1080.
    # (A bigger record_video_size would only add grey borders, not more detail.)
    context = browser.new_context(
        viewport=VIEWPORT, device_scale_factor=SCALE, color_scheme='light',
        record_video_dir=str(raw_dir), record_video_size=VIEWPORT,
    )
    context.add_init_script(OVERLAY_JS)
    page = context.new_page()
    started = time.monotonic()
    page.goto(f'{BASE}/')
    page.wait_for_selector('.scatter .dot')
    page.wait_for_timeout(500)
    trim = time.monotonic() - started  # the blank page at the start is cut off later
    d = Demo(page)
    d.show_pointer()

    # 1. Overview page
    d.caption('NbS mini-dashboard', '29 Nature-Based Solutions around Merano · fictional sample data')
    d.wait(3)
    d.caption('Key figures and charts, computed in a PostGIS database')
    d.move_to(900, 420)
    d.scroll(640, 1.6)
    d.wait(2.2)
    d.scroll(-640, 1.2)
    d.wait(0.6)

    # 2. To the map
    d.caption('Interactive map: points, lines and polygons')
    d.click('a.button-primary')
    page.wait_for_selector('.nbs-card')
    d.show_pointer()
    d.caption('Interactive map: points, lines and polygons')
    d.wait(1.8)
    # Fold the filters, so the priorities and the ranking fit on the screen together
    d.click('details.panel summary')
    d.wait(0.8)

    # 3. Priorities
    d.caption('Rank the NbS by your own priorities', 'Presets or sliders: heat, flood, biodiversity, wellbeing, cost')
    d.click('.preset[data-key="flood"]')
    d.wait(2.3)
    d.click('.preset[data-key="budget"]')
    d.wait(2.3)

    # 4. Click one NbS
    d.caption('Click an NbS: the map flies to its shape')
    target = page.evaluate(MARKER_POSITION_JS, CLICK_TARGET)
    d.click_at(target['x'], target['y'])
    d.wait(2.0)
    d.caption('Every score is explained, criterion by criterion')
    d.wait(3.2)

    # 5. Change a weight
    page.evaluate(SHOW_ALL_JS)
    d.caption('Change a weight: map and ranking update instantly')
    d.wait(1.6)
    page.locator('input[data-key="benefit_biodiversity"]').scroll_into_view_if_needed()
    d.drag_slider('input[data-key="benefit_biodiversity"]', 10)
    d.wait(2.4)

    # 6. End card
    d.caption('PostGIS · GeoDjango · REST API · Leaflet · Docker',
              'github.com/alireza-soleiman/nbs-mini-dashboard')
    d.wait(3.8)
    d.hide_caption()
    d.wait(0.5)

    raw_video = Path(page.video.path())
    context.close()  # finishes writing the video file
    return raw_video, trim


def take_screenshots(browser):
    """Four clean pictures (no captions, no pointer) for an image post or the README."""
    context = browser.new_context(viewport=VIEWPORT, device_scale_factor=SCALE, color_scheme='light')
    page = context.new_page()
    page.goto(f'{BASE}/')
    page.wait_for_selector('.scatter .dot')
    page.wait_for_timeout(600)
    page.screenshot(path=OUT / '1-overview.png')

    page.goto(f'{BASE}/map/')
    page.wait_for_selector('.nbs-card')
    page.wait_for_timeout(2000)
    page.click('.preset[data-key="flood"]')
    page.wait_for_timeout(1200)
    page.screenshot(path=OUT / '2-map.png')

    target = page.evaluate(MARKER_POSITION_JS, CLICK_TARGET)
    page.mouse.click(target['x'], target['y'])
    page.wait_for_timeout(2500)
    page.screenshot(path=OUT / '3-popup.png')
    context.close()

    phone = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3,
                                is_mobile=True, has_touch=True, color_scheme='light')
    page = phone.new_page()
    page.goto(f'{BASE}/map/')
    page.wait_for_selector('.nbs-card')
    page.wait_for_timeout(1500)
    # Zoom 12 on the Merano area: bigger markers, and the wider region stays out of the picture
    page.evaluate('() => dashboard.map.setView([46.655, 11.16], 12, { animate: false })')
    page.wait_for_timeout(2000)
    page.screenshot(path=OUT / '4-phone.png')  # map with the NbS, sheet closed at the bottom
    phone.close()


def to_mp4(raw_video, trim, mp4):
    """WebM from Playwright -> MP4 (H.264, 1920 x 1080), the format LinkedIn handles best."""
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([
        ffmpeg, '-y', '-loglevel', 'error', '-ss', f'{trim:.2f}', '-i', str(raw_video),
        '-vf', 'fps=30,scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(mp4),
    ], check=True)


def main():
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as raw_dir, sync_playwright() as p:
        browser = p.chromium.launch()
        raw_video, trim = record_video(browser, raw_dir)
        mp4 = OUT / 'nbs-dashboard-demo.mp4'
        to_mp4(raw_video, trim, mp4)
        take_screenshots(browser)
        browser.close()
    frames, seconds = imageio_ffmpeg.count_frames_and_secs(str(mp4))
    print(f'{mp4.name}: {seconds:.1f} s, {frames} frames, {mp4.stat().st_size / 1e6:.1f} MB')
    for png in sorted(OUT.glob('*.png')):
        print(f'{png.name}: {png.stat().st_size / 1e3:.0f} KB')


if __name__ == '__main__':
    main()
