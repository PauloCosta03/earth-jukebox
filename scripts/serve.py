"""Servidor local do Earth Jukebox (usado pelo run.bat).

Igual ao `python -m http.server`, mas com fila de conexões maior: o servidor padrão do Python só aceita
5 conexões esperando, e o navegador abre várias ao mesmo tempo (principalmente no 1º acesso, quando o
index.html troca para a introdução). Com a fila cheia, o Windows recusa conexões e algum script não
carrega. Também desliga o cache, para você ver sempre a versão mais nova dos arquivos.

Uso:  python scripts/serve.py [porta]      (padrão: 8013)
"""
import http.server
import socketserver
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):                 # silencioso (só erros aparecem)
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    request_queue_size = 128                           # o padrão é 5


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8013
    with Server(("", port), partial(Handler, directory=str(ROOT))) as httpd:
        print(f"Earth Jukebox em http://localhost:{port}  (Ctrl+C para parar)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
