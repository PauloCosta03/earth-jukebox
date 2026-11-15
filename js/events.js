// 📜 Acontecimentos da linha do tempo: o que aconteceu e o IMPACTO NA TERRA.
//
// No modo "Contar a história", a música pausa em cada ano desta lista, a voz (ou o leitor de tela)
// conta o acontecimento e a música continua. As teclas [ e ] pulam entre acontecimentos.
//
// Para editar: cada item tem { title, text, impact }. Mantenha frases curtas (são lidas em voz alta).
// Depois de 2025, os marcos são montados com os dados do modelo da NASA para o cenário escolhido.
window.EJ = window.EJ || {};
EJ.EVENTS = {
  1880: { title: 'Começam os registros globais de temperatura',
    text: 'A Revolução Industrial queima carvão em escala nunca vista, e os termômetros espalhados pelo mundo passam a formar o registro que a NASA usa até hoje.',
    impact: 'O gás carbônico começa a se acumular no ar e a reter calor, como um cobertor em volta da Terra.' },
  1896: { title: 'Arrhenius calcula o efeito estufa',
    text: 'O cientista sueco Svante Arrhenius calcula que dobrar o gás carbônico no ar aqueceria o planeta em vários graus.',
    impact: 'É a primeira previsão de que a queima de carvão poderia mudar o clima do planeta inteiro.' },
  1938: { title: 'Callendar mostra que a Terra já está esquentando',
    text: 'O engenheiro Guy Callendar reúne medições de temperatura e de gás carbônico e conclui que os dois estão subindo juntos.',
    impact: 'Pela primeira vez o aquecimento é ligado, com dados, às emissões humanas.' },
  1945: { title: 'A Grande Aceleração',
    text: 'Depois da Segunda Guerra, o consumo de petróleo, carros, plástico e energia dispara no mundo todo.',
    impact: 'As emissões de gás carbônico crescem mais rápido do que em qualquer época, e o aquecimento, que era lento, começa a acelerar.' },
  1958: { title: 'Começa a curva de Keeling',
    text: 'Charles Keeling começa a medir o gás carbônico no topo do vulcão Mauna Loa, no Havaí.',
    impact: 'A curva mostra o gás carbônico subindo todos os anos, com um pequeno sobe e desce das estações: é a respiração das florestas do hemisfério norte.' },
  1970: { title: 'Primeiro Dia da Terra',
    text: 'Cerca de vinte milhões de pessoas vão às ruas nos Estados Unidos pelo meio ambiente.',
    impact: 'Nascem as primeiras grandes leis e agências de proteção ambiental.' },
  1979: { title: 'Satélites passam a vigiar o gelo do Ártico',
    text: 'Começa o registro contínuo do gelo marinho por satélite, e acontece a primeira Conferência Mundial do Clima, em Genebra.',
    impact: 'Desde então, o gelo do Ártico no fim do verão encolhe cerca de doze por cento a cada década.' },
  1985: { title: 'Descoberto o buraco na camada de ozônio',
    text: 'Cientistas britânicos na Antártida mostram que a camada de ozônio fica muito fina toda primavera, por causa dos gases CFC.',
    impact: 'Mais radiação ultravioleta chega à superfície, o que aumenta o risco de câncer de pele e prejudica o plâncton dos oceanos.' },
  1987: { title: 'Protocolo de Montreal',
    text: 'Os países concordam em banir aos poucos os gases que destroem o ozônio. Hoje, todos os países do mundo assinaram.',
    impact: 'O buraco parou de crescer e deve se recuperar sobre a Antártida por volta de 2066. É a prova de que a humanidade consegue consertar um problema global.' },
  1988: { title: 'A NASA alerta o Senado dos Estados Unidos',
    text: 'O cientista da NASA James Hansen afirma ao Senado americano que o aquecimento global já começou. No mesmo ano, nasce o IPCC, o painel de cientistas do clima da ONU.',
    impact: 'O aquecimento global entra de vez na agenda política do mundo.' },
  1992: { title: 'Rio 92: a Cúpula da Terra no Brasil',
    text: 'No Rio de Janeiro, os países criam a Convenção do Clima da ONU.',
    impact: 'Quase todos os países se comprometem a evitar uma interferência perigosa no clima. As conferências do clima, as COPs, nascem daqui.' },
  1993: { title: 'Satélites começam a medir o nível do mar',
    text: 'O satélite TOPEX Poseidon, da NASA e da França, passa a medir a altura dos oceanos do mundo inteiro.',
    impact: 'Desde então, a velocidade de subida do mar mais que dobrou: o oceano esquenta, se expande, e o gelo das montanhas e da Groenlândia derrete.' },
  1997: { title: 'Protocolo de Kyoto',
    text: 'Os países ricos aceitam as primeiras metas obrigatórias de redução de emissões.',
    impact: 'É um primeiro passo, mas as emissões globais continuam subindo nos anos seguintes.' },
  1998: { title: 'Um El Niño fortíssimo e um ano recorde',
    text: 'Um El Niño muito forte, somado ao aquecimento, faz de 1998 o ano mais quente registrado até então.',
    impact: 'Acontece o primeiro branqueamento de corais em escala global: o calor do mar faz os corais perderem as algas que os alimentam.' },
  2003: { title: 'Onda de calor na Europa',
    text: 'Um verão extremo atinge a Europa em agosto.',
    impact: 'Estima-se que cerca de setenta mil pessoas morreram. O calor extremo passa a ser visto como um risco grave à saúde.' },
  2005: { title: 'Seca histórica na Amazônia',
    text: 'Rios da Amazônia chegam a níveis muito baixos.',
    impact: 'Comunidades ficam isoladas, peixes morrem e a floresta, sob estresse, absorve menos gás carbônico do que o normal.' },
  2007: { title: 'O gelo do Ártico despenca',
    text: 'O gelo do Ártico atinge o menor tamanho registrado até então. No mesmo ano, o IPCC recebe o Prêmio Nobel da Paz.',
    impact: 'O mundo percebe que o Ártico está mudando mais rápido do que os modelos previam.' },
  2012: { title: 'Recorde de derretimento no Ártico e na Groenlândia',
    text: 'O gelo do Ártico chega ao menor tamanho já medido, um recorde que ainda vale. Em julho, quase toda a superfície da Groenlândia derrete por alguns dias.',
    impact: 'Sem gelo branco para refletir o sol, o oceano escuro absorve mais calor, e o Ártico esquenta ainda mais rápido. É um ciclo que se alimenta.' },
  2015: { title: 'Acordo de Paris',
    text: 'Quase todos os países do mundo concordam em manter o aquecimento bem abaixo de dois graus, buscando um grau e meio acima da era pré-industrial.',
    impact: 'Cada país passa a apresentar metas próprias de redução de emissões.' },
  2016: { title: 'Novo recorde de calor',
    text: 'Com outro El Niño forte, 2016 se torna o ano mais quente registrado até então.',
    impact: 'Um novo branqueamento atinge a Grande Barreira de Corais, na Austrália, e cerca de trinta por cento dos seus corais morrem.' },
  2019: { title: 'Incêndios na Amazônia e na Austrália',
    text: 'As queimadas aumentam na Amazônia, e a Austrália enfrenta o verão negro, com incêndios gigantes.',
    impact: 'Florestas queimadas liberam gás carbônico, perdem biodiversidade, e a fumaça atinge cidades a milhares de quilômetros.' },
  2020: { title: 'A pandemia freia o mundo',
    text: 'Com o mundo parado, as emissões caem cerca de cinco por cento em um ano.',
    impact: 'Mesmo assim, o gás carbônico no ar continua subindo, porque ele fica séculos na atmosfera. Só cortes contínuos fazem diferença.' },
  2023: { title: 'O ano em que os oceanos ferveram',
    text: 'Os oceanos batem recordes de temperatura, o Canadá tem sua pior temporada de incêndios, e a Amazônia enfrenta outra seca histórica.',
    impact: 'Os extremos de calor, fogo e seca acontecem ao mesmo tempo, em vários lugares do planeta.' },
  2024: { title: 'O ano mais quente da história medida',
    text: 'A Terra chega perto de um grau e meio acima da era pré-industrial, o limite do Acordo de Paris. No Brasil, o Rio Grande do Sul sofre enchentes históricas.',
    impact: 'Chuvas extremas ficam mais fortes porque o ar mais quente guarda mais umidade.' },
  2025: { title: 'COP30 na Amazônia',
    text: 'A conferência do clima da ONU acontece em Belém, no coração da Amazônia.',
    impact: 'O mundo discute, dentro da maior floresta tropical do planeta, como cortar emissões e proteger as florestas. Daqui para a frente, você ouve as projeções.' },
};

// Marcos do futuro: montados com os dados do cenário escolhido (modelo da NASA GISS-E2.1-G).
EJ.FUTURE_YEARS = [2026, 2040, 2050, 2075, 2100];

// Impacto esperado por faixa de aquecimento (IPCC AR6, linguagem simplificada).
// A temperatura do app é em relação a 1951–1980; a era pré-industrial é ~0,3 °C mais fria.
EJ.impactFor = function (t) {
  const pre = t + 0.3;                       // aquecimento aproximado desde a era pré-industrial
  if (pre < 1.6) return 'Ondas de calor e chuvas extremas ficam mais frequentes, e muitos recifes de coral sofrem branqueamento repetido.';
  if (pre < 2.1) return 'Perto de dois graus, a maior parte dos recifes de coral pode desaparecer, e secas e enchentes ficam bem mais comuns.';
  if (pre < 3.1) return 'Perto de três graus, geleiras de montanha encolhem muito, colheitas em regiões tropicais caem e o calor extremo vira rotina em muitos lugares.';
  return 'Acima de três graus, o calor pode ficar perigoso para a saúde em boa parte do ano nas regiões tropicais, e o mar ameaça cidades costeiras no mundo todo.';
};
