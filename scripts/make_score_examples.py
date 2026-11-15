"""Gera partituras de exemplo (domínio público) para testar 🎼 Abrir partitura:

  exemplos/ode_a_alegria.musicxml   — MusicXML (formato padrão de partitura digital)
  exemplos/ode_a_alegria.mid        — MIDI
  exemplos/ode_a_alegria_partitura_impressa.png — imagem de partitura (pauta + notas) p/ a leitura óptica

Melodia: Beethoven, 9ª Sinfonia (1824). Uso: python scripts/make_score_examples.py
"""
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "exemplos"

# (nota, oitava, duração em semínimas) — em dó maior, clave de sol
ODE = [("E", 4, 1), ("E", 4, 1), ("F", 4, 1), ("G", 4, 1), ("G", 4, 1), ("F", 4, 1), ("E", 4, 1), ("D", 4, 1),
       ("C", 4, 1), ("C", 4, 1), ("D", 4, 1), ("E", 4, 1), ("E", 4, 1.5), ("D", 4, 0.5), ("D", 4, 2),
       ("E", 4, 1), ("E", 4, 1), ("F", 4, 1), ("G", 4, 1), ("G", 4, 1), ("F", 4, 1), ("E", 4, 1), ("D", 4, 1),
       ("C", 4, 1), ("C", 4, 1), ("D", 4, 1), ("E", 4, 1), ("D", 4, 1.5), ("C", 4, 0.5), ("C", 4, 2)]
STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
TYPES = {0.5: "eighth", 1: "quarter", 1.5: "quarter", 2: "half"}
TEMPO = 110


def musicxml():
    div = 2
    measures, cur, beats = [], [], 0
    for step, octv, d in ODE:
        dot = "<dot/>" if d == 1.5 else ""
        cur.append(f"<note><pitch><step>{step}</step><octave>{octv}</octave></pitch>"
                   f"<duration>{int(d * div)}</duration><type>{TYPES[d]}</type>{dot}</note>")
        beats += d
        if beats >= 4:
            measures.append(cur); cur, beats = [], 0
    body = []
    for i, m in enumerate(measures, 1):
        attrs = ("<attributes><divisions>2</divisions><key><fifths>0</fifths></key>"
                 "<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>"
                 f"<direction><sound tempo=\"{TEMPO}\"/></direction>") if i == 1 else ""
        body.append(f'<measure number="{i}">{attrs}{"".join(m)}</measure>')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<score-partwise version="3.1"><work><work-title>Ode à Alegria</work-title></work>'
           '<part-list><score-part id="P1"><part-name>Melodia</part-name></score-part></part-list>'
           f'<part id="P1">{"".join(body)}</part></score-partwise>\n')
    (OUT / "ode_a_alegria.musicxml").write_text(xml, encoding="utf-8")


def midi():
    tpq = 480
    def vlq(n):
        out = [n & 0x7F]
        while n > 127:
            n >>= 7; out.insert(0, (n & 0x7F) | 0x80)
        return bytes(out)
    ev = bytearray(b"\x00\xff\x51\x03" + (60_000_000 // TEMPO).to_bytes(3, "big"))
    for step, octv, d in ODE:
        n = 12 * (octv + 1) + STEP[step]
        ev += vlq(0) + bytes([0x90, n, 90]) + vlq(int(d * tpq)) + bytes([0x80, n, 0])
    ev += b"\x00\xff\x2f\x00"
    data = b"MThd" + struct.pack(">IHHH", 6, 0, 1, tpq) + b"MTrk" + struct.pack(">I", len(ev)) + ev
    (OUT / "ode_a_alegria.mid").write_bytes(data)


def image():
    """Partitura impressa simples: 2 pautas, clave de sol estilizada, cabeças de nota cheias com haste."""
    W, H, s = 1600, 700, 18                                  # s = espaço entre linhas da pauta
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 30)
        clef = ImageFont.truetype("seguisym.ttf", int(s * 7))
    except OSError:
        font = clef = ImageFont.load_default()
    d.text((W / 2 - 160, 25), "Ode à Alegria — Beethoven", fill="black", font=font)
    half = len(ODE) // 2
    for row, part in enumerate((ODE[:half], ODE[half:])):
        top = 150 + row * 260
        for k in range(5):
            d.line([(60, top + k * s), (W - 60, top + k * s)], fill="black", width=2)
        d.text((70, top - s * 2.6), "\U0001D11E", fill="black", font=clef)   # 𝄞 (clave de sol)
        x = 220
        for step, octv, dur in part:
            diat = "CDEFGAB".index(step) + 7 * (octv - 4)    # 0 = dó4
            y = top + 4 * s - (diat - 2) * s / 2              # linha de baixo = mi4
            d.ellipse([x - s * 0.65, y - s * 0.5, x + s * 0.65, y + s * 0.5], fill="black")
            d.line([(x + s * 0.6, y), (x + s * 0.6, y - s * 3.4)], fill="black", width=3)   # haste
            if diat <= 0:                                     # dó4: linha suplementar
                d.line([(x - s, y), (x + s, y)], fill="black", width=2)
            x += 85 * (0.7 + 0.3 * dur)
    img.save(OUT / "ode_a_alegria_partitura_impressa.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    musicxml(); midi(); image()
    print("gerados em exemplos/: ode_a_alegria.musicxml, ode_a_alegria.mid, ode_a_alegria_partitura_impressa.png")
