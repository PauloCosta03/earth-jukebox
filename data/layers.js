// GERADO por scripts/build_layers.py — não edite à mão.
// frames: [primeiro ano, último ano, índice do 1º quadro no atlas, passo em anos]
window.EJ_LAYERS = {
 "clouds": {
  "images": [
   "assets/layers/clouds_00.png",
   "assets/layers/clouds_01.png",
   "assets/layers/clouds_02.png",
   "assets/layers/clouds_03.png",
   "assets/layers/clouds_04.png",
   "assets/layers/clouds_05.png",
   "assets/layers/clouds_06.png",
   "assets/layers/clouds_07.png",
   "assets/layers/clouds_08.png",
   "assets/layers/clouds_09.png",
   "assets/layers/clouds_10.png",
   "assets/layers/clouds_11.png",
   "assets/layers/clouds_12.png",
   "assets/layers/clouds_13.png",
   "assets/layers/clouds_14.png",
   "assets/layers/clouds_15.png"
  ],
  "dates": [
   "2024-03-13",
   "2024-03-28"
  ],
  "source": "NASA GIBS — VIIRS SNPP + NOAA-20 Corrected Reflectance (cor real), dias seguidos"
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
 },
 "ndvi": {
  "atlas": "assets/layers/ndvi.png",
  "cols": 5,
  "rows": 5,
  "frameW": 720,
  "frameH": 360,
  "frames": {
   "hist": [
    2001,
    2025,
    0,
    1
   ]
  },
  "source": "NASA GIBS — MODIS Terra L3 NDVI mensal (mês de pico verde de cada ano)"
 },
 "fire": {
  "atlas": "assets/layers/fire.png",
  "cols": 5,
  "rows": 5,
  "frameW": 720,
  "frameH": 360,
  "frames": {
   "hist": [
    2001,
    2025,
    0,
    1
   ]
  },
  "source": "NASA GIBS — MODIS Terra+Aqua Thermal Anomalies (amostra a cada 8 dias)"
 },
 "wind": {
  "atlas": "assets/layers/wind.png",
  "cols": 8,
  "rows": 6,
  "frameW": 144,
  "frameH": 90,
  "frames": {
   "hist": [
    1850,
    2000,
    0,
    10
   ],
   "ssp126": [
    2010,
    2090,
    16,
    10
   ],
   "ssp245": [
    2010,
    2090,
    25,
    10
   ],
   "ssp585": [
    2010,
    2090,
    34,
    10
   ]
  },
  "range": [
   -15,
   15
  ],
  "source": "NASA GISS-E2.1-G (CMIP6), vento a 10 m (uas/vas), média por década"
 },
 "ozone": {
  "atlas": "assets/layers/ozone.png",
  "cols": 8,
  "rows": 6,
  "frameW": 360,
  "frameH": 180,
  "frames": {
   "hist": [
    1979,
    2025,
    0,
    1
   ]
  },
  "range": [
   100,
   500
  ],
  "missing": [
   1995
  ],
  "source": "NASA Ozone Watch (GSFC) — TOMS Nimbus-7, Meteor-3, Earth Probe e OMI; média 20/set–20/out"
 },
 "ocean": {
  "atlas": "assets/layers/ocean.png",
  "cols": 1,
  "rows": 1,
  "frameW": 288,
  "frameH": 180,
  "range": [
   -1.0,
   1.0
  ],
  "frames": {
   "hist": [
    1985,
    2014,
    0,
    30
   ]
  },
  "source": "NASA GISS-E2.1-G (CMIP6), altura do mar (zos) -> correntes geostróficas, média 1985–2014"
 }
};
