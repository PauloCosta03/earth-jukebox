"""Baixa os dados oficiais e regenera data/historical.js.

Uso:  python scripts/fetch_nasa_data.py
Requer apenas a biblioteca padrão do Python 3.8+.
Se uma fonte falhar, mantém os valores embutidos para aquela série.
"""
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "historical.js"
UA = {"User-Agent": "earth-jukebox-data-fetcher"}

SOURCES = {
    # NASA GISTEMP v4 — média global anual (coluna J-D), °C vs. 1951–1980
    "temp": "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
    # NOAA Mauna Loa — CO2 médio anual (ppm)
    "co2": "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv",
    # NSIDC Sea Ice Index v3 — extensão mensal de setembro, Ártico
    "ice": "https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v3.0.csv",
}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_temp(text):
    rows = csv.reader(io.StringIO(text.split("\n", 1)[1]))  # pula a 1ª linha (título)
    header = next(rows)
    i = header.index("J-D")
    out = {}
    for row in rows:
        if row and row[0].isdigit() and row[i] not in ("***", ""):
            out[int(row[0])] = round(float(row[i]), 2)
    return out


def parse_co2(text):
    out = {}
    for line in text.splitlines():
        parts = line.split(",")
        if parts and parts[0].strip().isdigit():
            out[int(parts[0])] = round(float(parts[1]), 1)
    return out


def parse_ice(text):
    out = {}
    for line in text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if parts and parts[0].isdigit() and float(parts[4]) > 0:
            out[int(parts[0])] = round(float(parts[4]), 2)
    return out


PARSERS = {"temp": parse_temp, "co2": parse_co2, "ice": parse_ice}


def load_existing():
    text = OUT.read_text(encoding="utf-8")
    data = {}
    for key in ("temp", "co2", "ice", "sea"):
        m = re.search(key + r":\s*(\{[^}]*\})", text)
        raw = re.sub(r"(\d+):", r'"\1":', m.group(1))
        raw = re.sub(r"(?<![\d])\.(\d)", r"0.\1", raw)
        data[key] = {int(k): v for k, v in json.loads(raw).items()}
    return data


def main():
    data = load_existing()
    for key, url in SOURCES.items():
        try:
            series = PARSERS[key](get(url))
            if key == "co2":  # antes de 1959 mantém núcleos de gelo
                series = {**{y: v for y, v in data["co2"].items() if y < min(series)}, **series}
            data[key] = series
            print(f"OK   {key}: {len(series)} anos ({min(series)}–{max(series)})")
        except Exception as e:  # noqa: BLE001
            print(f"FALHA {key}: {e} — mantendo valores embutidos")
    # Nível do mar: a série da NASA (PO.DAAC) exige login Earthdata; mantemos os pontos-chave.
    lines = [
        "// Gerado por scripts/fetch_nasa_data.py",
        "window.EJ_HISTORICAL = {",
        '  source: "NASA GISTEMP v4, NOAA Mauna Loa, NSIDC Sea Ice Index, NASA sea level",',
    ]
    for key in ("temp", "co2", "ice", "sea"):
        body = ",".join(f"{y}:{v}" for y, v in sorted(data[key].items()))
        lines.append(f"  {key}: {{{body}}},")
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Escrito: {OUT}")


if __name__ == "__main__":
    main()
