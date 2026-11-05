"""Render each keyframe scene to a 1920x1080 PNG and a contact sheet for review."""
import os
import sys
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
keys = sys.argv[1:] or ['k1', 'k2', 'k3', 'k4', 'k5']
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    for k in keys:
        pg.goto('file://' + os.path.join(HERE, 'scene.html') + '#' + k)
        pg.reload()
        pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(HERE, k + '.png'))
        print(k, 'ok', errs[-1:] if errs else '')
    b.close()
ims = [Image.open(os.path.join(HERE, k + '.png')) for k in keys]
cols = 2
rows = (len(ims) + cols - 1) // cols
w, h = 640, 360
sheet = Image.new('RGB', (cols * w + (cols + 1) * 10, rows * h + (rows + 1) * 10), (30, 30, 34))
for i, im in enumerate(ims):
    sheet.paste(im.resize((w, h), Image.LANCZOS), (10 + (i % cols) * (w + 10), 10 + (i // cols) * (h + 10)))
sheet.save(os.path.join(HERE, 'sheet.png'))
print('sheet', sheet.size)
