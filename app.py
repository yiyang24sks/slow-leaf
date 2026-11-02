"""Slow Leaf - a quiet desktop plant that grows while you work.

Run:  pythonw app.py            (normal)
      python app.py --speed 60  (test: plant grows 60x faster)
"""
import argparse
import json
import mimetypes
import os
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from detect import IS_WIN, Detector, FakeDetector
from engine import Engine

HERE = os.path.dirname(os.path.abspath(sys.argv[0] if getattr(sys, "frozen", False) else __file__))
WEB = os.path.join(getattr(sys, "_MEIPASS", HERE), "web")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


LOG = None


def log(msg):
    if LOG:
        try:
            LOG.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), msg))
        except Exception:
            pass


def setup_logging():
    """Write crashes and errors to %APPDATA%\\SlowLeaf\\crash.log (pythonw has no console)."""
    global LOG
    import faulthandler
    import traceback
    d = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "SlowLeaf")
    os.makedirs(d, exist_ok=True)
    LOG = open(os.path.join(d, "crash.log"), "a", buffering=1, encoding="utf-8")
    LOG.write("\n--- Slow Leaf started %s (Python %s) ---\n" % (time.ctime(), sys.version.split()[0]))
    faulthandler.enable(LOG)

    def hook(t, v, tb):
        traceback.print_exception(t, v, tb, file=LOG)
        sys.__excepthook__(t, v, tb)

    def thook(a):
        LOG.write("Error in thread %s:\n" % (a.thread.name if a.thread else "?"))
        traceback.print_exception(a.exc_type, a.exc_value, a.exc_traceback, file=LOG)

    sys.excepthook = hook
    threading.excepthook = thook


class Bridge:
    """Window actions requested by the web UI; replaced by the Qt shell."""

    def request(self, action):
        return False


def make_handler(engine, bridge):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, code, body, ctype):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj):
            self._send(200, json.dumps(obj).encode("utf-8"), "application/json")

        def _local(self):
            # only our own page may talk to the API: other websites open in a browser cannot reach it
            # (a DNS-rebinding page has a foreign Host header; a cross-site POST cannot send JSON without a preflight)
            host = (self.headers.get("Host") or "").split(":")[0]
            return host in ("127.0.0.1", "localhost")

        def do_GET(self):
            path = self.path.split("?", 1)[0]
            if path.startswith("/api/") and not self._local():
                return self._send(403, b"forbidden", "text/plain")
            if path == "/api/state":
                return self._json(engine.snapshot())
            if path == "/api/collection":
                return self._json(engine.get_collection())
            if path == "/":
                path = "/index.html"
            full = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
            if not full.startswith(WEB) or not os.path.isfile(full):
                return self._send(404, b"not found", "text/plain")
            with open(full, "rb") as fh:
                data = fh.read()
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype.endswith("javascript"):
                ctype += "; charset=utf-8"
            self._send(200, data, ctype)

        def do_POST(self):
            path = self.path.split("?", 1)[0]
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if not self._local() or ctype != "application/json":
                return self._send(403, b"forbidden", "text/plain")
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                body = {}
            if path == "/api/settings":
                engine.update_settings(body)
            elif path == "/api/break/start":
                engine.start_break(body.get("minutes"))
            elif path == "/api/break/stop":
                engine.stop_break()
            elif path == "/api/reminder/dismiss":
                engine.dismiss()
            elif path == "/api/newpot":
                engine.new_pot()
            elif path == "/api/harvest":
                engine.harvest()
            elif path == "/api/discard":
                engine.discard()
            elif path == "/api/collection/delete":
                engine.delete_items(body.get("ids") or [])
            elif path == "/api/bonus/start":
                engine.start_bonus()
            elif path == "/api/display":
                cid = body.get("id")
                engine.set_display(cid if isinstance(cid, int) else None)
            elif path == "/api/window":
                bridge.request(str(body.get("action", "")))
            else:
                return self._send(404, b"not found", "text/plain")
            self._json(engine.snapshot())

    return Handler


def start_server(engine, bridge, port=0):
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(engine, bridge))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, "http://127.0.0.1:%d" % server.server_address[1]


