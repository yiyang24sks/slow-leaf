# Slow Leaf

A quiet desktop plant for Windows. It grows while you are active, sleeps (and keeps growing) during breaks, and slowly wilts when you are idle.

## Start
1. Install Python 3.10+ from python.org (tick "Add python.exe to PATH").
2. Double-click `Slow Leaf.vbs` (no console window). The first run opens `run.bat` to install dependencies (a few minutes).
   Tip: right-click `Slow Leaf.vbs` > Send to > Desktop (create shortcut).

Testing: `debug.bat` shows a console and grows the plant 60x faster.
Preview the visuals only: open `web/index.html?preview=0.8` in a browser
(params: `species=staghorn|caladium|bluestar|jadevine|welwitschia`, `state=sleeping|wilting`, `stress=0..1`, `reminder=1`).

## Rules
- Full plant: 4 hours of activity. Speeds: active work 1.5x, breaks 1x (a break grows the plant 2/3 as fast as work), idle wilting 1x. A plant never dies.
- Grows when (Settings): keyboard, mouse, fullscreen window, media playing. Default: mouse + fullscreen.
- Take a break (default 15 min): plant sleeps and grows (at 1x, slower than working). When time is up you get a reminder; detection resumes immediately.
- Minimize button: the plant becomes a transparent always-on-top desktop pet. Drag it anywhere; double-click or use the corner button to reopen.
- Progress is saved in `%APPDATA%\SlowLeaf\state.json`. Nothing changes while the app is closed.
- Privacy: only "last activity time" is recorded, never what you type.

## Greenhouse & rare plants
- Every pot gets its own seed: leaf colour, size, shape, pot colour / board wood differ per plant.
- At 100 % a rare roll (10 %) happens once and is saved. Not rare? Choose "Add to Greenhouse",
  or "Golden chance": 30 more minutes of activity (pauses when idle, never goes back) = guaranteed rare.
- Plants: Monstera, Staghorn fern, Caladium, Blue Star fern, Jade vine, Welwitschia (each keeps its own progress).
  Welwitschia grows wild on a sand mound instead of a pot (a rare one hides a few gold nuggets in the sand).
- Rare forms: Monstera 'Aurea' / 'Albo', Staghorn 'Yellow Moon' / 'Silver Felt',
  Caladium 'Miss Muffet' / 'Strawberry Star', Blue Star 'Mandaianum' / 'Golden Sori',
  Jade vine 'Flame' / 'Lilac Dawn', Welwitschia 'Blue Cone' / 'Three-Leaf'.
- The greenhouse (house icon) lists all finished plants; any of them can be put on the desktop.
- Finished plants can also be discarded. In the greenhouse: filter by plant or "Rare", delete one plant, or "Select" to delete several; ‹ › (or arrow keys) to browse.
- Open `web/gallery.html` in a browser to see every look: rare forms, golden-chance steps, colours, pots, boards.
