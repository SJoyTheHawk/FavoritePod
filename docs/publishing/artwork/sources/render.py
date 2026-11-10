#!/usr/bin/env python3
"""Re-render FavoritePod's checked-in artwork sources on macOS."""

from pathlib import Path
import os
import subprocess
import tempfile

SOURCES = Path(__file__).resolve().parent
OUTPUT = SOURCES.parent
REPO = OUTPUT.parents[2]
CHROME = Path(os.environ.get(
    'CHROME_BIN', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
))


def run(args):
    result = subprocess.run([str(arg) for arg in args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)


def main():
    if not CHROME.is_file():
        raise SystemExit('Install Google Chrome or set CHROME_BIN to its executable.')
    (OUTPUT / 'alternates').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='favoritepod-artwork-') as temp:
        temp = Path(temp)
        for name, width, height, alternate in [
            ('small-promo-440x280', 440, 280, False),
            ('marquee-1400x560', 1400, 560, False),
            ('small-promo-440x280-en', 440, 280, True),
            ('marquee-1400x560-en', 1400, 560, True),
        ]:
            image = temp / f'{name}-2x.png'
            destination = (OUTPUT / 'alternates' if alternate else OUTPUT) / f'{name}.png'
            run([CHROME, '--headless', '--disable-gpu',
                 '--disable-background-networking', '--no-first-run',
                 '--no-default-browser-check', '--hide-scrollbars',
                 '--force-device-scale-factor=2',
                 f'--user-data-dir={temp / "chrome-profile"}',
                 f'--screenshot={image}', f'--window-size={width},{height}',
                 (SOURCES / f'{name}.svg').as_uri()])
            run(['sips', '-z', height, width, image, '--out', destination])
            print(f'Saved {destination.relative_to(REPO)} ({width} x {height})', flush=True)
        run(['swift', '-module-cache-path', temp / 'swift-cache',
             SOURCES / 'render-icon.swift',
             REPO / 'public/icons/favoritepod-icon.png',
             OUTPUT / 'extension-icon-128.png'])
        print('Saved docs/publishing/artwork/extension-icon-128.png (128 x 128)')


if __name__ == '__main__':
    main()
