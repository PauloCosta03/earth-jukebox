// Projeções 2025–2100 por cenário IPCC AR6 (SSP), medianas aproximadas.
// Fontes: NASA Sea Level Projection Tool (IPCC AR6), NASA NEX-GDDP-CMIP6, IPCC AR6 WG1.
// Temperatura convertida para a base 1951–1980 do GISTEMP (≈ −0,3 °C vs. 1850–1900).
window.EJ_PROJECTIONS = {
  ssp126: {
    label: "SSP1-2.6 · Emissões baixas",
    temp: {2024:1.28, 2050:1.4, 2075:1.5, 2100:1.5},
    co2:  {2024:424, 2050:443, 2075:445, 2100:446},
    ice:  {2024:4.3, 2050:3.0, 2075:3.0, 2100:3.0},
    sea:  {2024:111, 2050:220, 2075:340, 2100:470}
  },
  ssp245: {
    label: "SSP2-4.5 · Emissões intermediárias",
    temp: {2024:1.28, 2050:1.7, 2075:2.1, 2100:2.4},
    co2:  {2024:424, 2050:509, 2075:567, 2100:603},
    ice:  {2024:4.3, 2050:1.5, 2075:1.0, 2100:0.8},
    sea:  {2024:111, 2050:230, 2075:390, 2100:590}
  },
  ssp585: {
    label: "SSP5-8.5 · Emissões muito altas",
    temp: {2024:1.28, 2050:2.1, 2075:3.1, 2100:4.1},
    co2:  {2024:424, 2050:563, 2075:801, 2100:1135},
    ice:  {2024:4.3, 2050:0.8, 2075:0.2, 2100:0.0},
    sea:  {2024:111, 2050:260, 2075:490, 2100:800}
  }
};
