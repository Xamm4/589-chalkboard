"""Asset pipeline: normalizes the Regulator faces and downsizes the mascot/coin.
Run from the repo root:  python3 tools/process_assets.py
Sources (full resolution, from the kit) live in assets/src/; outputs go to assets/img/."""
from PIL import Image
import os

SRC = 'assets/src'
OUT = 'assets/img'
FACES = ['smug', 'angry', 'shock', 'grin', 'ko']
FACE_W = 256  # output width; the game draws heads at ~120-170 logical px (x2 DPR)


def faces():
    ims = {n: Image.open(f'{SRC}/regulator_{n}.png').convert('RGBA') for n in FACES}
    # Same canvas for every face (centered, top-aligned) so expression swaps never jump.
    cw = max(im.width for im in ims.values())
    ch = max(im.height for im in ims.values())
    th = round(ch * FACE_W / cw)
    for n, im in ims.items():
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((cw - im.width) // 2, 0))
        canvas = canvas.resize((FACE_W, th), Image.LANCZOS)
        canvas.save(f'{OUT}/regulator_{n}.png', optimize=True)
    return FACE_W, th


def mascot():
    im = Image.open(f'{SRC}/mascot_back.png').convert('RGBA')
    tw = 360
    th = round(im.height * tw / im.width)
    im.resize((tw, th), Image.LANCZOS).save(f'{OUT}/mascot_back.webp', 'WEBP', quality=88, method=6)


def coin():
    im = Image.open(f'{SRC}/coin_portrait.webp').convert('RGB')
    im.resize((240, 240), Image.LANCZOS).save(f'{OUT}/coin_portrait.webp', 'WEBP', quality=88, method=6)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('faces', faces())
    mascot()
    coin()
