# 🌍 Earth Jukebox

**NASA Space Apps Challenge 2026 · The Earth Information Jukebox**

Earth Jukebox transforma dados climáticos da NASA em **música e num globo 3D interativo**. De 1880 até 2100, cada indicador vira um instrumento e uma camada visual sobre a Terra. Conforme o planeta aquece, a música perde harmonia — e o globo mostra o porquê.

## Como rodar

**Dê dois cliques em `run.bat`.** Ele abre http://localhost:8013 no navegador (precisa do Python instalado).

Alternativas: `python scripts/serve.py` na pasta do projeto (o `python -m http.server` comum também funciona, mas recusa conexões quando muitos arquivos chegam juntos e às vezes um script não carrega no 1º acesso), ou a extensão **Live Server** do VS Code. Abrir o `index.html` direto (dois cliques no arquivo) **não funciona** — o globo 3D precisa de um servidor local.

## O globo 3D

Terra renderizada com **three.js**, com **relevo 3D** (altitude real, exagero vertical ~20x) e texturas reais da NASA (Blue Marble de dia, Black Marble à noite, relevo e máscara de oceanos), com rotação, dia/noite, atmosfera e estrelas. Arraste para girar, role para aproximar.

### Camadas visuais (chips no topo)

| Camada | O que mostra | De onde vem |
|---|---|---|
| 🌃 Luzes | Luzes das cidades no lado noturno, acendendo com a industrialização | NASA Black Marble |
| 🌊 Inundação | Áreas costeiras baixas inundando conforme o mar sobe (exagero vertical p/ escala global) | Relevo real + nível do mar NASA |
| 🧊 Gelo | Calota ártica com borda irregular, dimensionada pela extensão real medida por satélite | NSIDC Sea Ice Index |
| 🌡️ Calor | Mapa real da anomalia de temperatura por região, ano a ano (média móvel de 5 anos) | NASA GISTEMP (até 2025) + modelo GISS-E2.1-G (projeção) |
| ☁️ Nuvens | 16 dias seguidos de nuvens reais que se transformam uma na outra, levadas pelo vento do modelo (sem "piscar") | NASA GIBS — VIIRS cor real + vento GISS-E2.1-G |
| 🌿 Vegetação | Mês de pico verde de cada ano, 2001–2025 | NASA GIBS — MODIS NDVI |
| 🔥 Queimadas | Onde o fogo é frequente em cada ano, 2001–2025 | NASA GIBS — MODIS Thermal Anomalies |
| 🌬️ Ventos | Fluido: 16 mil partículas na placa de vídeo deixam rastros que escorrem como linhas de corrente (vento médio de cada década, por cenário) | Modelo GISS-E2.1-G (uas/vas) |
| 🌊 Correntes do mar | Água animada (ondas + reflexo do sol) que escorre na direção e velocidade das correntes de superfície (clima atual, 1985–2014) | Modelo GISS-E2.1-G: altura do mar (zos) → correntes geostróficas |
| 🛡️ Ozônio | Buraco de ozônio na Antártida (abaixo de 220 DU), set–out de cada ano, 1979–2025 | NASA Ozone Watch (TOMS, OMI) |

### Camadas de áudio (cards à direita)

| Camada | Dado | Instrumento |
|---|---|---|
| 🎹 Temperatura | NASA GISTEMP v4 | Melodia: mais aguda e dissonante com o calor |
| 🌫️ CO₂ | NOAA Mauna Loa + núcleos de gelo | Drone que distorce |
| 🔔 Gelo do Ártico | NSIDC / NASA | Sinos que somem |
| 🌊 Nível do mar | Altimetria por satélite da NASA | Ondas mais fortes |

Clique num card para ouvir **só aquele instrumento** (solo); o 🔊 de cada card liga/desliga a camada.

### Futuro (2025–2100)

Projeções em três cenários SSP (SSP1-2.6, SSP2-4.5, SSP5-8.5), calculadas a partir do modelo climático da própria NASA (GISS-E2.1-G, CMIP6). Detalhes na seção **Dados**. No gráfico, a projeção aparece tracejada; o ano fica laranja.

### Ouvir imagens (visão computacional)

