# 🌍 Earth Jukebox

**NASA Space Apps Challenge 2026 · The Earth Information Jukebox**

Earth Jukebox transforma dados climáticos da NASA em **música e num globo 3D interativo**. De 1880 até 2100, cada indicador vira um instrumento e uma camada visual sobre a Terra. Conforme o planeta aquece, a música perde harmonia — e o globo mostra o porquê.

## Como rodar

**Dê dois cliques em `run.bat`.** Ele abre http://localhost:8000 no navegador (precisa do Python instalado).

Alternativas: `python -m http.server 8000` na pasta do projeto, ou a extensão **Live Server** do VS Code. Abrir o `index.html` direto (dois cliques no arquivo) **não funciona** — o globo 3D precisa de um servidor local.

## O globo 3D

Terra renderizada com **three.js** e texturas reais da NASA (Blue Marble de dia, Black Marble à noite, relevo e máscara de oceanos), com rotação, dia/noite, atmosfera e estrelas. Arraste para girar, role para aproximar.

### Camadas visuais (chips no topo)

| Camada | O que mostra | De onde vem |
|---|---|---|
| 🌃 Luzes | Luzes das cidades no lado noturno, acendendo com a industrialização | NASA Black Marble |
| 🌊 Inundação | Áreas costeiras baixas inundando conforme o mar sobe (exagero vertical p/ escala global) | Relevo real + nível do mar NASA |
| 🧊 Gelo | Calota ártica com borda irregular, dimensionada pela extensão real medida por satélite | NSIDC Sea Ice Index |
| 🌡️ Calor | Tinta térmica e atmosfera avermelhada conforme a anomalia de temperatura | NASA GISTEMP |

### Camadas de áudio (cards à direita)

| Camada | Dado | Instrumento |
|---|---|---|
| 🎹 Temperatura | NASA GISTEMP v4 | Melodia: mais aguda e dissonante com o calor |
| 🌫️ CO₂ | NOAA Mauna Loa + núcleos de gelo | Drone que distorce |
| 🔔 Gelo do Ártico | NSIDC / NASA | Sinos que somem |
| 🌊 Nível do mar | Altimetria por satélite da NASA | Ondas mais fortes |

Clique num card para ouvir **só aquele instrumento** (solo); o 🔊 de cada card liga/desliga a camada.

### Futuro (2025–2100)

Projeções em três cenários do IPCC AR6 (SSP1-2.6, SSP2-4.5, SSP5-8.5), com base no NASA Sea Level Projection Tool e nos modelos CMIP6 (NASA NEX-GDDP-CMIP6). No gráfico, a projeção aparece tracejada; o ano fica laranja.

## Estrutura

```
index.html                  página (UI sobreposta ao globo)
run.bat                     inicia o servidor local e abre o navegador
css/style.css               estilos
js/globe.js                 globo 3D (three.js + shaders das camadas)
js/audio.js                 motor de áudio (Web Audio), uma camada por dado
js/chart.js                 gráfico 2D das séries
js/data.js                  junta histórico e projeção, interpolação por ano
js/main.js                  interface e controles
js/vendor/                  three.js + OrbitControls (empacotados p/ funcionar offline)
data/historical.js          séries históricas (geradas do dado oficial)
data/projections.js         projeções por cenário SSP
assets/textures/            texturas NASA (Blue/Black Marble, relevo, oceanos)
scripts/fetch_nasa_data.py  baixa os dados oficiais e regenera data/historical.js
```

## Atualizar os dados oficiais

```
python scripts/fetch_nasa_data.py
```

Usa só a biblioteca padrão do Python. Se uma fonte falhar, os valores atuais daquela série são mantidos.

## Fontes e créditos

- NASA GISS Surface Temperature Analysis (GISTEMP v4): https://data.giss.nasa.gov/gistemp/
- NOAA GML, CO₂ de Mauna Loa: https://gml.noaa.gov/ccgg/trends/
- NSIDC Sea Ice Index v3: https://nsidc.org/data/g02135
- NASA Sea Level: https://climate.nasa.gov/vital-signs/sea-level/
- NASA Sea Level Projection Tool (IPCC AR6): https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool
- NASA NEX-GDDP-CMIP6: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6
- Texturas: NASA Blue Marble / Black Marble (domínio público), via pacote three-globe
- 3D: [three.js](https://threejs.org) (MIT)

A inundação e a borda do gelo usam dados reais com **exagero visual** para serem legíveis em escala global — isso está indicado na própria interface.

## Equipe e contribuição

Quer ajudar? Leia o [CONTRIBUTING.md](CONTRIBUTING.md). Licença: [MIT](LICENSE).
