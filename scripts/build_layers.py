"""Gera as texturas das camadas visuais do globo — somente dados abertos da NASA.

Saídas:
  assets/layers/clouds.png   nuvens (VIIRS cor real, NASA GIBS)               — imagem única
  assets/layers/temp.png     atlas de anomalia de temperatura por ano          — GISTEMP + GISS-E2.1-G
  assets/layers/ndvi.png     atlas de vegetação (NDVI médio anual)             — MODIS Terra, NASA GIBS
  assets/layers/fire.png     atlas de focos de queimada por ano                — MODIS Thermal Anomalies, GIBS
  assets/layers/wind.png     atlas de vento médio por década (u=R, v=G)        — GISS-E2.1-G uas/vas
  data/layers.js             metadados (onde está cada ano dentro de cada atlas)

Um "atlas" é uma imagem grande feita de vários quadros pequenos lado a lado — um por ano
(ou década). O shader escolhe o quadro do ano atual.

Uso:
    .venv\\Scripts\\pip install -r scripts/requirements.txt
    .venv\\Scripts\\python scripts/build_layers.py            (todas as camadas)
    .venv\\Scripts\\python scripts/build_layers.py clouds temp (só algumas)

Downloads ficam em cache em data/cache/ (~1 GB na primeira vez).
"""
import gzip
import json
import math
import shutil
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from netCDF4 import Dataset
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"
OUT = ROOT / "assets" / "layers"
META = ROOT / "data" / "layers.js"
UA = {"User-Agent": "earth-jukebox-data-fetcher"}
SCENARIOS = ["ssp126", "ssp245", "ssp585"]

GIBS_WMS = ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
            "&VERSION=1.3.0&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH={w}&HEIGHT={h}"
            "&FORMAT={fmt}&TRANSPARENT=TRUE&LAYERS={layer}&TIME={time}")
GISTEMP = "https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz"
GISS = ("https://portal.nccs.nasa.gov/datashare/giss_cmip6/{mip}/NASA-GISS/GISS-E2-1-G/{exp}/r1i1p1f2/"
        "{table}/{var}/gn/{ver}/{var}_{table}_GISS-E2-1-G_{exp}_r1i1p1f2_gn_{period}.nc")

# ------------------------------------------------------------------ utilidades


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    tmp.replace(dest)
    return dest


def download_many(jobs, label):
    """jobs = [(url, dest)], baixa em paralelo e mostra progresso."""
    todo = [j for j in jobs if not (j[1].exists() and j[1].stat().st_size > 0)]
    print(f"  {label}: {len(jobs) - len(todo)} em cache, baixando {len(todo)} …", flush=True)
    done = 0
    with ThreadPoolExecutor(8) as ex:
        for _ in ex.map(lambda j: download(*j), todo):
            done += 1
            if done % 50 == 0:
                print(f"    {done}/{len(todo)}", flush=True)


def giss_file(exp, var, period):
    hist = exp == "historical"
    url = GISS.format(mip="CMIP" if hist else "ScenarioMIP", exp=exp, table="Amon", var=var,
                      ver="v20190903" if hist else "v20200115", period=period)
    return download(url, CACHE / "giss" / Path(url).name)


def giss_annual(exp, var, periods):
    """{ano: campo anual [lat, lon]} com longitude reordenada para -180..180 e norte no topo."""
    out = {}
    for period in periods:
        with Dataset(giss_file(exp, var, period)) as ds:
            f = np.ma.filled(ds.variables[var][:].astype("f4"), np.nan)
            lon = ds.variables["lon"][:]
        shift = int(np.argmin(np.abs(((lon + 180) % 360) - 180 - (-180 + (lon[1] - lon[0]) / 2))))
        f = np.roll(f, -shift, axis=2)[:, ::-1, :]
        y0 = int(period[:4])
        for i in range(f.shape[0] // 12):
            out[y0 + i] = np.nanmean(f[i * 12:(i + 1) * 12], axis=0)
    return out


def running_mean(frames, years, n=5):
    h = n // 2
    return {y: np.nanmean([frames[k] for k in range(y - h, y + h + 1) if k in frames], axis=0) for y in years}


def write_atlas(name, frames, mode, cols):
    """frames = lista de arrays HxW (L) ou HxWxC; devolve info do atlas."""
    h, w = frames[0].shape[:2]
    rows = math.ceil(len(frames) / cols)
    shape = (rows * h, cols * w) + frames[0].shape[2:]
    atlas = np.zeros(shape, dtype=np.uint8)
    for i, fr in enumerate(frames):
        r, c = divmod(i, cols)
        atlas[r * h:(r + 1) * h, c * w:(c + 1) * w] = fr
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas, mode).save(OUT / f"{name}.png", optimize=True)
    print(f"  -> assets/layers/{name}.png  {atlas.shape[1]}x{atlas.shape[0]}  ({len(frames)} quadros)")
    return {"atlas": f"assets/layers/{name}.png", "cols": cols, "rows": rows, "frameW": w, "frameH": h}


