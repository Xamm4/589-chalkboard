# Design notes: Chalkboard Rebel v1.0

## Pillars

1. **Greed vs. fear every few seconds.** One input. Holding is always worth more, and holding is always the risk.
2. **Readable and fair.** Every look has a tell you can see or read (captions). Every catch is replayed so you see why.
3. **The board is the trophy.** Over a run it fills with `XRP TO HIT $589+ BY EOY` and becomes the chalkboard-detention meme. The results screen frames it.
4. **Funny, never mean.** The Regulator is smug, the bear is a snitch, the newspaper headlines are FUD, and the kid never stops believing.

## Decisions the brief left open

### Board and writing
- **Two zones on one board.** Rebel lines fill 11 big rows top to bottom and stay there. The punishment line is written small and dim in a strip along the bottom edge, right where the mascot's chalk hand is, so the "official" work looks official. Completed punishment lines become tally marks in the bottom-right corner.
- **Lines in progress persist.** Letting go pauses the rebel line; it doesn't reset it. Getting caught erases only the line in progress. Letter points already earned are kept; the +100×streak line bonus is what you lose. That keeps "one more letter" tense without feeling like theft.
- **The board persists across days.** When it's full you get **FULL BOARD! +500** *(addition)*. A glint runs across the finished meme, then a giant eraser sweeps it in a zigzag and leaves ghost smudges. Ghost smudges (and faint ghosts of yesterday's punishment lines) keep the board looking used.
- **Golden lines are announced before you commit.** The next line is prepared the moment the previous one completes. When it's golden, its row glows, a `×3` tag appears and a label says so. It spans two rows: `XRP TO HIT $589+ BY EOY —` / `NOT FINANCIAL ADVICE`.
- Spaces take 45% of a letter's time, so the line reads at the speed the player feels.

### The Regulator
- **Tell layers:** newspaper rustle with comic shake marks, then *ahem* or *cough*, then the paper lowers and his eyes appear, then the head turn (`turn` seconds). He can't see until the turn completes, and the 140 ms grace starts after that.
- **Captions for every audio tell** *(addition)*: `*rustle*`, `AHEM!`, `*COUGH*`, `HM?!`, `*creak*`, `*step*`. Most mobile players play muted, so an audio-only tell would be invisible to them. Snap looks still have no newspaper motion and no eye meter, just the tiny `HM?!` caption, so they stay the sharpest tell in the game while remaining fair with the sound off.
- **Thursday (sneaky):** the newspaper barely moves. The real tells are his **reflection in the door window** lowering its paper, his **shadow rising on the wall**, a chair creak and a step. The eye meter only fills halfway.
- **Faces:** smug (reading and looking), shock (close call: "HM?! I COULD HAVE SWORN…", and the airplane), angry (catch), grin (the strike lands, quota miss, game over), ko (EOY, with orbiting stars). Each swap pops with squash and stretch.
- **He talks** *(addition)*: a line when each day starts ("100 LINES. NO SHILLING.", "*SLURP* MORE COFFEE."…), random catch lines ("NOT FINANCIAL ADVICE, HUH?", "$589?! DREAM ON!"), "THANK YOU, BEAR." on a snitch, "PRINCIPAL'S OFFICE. NOW." on game over.
- **Newspaper headlines change per day** ("SEC SAYS 'NO.'", "XRP TO ZERO?!", "WHO IS '589'??", "BEARS WIN AGAIN"…). The FUD he reads vs. the line you write is the joke.
- **CAUGHT sequence (2.0 s, day clock paused):** 0.25 s freeze-frame with a zoom framed between your line and his face, then the desk slam (shake and the CAUGHT! stamp), then he stands up, marches to the board and wipes your line with a felt eraser taped to a pointer (dust clouds). The strike X is chalked into the HUD at 1.42 s, he grins, then marches back. After a catch he reads for an extra second so you can recover.
- **EOY boss:** he leaves the desk and patrols the room on foot. While reading he faces away (toward the door) and drifts right. A tell means he stops, then `HMMM...`. The turn is a 2D flip that takes exactly the state machine's `turn` time. He can only see you while facing the board, and he creeps toward you while he looks.

