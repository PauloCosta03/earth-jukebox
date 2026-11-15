"""Baixa os ícones usados na interface (Lucide, licença ISC) e embute no index.html como sprite SVG.

Os ícones ficam entre os marcadores <!-- ICONES:INICIO --> e <!-- ICONES:FIM --> do index.html,
então o app funciona offline e sem pedidos extras. Uso: python scripts/build_icons.py
Para usar no HTML:  <svg class="ic" aria-hidden="true"><use href="#i-play"/></svg>
"""
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = "0.460.0"
URL = f"https://unpkg.com/lucide-static@{VERSION}/icons/{{}}.svg"

# nome no app -> nome no Lucide (o primeiro que existir)
ICONS = {
    "earth": ["earth"], "layers": ["layers"], "instruments": ["audio-lines"], "files": ["file-music"],
    "a11y": ["accessibility"], "info": ["info"], "zoom-in": ["zoom-in"], "zoom-out": ["zoom-out"],
    "center": ["locate-fixed"], "eye": ["eye"], "eye-off": ["eye-off"], "maximize": ["maximize"],
    "minimize": ["minimize"], "play": ["play"], "pause": ["pause"], "again": ["rotate-ccw"],
    "stop": ["square"], "volume": ["volume-2"], "volume-off": ["volume-x"], "speak": ["speech", "message-square-text"],
    "repeat": ["repeat"], "close": ["x"], "heat": ["thermometer-sun"], "ice": ["snowflake"],
    "flood": ["waves"], "lights": ["building-2"], "clouds": ["cloud"], "wind": ["wind"], "ozone": ["shield"],
    "leaf": ["leaf"], "fire": ["flame"], "currents": ["waves-ladder", "navigation"], "spin": ["orbit", "rotate-3d"],
    "thermo": ["thermometer"], "co2": ["factory"], "bell": ["bell"], "sea": ["waves"], "image": ["image"],
    "folder": ["folder-open"], "scan": ["scan-line"], "record": ["circle-dot"], "score": ["music"],
    "globe": ["globe"], "keyboard": ["keyboard"], "voice": ["audio-waveform"], "chime": ["bell-ring"],
    "text": ["type"], "contrast": ["contrast"], "motion": ["turtle", "pause-circle"], "help": ["circle-help"],
    "low": ["leaf"], "mid": ["cloud-sun"], "high": ["flame"],
    "ev-prev": ["skip-back"], "ev-next": ["skip-forward"], "story": ["book-open-text", "book-open"],
    "lang": ["languages"],
}


def fetch(name):
    with urllib.request.urlopen(urllib.request.Request(URL.format(name), headers={"User-Agent": "earth-jukebox"}),
                                timeout=30) as r:
        return r.read().decode("utf-8")


def main():
    symbols = []
    for key, candidates in ICONS.items():
        for cand in candidates:
            try:
                svg = fetch(cand)
            except Exception:  # noqa: BLE001
                continue
            inner = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", svg, flags=re.S).strip()
            inner = re.sub(r"\s+", " ", inner)
            symbols.append(f'<symbol id="i-{key}" viewBox="0 0 24 24">{inner}</symbol>')
            break
        else:
            raise SystemExit(f"ícone não encontrado: {key} {candidates}")
    sprite = ('<svg xmlns="http://www.w3.org/2000/svg" style="display:none" fill="none" stroke="currentColor" '
              'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              f'<!-- Ícones: Lucide (https://lucide.dev, licença ISC) -->{"".join(symbols)}</svg>')
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    block = f"<!-- ICONES:INICIO -->\n{sprite}\n<!-- ICONES:FIM -->"
    html, n = re.subn(r"<!-- ICONES:INICIO -->.*?<!-- ICONES:FIM -->", lambda m: block, html, flags=re.S)
    if not n:
        raise SystemExit("marcadores <!-- ICONES:INICIO --> / <!-- ICONES:FIM --> não encontrados no index.html")
    html_path.write_text(html, encoding="utf-8")
    print(f"{len(symbols)} ícones embutidos no index.html")


if __name__ == "__main__":
    main()
