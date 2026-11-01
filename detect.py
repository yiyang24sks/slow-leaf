"""Slow Leaf - activity detection (Windows). Only timestamps are kept, never key contents."""
import sys
import threading
import time

IS_WIN = sys.platform == "win32"


class Detector:
    def __init__(self):
        self.last = {"keyboard": 0.0, "mouse": 0.0, "fullscreen": 0.0, "media": 0.0}
        self.available = {"keyboard": IS_WIN, "mouse": IS_WIN, "fullscreen": IS_WIN, "media": False}
        self._kb_hook = False
        self._stop = threading.Event()

    def start(self):
        if not IS_WIN:
            return
        self._init_win()
        self._start_keyboard_hook()
        threading.Thread(target=self._poll_loop, daemon=True).start()
        threading.Thread(target=self._media_thread, daemon=True).start()

    def stop(self):
        self._stop.set()

    # ---------- Win32 ----------
    def _init_win(self):
        import ctypes
        from ctypes import wintypes
        self.ct = ctypes
        u = ctypes.WinDLL("user32", use_last_error=True)
        s = ctypes.WinDLL("shell32")

        class POINT(ctypes.Structure):
            _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

        class RECT(ctypes.Structure):
            _fields_ = [("left", ctypes.c_long), ("top", ctypes.c_long),
                        ("right", ctypes.c_long), ("bottom", ctypes.c_long)]

        class MONITORINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.DWORD), ("rcMonitor", RECT),
                        ("rcWork", RECT), ("dwFlags", wintypes.DWORD)]

        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

        self.POINT, self.RECT, self.MONITORINFO, self.LASTINPUTINFO = POINT, RECT, MONITORINFO, LASTINPUTINFO
        u.GetForegroundWindow.restype = wintypes.HWND
        u.GetDesktopWindow.restype = wintypes.HWND
        u.GetShellWindow.restype = wintypes.HWND
        u.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT)]
        u.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        u.MonitorFromWindow.argtypes = [wintypes.HWND, wintypes.DWORD]
        u.MonitorFromWindow.restype = wintypes.HANDLE
        u.GetMonitorInfoW.argtypes = [wintypes.HANDLE, ctypes.POINTER(MONITORINFO)]
        u.GetCursorPos.argtypes = [ctypes.POINTER(POINT)]
        u.GetLastInputInfo.argtypes = [ctypes.POINTER(LASTINPUTINFO)]
        self.u32, self.s32 = u, s

    def _start_keyboard_hook(self):
        try:
            from pynput import keyboard
        except Exception:
            return  # fall back to the GetLastInputInfo heuristic

        def on_press(_key):
            self.last["keyboard"] = time.time()

        try:
            listener = keyboard.Listener(on_press=on_press)
            listener.daemon = True
            listener.start()
            self._kb_hook = True
        except Exception:
            pass

    def _cursor(self):
        pt = self.POINT()
        self.u32.GetCursorPos(self.ct.byref(pt))
        return pt.x, pt.y

    def _last_input_tick(self):
        li = self.LASTINPUTINFO()
        li.cbSize = self.ct.sizeof(self.LASTINPUTINFO)
        self.u32.GetLastInputInfo(self.ct.byref(li))
        return li.dwTime

    def is_fullscreen(self):
        state = self.ct.c_int(0)
        try:
            # 2 = busy (fullscreen app), 3 = D3D fullscreen, 4 = presentation mode
            if self.s32.SHQueryUserNotificationState(self.ct.byref(state)) == 0 and state.value in (2, 3, 4):
                return True
        except Exception:
            pass
        u = self.u32
        hwnd = u.GetForegroundWindow()
        if not hwnd or hwnd in (u.GetDesktopWindow(), u.GetShellWindow()):
            return False
        buf = self.ct.create_unicode_buffer(256)
        u.GetClassNameW(hwnd, buf, 256)
        if buf.value in ("Progman", "WorkerW", "Shell_TrayWnd"):
            return False
        r = self.RECT()
        if not u.GetWindowRect(hwnd, self.ct.byref(r)):
            return False
        mi = self.MONITORINFO()
        mi.cbSize = self.ct.sizeof(self.MONITORINFO)
        if not u.GetMonitorInfoW(u.MonitorFromWindow(hwnd, 2), self.ct.byref(mi)):
            return False
        m = mi.rcMonitor
        return r.left <= m.left and r.top <= m.top and r.right >= m.right and r.bottom >= m.bottom

    def _poll_loop(self):
        last_pos = self._cursor()
        last_tick = self._last_input_tick()
        while not self._stop.wait(0.5):
            now = time.time()
            try:
                pos = self._cursor()
                tick = self._last_input_tick()
                moved = pos != last_pos
                if moved or (tick != last_tick and self._mouse_buttons_down()):
                    self.last["mouse"] = now
                elif tick != last_tick and not self._kb_hook:
                    self.last["keyboard"] = now     # input happened without mouse movement
                last_pos, last_tick = pos, tick
                if self.is_fullscreen():
                    self.last["fullscreen"] = now
            except Exception:
                pass

    def _mouse_buttons_down(self):
        g = self.u32.GetAsyncKeyState
        return any(g(vk) & 0x8000 for vk in (0x01, 0x02, 0x04))

    # ---------- media sessions (optional winrt packages) ----------
    def _media_thread(self):
        try:
            try:
                from winrt.windows.media.control import \
                    GlobalSystemMediaTransportControlsSessionManager as Manager
            except ImportError:
                from winsdk.windows.media.control import \
                    GlobalSystemMediaTransportControlsSessionManager as Manager
        except Exception:
            return
        import asyncio

        async def loop():
            mgr = await Manager.request_async()
            self.available["media"] = True
            while not self._stop.is_set():
                playing = False
                try:
                    for sess in mgr.get_sessions():
                        info = sess.get_playback_info()
                        if info is not None and int(info.playback_status) == 4:  # 4 = Playing
                            playing = True
                            break
                except Exception:
                    pass
                if playing:
                    self.last["media"] = time.time()
                await asyncio.sleep(2)

        try:
            asyncio.run(loop())
        except Exception:
            self.available["media"] = False


class FakeDetector(Detector):
    """For non-Windows testing: pretends the mouse is always moving."""

    def __init__(self, active=True):
        super().__init__()
        self.available = {"keyboard": True, "mouse": True, "fullscreen": True, "media": False}
        self.active = active

    def start(self):
        def loop():
            while not self._stop.wait(0.5):
                if self.active:
                    self.last["mouse"] = time.time()
        threading.Thread(target=loop, daemon=True).start()
