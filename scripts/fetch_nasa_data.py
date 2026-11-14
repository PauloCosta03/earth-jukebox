"""Pipeline de dados do Earth Jukebox — somente fontes abertas da NASA.

Gera data/historical.js e data/projections.js a partir de:

  OBSERVAÇÕES
  - Temperatura ....... NASA GISS GISTEMP v4 (anomalia global anual, base 1951–1980)
  - CO2 ............... NASA GISS, concentrações globais usadas no ModelE (CMIP6), 1880–2014
  - Gelo do Ártico .... NASA GSFC Cryospheric Sciences Lab, extensão mensal (set.), 1979–2017
  - Nível do mar ...... NASA-SSH GMSL Indicator (PO.DAAC) — exige token Earthdata (gratuito)

  PROJEÇÕES (cenários SSP1-2.6, SSP2-4.5, SSP5-8.5)
  - CO2 ............... NASA GISS, arquivos GHG.CMIP6 por cenário (forçante do ModelE)
  - Temperatura ....... modelo climático da NASA GISS-E2.1-G (CMIP6, r1i1p1f2), média global de `tas`
  - Gelo do Ártico .... GISS-E2.1-G, extensão de setembro a partir de `siconca` (células >= 15%)
  - Nível do mar ...... modelo semi-empírico (Rahmstorf 2007) dirigido pela temperatura anual de cada
                        cenário e calibrado para atingir a mediana do NASA Sea Level Projection Tool
                        (IPCC AR6) em 2100 — dá uma série anual coerente com a temperatura do cenário

Uso:
    pip install -r scripts/requirements.txt     # netCDF4 + numpy (só para as projeções do modelo)
    python scripts/fetch_nasa_data.py

Opcional (nível do mar observado):
    set EARTHDATA_TOKEN=<token de https://urs.earthdata.nasa.gov>   (Windows)
    export EARTHDATA_TOKEN=<token>                                  (Linux/Mac)

Os arquivos do modelo (~350 MB) ficam em cache em data/cache/ e são baixados uma vez só.
Se uma fonte falhar, a série correspondente mantém os valores atuais e o motivo é impresso.
"""
import json
import math
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = DATA / "cache"
UA = {"User-Agent": "earth-jukebox-data-fetcher"}

SCENARIOS = {
    "ssp126": "SSP1-2.6 · Emissões baixas",
    "ssp245": "SSP2-4.5 · Emissões intermediárias",
    "ssp585": "SSP5-8.5 · Emissões muito altas",
}

URL = {
    "gistemp": "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
    "ghg_hist": "https://portal.nccs.nasa.gov/GISS_modelE/modelE_input_data/GHG.CMIP6.1-2014.txt",
    "ghg_ssp": "https://portal.nccs.nasa.gov/GISS_modelE/modelE_input_data/GHG.CMIP6.2015-2500.{ssp}.txt",
    "ice_gsfc": "https://earth.gsfc.nasa.gov/sites/default/files/neptune/files/NH_IceExt_Monthly_1978-2017.txt",
    "gmsl": "https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-protected/"
            "NASA_SSH_GMSL_INDICATOR/NASA_SSH_GMSL_INDICATOR.txt",
    "giss_model": "https://portal.nccs.nasa.gov/datashare/giss_cmip6/{mip}/NASA-GISS/GISS-E2-1-G/"
                  "{exp}/r1i1p1f2/{table}/{var}/gn/{ver}/{var}_{table}_GISS-E2-1-G_{exp}_r1i1p1f2_gn_{period}.nc",
}
# Medianas AR6 do nível do mar em 2100 (mm vs. 1993), do NASA Sea Level Projection Tool.
# ATENÇÃO: valores aproximados, ainda NÃO conferidos no arquivo oficial da ferramenta da NASA.
# Substituir pelos números exportados do NASA Sea Level Projection Tool (mediana global).
SEA_AR6_2100 = {"ssp126": 470, "ssp245": 590, "ssp585": 800}
SEA_RATE_NOW = 4.5   # mm/ano, taxa observada atual (altimetria por satélite)
MODEL_VER = {"historical": "v20190903", "ssp": "v20200115"}

# ---------------------------------------------------------------- utilidades