### Scoring and structure
- Streak multiplier applies to the line being completed: 1st line ×1, 2nd ×1.5, 3rd ×2, 4th ×3, 5th+ ×5. Streak words float up *(addition)*: NICE, BULLISH, MOON MODE, TO THE MOON. At ×5 the cursor throws sparks.
- **Close call** = you were writing, and you let go within 180 ms before the turn completed or inside the 140 ms grace window. It pays +250 with a SO CLOSE! stamp, a gold flash, a heartbeat, 0.3 s of slow-mo, a camera punch, sweat drops on the mascot, haptics, and a doubtful look from the Regulator. One per look.
- **Quota:** a missed quota at the bell is +1 strike ("WHERE'S MY PUNISHMENT?!"). With 12 s left the tally throbs red and a label tells you what to do *(addition)*. In the last 5 s a big countdown sits on the wall clock, red if the quota is still missing.
- **Strikes carry across the week.** Overtime starts with 0 strikes: it's a victory lap for high scores, and lifetime lines only count each line once even if you continue.
- Punishment line: +10. "Worth almost nothing" but not literally nothing, so behaving still ticks the score.
- **Titles:** Teacher's Pet (0 lines), Professional Shiller, Chalk Outlaw (10+ lines on Mon/Tue), Hall Monitor's Nightmare (Wed/Thu), Diamond-Handed Delinquent (Fri/EOY), Close Call Connoisseur (8+ close calls), EOY Prophet (cleared), Detention Legend (Overtime 3+).

### Events (Wednesday onward)
- **Paper airplane:** spawns on the chalk tray once per day and is kept until used. Throwing it puts him in `DISTRACTED` for 3 s, with his eyes following the plane. It also works as a **panic button** mid-tell *(addition)*, which makes it a real decision instead of a free 3 s.
- **Snitch bear:** the bear raises a paw (0.35 s) with a pulsing `!`. If you're writing after a 0.25 s reaction allowance he shouts TEACHER!! and the Regulator whips around in 0.16 s, plus the normal grace.
- **Chalk break:** snaps on your next rebel letter. Release, re-press, then there's a 0.3 s regrab. Holding broken chalk writes nothing and can't get you caught.
- **Blackout:** 0.45 s flicker, then 3 s of dark. The board's chalk keeps a faint glow and your line stays readable. The lights flicker 0.5 s before returning, and there's a 0.3 s grace after.
- **Principal walk-by:** a silhouette crosses the door window and reads get 45% shorter while he's there.
- **FUD fly:** lands on your current line for 4 s. Letters written under it are smudged (no points).
- Scheduling: N events per day, every pool entry shown before any repeat, spread across the day with 6 s of quiet at the start and end, and at most one blackout per day.

### Presentation
- **Composition (540×960):** board top-left (≈58%), clock, framed $589 coin ("IN 589 WE TRUST"), light switch and door on the right wall. The mascot stands bottom-left, the bear at his desk mid-room, the Regulator's desk ("THE REGULATOR" nameplate, SEC mug, apple) bottom-right, a trash can with paper balls. Warm afternoon light with sun beams and dust motes, and a vignette.
- **Chalk:** Cabin Sketch Bold filled with a generated grain pattern (holes and streaks). Each glyph has seeded rotation, offset and scale jitter, a left-to-right stroke reveal, and a dust puff when it completes. Completed lines are baked into an offscreen board layer; only the line in progress is drawn each frame.
- **Danger vignette** *(addition)*: while you hold through a tell, the screen edges throb red in proportion to how far the tell has gone. That's the "just one more letter" feeling made visible. It's halved on sneaky days and absent for snap looks.
- **HUD** is chalked onto the board: day, lines snuck, score (counts up), the **eye** (closed, half, open with a pulse, with shape changes rather than color alone), strikes as chalk X's, and the next streak multiplier.
- **Day card:** a desk calendar. Yesterday's page tears off and tumbles away, showing the day, a mood sticker with the matching Regulator face, the mood, a one-line hint and the quota.
- **Results:** the run's board in its frame (rebel lines on top, the official punishment below, the mascot writing in the corner). It zooms out on entry. Then the title earned, lines snuck, score, best streak, close calls, day reached and the lifetime meter. It fits one screen at every tested size, because the whole UI is laid out at 540×960 and scaled as one.
- **Title screen** shows the live classroom: the Regulator reads, the mascot mimes the loop (scribbles while he reads, slumps when he looks).
- **Haptics** *(addition)* on catches and close calls where `navigator.vibrate` exists.
- `prefers-reduced-motion`: no screen shake, 40% particles, half-strength camera zoom, CSS animations off.

## Tuning

| Day | Dur | Quota | Read | Tell | Turn | Look | Fake | Extras |
|---|---|---|---|---|---|---|---|---|
| Mon | 42 s | 2 | 3.0–5.5 | 1.10 | 0.34 | 1.4–2.0 | 0% | tutorial bubbles (first run only) |
| Tue | 45 s | 3 | 2.3–4.4 | 0.85 | 0.28 | 1.3–2.2 | 25% | |
| Wed | 48 s | 3 | 1.7–3.3 | 0.62 | 0.23 | 1.2–2.2 | 25% | 3 events, airplane |
| Thu | 50 s | 4 | 1.6–3.2 | 0.62 | 0.22 | 1.1–2.3 | 30% | sneaky tells, 20% snap, principal |
| Fri | 52 s | 4 | 0.9–2.2 | 0.42 | 0.18 | 1.0–2.5 | 40% | 35% multi-peek, 15% snap, 4 events |
| EOY | 60 s | 0 | 1.1–2.4 | 0.42 | 0.20 | 1.0–2.2 | 30% | walks the room, 30% multi-peek, 5 events |

