"""Builds assets/img/og.png (social card) and assets/img/favicon.png.
Usage: python3 tools/make_meta_images.py <frame.png> <fonts_dir>
frame.png is a 9:16 screenshot of the game (see README); fonts_dir holds the TTFs."""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

frame_path, fonts = sys.argv[1], sys.argv[2]
LUCKY = f'{fonts}/apache_luckiestguy_LuckiestGuy-Regular.ttf'
CHALK = f'{fonts}/ofl_cabinsketch_CabinSketch-Bold.ttf'
HAND = f'{fonts}/ofl_gochihand_GochiHand-Regular.ttf'
INK = (17, 16, 20)


def outlined(d, xy, text, font, fill, stroke=8, anchor='la'):
    d.text(xy, text, font=font, fill=fill, stroke_width=stroke, stroke_fill=INK, anchor=anchor)


# ---------------------------------------------------------------- og.png
W, H = 1200, 630
og = Image.new('RGB', (W, H), (20, 33, 61))
bg = ImageDraw.Draw(og)
for i in range(0, W + H, 46):  # diagonal chalk-dust stripes
    bg.line([(i, 0), (i - H, H)], fill=(26, 41, 74), width=18)
frame = Image.open(frame_path).convert('RGB')
fh = H - 60
fw = round(frame.width * fh / frame.height)
frame = frame.resize((fw, fh), Image.LANCZOS)
fx, fy = 70, 30
shadow = Image.new('RGBA', (fw + 40, fh + 40), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle([20, 26, fw + 20, fh + 26], 24, fill=(0, 0, 0, 150))
og.paste(shadow.filter(ImageFilter.GaussianBlur(12)), (fx - 20, fy - 20), shadow.filter(ImageFilter.GaussianBlur(12)))
mask = Image.new('L', (fw, fh), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, fw - 1, fh - 1], 22, fill=255)
og.paste(frame, (fx, fy), mask)
ImageDraw.Draw(og).rounded_rectangle([fx - 3, fy - 3, fx + fw + 2, fy + fh + 2], 24, outline=INK, width=6)
d = ImageDraw.Draw(og)
tx = fx + fw + 70
outlined(d, (tx, 70), 'CHALKBOARD', ImageFont.truetype(LUCKY, 74), (255, 243, 220), 9)
outlined(d, (tx - 6, 140), 'REBEL', ImageFont.truetype(LUCKY, 168), (255, 138, 31), 11)
d.text((tx + 4, 330), '589 LINES', font=ImageFont.truetype(CHALK, 60), fill=(244, 244, 236))
d.line([(tx + 4, 404), (tx + 300, 400)], fill=(244, 244, 236), width=5)
hand = ImageFont.truetype(HAND, 38)
d.text((tx + 4, 438), 'Hold to sneak the rebel line.', font=hand, fill=(201, 212, 239))
d.text((tx + 4, 484), 'Let go before the Regulator looks.', font=hand, fill=(201, 212, 239))
outlined(d, (tx + 4, 548), 'XRP TO HIT $589+ BY EOY', ImageFont.truetype(LUCKY, 34), (255, 210, 63), 6)
og.save('assets/img/og.png', optimize=True)

# ---------------------------------------------------------------- favicon.png
S = 180
fav = Image.new('RGBA', (S, S), (0, 0, 0, 0))
f = ImageDraw.Draw(fav)
f.rounded_rectangle([4, 4, S - 5, S - 5], 34, fill=(154, 106, 60), outline=INK, width=8)
f.rounded_rectangle([24, 24, S - 25, S - 25], 16, fill=(43, 87, 67))
f.text((S / 2, S / 2 - 4), '589', font=ImageFont.truetype(CHALK, 70), fill=(244, 244, 236), anchor='mm')
f.line([(48, 128), (132, 126)], fill=(244, 244, 236), width=5)
fav.save('assets/img/favicon.png', optimize=True)
print('og.png + favicon.png written')
