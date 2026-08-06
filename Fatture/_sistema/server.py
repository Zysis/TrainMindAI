#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mini server locale per la dashboard spese TrainMind.

Serve a una cosa sola: dare alla dashboard un bottone "Aggiorna" che funzioni
davvero. Un file HTML aperto con doppio clic (file://) non puo' lanciare
programmi sul computer — e' il browser che lo impedisce, giustamente. Con un
server in ascolto su localhost invece il bottone puo' chiamare un endpoint che
esegue importa.py.

Uso:
    python _sistema/importa.py --dashboard        (consigliato)
    python _sistema/server.py                     (solo server, senza import)
    python _sistema/server.py --porta 9000 --non-aprire

Il server ascolta SOLO su 127.0.0.1: non e' raggiungibile dalla rete.
Si ferma con Ctrl+C.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

BASE = Path(__file__).resolve().parent.parent
SISTEMA = BASE / "_sistema"
DASHBOARD = BASE / "Dashboard-Spese.html"

PORTA_DEFAULT = 8765
ESTENSIONI_AMMESSE = {".html", ".css", ".js", ".json", ".png", ".svg", ".ico", ".xlsx"}

# un aggiornamento alla volta: evita due import concorrenti sullo stesso JSON
_lucchetto = threading.Lock()


class Gestore(BaseHTTPRequestHandler):
    server_version = "SpeseTrainMind/1.0"

    # ---- utilita' -------------------------------------------------------

    def _host_locale(self) -> bool:
        """Difesa contro il DNS rebinding: accetto solo host locali."""
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost", "[::1]", "::1")

    def _json(self, codice: int, payload: dict) -> None:
        corpo = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(codice)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def _file(self, percorso: Path) -> None:
        if not percorso.exists() or not percorso.is_file():
            self._json(404, {"errore": "file non trovato"})
            return
        tipo = mimetypes.guess_type(percorso.name)[0] or "application/octet-stream"
        dati = percorso.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dati)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dati)

    def _risolvi(self, percorso_url: str) -> Path | None:
        """Traduce l'URL in un file dentro Fatture/, bloccando i path traversal."""
        rel = percorso_url.lstrip("/")
        if not rel:
            return DASHBOARD
        try:
            candidato = (BASE / rel).resolve()
            candidato.relative_to(BASE.resolve())
        except (ValueError, OSError):
            return None
        if candidato.suffix.lower() not in ESTENSIONI_AMMESSE:
            return None
        if SISTEMA.resolve() in candidato.parents:
            return None
        return candidato

    # ---- rotte ----------------------------------------------------------

    def do_GET(self) -> None:
        if not self._host_locale():
            self._json(403, {"errore": "accesso consentito solo da localhost"})
            return

        url = urlparse(self.path)

        if url.path == "/api/stato":
            metriche = BASE / "dati" / "metriche.json"
            self._json(200, {
                "ok": True,
                "dashboard_presente": DASHBOARD.exists(),
                "metriche_presenti": metriche.exists(),
                "metriche_aggiornate_al": (
                    __import__("datetime").datetime.fromtimestamp(
                        metriche.stat().st_mtime).isoformat(timespec="seconds")
                    if metriche.exists() else None
                ),
            })
            return

        percorso = self._risolvi(url.path)
        if percorso is None:
            self._json(403, {"errore": "percorso non consentito"})
            return
        self._file(percorso)

    def do_POST(self) -> None:
        if not self._host_locale():
            self._json(403, {"errore": "accesso consentito solo da localhost"})
            return

        url = urlparse(self.path)
        if url.path != "/api/aggiorna":
            self._json(404, {"errore": "endpoint sconosciuto"})
            return

        query = parse_qs(url.query)
        con_metriche = query.get("metriche", ["1"])[0] != "0"

        if not _lucchetto.acquire(blocking=False):
            self._json(409, {"ok": False, "output": "Un aggiornamento e' gia' in corso."})
            return

        try:
            comando = [sys.executable, str(SISTEMA / "importa.py")]
            if not con_metriche:
                comando.append("--senza-metriche")
            res = subprocess.run(
                comando, cwd=str(BASE), capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=300,
            )
            uscita = (res.stdout or "") + (("\n" + res.stderr) if res.stderr else "")
            self._json(200, {"ok": res.returncode == 0, "output": uscita.strip()})
        except subprocess.TimeoutExpired:
            self._json(200, {"ok": False, "output": "L'aggiornamento ha superato i 5 minuti ed e' stato interrotto."})
        except Exception as e:  # noqa: BLE001 — qualunque errore va mostrato nel browser
            self._json(200, {"ok": False, "output": f"Errore imprevisto: {e}"})
        finally:
            _lucchetto.release()

    def log_message(self, formato: str, *args) -> None:
        """Silenzio: l'output utile e' quello di importa.py, non gli access log."""
        return


def avvia(porta: int = PORTA_DEFAULT, apri_browser: bool = True) -> int:
    if not DASHBOARD.exists():
        print("Dashboard-Spese.html non esiste ancora. Lancia prima:  bash aggiorna.sh")
        return 1

    for tentativo in range(porta, porta + 10):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", tentativo), Gestore)
        except OSError:
            continue
        break
    else:
        print(f"Nessuna porta libera tra {porta} e {porta + 9}.")
        return 1

    indirizzo = f"http://127.0.0.1:{httpd.server_address[1]}/"
    print(f"Dashboard attiva su {indirizzo}")
    print("Il bottone 'Aggiorna ora' funziona solo finche' questa finestra resta aperta.")
    print("Premi Ctrl+C per chiudere.\n", flush=True)

    if apri_browser:
        threading.Timer(0.6, lambda: webbrowser.open(indirizzo)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer fermato.")
    finally:
        httpd.server_close()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Server locale per la dashboard spese TrainMind.")
    ap.add_argument("--porta", type=int, default=PORTA_DEFAULT)
    ap.add_argument("--non-aprire", action="store_true", help="non aprire il browser da solo")
    args = ap.parse_args()
    return avvia(args.porta, not args.non_aprire)


if __name__ == "__main__":
    sys.exit(main())
