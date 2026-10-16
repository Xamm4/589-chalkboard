# BUILD PROMPT — "CHALKBOARD REBEL: 589 LINES"

You are a senior game designer + senior web game engineer. Build a complete, polished, mobile-first browser game in this repository and deploy it to GitHub Pages. Work autonomously, commit in small logical steps, and do not stop at a prototype: ship a juicy, finished v1.0 that feels like a premium indie mobile game.

Read this entire document before writing code. When something is unspecified, make the choice a top-tier game designer would make, and note it in `DESIGN_NOTES.md`.

---

## 0. One-sentence pitch

You're in detention. The Regulator is making you write **"I WILL NOT SHILL $589"** a hundred times — but every time he looks away, you secretly write **"XRP TO HIT $589+ BY EOY"** instead. Hold to write the rebel line, let go before he looks up. Don't get caught.

The reference must be instantly recognizable: a green chalkboard filled with the same handwritten line repeated over and over, a kid in detention seen from behind, a wall clock, a framed picture, a trash can. **Do NOT use any Simpsons characters, names, art, fonts, colors-as-branding, or the yellow-skin/spiky-hair look.** The reference comes from the *situation* (detention + chalkboard lines gag), not from copying characters. Our kid is the **$589 community mascot** (bearded guy with sunglasses, provided as `assets/img/mascot_back.png`, already cut out on a transparent background). His red tee + blue shorts outfit is the community's approved art for this game — use the asset exactly as provided, do not recolor or redraw it. The teacher is **The Regulator** (bald old man with round glasses, 5 face expressions, provided).

Audience: the $589 meme-coin community on the XRP Ledger. Tone: funny, rebellious, bullish, never mean-spirited. All in-game text in **English**.

---

## 1. Core loop (must feel great within 5 seconds, no tutorial needed)

**Single input:** press-and-hold anywhere (touch, mouse, or Space). That's the whole control scheme.

- **HOLD** → you write the **rebel line** ("XRP TO HIT $589+ BY EOY") in thick, bright chalk, letter by letter, fast. Rebel letters score points.
- **RELEASE** → your hand instantly switches to writing the **punishment line** ("I WILL NOT SHILL $589") in thin, tired chalk, slowly. Safe, worth almost nothing, but it fills a **Punishment Quota** (see §3).
- **The Regulator** sits at his desk in the foreground (bottom-right), reading a newspaper. Periodically he lowers it and **LOOKS** at the board.
- If he is LOOKING while you are HOLDING → **"CAUGHT!"**: he slams the desk, storms to the board, angrily erases the rebel line you were writing (animated eraser swipe), and you get **1 strike**. 3 strikes = **"SENT TO THE PRINCIPAL"** = game over.
- Completed rebel lines **stay on the board**. Over a run the board fills up and visually becomes *the meme*: rows and rows of "XRP TO HIT $589+ BY EOY".

The feeling we want: *"just one more letter… ONE more… LET GO!"* — greed vs. fear, every few seconds.

