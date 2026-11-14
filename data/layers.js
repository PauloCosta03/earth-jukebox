// GERADO por scripts/build_layers.py — não edite à mão.
// frames: [primeiro ano, último ano, índice do 1º quadro no atlas, passo em anos]
window.EJ_LAYERS = {
 "clouds": {
  "image": "assets/layers/clouds.png",
  "date": "2024-03-20",
  "source": "NASA GIBS — VIIRS SNPP + NOAA-20 Corrected Reflectance (cor real)"
 },
 "temp": {
  "atlas": "assets/layers/temp.png",
  "cols": 16,
  "rows": 24,
  "frameW": 180,
  "frameH": 90,
  "frames": {
   "hist": [
    1880,
    2025,
    0,
    1
   ],
   "ssp126": [
    2026,
    2100,
    146,
    1
   ],
   "ssp245": [
    2026,
    2100,
    221,
    1
   ],
   "ssp585": [
    2026,
    2100,
    296,
    1
   ]
  },
  "range": [
   -6,
   12
  ],
  "smoothing": "média móvel de 5 anos",
  "source": "NASA GISTEMP v4 (1200 km) até 2025; modelo NASA GISS-E2.1-G depois"
 }
};