def encode(field, lo, hi):
    """valor -> 1..255 (0 = sem dado)."""
    v = np.clip((field - lo) / (hi - lo), 0, 1) * 254 + 1
    return np.where(np.isnan(field), 0, v).astype(np.uint8)


# ------------------------------------------------------------------ camadas


def build_clouds():
    print("☁️  nuvens (VIIRS cor real, equinócio 2024-03-20)")
    imgs = []
    for layer in ("VIIRS_SNPP_CorrectedReflectance_TrueColor", "VIIRS_NOAA20_CorrectedReflectance_TrueColor"):
        dest = CACHE / "gibs" / f"{layer}_2024-03-20.jpg"
        download(GIBS_WMS.format(w=4096, h=2048, fmt="image/jpeg", layer=layer, time="2024-03-20"), dest)
        imgs.append(np.asarray(Image.open(dest).convert("RGB")).astype("f4") / 255)
    # Superfície sem nuvens (Blue Marble): o que já é claro nela (gelo, neve, deserto) não é nuvem.
    bm = Image.open(ROOT / "assets" / "textures" / "earth-day.jpg").convert("RGB").resize((4096, 2048))
    surface = np.asarray(bm).astype("f4").min(axis=2) / 255
    clouds = []
    for rgb in imgs:
        mx, mn = rgb.max(axis=2), rgb.min(axis=2)
        valid = mx > 0.03                                    # preto = sem passagem do satélite
        sat = (mx - mn) / np.maximum(mx, 1e-3)
        brighter = mn - surface                              # quanto ficou mais claro que o chão
        cloud = np.clip((brighter - 0.10) / 0.45, 0, 1) * np.clip(1 - sat * 2.2, 0, 1)
        clouds.append(np.where(valid, cloud, np.nan))
    # Nos dois satélites ao mesmo tempo: o mínimo remove o reflexo do sol (muda de lugar entre eles)
    a, b = clouds
    best = np.where(np.isnan(a), b, np.where(np.isnan(b), a, np.fmin(a, b)))
    alpha = (np.nan_to_num(best) ** 0.9 * 255).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(alpha, "L").save(OUT / "clouds.png", optimize=True)
    print("  -> assets/layers/clouds.png 4096x2048")
    return {"image": "assets/layers/clouds.png", "date": "2024-03-20",
            "source": "NASA GIBS — VIIRS SNPP + NOAA-20 Corrected Reflectance (cor real)"}


