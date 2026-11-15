"""Gera imagens-partitura: melodias de domínio público desenhadas como estrelas sobre a Terra.

Abra a imagem em Instrumentos -> Abrir imagem ou vídeo e aperte Varrer (tecla S).
O nome do arquivo contém "partitura": o app então usa a ESCALA MAIOR na varredura (modo partitura).

Como a varredura do js/vision.js lê a imagem:
  - a imagem é reduzida para 96x54 e dividida em 48 colunas (6 segundos -> 0,125 s por coluna);
  - em cada coluna, o ponto mais claro vira nota: quanto mais ALTO, mais AGUDO;
    grau da escala = round((1 - linha/53) * 20)   (7 notas x 3 oitavas - 1)
  - tudo que é escuro (céu, Terra, linhas da constelação, título) fica abaixo do limiar e é silêncio.

Uso:  python scripts/make_melody_image.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "exemplos"
COLS, ROWS = 48, 54                 # grade de análise do vision.js
W, H = 1920, 1080                   # imagem final (16:9, igual à tela)
CW, RH = W / COLS, H / ROWS         # largura de coluna e altura de linha em pixels
DEG_MAX = 20

# Escala maior em lá (grau 7 = lá3, 220 Hz): lá si dó# ré mi fá# sol#
NOTE = {"E3": 4, "F#3": 5, "G#3": 6, "A": 7, "B": 8, "C#": 9, "D": 10, "E": 11, "F#": 12, "G#": 13, "A'": 14}

MELODIES = {
    # Beethoven, 9ª Sinfonia (1824) — domínio público. Semínima = 2 colunas.
    "ode_a_alegria": ("Ode à Alegria · Beethoven", [
        ("C#", 2), ("C#", 2), ("D", 2), ("E", 2), ("E", 2), ("D", 2), ("C#", 2), ("B", 2),
        ("A", 2), ("A", 2), ("B", 2), ("C#", 2), ("C#", 3), ("B", 1), ("B", 4),
    ]),
    # Melodia tradicional francesa (séc. XVIII) — domínio público.
    "brilha_brilha_estrelinha": ("Brilha, Brilha, Estrelinha · tradicional", [
        ("A", 2), ("A", 2), ("E", 2), ("E", 2), ("F#", 2), ("F#", 2), ("E", 4),
        ("D", 2), ("D", 2), ("C#", 2), ("C#", 2), ("B", 2), ("B", 2), ("A", 4),
    ]),
}


def row_for(degree):
    return round((1 - degree / DEG_MAX) * (ROWS - 1))


def star(d, cx, cy, r, fill):
    """Estrela de 5 pontas."""
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)


def draw(name, title, melody):
    rnd = random.Random(name)
    img = Image.new("RGB", (W, H), (3, 6, 16))
    d = ImageDraw.Draw(img)
    # céu: estrelinhas de fundo MUITO apagadas (precisam ficar abaixo do limiar de nota)
    for _ in range(500):
        x, y, c = rnd.randrange(W), rnd.randrange(H), rnd.randrange(18, 30)
        d.point((x, y), fill=(c, c + 2, c + 10))
    # Terra escura no rodapé (lado noturno), com borda azul discreta
    R = 1500
    d.ellipse([W / 2 - R, H - 230, W / 2 + R, H - 230 + 2 * R], fill=(8, 18, 44))
    d.ellipse([W / 2 - R + 6, H - 224, W / 2 + R - 6, H - 224 + 2 * R], fill=(5, 11, 28))
    # posições das notas
    total = sum(n for _, n in melody)
    pos, col = [], (COLS - total) // 2                     # centraliza (silêncio curto antes)
    for note, length in melody:
        r = row_for(NOTE[note])
        pos.append(((col + 0.5) * CW, (r + 0.5) * RH))
        col += length
    if col > COLS:
        raise ValueError(f"{name}: {col} colunas (máximo {COLS})")
    # linhas da "constelação" ligando as notas (escuras: não tocam)
    d.line(pos, fill=(14, 24, 52), width=3)
    # brilho suave em volta de cada nota (camada desfocada, escura o bastante)
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for x, y in pos:
        gd.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(18, 26, 48))
    img = Image.fromarray(np.maximum(np.asarray(img), np.asarray(glow.filter(ImageFilter.GaussianBlur(10)))))
    d = ImageDraw.Draw(img)
    # as notas: estrelas brancas-azuladas (cor fria = timbre suave), do tamanho de uma célula
    for x, y in pos:
        # núcleo brilhante que cobre a célula inteira (garante a leitura em qualquer navegador)
        d.ellipse([x - CW * 0.45, y - RH * 0.45, x + CW * 0.45, y + RH * 0.45], fill=(225, 236, 255))
        star(d, x, y, RH * 1.05, (240, 247, 255))
    # título discreto (escuro: não toca)
    try:
        font = ImageFont.truetype("arial.ttf", 34)          # tem acentos (Windows)
    except OSError:
        font = ImageFont.load_default(size=34)
    d.text((40, 30), title, fill=(30, 36, 56), font=font)
    d.text((40, 72), "Earth Jukebox · abra e aperte Varrer (S)", fill=(24, 30, 48), font=font)
    OUT.mkdir(exist_ok=True)
    path = OUT / f"{name}.partitura.png"
    img.save(path, optimize=True)
    return path, col


def read_like_vision(path, method):
    """Leitura como o vision.js: reduz para 96x54, até 2 picos por coluna (>= 0,1, 6 linhas de distância)."""
    small = Image.open(path).convert("RGB").resize((96, 54), method)
    px = small.load()
    out = []
    for c in range(COLS):
        rows = []
        for y in range(54):
            a = 0.0
            for x in (2 * c, 2 * c + 1):
                r, g, b = (v / 255 for v in px[x, y])
                mx, mn = max(r, g, b), min(r, g, b)
                l = 0.2126 * r + 0.7152 * g + 0.0722 * b
                s = (mx - mn) / mx if mx else 0
                a += l * (0.4 + 0.6 * s)
            rows.append((a / 2, y))
        rows.sort(reverse=True)
        peaks = []
        for a, y in rows:
            if a < 0.1 or len(peaks) >= 2:
                break
            if all(abs(p - y) >= 6 for p in peaks):
                peaks.append(y)
        out += [round((1 - y / 53) * DEG_MAX) for y in peaks]
    return out


if __name__ == "__main__":
    names = {v: k for k, v in NOTE.items()}
    for old in OUT.glob("mary_had_a_little_lamb*.png"):     # exemplo antigo (pentatônico), substituído
        old.unlink()
    for name, (title, mel) in MELODIES.items():
        path, used = draw(name, title, mel)
        want = [NOTE[n] for n, _ in mel]
        for label, method in (("suave", Image.BILINEAR), ("seca", Image.NEAREST)):
            got = read_like_vision(path, method)
            ok = got == want
            print(f"{path.name:42s} redução {label:5s}: {'OK' if ok else 'DIFERENTE'}  "
                  + " ".join(names.get(g, str(g)) for g in got))