def get_text(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")


def download(url, dest):
    """Baixa para o cache (uma vez só)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    print(f"     baixando {dest.name} …", flush=True)
    req = urllib.request.Request(url, headers=UA)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.replace(dest)
    return dest


def load_js_object(path, var):
    """Lê um window.X = {...} gerado anteriormente (para manter séries em caso de falha)."""
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\." + var + r"\s*=\s*(\{.*\});", text, re.S)
    if not m:
        return {}
    raw = re.sub(r"//[^\n]*", "", m.group(1))
    raw = re.sub(r"([{,]\s*)([A-Za-z_]\w*|\d+)\s*:", r'\1"\2":', raw)
    raw = re.sub(r"(?<![\d\w])(-?)\.(\d)", r"\g<1>0.\2", raw)
    raw = re.sub(r",(\s*[}\]])", r"\1", raw)
    return json.loads(raw)


def keys_to_int(d):
    return {int(k): v for k, v in d.items()}


# ---------------------------------------------------------------- observações


def temp_gistemp():
    text = get_text(URL["gistemp"])
    lines = text.splitlines()[1:]  # 1ª linha é título
    header = lines[0].split(",")
    i = header.index("J-D")
    out = {}
    for line in lines[1:]:
        row = line.split(",")
        if row and row[0].isdigit() and "*" not in row[i]:
            out[int(row[0])] = round(float(row[i]), 2)
    return out


def parse_ghg(text):
    out = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0].isdigit():
            out[int(parts[0])] = round(float(parts[1]), 1)
    return out


def co2_hist():
    s = parse_ghg(get_text(URL["ghg_hist"]))
    return {y: v for y, v in s.items() if y >= 1880}


def co2_ssp(ssp):
    s = parse_ghg(get_text(URL["ghg_ssp"].format(ssp=ssp)))
    return {y: v for y, v in s.items() if 2014 <= y <= 2100}


def ice_gsfc():
    """Extensão de setembro (milhões de km²), coluna Total."""
    out = {}
    for line in get_text(URL["ice_gsfc"]).splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[0].isdigit() and parts[1] == "9":
            out[int(parts[0])] = round(int(parts[-1]) / 1e6, 2)
    return out


def sea_gmsl():
    """NASA-SSH GMSL (cm) -> média anual em mm, referência 1993 = 0. Exige EARTHDATA_TOKEN."""
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        raise RuntimeError("EARTHDATA_TOKEN não definido (conta gratuita em urs.earthdata.nasa.gov)")
    text = get_text(URL["gmsl"], {"Authorization": f"Bearer {token}"})
    by_year = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 2 or line.lstrip().startswith(("#", "HDR")):
            continue
        try:
            t, v = float(parts[0]), float(parts[1])
        except ValueError:
            continue
        if 1990 < t < 2100:
            by_year.setdefault(int(t), []).append(v * 10)  # cm -> mm
    annual = {y: sum(v) / len(v) for y, v in by_year.items() if len(v) >= 6}
    if 1993 not in annual:
        raise RuntimeError("formato inesperado no arquivo GMSL")
    ref = annual[1993]
    return {y: round(v - ref) for y, v in sorted(annual.items())}


# ---------------------------------------------------------------- modelo GISS-E2.1-G


def model_file(exp, table, var, period):
    is_hist = exp == "historical"
    url = URL["giss_model"].format(
        mip="CMIP" if is_hist else "ScenarioMIP", exp=exp, table=table, var=var,
        ver=MODEL_VER["historical" if is_hist else "ssp"], period=period)
    return download(url, CACHE / "giss" / Path(url).name)


def band_areas(ds, np):
    """Área (km²) de cada faixa de latitude da grade regular, a partir de lat_bnds."""
    lb = np.radians(ds.variables["lat_bnds"][:])
    nlon = len(ds.variables["lon"][:])
    R = 6371.0
    return 2 * math.pi * R * R * np.abs(np.sin(lb[:, 1]) - np.sin(lb[:, 0])) / nlon, nlon


def model_series(exp, periods, reducer):
    """Aplica reducer(campo_mensal[t, lat, lon], área_por_lat, lat) e devolve {ano: valor}."""
    import numpy as np
    from netCDF4 import Dataset
    out = {}
    for var, table, period in periods:
        path = model_file(exp, table, var, period)
        with Dataset(path) as ds:
            area, _ = band_areas(ds, np)
            lat = ds.variables["lat"][:]
            field = np.ma.filled(ds.variables[var][:].astype("f8"), np.nan)
            y0 = int(period[:4])
            for i in range(field.shape[0] // 12):
                v = reducer(field[i * 12:(i + 1) * 12], area, lat, np)
                if v is not None:
                    out[y0 + i] = v
    return out


def gmean_annual(block, area, lat, np):
    w = area[:, None] * np.ones(block.shape[2])[None, :]
    return float(np.nansum(block.mean(axis=0) * w) / np.nansum(w))


def arctic_sept_extent(block, area, lat, np):
    sept = block[8]                                    # setembro
    mask = (sept >= 15.0) & (lat[:, None] > 0)
    a = area[:, None] * np.ones(sept.shape[1])[None, :]
    return float((a * mask).sum() / 1e6)               # milhões de km²


def model_projections(temp_obs, ice_obs):
    hist_p = lambda v, t: [(v, t, "195101-200012"), (v, t, "200101-201412")]
    ssp_p = lambda v, t: [(v, t, "201501-205012"), (v, t, "205101-210012")]

    # Temperatura: anomalia vs. 1951–1980 do próprio modelo (mesma base do GISTEMP),
    # ancorada para que a média 2015–2024 do modelo coincida com a observada.
    th = model_series("historical", hist_p("tas", "Amon"), gmean_annual)
    base = sum(th[y] for y in range(1951, 1981)) / 30
    ice_h = model_series("historical", hist_p("siconca", "SImon"), arctic_sept_extent)
    overlap = range(1979, 2015)
    ice_ratio = sum(ice_obs[y] for y in overlap) / sum(ice_h[y] for y in overlap)

    temp, ice, notes = {}, {}, {}
    for ssp in SCENARIOS:
        ts = model_series(ssp, ssp_p("tas", "Amon"), gmean_annual)
        anom = {y: v - base for y, v in ts.items()}
        shift = (sum(temp_obs[y] for y in range(2015, 2025)) - sum(anom[y] for y in range(2015, 2025))) / 10
        temp[ssp] = {y: round(v + shift, 2) for y, v in anom.items() if y <= 2100}
        si = model_series(ssp, ssp_p("siconca", "SImon"), arctic_sept_extent)
        ice[ssp] = {y: round(max(0.0, v * ice_ratio), 2) for y, v in si.items() if y <= 2100}
        notes[ssp] = round(shift, 3)
    return temp, ice, {"temp_anchor_shift_C": notes, "ice_bias_ratio": round(ice_ratio, 3)}


def sea_projection(temp, sea_obs, anchor_2100):
    """Série anual de nível do mar (mm vs. 1993) para um cenário.

    dH/dt = r0 + a * (T(t) - T0): a taxa atual mais um termo proporcional ao aquecimento adicional.
    `a` é resolvido para que H(2100) coincida com a mediana AR6 (`anchor_2100`).
    """
    y0 = max(y for y in sea_obs if y in temp)             # último ano com nível do mar observado
    t0 = temp[y0]
    years = range(y0 + 1, 2101)
    d_temp = sum(temp[y] - t0 for y in years)
    need = anchor_2100 - sea_obs[y0] - SEA_RATE_NOW * len(years)
    a = need / d_temp if abs(d_temp) > 1e-6 else 0.0
    out, h = {y0: sea_obs[y0]}, float(sea_obs[y0])
    for y in years:
        h += max(0.0, SEA_RATE_NOW + a * (temp[y] - t0))   # o mar não desce neste horizonte
        out[y] = round(h)
    return out


# ---------------------------------------------------------------- escrita


def fmt_series(d):
    return "{" + ",".join(f"{y}:{v}" for y, v in sorted(d.items())) + "}"


def write_historical(h, sources):
    lines = ["// GERADO por scripts/fetch_nasa_data.py — não edite à mão.",
             "// Cada série termina no último ano observado; depois disso o app usa data/projections.js.",
             "window.EJ_HISTORICAL = {",
             f"  source: {json.dumps(sources['summary'], ensure_ascii=False)},"]
    for k in ("temp", "co2", "ice", "sea"):
        lines.append(f"  // {sources[k]}")
        lines.append(f"  {k}: {fmt_series(h[k])},")
    lines.append("};")
    (DATA / "historical.js").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_projections(p, sources):
    lines = ["// GERADO por scripts/fetch_nasa_data.py — não edite à mão.",
             "window.EJ_PROJECTIONS = {"]
    for ssp, label in SCENARIOS.items():
        lines.append(f"  {ssp}: {{")
        lines.append(f"    label: {json.dumps(label, ensure_ascii=False)},")
        for k in ("temp", "co2", "ice", "sea"):
            if not p[ssp].get(k):
                print(f"AVISO: {ssp}/{k} sem dados — série omitida (o app precisa dela!)")
                continue
            lines.append(f"    // {sources[k]}")
            lines.append(f"    {k}: {fmt_series(p[ssp][k])},")
        lines.append("  },")
    lines.append("};")
    (DATA / "projections.js").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    old_h = {k: keys_to_int(v) for k, v in load_js_object(DATA / "historical.js", "EJ_HISTORICAL").items()
             if isinstance(v, dict)}
    old_p = load_js_object(DATA / "projections.js", "EJ_PROJECTIONS")
    old_p = {s: {k: keys_to_int(v) for k, v in d.items() if isinstance(v, dict)} for s, d in old_p.items()}

    h = dict(old_h)
    p = {s: dict(old_p.get(s, {})) for s in SCENARIOS}
    hs = {"temp": "?", "co2": "?", "ice": "?", "sea": "?"}
    ps = {"temp": "?", "co2": "?", "ice": "?", "sea": "?"}
    meta = {}

    def step(name, fn):
        try:
            fn()
            print(f"OK    {name}")
        except Exception as e:  # noqa: BLE001
            print(f"FALHA {name}: {e} — mantendo valores atuais")

    def do_temp():
        h["temp"] = temp_gistemp(); hs["temp"] = "NASA GISS GISTEMP v4, °C vs. 1951–1980"
    def do_co2():
        h["co2"] = co2_hist(); hs["co2"] = "NASA GISS, CO2 global (ppm) usado no ModelE/CMIP6"
        for s in SCENARIOS:
            p[s]["co2"] = co2_ssp(s)
        ps["co2"] = "NASA GISS, GHG.CMIP6 por cenário (ppm)"
    def do_ice():
        h["ice"] = ice_gsfc(); hs["ice"] = "NASA GSFC, extensão de setembro (mi km²), 1979–2017"
    def do_sea():
        h["sea"] = sea_gmsl(); hs["sea"] = "NASA-SSH GMSL Indicator (PO.DAAC), mm vs. 1993"
    def do_model():
        try:
            import netCDF4, numpy  # noqa: F401,E401
        except ImportError:
            raise RuntimeError("instale as dependências: pip install -r scripts/requirements.txt")
        temp, ice, m = model_projections(h["temp"], h["ice"])
        for s in SCENARIOS:
            p[s]["temp"] = temp[s]; p[s]["ice"] = ice[s]
        ps["temp"] = "NASA GISS-E2.1-G (CMIP6), média global de tas; ancorado à média GISTEMP 2015–2024"
        ps["ice"] = "NASA GISS-E2.1-G (CMIP6), extensão de setembro (siconca >= 15%); bias corrigido vs. GSFC 1979–2014"
        meta.update(m)

    def do_sea_proj():
        if not h.get("sea"):
            raise RuntimeError("sem nível do mar observado")
        for s_ in SCENARIOS:
            if not p[s_].get("temp"):
                raise RuntimeError(f"sem temperatura projetada para {s_}")
            p[s_]["sea"] = sea_projection(p[s_]["temp"], h["sea"], SEA_AR6_2100[s_])
        ps["sea"] = "Semi-empírico (Rahmstorf 2007) dirigido pela temperatura GISS; calibração de 2100 PENDENTE (valores AR6 aproximados)"

    step("temperatura observada (GISTEMP)", do_temp)
    step("CO2 observado + cenários (GISS)", do_co2)
    step("gelo do Ártico observado (GSFC)", do_ice)
    step("nível do mar observado (NASA-SSH)", do_sea)
    step("projeções de temperatura e gelo (modelo GISS-E2.1-G)", do_model)
    step("projeção do nível do mar (semi-empírico + AR6)", do_sea_proj)

    for k in hs:
        if hs[k] == "?":
            hs[k] = "PENDENTE — valores anteriores mantidos (ver README, seção Dados)"
        if ps[k] == "?":
            ps[k] = "PENDENTE — valores anteriores mantidos (ver README, seção Dados)"
    hs["summary"] = "Somente dados abertos da NASA — ver README, seção Dados"
    write_historical(h, hs)
    write_projections(p, ps)
    (DATA / "provenance.json").write_text(json.dumps(
        {"historical": hs, "projections": ps, "adjustments": meta,
         "last_observed_year": {k: max(v) for k, v in h.items() if v}},
        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\nEscrito: data/historical.js, data/projections.js, data/provenance.json")
    if meta:
        print("Ajustes:", json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
