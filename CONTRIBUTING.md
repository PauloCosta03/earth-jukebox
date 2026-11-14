# Como contribuir

## Começando

```
git clone <url-do-repositorio>
cd earth-jukebox
```

Dê dois cliques em `run.bat` (ou rode `python -m http.server 8000`) e abra http://localhost:8000. Abrir o `index.html` direto não funciona: o globo 3D precisa de servidor local.

## Fluxo de trabalho

1. Atualize a `main`: `git pull`
2. Crie um branch para a sua tarefa: `git checkout -b nome-da-tarefa`
3. Faça commits pequenos, com mensagens claras
4. Envie o branch: `git push -u origin nome-da-tarefa`
5. Abra um Pull Request no GitHub e peça revisão para alguém da equipe

Ninguém faz commit direto na `main`.

## Onde mexer

| Quero mudar... | Arquivo |
|---|---|
| Sons e instrumentos | `js/audio.js` |
| Globo 3D e shaders | `js/globe.js` |
| Gráfico 2D | `js/chart.js` |
| Botões, textos e eventos | `js/main.js`, `index.html` |
| Visual (cores, layout) | `css/style.css` |
| Texturas das camadas | `scripts/build_layers.py` (gera `assets/layers/`) |
| Dados (todos) | `scripts/fetch_nasa_data.py` (gera os arquivos de `data/`) |
| Regra de dados | só fontes abertas da NASA (ver README, seção Dados) |

## Regras

- Toda fonte de dados nova vai com o link no `README.md` e no rodapé da página.
- Teste no navegador antes de abrir o PR: play, slider, cards e cenários.
- Indentação: 2 espaços em JS/CSS/HTML e 4 em Python (o `.editorconfig` já cuida disso).
