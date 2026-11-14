# Como contribuir

## Começando

```
git clone <url-do-repositorio>
cd earth-jukebox
```

Abra o `index.html` no navegador. Não precisa instalar nada.

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
| Globo e gráfico | `js/visuals.js` |
| Botões, textos e eventos | `js/main.js`, `index.html` |
| Visual (cores, layout) | `css/style.css` |
| Dados históricos | `scripts/fetch_nasa_data.py` (gera `data/historical.js`) |
| Projeções futuras | `data/projections.js` |

## Regras

- Toda fonte de dados nova vai com o link no `README.md` e no rodapé da página.
- Teste no navegador antes de abrir o PR: play, slider, cards e cenários.
- Indentação: 2 espaços em JS/CSS/HTML e 4 em Python (o `.editorconfig` já cuida disso).