O `js/vision.js` "olha" um quadro e transforma em música: **cor** → acorde, **brilho** → timbre, **pontos brilhantes** → arpejo, **bordas** → chimbal, **movimento** → golpes graves. No globo, ele lê o próprio quadro desenhado (gire a Terra ou ligue camadas e a música muda). Em **Instrumentos → Ouvir uma imagem** dá para abrir qualquer imagem ou vídeo do NASA Earth Information Center / Scientific Visualization Studio, escolher um perfil de som, **varrer** a imagem da esquerda para a direita e **gravar** o áudio.

Acessibilidade: o botão 🗣️ (tecla **D**) descreve em texto tudo o que está na tela — ano, valores, harmonia, camadas ligadas e o que a imagem mostra. Atalhos: Espaço, ← →, S, D, M.

### Tocar partituras

Em **Instrumentos → 🎼 Abrir partitura** (ou arrastando o arquivo para a tela):

| Formato | Precisão | De onde tirar |
|---|---|---|
| **MusicXML** (`.musicxml`, `.xml`, `.mxl`) | exata (notas, ritmo, andamento) | exporte do MuseScore/Finale/Sibelius; baixe no IMSLP ou MuseScore |
| **MIDI** (`.mid`, `.midi`) | exata | qualquer editor de música |
| **Imagem** de partitura impressa | experimental | pauta reta e limpa, clave de sol, uma linha de melodia; não lê armadura, acidentes nem ritmo |

Na imagem, as notas encontradas aparecem com um círculo verde para conferir a leitura. Exemplos em `exemplos/` (gerados por `scripts/make_score_examples.py`, domínio público).

## Interface e acessibilidade

A interface fica em três faixas: **topo** (menu e visualização), **painel lateral** (um aberto por vez) e **barra de reprodução**. Tudo é feito para funcionar só com teclado e para quem não enxerga.

