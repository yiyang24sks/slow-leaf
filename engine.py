"""Slow Leaf - plant state engine (growth, wilting, breaks)."""
import copy
import json
import os
import random
import threading
import time

GROW_SECONDS = 4 * 3600            # 4 h of activity grows a full plant
GROW_RATE = 1.0 / GROW_SECONDS
BASE_RATE = GROW_RATE / 1.5        # breaks grow and idling wilts at 1x; active work grows at 1.5x
WILT_RATE = BASE_RATE
STRESS_UP = 1.0 / 600              # wilted look builds over ~10 min of idling
STRESS_DOWN = 1.0 / 120            # and recovers in ~2 min
MIN_GROWTH = 0.02                  # a plant never disappears completely
SPECIES = ("monstera", "staghorn", "caladium", "bluestar", "jadevine", "welwitschia")
RARE_CHANCE = 0.10                 # rolled once, when a pot reaches 100 %
BONUS_SECONDS = 30 * 60            # "golden chance": 30 more active minutes -> guaranteed rare
VARIANTS = {"monstera": ("aurea", "albo"), "staghorn": ("spore", "silver"),
            "caladium": ("muffet", "strawberry"), "bluestar": ("mandaianum", "goldsori"),
            "jadevine": ("flame", "lilac"), "welwitschia": ("bluecone", "trileaf")}
PHASES = ("growing", "complete", "bonus")
FACTORS = ("keyboard", "mouse", "fullscreen", "media")

DEFAULT_SETTINGS = {
    "species": "monstera",
    "factors": {"keyboard": False, "mouse": True, "fullscreen": True, "media": False},
    "grace_min": 2,
    "break_min": 15,
    "sound": True,
}


def fresh_pot():
    return {"growth": MIN_GROWTH, "stress": 0.0, "seed": random.randint(1, 2 ** 31 - 2),
            "phase": "growing", "rare": False, "variant": None, "bonus": 0.0,
            "active": 0.0, "started": time.time()}


def clean_pot(sp, p):
    """Merge a saved pot over defaults and validate every field."""
    out = fresh_pot()
    if not isinstance(p, dict):
        return out
    num = lambda k, lo, hi: min(hi, max(lo, float(p[k]))) if isinstance(p.get(k), (int, float)) else None
    for k, lo, hi in (("growth", MIN_GROWTH, 1.0), ("stress", 0.0, 1.0), ("bonus", 0.0, BONUS_SECONDS),
                      ("active", 0.0, 1e9), ("started", 0.0, 1e11)):
        v = num(k, lo, hi)
        if v is not None:
            out[k] = v
    if isinstance(p.get("seed"), int) and p["seed"] > 0:
        out["seed"] = p["seed"]
    if p.get("phase") in PHASES:
        out["phase"] = p["phase"]
    out["rare"] = bool(p.get("rare"))
    if p.get("variant") in VARIANTS[sp]:
        out["variant"] = p["variant"]
    if (out["rare"] or out["phase"] == "bonus") and not out["variant"]:
        out["variant"] = random.choice(VARIANTS[sp])
    if out["phase"] != "growing":
        out["growth"] = 1.0
    return out