### Fairness rules (non-negotiable)
- There is ALWAYS a readable **tell** before a look, except where §4 explicitly says otherwise (and then there's an audio tell).
- **Grace window:** 140 ms after the head finishes turning before a hold counts as caught (tunable).
- Input latency must be minimal: respond on `pointerdown`/`pointerup`, not click.
- When caught, freeze-frame 250 ms + zoom so the player sees exactly why.

---

## 2. The Regulator — state machine & tells

States: `READING → TELL → LOOKING → RETURNING → READING`, plus `FAKE_TELL` (goes TELL → READING without looking).

**Tells (layered, so players learn to read him):**
1. Newspaper **rustles/trembles** (visual + paper sound).
2. He **clears his throat** ("ahem") or **coughs**.
3. Newspaper **lowers slowly**, his eyebrows appear above it.
4. On later days: footsteps from the hallway, his **reflection** in the window, his **shadow** moving on the wall.

**Faces (provided assets):** `smug` (reading/peeking), `angry` (caught you), `shock` (fake-out / surprised), `grin` (smug satisfaction when you get a strike), `ko` (defeated — you reached EOY). Swap faces with a tiny squash/stretch pop.

**Danger readout:** a subtle "eye" indicator near the top HUD that fills during TELL (also conveyed by shape and pulsing, not just color — colorblind safe).

---

## 3. Scoring, greed and depth

- **Rebel letter:** +1 pt each. **Completed rebel line:** +100 × streak multiplier.
- **Streak:** consecutive completed rebel lines without a strike → multiplier ×1, ×1.5, ×2, ×3, ×5 (cap). Strike resets.
- **CLOSE CALL bonus:** releasing within 180 ms before he finishes turning → "SO CLOSE!" text, +250, screen-shake, heartbeat sound. This near-miss reward is the main source of addiction — make it feel incredible.
- **Golden Line:** occasionally the next rebel line glows gold: it's longer ("XRP TO HIT $589+ BY EOY — NOT FINANCIAL ADVICE"), slower to write, worth ×3. Pure greed decision.
- **Punishment Quota:** each school day requires N punishment lines (shown as tally marks on the board corner, written in a small dull hand). At the bell, if the quota isn't met → +1 strike ("You didn't do your punishment!"). This forces you to spend some time "behaving" — and the natural time to behave is while he's looking. Elegant: looking phases become productive, not dead time.
- **Score = "lines snuck"** for sharing, plus a points total for the leaderboard (local best only).

---

## 4. Structure: one school week to EOY

A run = **Monday → Friday → EOY (final exam)**. Each day ≈ 40–55 seconds, ending with the school bell. The **wall clock** is the day timer (hands visibly move). Between days: a 2-second "next day" card (calendar page tears off). Difficulty and teacher personality change per day:

| Day | Teacher mood | Behavior |
|---|---|---|
| Monday | Sleepy | Long reads, slow obvious tells, no fakes. Tutorial-by-design: tip bubbles appear ONLY on Monday of the first run. |
| Tuesday | Suspicious | Introduces FAKE_TELLs (~25%). |
| Wednesday | Caffeinated | Shorter reads, faster turns. Introduces events (see §5). |
| Thursday | Sneaky | Visual tells get subtle; footsteps/reflection tells introduced. Occasional **snap look** with only an audio tell. |
| Friday | Paranoid | Short reads, multiple quick peeks in a row, fakes ~40%. |
| **EOY — Final Exam** | Boss | He walks around the classroom; position matters (looking at board only when facing it). 60 s. Survive → he gets the `ko` face, confetti chalk dust, "EOY REACHED". |

After EOY: optional **Overtime** (endless, escalating) for high scores.

Use a **seeded RNG** so a "Daily Detention" seed (date-based) is possible later, but keep only the main mode in v1 (the community found daily modes confusing in a previous game).

---

## 5. Classroom events (variety so it never gets repetitive)

Introduce gradually (Wed+). Each event has its own clear visual + sound and a one-line floating label.

- **Paper Airplane** (power-up appears on your desk ~1×/day): tap the airplane button to throw it → it flies across the room, the Regulator follows it with his eyes for 3 s = guaranteed safe writing window. Satisfying arc animation.
- **Snitch Bear:** a bear classmate (simple chalk-doodle style or provided asset) raises his hand. If you're holding while his hand is up, he snitches → teacher looks instantly. Release until the hand goes down.
- **Chalk Breaks:** mid-line your chalk snaps (crack sound, pieces fly). You must release and re-press to grab a new piece (0.3 s penalty). Pure comedy.
- **Blackout:** lights flicker off for 3 s — the board glows faintly, you can write freely ("LIGHTS OUT! WRITE!").
- **Principal Walk-by:** a silhouette passes the door window; during that time the teacher is extra alert (shorter reads).
- **FUD Fly:** a buzzing fly lands on the board; ignore it, but if you hold while it's on your line, your letters get smudged (fewer points). Optional if scope allows.

---

## 6. Art direction — "premium hand-drawn chalk"

**Composition** (portrait, 9:16 logical canvas, e.g. 540×960, scaled to fit; also looks great letterboxed on desktop):
- Top ~58%: big **green chalkboard** with wooden frame and chalk tray (eraser + chalk pieces on the tray).
- Right edge / top-right: pale green classroom wall, **round red wall clock** (functional day timer), a **framed portrait of the $589 coin** (provided asset) instead of any copyrighted character, a light switch.
- Bottom-left: **the mascot seen from behind** (`mascot_back.png`), standing at the board on his toes, arm raised writing with chalk. Position him so the chalk tip in his raised hand touches the line currently being written, and move him along the board as the line progresses. Animate with transforms only (tiny bob + rotation while holding/writing fast, slower calmer motion while releasing, a jolt + shake when caught).
- Bottom-right foreground: **The Regulator's desk** with newspaper, coffee mug, apple; his face peeks above the newspaper.
- Trash can with crumpled paper balls.
- Brown floor, warm afternoon light.

**Chalk rendering (this is where the game must feel expensive):**
- Use a chalk-style handwriting font (e.g. self-hosted *Cabin Sketch* or *Gochi Hand* / *Patrick Hand* — OFL licensed, include license file). Rebel line: bold, bright white with slight per-letter rotation/jitter and a grainy chalk texture (noise mask). Punishment line: thinner, greyer, sloppier.
- Letters appear with a **stroke-reveal** feel (clip-reveal left→right per glyph with a tiny dust puff per letter).
- The board keeps **ghost smudges** of erased lines (semi-transparent swirls) — the board looks used and alive.
- Chalk dust particles, eraser clouds when caught, screen-shake on strikes.
- When the board is full: the teacher's assistant eraser wipes it in a satisfying sweep and a new board begins (lines snuck counter persists).

**UI:** HUD drawn in chalk style on the board's top edge: score, streak ×N, strikes as 3 chalk "X" marks, day name, quota tallies. Big chunky buttons for menus (consistent with the previous $589 games: orange PLAY, cream/dark navy panels, black outlines). Fonts: one display font for titles, the chalk font for in-world text.

**Motion principles:** ease-out on UI, squash & stretch on characters, 60 fps, respect `prefers-reduced-motion` (no shake, fewer particles).

**If an asset is missing,** draw a clean placeholder in the same chalk style so the game is always playable — never block on art.

---

## 7. Audio (lightweight)

Synthesize with WebAudio by default (no big files):
- Chalk scratching: filtered noise bursts, pitch/rate modulated by writing speed; rebel = louder, crunchier; punishment = soft.
- Newspaper rustle, throat clear, cough, footsteps, desk slam, eraser swipe, chalk snap, school bell (end of day), heartbeat on close calls, a short "ta-da" for EOY.
- Light background loop (lo-fi classroom: clock ticking + subtle bass), ducked during tells.
- Optional: if mp3 files exist in `/assets/sfx/`, prefer them (preload → `decodeAudioData`), fall back to synth.
- Mute button, remembered in localStorage. Audio starts only after first user gesture.

---

## 8. Screens & flow

1. **Title:** the classroom scene idle, the board already showing a few rebel lines, logo "CHALKBOARD REBEL" + subtitle "589 LINES". Buttons: PLAY, HOW TO (3 illustrated panels: Hold = write rebel / Release = behave / Don't get caught), mute. Show best score and lifetime lines.
2. **Game.**
3. **Caught / strike** animation (in-game).
4. **Game over / EOY results** (must fit one screen, no scroll): zoom-out shot of your full board (the meme!), lines snuck, score, best streak, close calls, day reached, title earned (e.g. "Hall Monitor's Nightmare", "Professional Shiller", "Diamond-Handed Delinquent", "EOY Prophet"). Buttons: PLAY AGAIN (big), Share on X, Copy score, Menu.
   - Share text: `I snuck {N} bullish lines past the Regulator ✏️ Reached {day}. Can you make it to EOY? @589CTO $589 $XRP` (+ game URL when known — put it in one config constant).
5. **Lifetime meta goal:** a counter of total rebel lines across all runs toward **589**. Reaching 589 lifetime lines unlocks **Golden Chalk** (cosmetic: gold rebel letters) with a celebration. Persist in localStorage (`chalkboardRebel_v1`), wrapped in try/catch.

---

## 9. Tuning (start here, expose all values in one `config.js`)

- Rebel write speed: ~11 letters/s (golden: 8). Punishment: ~4 letters/s.
- Monday read duration 3.0–5.5 s, tell 1.1 s, look 1.4–2.0 s. Friday read 1.0–2.4 s, tell 0.45 s, look 1.0–2.5 s, multi-peek chance 30%.
- Quota per day: Mon 2, Tue 3, Wed 3, Thu 4, Fri 4, EOY 0.
- Grace 140 ms. Close-call window 180 ms.
- Target: a decent first-time player reaches Wednesday; a good player reaches EOY in ~10 runs; EOY clear rate for experienced players ~30%.
- Add `?debug=1` panel: show state machine, timers, toggle invincibility, jump to day, slow-mo.

---

## 10. Tech requirements

- **Vanilla JavaScript (ES modules) + Canvas 2D**, no framework. Optional Vite only if it simplifies dev; the deployed output must be static files.
- Structure:
  ```
  /index.html
  /src/main.js, config.js, game.js, teacher.js, writing.js, events.js, render/*.js, audio.js, ui.js, storage.js, rng.js
  /assets/img/  (mascot_back.png [provided], regulator_{smug,angry,shock,grin,ko}.webp, coin_portrait.webp, bear.png …)
  /assets/sfx/  (optional mp3s)
  /assets/fonts/ (self-hosted + LICENSE)
  /tests/
  DESIGN_NOTES.md, README.md
  ```
- Fixed-timestep simulation (60 Hz) separated from rendering; DPR-aware canvas (cap DPR 2); resize/orientation safe; pause on `visibilitychange`.
- Total payload < 2.5 MB, first meaningful paint fast; lazy-load non-critical audio.
- Must work standalone AND embedded in an `<iframe>` on 589onxrpl.com (no assumptions about top window; no `alert`; no external network calls except fonts if not self-hosted — prefer self-hosted).
- Works on iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari. Prevent long-press context menu/text selection/zoom on the game area.
- Accessibility: keyboard (Space/Enter), focus states on menus, reduced motion, colorblind-safe tells, readable contrast.

---

## 11. Testing & quality bar

- Add a **Playwright** test that loads the game, plays automatically with a bot (holds during READING, releases on TELL), and asserts: no console errors, score increases, a day transition happens, results screen appears and fits the viewport without scrolling (test 390×844, 360×640, 1280×800 and an iframe of 480×700).
- Add a simple **balance simulation** script (headless, using the seeded RNG + state machine) that runs 1,000 bot games with different reaction times (150/250/400 ms) and prints which day they reach. Use it to tune §9 targets. Write the results in `DESIGN_NOTES.md`.
- Screenshot every screen at 390×844 and review them yourself for polish before finishing; fix anything that looks amateur, cramped, misaligned or unreadable.

---

## 12. Deployment

- GitHub Actions workflow to deploy to **GitHub Pages** on push to `main`.
- README: how to run locally (`npx serve` or similar — note that opening via `file://` won't load audio), how to tune `config.js`, and an embed snippet:
  ```html
  <iframe src="https://<user>.github.io/<repo>/" title="Chalkboard Rebel"
    style="width:100%;max-width:480px;height:min(900px,92vh);border:0;border-radius:16px;display:block;margin:0 auto"
    allow="autoplay; fullscreen; clipboard-write" loading="lazy"></iframe>
  ```

---

## 13. Definition of done

- [ ] Someone who has never seen the game understands it in 5 seconds without reading anything.
- [ ] The full board at the end clearly evokes the famous chalkboard-detention meme — without any copyrighted character.
- [ ] Close calls feel thrilling; getting caught feels funny, not frustrating.
- [ ] Monday→EOY progression with distinct teacher personalities and at least 4 events.
- [ ] Results screen fits one screen, share on X works, lifetime 589-lines goal works.
- [ ] 60 fps on a mid-range phone, no console errors, tests passing, deployed to GitHub Pages.
- [ ] `DESIGN_NOTES.md` documents decisions, tuning results and ideas for v1.1.

Surprise me: if you see a way to make it funnier, juicier or more addictive within this concept, do it and document it.
