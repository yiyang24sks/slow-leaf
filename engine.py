"""Slow Leaf - plant state engine (growth, wilting, breaks)."""
import copy
import json
import os
import threading
import time

GROW_SECONDS = 4 * 3600            # 4 h of activity grows a full plant
GROW_RATE = 1.0 / GROW_SECONDS
WILT_RATE = GROW_RATE / 1.5        # growing is 1.5x faster than wilting
STRESS_UP = 1.0 / 600              # wilted look builds over ~10 min of idling
STRESS_DOWN = 1.0 / 120            # and recovers in ~2 min
MIN_GROWTH = 0.02                  # a plant never disappears completely
SPECIES = ("monstera", "staghorn")
FACTORS = ("keyboard", "mouse", "fullscreen", "media")

DEFAULT_SETTINGS = {
    "species": "monstera",
    "factors": {"keyboard": False, "mouse": True, "fullscreen": True, "media": False},
    "grace_min": 2,
    "break_min": 15,
    "sound": True,
}


def data_dir():
    base = os.environ.get("APPDATA") or os.path.expanduser("~/.config")
    path = os.path.join(base, "SlowLeaf")
    os.makedirs(path, exist_ok=True)
    return path


class Engine:
    def __init__(self, detector, speed=1.0, path=None):
        self.det = detector
        self.speed = float(speed)
        self.path = path or os.path.join(data_dir(), "state.json")
        self.lock = threading.RLock()
        self.settings = copy.deepcopy(DEFAULT_SETTINGS)
        self.plants = {s: {"growth": MIN_GROWTH, "stress": 0.0} for s in SPECIES}
        self.pots_done = 0
        self.brk = None
        self.reminder = False
        self.anchor = time.time()
        self.mode = "growing"
        self.idle = 0.0
        self.view = "main"
        self.shell = "browser"
        self.on_reminder = None
        self._stop = threading.Event()
        self._last_save = 0.0
        self.load()

    # ---------- persistence ----------
    def load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            return
        s = data.get("settings", {})
        if s.get("species") in SPECIES:
            self.settings["species"] = s["species"]
        for k in FACTORS:
            if isinstance(s.get("factors", {}).get(k), bool):
                self.settings["factors"][k] = s["factors"][k]
        for k in ("grace_min", "break_min"):
            if isinstance(s.get(k), (int, float)):
                self.settings[k] = int(s[k])
        if isinstance(s.get("sound"), bool):
            self.settings["sound"] = s["sound"]
        for sp in SPECIES:
            p = data.get("plants", {}).get(sp)
            if p:
                self.plants[sp]["growth"] = min(1.0, max(MIN_GROWTH, float(p.get("growth", MIN_GROWTH))))
                self.plants[sp]["stress"] = min(1.0, max(0.0, float(p.get("stress", 0.0))))
        self.pots_done = int(data.get("pots_done", 0))

    def save(self):
        with self.lock:
            data = {"settings": self.settings, "plants": self.plants, "pots_done": self.pots_done}
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=1)
            os.replace(tmp, self.path)
        except OSError:
            pass

    # ---------- main loop ----------
    def run(self):
        last = time.time()
        while not self._stop.wait(1.0):
            now = time.time()
            dt = min(5.0, max(0.0, now - last))   # cap: PC sleep must not count as idle
            last = now
            self.tick(dt, now)
            if now - self._last_save > 20:
                self._last_save = now
                self.save()

    def stop(self):
        self._stop.set()
        self.save()

    def _last_activity(self):
        last = self.anchor
        for k in FACTORS:
            if self.settings["factors"].get(k) and self.det.available.get(k):
                last = max(last, self.det.last.get(k, 0.0))
        return last

    def tick(self, dt, now=None):
        now = now or time.time()
        fire = False
        with self.lock:
            p = self.plants[self.settings["species"]]
            if self.brk and now >= self.brk["ends"]:
                self.brk = None
                self.reminder = True
                self.anchor = now           # grace period starts when the break ends
                fire = True
            self.idle = max(0.0, now - self._last_activity())
            grace = self.settings["grace_min"] * 60
            g = dt * self.speed
            if self.brk:
                self.mode = "sleeping"
                p["growth"] += GROW_RATE * g
                p["stress"] -= STRESS_DOWN * dt
            elif self.idle <= grace:
                self.mode = "growing"
                p["growth"] += GROW_RATE * g
                p["stress"] -= STRESS_DOWN * dt
            else:
                self.mode = "wilting"
                p["growth"] -= WILT_RATE * g
                p["stress"] += STRESS_UP * g
            p["growth"] = min(1.0, max(MIN_GROWTH, p["growth"]))
            p["stress"] = min(1.0, max(0.0, p["stress"]))
        if fire and self.on_reminder:
            try:
                self.on_reminder()
            except Exception:
                pass

    # ---------- actions ----------
    def update_settings(self, d):
        with self.lock:
            s = self.settings
            if d.get("species") in SPECIES:
                s["species"] = d["species"]
            if isinstance(d.get("factors"), dict):
                merged = dict(s["factors"])
                for k, v in d["factors"].items():
                    if k in FACTORS:
                        merged[k] = bool(v)
                if any(merged.values()):
                    s["factors"] = merged
            if d.get("grace_min") in (1, 2, 5, 10):
                s["grace_min"] = d["grace_min"]
            if isinstance(d.get("break_min"), (int, float)):
                s["break_min"] = int(min(180, max(1, d["break_min"])))
            if isinstance(d.get("sound"), bool):
                s["sound"] = d["sound"]
        self.save()

    def start_break(self, minutes=None):
        with self.lock:
            m = int(min(180, max(1, minutes or self.settings["break_min"])))
            now = time.time()
            self.brk = {"ends": now + m * 60, "total": m * 60}
            self.reminder = False
            self.mode = "sleeping"

    def stop_break(self):
        with self.lock:
            self.brk = None
            self.anchor = time.time()

    def dismiss(self):
        with self.lock:
            self.reminder = False
            self.anchor = time.time()

    def new_pot(self):
        with self.lock:
            p = self.plants[self.settings["species"]]
            if p["growth"] >= 0.999:
                self.pots_done += 1
            p["growth"], p["stress"] = MIN_GROWTH, 0.0
        self.save()

    def set_view(self, v):
        with self.lock:
            self.view = v

    def snapshot(self):
        now = time.time()
        with self.lock:
            sp = self.settings["species"]
            p = self.plants[sp]
            grace = self.settings["grace_min"] * 60
            signals = {}
            for k in FACTORS:
                ago = now - self.det.last.get(k, 0.0) if self.det.last.get(k) else None
                signals[k] = {
                    "available": bool(self.det.available.get(k)),
                    "enabled": bool(self.settings["factors"].get(k)),
                    "ago": ago,
                    "on": ago is not None and ago <= grace,
                }
            return {
                "mode": self.mode,
                "species": sp,
                "growth": p["growth"],
                "stress": p["stress"],
                "full": p["growth"] >= 0.999,
                "eta": (1.0 - p["growth"]) / GROW_RATE / self.speed,
                "idle": self.idle,
                "grace": grace,
                "settings": copy.deepcopy(self.settings),
                "brk": ({"active": True, "remaining": max(0.0, self.brk["ends"] - now),
                         "total": self.brk["total"]} if self.brk else None),
                "reminder": self.reminder,
                "pots_done": self.pots_done,
                "signals": signals,
                "view": self.view,
                "shell": self.shell,
                "plants": {k: round(v["growth"], 4) for k, v in self.plants.items()},
            }