- **Narração por voz** (`js/a11y.js`): ao navegar com **Tab**, cada controle diz em voz alta o que faz e o estado atual (ligado/desligado, valor, aberto/fechado). A música abaixa enquanto a voz fala. Texto de cada controle no atributo `data-say` do `index.html`. Tecla **V** liga/desliga (para quem já usa leitor de tela).
- **Contar a história** (botão de livro na barra, ou no painel Acessibilidade): a música **pausa em cada acontecimento** de 1880 a 2025 (`js/events.js`) e a voz — ou o leitor de tela — conta o que aconteceu, o **impacto na Terra** e os dados medidos naquele ano; depois continua sozinha. Após 2025, marcos do futuro (2026, 2040, 2050, 2075, 2100) são montados com os dados do modelo da NASA para o cenário escolhido. **[ ]** e os botões ⏮ ⏭ pulam entre acontecimentos.
- **Dois idiomas: português e inglês** (`js/i18n.js`): no primeiro acesso, uma caixa pergunta o idioma (já focada no idioma do navegador; cada opção é falada no próprio idioma). A escolha muda **tudo**: textos, rótulos de leitor de tela (`aria-label`), narração por voz (voz pt-BR ou en-US), acontecimentos, descrições e mensagens. Fica salva no navegador; o botão **PT/EN** no topo, o painel Acessibilidade ou a tecla **L** trocam a qualquer momento. O `<html lang>` acompanha, para o leitor de tela pronunciar certo. Para traduzir mais textos: frases do código ficam em `S` (`EJ.t('chave')`) e textos do HTML no mapa `DOM` (seletor → inglês); o português continua escrito no próprio `index.html`.
- **Introdução** (`intro.html`, `js/intro.js`): no primeiro acesso, o `index.html` abre a introdução. Ela pergunta o idioma (**P** / **E**), apresenta o projeto em três frases faladas (qualquer letra começa, **Esc** pula) e oferece "Ouvir o guia ao entrar". Reabre pelo botão "Reassistir à introdução" do painel Acessibilidade.
- **Três vozes** (em ordem): **narração gravada** em inglês dos acontecimentos (`audio/en/*.mp3`, `js/narrator-online.js`) → **voz do navegador** → **voz offline** de reserva (meSpeak, `js/narrator-fallback.js`, para computadores sem voz instalada no idioma). Cada MP3 tem como nome o *hash* do texto **exato** da fala: se o inglês de um acontecimento mudar, ele volta a usar a voz do navegador até ser gravado de novo.
- **Sons da interface**: toques curtos na mesma tonalidade da música (lá maior pentatônica) ao navegar, ligar/desligar e abrir painéis — dá para "ouvir" onde se está.
- **Painel Acessibilidade**: narração, velocidade da voz, sons da interface, tamanho do texto, alto contraste, reduzir movimento, guia falado e lista de atalhos.
- **Esconder a interface** (botão de olho ou **H**) e **tela cheia** (**F**).
- **Zoom** suave na roda/touchpad e pelos botões ou teclas **+ − 0**. Corrige um bug do OrbitControls do three.js 0.160 (`devicePixelRatio | 0` vira 0 com o zoom do navegador abaixo de 100% → a Terra pulava).
- Ícones: [Lucide](https://lucide.dev) (ISC), embutidos no HTML por `scripts/build_icons.py`.

| Tecla | Ação | Tecla | Ação |
|---|---|---|---|
| Tab | próximo controle (com narração) | V | narração liga/desliga |
| Espaço | tocar / pausar | + − 0 | aproximar / afastar / centralizar |
| ← → | ano (Shift: 10 anos) | H | esconder / mostrar interface |
| D | descrever a tela | F | tela cheia |
| S | varrer a imagem | ? | painel Acessibilidade |
| [ ] | acontecimento anterior / próximo | L | trocar idioma (PT / EN) |
| M | silenciar a música | Esc | fecha o painel |

## Estrutura

```
index.html                  página (UI sobreposta ao globo)
intro.html                  introdução do primeiro acesso (idioma + apresentação falada)
run.bat                     inicia o servidor local (scripts/serve.py) e abre o navegador
css/style.css               estilos
js/globe.js                 globo 3D (three.js + shaders das camadas)
js/audio.js                 motor de áudio (Web Audio), uma camada por dado
js/chart.js                 gráfico 2D das séries
js/events.js                acontecimentos da linha do tempo (o que aconteceu + impacto na Terra)
js/data.js                  junta histórico e projeção (interpolação PCHIP, emenda suave)
js/vision.js                visão computacional: imagem → características musicais
js/score.js                 partituras: MusicXML, MIDI e leitura óptica de imagem → notas
tests/                      testes automáticos (node --test tests/)
js/main.js                  interface e controles
js/i18n.js                  idiomas (português / inglês): textos, rótulos e caixa de escolha
js/a11y.js                  narração por voz, sons da interface, tela cheia, esconder interface, zoom, opções
js/intro.js                 introdução (+ js/intro-preferences.js: lembra se já foi vista)
js/narrator-online.js       narração gravada em inglês (toca os MP3 de audio/en)
js/narrator-fallback.js     voz offline de reserva (meSpeak)
audio/en/                   narração gravada dos acontecimentos em inglês + manifest.json
js/vendor/                  three.js + OrbitControls + meSpeak (empacotados p/ funcionar offline)
data/historical.js          séries observadas (GERADO pelo script)
data/projections.js         projeções por cenário SSP (GERADO pelo script)
data/provenance.json        fonte e ajustes de cada série (GERADO pelo script)
assets/textures/            texturas NASA (Blue/Black Marble, relevo, oceanos)
scripts/fetch_nasa_data.py  pipeline: baixa os dados da NASA e gera os arquivos de data/
scripts/build_layers.py     gera as texturas das camadas (assets/layers/) e data/layers.js
scripts/build_textures.py   gera as texturas-base (dia, relevo, água, luzes) direto dos originais da NASA
scripts/serve.py            servidor local (fila de conexões maior que a do http.server padrão)
assets/layers/              texturas das camadas (GERADAS pelo script)
```

## Dados

**Regra do projeto: só usamos dados abertos da NASA.** Tudo em `data/` é gerado pelo script, nada é digitado à mão.

### Observações

| Série | Fonte NASA | Período |
|---|---|---|
| Temperatura | [NASA GISS GISTEMP v4](https://data.giss.nasa.gov/gistemp/), anomalia global anual (base 1951–1980) | 1880–2025 |
| CO₂ | [NASA GISS](https://portal.nccs.nasa.gov/GISS_modelE/modelE_input_data/), concentração global usada no ModelE (`GHG.CMIP6.1-2014.txt`) | 1880–2014 |
| Gelo do Ártico | [NASA GSFC Cryospheric Sciences Lab](https://earth.gsfc.nasa.gov/cryo/data/arcticantarctic-sea-ice-time-series), extensão de setembro | 1979–2017 |
| Nível do mar | NASA JPL/GSFC (programa NASA Sea Level Change): nível médio global por altimetria NASA-SSH, arquivo aberto [doi:10.5281/zenodo.7702315](https://doi.org/10.5281/zenodo.7702315) (indicado pelo [NASA SVS](https://svs.gsfc.nasa.gov/5611)) | 1993–2025; **antes de 1993 não há satélite** e o app mostra "sem satélite" |

Depois do último ano observado de cada série, o app usa a projeção do cenário escolhido.

### Projeções (2015–2100)

| Série | Fonte NASA | Método |
|---|---|---|
| CO₂ | NASA GISS, `GHG.CMIP6.2015-2500.<cenário>.txt` | Concentrações usadas como forçante do modelo da NASA |
| Temperatura | [GISS-E2.1-G](https://data.giss.nasa.gov/modelE/cmip6/) (CMIP6, membro r1i1p1f2), variável `tas`, via [NCCS](https://portal.nccs.nasa.gov/datashare/giss_cmip6/) | Média global ponderada por área; anomalia vs. 1951–1980 do próprio modelo; ancorada à média GISTEMP 2015–2024 (ajuste < 0,02 °C) |
| Gelo do Ártico | GISS-E2.1-G, variável `siconca` | Extensão de setembro (células ≥ 15%); viés corrigido pela razão GSFC/modelo em 1979–2014 (fator 0,62) |
| Nível do mar | Modelo semi-empírico (Rahmstorf 2007) dirigido pela temperatura GISS | Parte da taxa atual medida pela NASA (4,4 mm/ano) e chega em 2100 à mediana do [NASA Sea Level Projection Tool](https://sealevel.nasa.gov/ipcc-ar6-sea-level-projection-tool) (AR6, tab. 9.9: 0,44 / 0,56 / 0,77 m), convertida para a base de 1993 com a própria série da NASA |

**Limitações (importante para a apresentação):**
- Projeções de um único modelo e um único membro: a variabilidade ano a ano é real do modelo, não uma previsão de cada ano.
- O GISS-E2.1-G mantém mais gelo ártico que outros modelos e não zera o gelo de setembro até 2100, nem no SSP5-8.5.
- Gelo de 2018–2024 e CO₂ de 2015–2024 vêm do modelo e dos cenários, não de observação.
- Nível do mar: série observada da NASA desde 1993; os pontos antigos (1880–1960) digitados à mão foram removidos por não virem da NASA.

### Atualizar os dados

```
python -m venv .venv
.venv\Scripts\pip install -r scripts/requirements.txt      (Linux/Mac: .venv/bin/pip)
.venv\Scripts\python scripts/fetch_nasa_data.py
```

Na primeira execução, ~350 MB de saídas do modelo são baixados para `data/cache/` (ignorado pelo git). O nível do mar observado vem de um arquivo aberto da NASA (não precisa de login). Se uma fonte falhar, a série mantém os valores atuais e o motivo é impresso.

### Camadas do globo

```
.venv\Scripts\python scripts/build_layers.py              (todas)
.venv\Scripts\python scripts/build_layers.py ozone fire   (só algumas)
```

Gera as texturas em `assets/layers/` (atlas: um quadro por ano lado a lado) e os metadados em `data/layers.js`. Baixa ~2 GB na primeira vez (cache em `data/cache/`). Camadas sem dado num ano (ex.: vegetação antes de 2001, ozônio em 1995) somem suavemente.

## Créditos

- Dados: NASA GISS (GISTEMP, ModelE/GISS-E2.1-G), NASA GSFC, NASA NCCS, NASA PO.DAAC
- Texturas (geradas por `scripts/build_textures.py` direto dos originais da NASA): Blue Marble Next Generation topografia e batimetria, maio de 2004 (dia); topografia BMNG (relevo e inundação); máscara de água MODIS Terra via GIBS (+ BMNG na Antártida); Black Marble 2016 (só as luzes)
- 3D: [three.js](https://threejs.org) (MIT)
- Voz offline: [meSpeak](https://www.masswerk.at/mespeak/) / eSpeak (GPL-3.0, licença em `js/vendor/mespeak/LICENSE.txt`)
- Narração em inglês dos acontecimentos: gravada com voz sintética por IA (versão em inglês feita no Lovable)

A inundação e a borda do gelo usam dados reais com **exagero visual** para serem legíveis em escala global — isso está indicado na própria interface.

## Equipe e contribuição

Quer ajudar? Leia o [CONTRIBUTING.md](CONTRIBUTING.md). Licença: [MIT](LICENSE).
