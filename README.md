# Slow Leaf

A quiet desktop plant for Windows. It grows while you are active, sleeps (and keeps growing) during breaks, and slowly wilts when you are idle.

## Start
1. Install Python 3.10+ from python.org (tick "Add python.exe to PATH").
2. Double-click `run.bat`. The first run installs dependencies (a few minutes).

Testing: `debug.bat` shows a console and grows the plant 60x faster.
Preview the visuals only: open `web/index.html?preview=0.8` in a browser
(params: `species=staghorn`, `state=sleeping|wilting`, `stress=0..1`, `reminder=1`).

## Rules
- Full plant: 4 hours of activity. Wilting is 1.5x slower than growing. A plant never dies.
- Grows when (Settings): keyboard, mouse, fullscreen window, media playing. Default: mouse + fullscreen.
- Take a break (default 15 min): plant sleeps and grows. When time is up you get a reminder; detection resumes immediately.
- Minimize button: the plant becomes a transparent always-on-top desktop pet. Drag it anywhere; double-click or use the corner button to reopen.
- Progress is saved in `%APPDATA%\SlowLeaf\state.json`. Nothing changes while the app is closed.
- Privacy: only "last activity time" is recorded, never what you type.