Monday matches the brief (read 3.0–5.5, tell 1.1, look 1.4–2.0). Friday's look, quota and multi-peek chance match it as well. Friday's tell (0.42 vs 0.45) and read (0.9–2.2 vs 1.0–2.4) are a touch sharper. That came out of the balance pass below, which showed the late week was too forgiving for good players.

### Balance simulation

`node tests/balance.mjs 1000` runs the real `Game` class headless with a bot per profile.
Reaction time alone doesn't make a player. A pure-reaction bot cleared EOY 99% of the time even at 250 ms, because every tell is far longer than a reaction. Humans lose to **attention** (eyes on their chalk, not the teacher) and **greed** (milking the tell). So the bot (`tests/bot.mjs`) models:

- `rt`: reaction time once a signal is noticed.
- `attention`: chance to notice a tell at onset. Otherwise it's noticed late, 25–100% of the way in. A missed tell can still be caught in peripheral vision when the head turns (75%, slower).
- `greed`: chance to hold through a tell on purpose and plan the release "just in time", with interval-estimation error (`timing`, Weber-style) and a safety `margin`.
- quota awareness, airplane use, chalk regrab, holding through blackouts and distractions.

Results, 1,000 games per profile (share of runs *ending* on each day):

| Profile | MON | TUE | WED | THU | FRI | EOY | CLEAR | median end | avg lines | avg close calls |
|---|---|---|---|---|---|---|---|---|---|---|
| experienced 150 ms (attention .90, greed .65) | 0.1% | 0.1% | 0.6% | 1.9% | 3.2% | 5.5% | **88.6%** | CLEAR | 79.2 | 17.1 |
| good 250 ms (attention .82, greed .50) | 0.0% | 0.1% | 3.6% | 13.4% | 23.8% | 20.8% | **38.3%** | EOY | 66.8 | 10.5 |
| learning 320 ms (attention .76, greed .45) | 0.1% | 1.5% | 14.0% | 37.5% | 26.4% | 15.9% | **4.6%** | THU | 52.5 | 6.7 |
| first-timer 400 ms (attention .68, greed .40) | 1.7% | 12.1% | **37.0%** | 34.7% | 12.1% | 2.3% | 0.1% | **WED** | 38.9 | 4.1 |

Reading against the targets:
- **"A decent first-time player reaches Wednesday"**: the first-timer bot's median run ends on Wednesday, and 98% get past Monday.
- **"A good player reaches EOY in ~10 runs"**: the learning bot reaches EOY in about 20% of runs, so 1 − 0.8¹⁰ ≈ 89% have seen EOY within 10 runs.
- **"EOY clear rate for experienced players ~30%"**: the good-250 bot, our best stand-in for an experienced human, clears 38%. The 150 ms / 90%-attention bot is a superhuman ceiling and is kept as a sanity bound.
- Monday is deliberately gentle: under 2% of first-timer runs end there.

## Accessibility
- Full keyboard play (Space/Enter to hold, A for the airplane, Esc/P to pause). Focus moves to the primary button of each menu, with visible gold focus rings.
- Tells are layered: motion, captions, eye-meter shape, the danger vignette, and audio. None depends on color alone.
- Screen-reader announcements for day starts, catches and close calls. The canvas has a descriptive label.
- Large hit targets: the whole screen is the hold area, the THROW button is 92 px, and the pause button has an enlarged invisible hit area.
- Reduced motion is respected.

## Performance
- Fixed 60 Hz simulation, decoupled from rendering. DPR capped at 2. Static art, the board surface, completed lines, the newspaper, the light overlay and the vignette are pre-rendered at the current resolution and rebuilt on resize.
- The per-frame work is the line in progress (≤ 46 glyphs), characters, at most 420 particles, and a few overlays.
- Payload ≈ 1 MB. Audio is generated on the fly after the first user gesture.

## Ideas for v1.1
- **Daily Detention** mode with `dateSeed()` (already in `rng.js`) and a shared seed per day.
- Share a **picture** of your board: render the results canvas to a PNG and use the Web Share API with files where available.
- More classmates with their own events: the paper-ball thrower, the kid who falls asleep and snores (masks audio tells).
- Cosmetic chalk colors unlocked by milestones (100, 1,000, 5,890 lifetime lines) and a "rebel line editor" that unlocks community slogans.
- A real body sprite for the Regulator (seated and walking) and a proper bear sprite, replacing the procedural ones.
- An end-of-week "report card" that grades each day.
- Online leaderboard (the brief asked for local best only in v1).
