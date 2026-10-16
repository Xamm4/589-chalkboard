// Image + font loading. Missing files resolve to null; renderers draw chalk placeholders.

const IMAGES = {
  mascot: 'assets/img/mascot_back.webp',
  coin: 'assets/img/coin_portrait.webp',
  smug: 'assets/img/regulator_smug.png',
  angry: 'assets/img/regulator_angry.png',
  shock: 'assets/img/regulator_shock.png',
  grin: 'assets/img/regulator_grin.png',
  ko: 'assets/img/regulator_ko.png',
};

export const FONTS = {
  chalk: '"Cabin Sketch", "Chalkboard SE", "Comic Sans MS", cursive',
  hand: '"Gochi Hand", "Chalkboard SE", "Comic Sans MS", cursive',
  display: '"Luckiest Guy", "Arial Black", Impact, sans-serif',
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadAssets(onProgress = () => {}) {
  const entries = Object.entries(IMAGES);
  let done = 0;
  const imgs = await Promise.all(
    entries.map(async ([key, src]) => {
      const img = await loadImage(src);
      onProgress(++done / (entries.length + 1));
      return [key, img];
    }),
  );
  const fonts = [
    `700 28px ${FONTS.chalk}`,
    `20px ${FONTS.hand}`,
    `30px ${FONTS.display}`,
  ];
  try {
    await Promise.race([
      Promise.all(fonts.map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* system fallback fonts are fine */
  }
  onProgress(1);
  return Object.fromEntries(imgs);
}
