# 🌍 Earth Jukebox

**NASA Space Apps Challenge 2026 · The Earth Information Jukebox**

Earth Jukebox transforma dados climáticos da NASA em música. De 1880 até 2100, cada indicador vira um instrumento. Conforme o planeta aquece, a música perde harmonia.

## Como rodar

Abra o `index.html` no navegador. Não precisa instalar nada nem rodar servidor.

## Funcionalidades

| Camada | Dado | Instrumento |
|---|---|---|
| 🎹 Temperatura | NASA GISTEMP v4 | Melodia: mais aguda e dissonante com o calor |
| 🌫️ CO₂ | NOAA Mauna Loa + núcleos de gelo | Drone que distorce |
| 🔔 Gelo do Ártico | NSIDC / NASA (satélite) | Sinos que somem |
| 🌊 Nível do mar | Altimetria por satélite da NASA | Ondas mais fortes |

- **Camadas interativas:** clique num card para ouvir só aquele instrumento (solo). O botão 🔊 de cada card liga ou desliga a camada.
- **Futuro (2025–2100):** projeções em três cenários do IPCC AR6 (SSP1-2.6, SSP2-4.5, SSP5-8.5), baseadas no NASA Sea Level Projection Tool e nos modelos CMIP6 (NASA NEX-GDDP-CMIP6). No gráfico, a projeção aparece tracejada.
- **Modo contínuo:** a opção "Repetir sem parar" toca a história em loop.
- **Filtro de calor:** tinge a Terra conforme a temperatura. Vem desligado por padrão.

## Estrutura

```
index.html                  página
css/style.css               estilos
js/data.js                  junta histórico e projeção, interpolação por ano
js/audio.js                 motor de áudio (Web Audio), uma camada por dado
js/visuals.js               globo e gráfico
js/main.js                  interface e controles
data/historical.js          séries históricas
data/projections.js         projeções por cenário SSP
scripts/fetch_nasa_data.py  baixa os dados oficiais e regenera data/historical.js
```

## Atualizar os dados oficiais

```
python scripts/fetch_nasa_data.py
```

O script usa só a biblioteca padrão do Python. Se uma fonte falhar, os valores atuais daquela série são mantidos.

## Fontes

- NASA GISS Surface Temperature Analysis (GISTEMP v4): https://data.giss.nasa.gov/gistemp/
- NOAA GML, CO₂ de Mauna Loa: https://gml.noaa.gov/ccgg/trends/
- NSIDC Sea Ice Index v3: https://nsidc.org/data/g02135
- NASA Sea Level: https://climate.nasa.gov/vital-signs/sea-level/
- NASA Sea Level Projection Tool (IPCC AR6): https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool
- NASA NEX-GDDP-CMIP6: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6
