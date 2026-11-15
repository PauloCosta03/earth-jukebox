"""Gera as texturas-base do globo direto dos originais publicados pela NASA.

Saídas (assets/textures/):
  earth-day.jpg       superfície de dia — NASA Blue Marble Next Generation, topografia e batimetria,
                      maio de 2004 (NASA Earth Observatory / Reto Stöckli). Leve curva de tom (gama/ganho
                      por canal) só para manter o visual que o projeto já tinha.
  earth-topology.png  relevo (0 = nível do mar … 255 = picos) — NASA Blue Marble Next Generation,
                      "gebco_08_rev_elev" (topografia publicada pela NASA Earth Observatory).
                      Usada no relevo 3D e no cálculo da inundação.
  earth-water.png     máscara de água (255 = oceano) — NASA MODIS Terra Land/Water Mask (GIBS) entre 60°S
                      e 90°N; ao sul de 60°S (a máscara MODIS não cobre a Antártida) usa a topografia acima.
  earth-night.jpg     luzes das cidades — NASA Black Marble 2016 (VIIRS, NASA Earth Observatory). Só as
                      luzes (o "chão iluminado pela lua" da imagem original é removido), para o shader
                      acender as cidades conforme o ano sem acender os oceanos.

Uso:
    .venv\\Scripts\\python scripts/build_textures.py

Downloads ficam em cache em data/cache/nasa_textures/ (~15 MB).
"""
import shutil
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache" / "nasa_textures"
OUT = ROOT / "assets" / "textures"
UA = {"User-Agent": "earth-jukebox-data-fetcher"}

ASSETS = "https://assets.science.nasa.gov/content/dam/science/esd/eo/images"
SRC = {
    "day": f"{ASSETS}/bmng/bmng-topography-bathymetry/may/world.topo.bathy.200405.3x5400x2700.jpg",
    "topo": f"{ASSETS}/bmng/topography/gebco_08_rev_elev_5400x2700.jpg",
    "night": f"{ASSETS}/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg",
    "water": ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
              "&VERSION=1.3.0&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048"
              "&FORMAT=image/png&TRANSPARENT=FALSE&LAYERS=MODIS_Terra_L3_Land_Water_Mask"),
}
NAMES = {"day": "world.topo.bathy.200405.3x5400x2700.jpg", "topo": "gebco_08_rev_elev_5400x2700.jpg",
         "night": "BM2016_144898.jpg", "water": "modis_water_mask_4096.png"}

# curva de tom do dia (ajustada por mínimos quadrados contra a textura que o projeto usava):
# saída = ganho · entrada^gama, por canal (R, G, B)
DAY_TONE = {"gamma": (0.963, 0.974, 0.950), "gain": (0.930, 0.940, 0.926)}


def download(key):
    dest = CACHE / NAMES[key]
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(SRC[key], headers=UA)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            break
        except OSError:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    tmp.replace(dest)
    return dest


def build_day():
    img = Image.open(download("day")).convert("RGB").resize((4096, 2048), Image.LANCZOS)
    a = np.asarray(img).astype("f4") / 255
    for c in range(3):
        a[..., c] = np.clip(DAY_TONE["gain"][c] * a[..., c] ** DAY_TONE["gamma"][c], 0, 1)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8), "RGB").save(OUT / "earth-day.jpg", quality=90, optimize=True)
    print("  -> earth-day.jpg       4096x2048  (NASA Blue Marble NG, maio/2004)")


def topo_array(w, h):
    return np.asarray(Image.open(download("topo")).convert("L").resize((w, h), Image.LANCZOS))


def build_topology():
    Image.fromarray(topo_array(2048, 1024), "L").save(OUT / "earth-topology.png", optimize=True)
    print("  -> earth-topology.png  2048x1024  (NASA Blue Marble NG, topografia)")


def build_water():
    w, h = 2048, 1024
    rgb = np.asarray(Image.open(download("water")).convert("RGB")).astype("f4")
    modis = (rgb[..., 2] > 128).astype("f4")                       # azul-claro = água, preto = terra
    modis = np.asarray(Image.fromarray((modis * 255).astype(np.uint8)).resize((w, h), Image.BOX)).astype("f4") / 255
    topo = topo_array(w, h).astype("f4")
    antarctic = 1.0 - np.clip(topo / 2.0, 0, 1)                    # 0 = mar na topografia da NASA
    lat = 90 - (np.arange(h) + 0.5) * 180 / h
    water = np.where(lat[:, None] < -60, antarctic, modis)
    Image.fromarray((water * 255 + 0.5).astype(np.uint8), "L").save(OUT / "earth-water.png", optimize=True)
    print("  -> earth-water.png     2048x1024  (NASA MODIS Land/Water Mask + BMNG ao sul de 60°S)")


def build_night():
    a = np.asarray(Image.open(download("night")).convert("RGB")).astype("f4")
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # luz artificial é amarela/branca (R e G altos); o chão iluminado pela lua e o gelo são azulados
    index = (r + g) / 2 - 0.8 * b
    lights = np.clip(index / 45.0, 0, 1) ** 0.55 * 175            # curva que mantém subúrbios e estradas
    img = Image.fromarray((lights + 0.5).astype(np.uint8), "L").resize((4096, 2048), Image.LANCZOS)
    img.convert("RGB").save(OUT / "earth-night.jpg", quality=90, optimize=True)
    print("  -> earth-night.jpg     4096x2048  (NASA Black Marble 2016, só as luzes)")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # console do Windows
    OUT.mkdir(parents=True, exist_ok=True)
    print("🌍 texturas-base (originais da NASA)")
    build_day()
    build_topology()
    build_water()
    build_night()


if __name__ == "__main__":
    main()