def clean_item(c):
    try:
        sp = c["species"] if c.get("species") in SPECIES else None
        if not sp:
            return None
        v = c.get("variant") if c.get("variant") in VARIANTS[sp] else None
        return {"id": int(c["id"]), "species": sp, "seed": int(c["seed"]), "rare": bool(c.get("rare")) and bool(v),
                "variant": v if c.get("rare") else None, "finishedAt": float(c.get("finishedAt", 0)),
                "hours": round(float(c.get("hours", 0)), 2)}
    except (KeyError, TypeError, ValueError):
        return None


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
        self.plants = {s: fresh_pot() for s in SPECIES}
        self.collection = []
        self.display = None              # collection id shown in the desktop window, or None
        self.next_id = 1                 # numbers are never reused, even after deleting
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
            self.plants[sp] = clean_pot(sp, data.get("plants", {}).get(sp))
        coll = data.get("collection")
        if isinstance(coll, list):
            self.collection = [c for c in (clean_item(x) for x in coll) if c]
        ids = {c["id"] for c in self.collection}
        self.display = data.get("display") if data.get("display") in ids else None
        self.pots_done = max(int(data.get("pots_done", 0) or 0), len(self.collection))
        top = max([c["id"] for c in self.collection] + [0]) + 1
        self.next_id = max(top, int(data.get("next_id", 1) or 1))

    def save(self):
        with self.lock:
            data = {"settings": self.settings, "plants": self.plants, "pots_done": self.pots_done,
                    "collection": self.collection, "display": self.display, "next_id": self.next_id}
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
                p["growth"] += BASE_RATE * g
                p["stress"] -= STRESS_DOWN * dt
            elif self.idle <= grace:
                self.mode = "growing"
                p["growth"] += GROW_RATE * g
                p["stress"] -= STRESS_DOWN * dt
                p["active"] += g
                if p["phase"] == "bonus":           # golden chance only counts active time
                    p["bonus"] = min(BONUS_SECONDS, p["bonus"] + g)
                    if p["bonus"] >= BONUS_SECONDS:
                        p["phase"], p["rare"] = "complete", True
                        self._last_save = 0.0
            else:
                self.mode = "wilting"
                p["growth"] -= WILT_RATE * g
                p["stress"] += STRESS_UP * g
            p["growth"] = min(1.0, max(MIN_GROWTH, p["growth"]))
            p["stress"] = min(1.0, max(0.0, p["stress"]))
            if p["phase"] == "growing" and p["growth"] >= 0.999:
                # roll once and store it, so restarting the app cannot re-roll
                p["phase"] = "complete"
                if random.random() < RARE_CHANCE:
                    p["rare"], p["variant"] = True, random.choice(VARIANTS[self.settings["species"]])
                self._last_save = 0.0
            if p["phase"] != "growing":
                p["growth"] = 1.0                   # a finished plant never shrinks
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
        """Finished pot -> greenhouse. Unfinished pot -> start over with a new seed."""
        with self.lock:
            sp = self.settings["species"]
            if self.plants[sp]["phase"] != "growing":
                return self.harvest()
            self.plants[sp] = fresh_pot()
        self.save()

    def start_bonus(self):
        with self.lock:
            sp = self.settings["species"]
            p = self.plants[sp]
            if p["phase"] == "complete" and not p["rare"]:
                p["phase"], p["bonus"] = "bonus", 0.0
                p["variant"] = random.choice(VARIANTS[sp])
        self.save()

    def harvest(self):
        with self.lock:
            sp = self.settings["species"]
            p = self.plants[sp]
            if p["phase"] == "growing":
                return None
            rare = p["phase"] == "complete" and p["rare"]
            item = {"id": self.next_id, "species": sp, "seed": p["seed"],
                    "rare": rare, "variant": p["variant"] if rare else None,
                    "finishedAt": time.time(), "hours": round(p["active"] / 3600.0, 2)}
            self.collection.append(item)
            self.next_id += 1
            self.pots_done += 1
            self.plants[sp] = fresh_pot()
        self.save()
        return item

    def discard(self):
        """Throw the current pot away (finished or not) and start a new seed."""
        with self.lock:
            self.plants[self.settings["species"]] = fresh_pot()
        self.save()

    def delete_items(self, ids):
        ids = {i for i in ids if isinstance(i, int)}
        with self.lock:
            self.collection = [c for c in self.collection if c["id"] not in ids]
            if self.display in ids:
                self.display = None
        self.save()

    def set_display(self, cid):
        with self.lock:
            self.display = cid if any(c["id"] == cid for c in self.collection) else None
        self.save()

    def get_collection(self):
        with self.lock:
            return copy.deepcopy(self.collection)

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
                "pot": self._pot_info(p),
                "collection_n": len(self.collection),
                "gold_n": sum(1 for c in self.collection if c["rare"]),
                "display": next((copy.deepcopy(c) for c in self.collection if c["id"] == self.display), None),
            }

    def _pot_info(self, p):
        vk = 1.0 if p["rare"] else (p["bonus"] / BONUS_SECONDS if p["phase"] == "bonus" else 0.0)
        return {"seed": p["seed"], "phase": p["phase"], "rare": p["rare"], "variant": p["variant"],
                "vk": round(vk, 4), "bonus": p["bonus"], "bonus_total": BONUS_SECONDS,
                "bonus_eta": (BONUS_SECONDS - p["bonus"]) / self.speed, "active": p["active"],
                "next_id": self.next_id}