def build_temp():
    print("🌡️  mapa de anomalia de temperatura (GISTEMP 1880–2025 + GISS-E2.1-G 2026–2100)")
    gz = download(GISTEMP, CACHE / "gistemp" / "gistemp1200_GHCNv4_ERSSTv5.nc.gz")
    nc = gz.with_suffix("")
    if not nc.exists():
        with gzip.open(gz) as src, open(nc, "wb") as dst:
            shutil.copyfileobj(src, dst)
    with Dataset(nc) as ds:
        t = np.ma.filled(ds.variables["tempanomaly"][:].astype("f4"), np.nan)[:, ::-1, :]  # norte no topo
    obs = {}
    for i in range(t.shape[0] // 12):
        blk = t[i * 12:(i + 1) * 12]
        cnt = np.sum(~np.isnan(blk), axis=0)
        with np.errstate(all="ignore"):
            obs[1880 + i] = np.where(cnt >= 9, np.nanmean(blk, axis=0), np.nan)
    last_obs = max(y for y, f in obs.items() if np.isfinite(f).mean() > 0.5)
    obs_years = list(range(1880, last_obs + 1))
    obs_s = running_mean(obs, obs_years)

    # modelo: anomalia por célula vs. 1951–1980 do próprio modelo, regradeada para 180 longitudes
    hist = giss_annual("historical", "tas", ["195101-200012"])
    base = np.mean([hist[y] for y in range(1951, 1981)], axis=0)
    def regrid(f):                                              # 90x144 -> 90x180
        src = np.linspace(-180, 180, f.shape[1], endpoint=False) + 180 / f.shape[1]
        dst = np.linspace(-179, 179, 180)
        return np.stack([np.interp(dst, src, row, period=360) for row in f])
    frames, meta_frames = [encode(obs_s[y], -6, 12) for y in obs_years], {"hist": [obs_years[0], last_obs, 0, 1]}
    for ssp in SCENARIOS:
        fut = giss_annual(ssp, "tas", ["201501-205012", "205101-210012"])
        anom = {y: regrid(f - base) for y, f in fut.items()}
        years = list(range(last_obs + 1, 2101))
        sm = running_mean(anom, years)
        meta_frames[ssp] = [years[0], years[-1], len(frames), 1]
        frames += [encode(sm[y], -6, 12) for y in years]
    info = write_atlas("temp", frames, "L", 16)
    return {**info, "frames": meta_frames, "range": [-6, 12], "smoothing": "média móvel de 5 anos",
            "source": "NASA GISTEMP v4 (1200 km) até %d; modelo NASA GISS-E2.1-G depois" % last_obs}


def build_ndvi():
    print("🌿  vegetação (MODIS Terra NDVI mensal, 2001–2025)")
    years = list(range(2001, 2026))
    jobs = []
    for y in years:
        for m in range(1, 13):
            t = f"{y}-{m:02d}-01"
            jobs.append((GIBS_WMS.format(w=720, h=360, fmt="image/png", layer="MODIS_Terra_L3_NDVI_Monthly", time=t),
                         CACHE / "gibs" / "ndvi" / f"{t}.png"))
    download_many(jobs, "NDVI")
    frames = []
    for y in years:
        acc, cnt = np.zeros((360, 720, 3), "f4"), np.zeros((360, 720), "f4")
        for m in range(1, 13):
            im = np.asarray(Image.open(CACHE / "gibs" / "ndvi" / f"{y}-{m:02d}-01.png").convert("RGBA")).astype("f4")
            ok = im[..., 3] > 0
            acc[ok] += im[..., :3][ok]
            cnt += ok
        rgb = acc / np.maximum(cnt, 1)[..., None]
        a = np.where(cnt > 0, 255, 0)
        frames.append(np.dstack([rgb, a]).astype(np.uint8))
    info = write_atlas("ndvi", frames, "RGBA", 5)
    return {**info, "frames": {"hist": [years[0], years[-1], 0, 1]},
            "source": "NASA GIBS — MODIS Terra L3 NDVI mensal (média anual)"}


def build_fire():
    print("🔥  queimadas (MODIS Thermal Anomalies, a cada 8 dias, 2001–2025)")
    import datetime as dt
    years = list(range(2001, 2026))
    jobs, by_year = [], {y: [] for y in years}
    for y in years:
        d = dt.date(y, 1, 1)
        while d.year == y:
            dest = CACHE / "gibs" / "fire" / f"{d}.png"
            jobs.append((GIBS_WMS.format(w=720, h=360, fmt="image/png",
                                         layer="MODIS_Combined_Thermal_Anomalies_All", time=d), dest))
            by_year[y].append(dest)
            d += dt.timedelta(days=8)
    download_many(jobs, "queimadas")
    counts = []
    for y in years:
        c = np.zeros((360, 720), "f4")
        for p in by_year[y]:
            c += np.asarray(Image.open(p).convert("RGBA"))[..., 3] > 0
        counts.append(c / len(by_year[y]))                      # fração dos dias amostrados com fogo
    frames = [(np.clip(np.sqrt(c / 0.35), 0, 1) * 255).astype(np.uint8) for c in counts]
    info = write_atlas("fire", frames, "L", 5)
    return {**info, "frames": {"hist": [years[0], years[-1], 0, 1]},
            "source": "NASA GIBS — MODIS Terra+Aqua Thermal Anomalies (amostra a cada 8 dias)"}


def build_wind():
    print("🌬️  ventos (GISS-E2.1-G uas/vas, média por década)")
    hp = ["185001-190012", "190101-195012", "195101-200012", "200101-201412"]
    sp = ["201501-205012", "205101-210012"]
    hu, hv = giss_annual("historical", "uas", hp), giss_annual("historical", "vas", hp)
    def dec(u, v, d):
        ys = [y for y in range(d, d + 10) if y in u]
        return np.mean([u[y] for y in ys], axis=0), np.mean([v[y] for y in ys], axis=0)
    def enc(u, v):
        return np.dstack([encode(u, -15, 15), encode(v, -15, 15), np.zeros_like(u, np.uint8)])
    frames, meta = [], {"hist": [1850, 2000, 0, 10]}
    for d in range(1850, 2001, 10):
        frames.append(enc(*dec(hu, hv, d)))
    for ssp in SCENARIOS:
        su, sv = giss_annual(ssp, "uas", sp), giss_annual(ssp, "vas", sp)
        u, v = {**hu, **su}, {**hv, **sv}
        meta[ssp] = [2010, 2090, len(frames), 10]
        for d in range(2010, 2091, 10):
            frames.append(enc(*dec(u, v, d)))
    info = write_atlas("wind", frames, "RGB", 8)
    return {**info, "frames": meta, "range": [-15, 15],
            "source": "NASA GISS-E2.1-G (CMIP6), vento a 10 m (uas/vas), média por década"}


BUILDERS = {"clouds": build_clouds, "temp": build_temp, "ndvi": build_ndvi, "fire": build_fire, "wind": build_wind}


def main():
    wanted = sys.argv[1:] or list(BUILDERS)
    meta = {}
    if META.exists():
        txt = META.read_text(encoding="utf-8")
        meta = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    for name in wanted:
        try:
            meta[name] = BUILDERS[name]()
        except Exception as e:  # noqa: BLE001
            print(f"FALHA {name}: {e}")
    META.write_text("// GERADO por scripts/build_layers.py — não edite à mão.\n"
                    "// frames: [primeiro ano, último ano, índice do 1º quadro no atlas, passo em anos]\n"
                    "window.EJ_LAYERS = " + json.dumps(meta, ensure_ascii=False, indent=1) + ";\n",
                    encoding="utf-8")
    print("Escrito: data/layers.js")


if __name__ == "__main__":
    main()