# --------------------------------------------------------------------------- Qt shell
def run_qt(url, engine, bridge):
    from PySide6.QtCore import QObject, QPoint, Qt, QTimer, QUrl, Signal, Slot
    from PySide6.QtGui import QAction, QColor, QCursor, QGuiApplication, QIcon, QPainter, QPixmap, QPolygonF
    from PySide6.QtCore import QPointF
    from PySide6.QtWebEngineCore import QWebEngineSettings
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWidgets import QApplication, QMenu, QSystemTrayIcon

    app = QApplication(sys.argv)
    app.setApplicationName("Slow Leaf")
    app.setQuitOnLastWindowClosed(False)

    def make_icon():
        pm = QPixmap(64, 64)
        pm.fill(Qt.transparent)
        p = QPainter(pm)
        p.setRenderHint(QPainter.Antialiasing)
        p.setPen(Qt.NoPen)
        p.setBrush(QColor("#B0876F"))
        p.drawPolygon(QPolygonF([QPointF(18, 40), QPointF(46, 40), QPointF(42, 60), QPointF(22, 60)]))
        p.setBrush(QColor("#5E7862"))
        p.translate(32, 38)
        for ang in (-38, 0, 38):
            p.save()
            p.rotate(ang)
            p.drawEllipse(QPointF(0, -14), 7, 14)
            p.restore()
        p.end()
        return QIcon(pm)

    icon = make_icon()
    app.setWindowIcon(icon)
    state = {"quitting": False}

    class MainView(QWebEngineView):
        def closeEvent(self, e):
            e.accept()
            log("main window closed")
            hub.quit_app()

    class PetView(QWebEngineView):
        def closeEvent(self, e):
            e.ignore()
            hub.show_main()

    def prep(view):
        view.settings().setAttribute(QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False)
        view.setContextMenuPolicy(Qt.NoContextMenu)

        # if the page's renderer crashes, reload it instead of leaving a blank window
        def on_dead(status, code, v=view):
            log("web renderer stopped (status %s, code %s) - reloading" % (status, code))
            QTimer.singleShot(800, v.reload)
        try:
            view.page().renderProcessTerminated.connect(on_dead)
        except Exception:
            pass

    main = MainView()
    main.setWindowTitle("Slow Leaf")
    main.resize(440, 720)
    main.setMinimumSize(380, 600)
    prep(main)
    main.load(QUrl(url + "/?mode=main"))

    pet = PetView()
    pet.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
    pet.setAttribute(Qt.WA_TranslucentBackground, True)
    pet.setAttribute(Qt.WA_NoSystemBackground, True)
    pet.setStyleSheet("background: transparent;")
    pet.page().setBackgroundColor(Qt.transparent)
    pet.resize(240, 270)
    prep(pet)
    pet.load(QUrl(url + "/?mode=pet"))
    placed = {"done": False}

    def lbutton_down():
        if IS_WIN:
            import ctypes
            return bool(ctypes.windll.user32.GetAsyncKeyState(0x01) & 0x8000)
        return bool(QGuiApplication.mouseButtons() & Qt.LeftButton)

    follow = QTimer()
    follow.setInterval(10)
    drag_off = {"p": QPoint()}

    def follow_step():
        if lbutton_down():
            pet.move(QCursor.pos() - drag_off["p"])
        else:
            follow.stop()

    follow.timeout.connect(follow_step)

    class Hub(QObject):
        action = Signal(str)
        remind = Signal()

        def __init__(self):
            super().__init__()
            self.action.connect(self.on_action)
            self.remind.connect(self.on_remind)

        @Slot(str)
        def on_action(self, a):
            if a == "pet":
                self.show_pet()
            elif a == "main":
                self.show_main()
            elif a == "drag":
                wh = pet.windowHandle()
                ok = False
                try:
                    ok = bool(wh and wh.startSystemMove())
                except Exception:
                    ok = False
                if not ok:
                    drag_off["p"] = QCursor.pos() - pet.pos()
                    follow.start()
            elif a == "quit":
                self.quit_app()

        def show_pet(self):
            if not placed["done"]:
                g = QGuiApplication.primaryScreen().availableGeometry()
                pet.move(g.right() - pet.width() - 24, g.bottom() - pet.height() - 16)
                placed["done"] = True
            pet.show()
            pet.raise_()
            main.hide()
            engine.set_view("pet")

        def show_main(self):
            main.showNormal()
            main.raise_()
            main.activateWindow()
            pet.hide()
            engine.set_view("main")

        @Slot()
        def on_remind(self):
            tray.showMessage("Break's over", "Your plant is awake. Stay active to keep it growing.", icon, 6000)
            if engine.view == "pet":
                pet.raise_()
            else:
                main.showNormal()
                main.raise_()
                main.activateWindow()

        def quit_app(self):
            if state["quitting"]:
                return
            state["quitting"] = True
            log("quit requested")
            engine.stop()
            tray.hide()
            app.quit()

    hub = Hub()
    bridge.request = lambda a: hub.action.emit(a)
    engine.on_reminder = lambda: hub.remind.emit()
    engine.shell = "qt"

    tray = QSystemTrayIcon(icon)
    tray.setToolTip("Slow Leaf")
    menu = QMenu()
    for label, fn in (("Open Slow Leaf", hub.show_main), ("Desktop plant", hub.show_pet), ("Quit", hub.quit_app)):
        act = QAction(label, menu)
        act.triggered.connect(fn)
        menu.addAction(act)
    tray.setContextMenu(menu)
    tray.activated.connect(lambda r: hub.show_main() if r == QSystemTrayIcon.Trigger else None)
    tray.show()

    main.show()
    engine.set_view("main")
    code = app.exec()
    engine.stop()
    return code


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--speed", type=float, default=1.0, help="growth speed multiplier for testing")
    ap.add_argument("--browser", action="store_true", help="open in the default browser instead of a window")
    ap.add_argument("--fake", action="store_true", help="fake activity detector (testing)")
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--state", default=None, help="custom state file path")
    args = ap.parse_args()
    try:
        setup_logging()
    except Exception:
        pass

    det = FakeDetector() if (args.fake or not IS_WIN) else Detector()
    det.start()
    engine = Engine(det, speed=args.speed, path=args.state)
    threading.Thread(target=engine.run, daemon=True).start()
    bridge = Bridge()
    server, url = start_server(engine, bridge, args.port)

    if not args.browser:
        try:
            sys.exit(run_qt(url, engine, bridge))
        except ImportError as exc:
            print("PySide6 not available (%s); opening in browser instead." % exc)
    engine.shell = "browser"
    print("Slow Leaf running at", url)
    webbrowser.open(url + "/?mode=main")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        engine.stop()


if __name__ == "__main__":
    main()
