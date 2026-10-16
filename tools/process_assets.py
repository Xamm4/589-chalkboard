"""Asset pipeline: cuts the Regulator faces out of their round badges and
downsizes the mascot. Run from the repo root:  python3 tools/process_assets.py
Sources live in assets/src/, outputs go to assets/img/."""
from collections import deque
from PIL import Image, ImageFilter
import math, os

SRC = 'assets/src'
OUT = 'assets/img'

def is_bg(p, r):
    rr, g, b, a = p
    if a < 40:
        return True
    mx, mn = max(rr, g, b), min(rr, g, b)
    lum = (rr + g + b) / 3
    if r > 96:  # outer ring band: red ring, dark slate ring and black outline
        if rr > 180 and g < 130 and b < 140 and rr - g > 80:
            return True
        if mx < 95:
            return True
    if b - rr > 12 and lum < 215:  # bluish ring highlight
        return True
    # inner badge background: desaturated mauve / slate grey
    if mx - mn < 34 and 45 < lum < 150:
        return True
    return False

def largest_component(mask):
    w, h = mask.size
    mp = mask.load()
    label = [[0] * h for _ in range(w)]
    best, best_n, cur = 0, 0, 0
    for sx in range(w):
        for sy in range(h):
            if mp[sx, sy] == 0 or label[sx][sy]:
                continue
            cur += 1
            n = 0
            st = [(sx, sy)]
            label[sx][sy] = cur
            while st:
                x, y = st.pop()
                n += 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and mp[nx, ny] and not label[nx][ny]:
                        label[nx][ny] = cur
                        st.append((nx, ny))
            if n > best_n:
                best, best_n = cur, n
    out = Image.new('L', (w, h), 0)
    op = out.load()
    for x in range(w):
        for y in range(h):
            if label[x][y] == best:
                op[x, y] = 255
    return out

def cut_face(name):
    im = Image.open(f'{SRC}/regulator_{name}.webp').convert('RGBA')
    w, h = im.size
    px = im.load()
    cx, cy = w / 2, h / 2
    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    mask = Image.new('L', (w, h), 255)
    mp = mask.load()
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[x][y]:
            continue
        seen[x][y] = True
        r = math.hypot(x - cx, y - cy)
        if not is_bg(px[x, y], r):
            continue
        mp[x, y] = 0
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    mask = largest_component(mask)
    # tidy: close pinholes, soften the edge a touch
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    out = im.copy()
    out.putalpha(mask)
    # add a crisp dark outline around the silhouette (the flood removed the ring outline)
    sil = mask.point(lambda v: 255 if v > 110 else 0)
    grown = sil.filter(ImageFilter.MaxFilter(5))
    outline = Image.new('RGBA', (w, h), (22, 14, 12, 255))
    outline.putalpha(grown)
    outline.alpha_composite(out)
    bbox = (28, 26, 232, 244)  # same box for every face so swaps never jump
    outline = outline.crop(bbox)
    outline.save(f'{OUT}/regulator_{name}.webp', 'WEBP', quality=90, method=6)
    return bbox

def mascot():
    im = Image.open(f'{SRC}/mascot_back.png').convert('RGBA')
    tw = 360
    th = round(im.height * tw / im.width)
    im = im.resize((tw, th), Image.LANCZOS)
    im.save(f'{OUT}/mascot_back.webp', 'WEBP', quality=88, method=6)

def coin():
    im = Image.open(f'{SRC}/coin_portrait.webp').convert('RGB')
    im = im.resize((240, 240), Image.LANCZOS)
    im.save(f'{OUT}/coin_portrait.webp', 'WEBP', quality=88, method=6)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in ['smug', 'angry', 'shock', 'grin', 'ko']:
        print(n, cut_face(n))
    mascot()
    coin()
