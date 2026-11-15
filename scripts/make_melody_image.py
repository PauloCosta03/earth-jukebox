"""Gera uma imagem que TOCA uma melodia quando é varrida no Earth Jukebox (botão Varrer / tecla S).

Como a varredura do js/vision.js lê a imagem:
  - a imagem é reduzida para 96x54 e dividida em 48 colunas (6 segundos -> 0,125 s por coluna);
  - em cada coluna, o ponto claro vira uma nota: quanto mais ALTO na imagem, mais AGUDA;
    grau da escala = round((1 - linha/53) * 14);
  - fundo escuro e azulado = silêncio e escala pentatônica maior (lá, si, dó#, mi, fá#).

Melodias aqui são de domínio público. Uso:
    python scripts/make_melody_image.py
Saída: exemplos/*.png  (abra em Instrumentos -> Abrir imagem ou vídeo e aperte Varrer)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "exemplos"
COLS, ROWS = 48, 54                 # grade de análise do vision.js (96x54 px, 2 px por coluna)
CELL = 20                           # cada célula da grade vira 20x20 px -> imagem 1920x1080
DEG_MAX = 14                        # 5 notas x 3 oitavas - 1

# Pentatônica maior em lá: graus 0..4 = lá, si, dó#, mi, fá# (a cada 5 graus, uma oitava acima)
NOTE = {"A": 5, "B": 6, "C#": 7, "E": 8, "F#": 9, "A'": 10, "B'": 11}

MELODIES = {
    # Mary Had a Little Lamb (tradicional, domínio público), em lá maior.
    # (nota, duração em colunas): semínima = 2 colunas, mínima = 4 colunas
    "mary_had_a_little_lamb": [
        ("C#", 2), ("B", 2), ("A", 2), ("B", 2), ("C#", 2), ("C#", 2), ("C#", 4),
        ("B", 2), ("B", 2), ("B", 4),
        ("C#", 2), ("E", 2), ("E", 4),
        ("C#", 2), ("B", 2), ("A", 2), ("B", 2), ("C#", 2), ("C#", 2), ("C#", 2), ("C#", 2),
    ],
}


def row_for(degree):
    """Linha (0 = topo) que o vision.js converte de volta no grau desejado."""
    return round((1 - degree / DEG_MAX) * (ROWS - 1))


def draw(name, melody):
    W = COLS * CELL
    img = Image.new("RGB", (W, ROWS * CELL), (8, 16, 38))      # azul-noite = silêncio
    d = ImageDraw.Draw(img)
    # linhas-guia discretas (só decoração; escuras demais para virar nota)
    for deg in range(0, DEG_MAX + 1):
        y = row_for(deg) * CELL + CELL // 2
        d.line([(0, y), (W, y)], fill=(16, 30, 62), width=1)
    col = 0
    for note, length in melody:
        r = row_for(NOTE[note])
        # nota = 1 coluna acesa; o resto da duração fica escuro (separa notas repetidas)
        x0, y0 = col * CELL, r * CELL
        d.rounded_rectangle([x0 + 2, y0 + 2, x0 + CELL - 2, y0 + CELL - 2], radius=5, fill=(245, 250, 255))
        col += length
    if col > COLS:
        raise ValueError(f"{name}: {col} colunas (máximo {COLS})")
    OUT.mkdir(exist_ok=True)
    path = OUT / f"{name}.png"
    img.save(path, optimize=True)
    return path, col


def verify(path):
    """Refaz a leitura como o vision.js (reduz para 96x54 e acha o ponto claro de cada coluna)."""
    small = Image.open(path).convert("RGB").resize((96, 54), Image.BILINEAR)
    px = small.load()
    seq = []
    for c in range(COLS):
        best, best_row = 0.0, None
        for y in range(54):
            for x in (2 * c, 2 * c + 1):
                r, g, b = (v / 255 for v in px[x, y])
                l = 0.2126 * r + 0.7152 * g + 0.0722 * b
                s = (max(r, g, b) - min(r, g, b)) / max(r, g, b) if max(r, g, b) else 0
                sal = l * (0.4 + 0.6 * s)
                if sal > best:
                    best, best_row = sal, y
        if best >= 0.1:
            seq.append((c, round((1 - best_row / 53) * DEG_MAX)))
    return seq


if __name__ == "__main__":
    names = {v: k for k, v in NOTE.items()}
    for name, mel in MELODIES.items():
        path, used = draw(name, mel)
        got = verify(path)
        want = [NOTE[n] for n, _ in mel]
        ok = [g for _, g in got] == want
        print(f"{path.relative_to(ROOT)}  ({used}/{COLS} colunas)  leitura {'OK' if ok else 'DIFERENTE'}:",
              " ".join(names.get(g, str(g)) for _, g in got))
