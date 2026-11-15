// 🌐 Idiomas (português / inglês).
//
//  - EJ.t('chave', { variaveis }) → texto no idioma atual (textos criados pelo código).
//  - DOM: lista "seletor → campo → texto em inglês". O português é o que já está no index.html;
//    ele é guardado automaticamente na primeira troca, então o HTML não precisa ser duplicado.
//    Campos: text (textContent) · html (innerHTML) · label (último texto solto, ao lado de um ícone)
//            say (data-say, o que a narração fala) · aria (aria-label) · title (dica do mouse)
//  - EJ.i18n.set('en') troca tudo e avisa os módulos (EJ.i18n.onChange).
//  - A escolha fica salva neste navegador (localStorage), só por conveniência.
window.EJ = window.EJ || {};
EJ.i18n = (function () {
  const KEY = 'ej-lang';
  const detected = /^pt/i.test(navigator.language || '') ? 'pt' : 'en';
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* sem armazenamento */ }
  if (saved !== 'pt' && saved !== 'en') saved = null;
  let lang = saved || detected;
  const listeners = [];

  // ================================================================== TEXTOS DO CÓDIGO
  // [português, inglês]. {x} = variável.
  const S = {
    // carregamento
    'load.file': ['O globo 3D precisa de um servidor local.<br>Dê dois cliques em <b>run.bat</b> na pasta do projeto<br>e abra <b>http://localhost:8013</b>.',
                  'The 3D globe needs a local server.<br>Double-click <b>run.bat</b> in the project folder<br>and open <b>http://localhost:8013</b>.'],
    'load.error': ['Não consegui carregar <b>{url}</b>.<br>Abra pelo <b>run.bat</b> (servidor local), não pelo arquivo direto.',
                   'Could not load <b>{url}</b>.<br>Open it through <b>run.bat</b> (local server), not the file directly.'],
    'msg.intro': ['Aperte <b>Tocar</b> para ouvir 220 anos de clima · <kbd>Tab</kbd> navega com narração por voz',
                  'Press <b>Play</b> to hear 220 years of climate · <kbd>Tab</kbd> navigates with voice narration'],

    // valores
    'fmt.noSat': ['sem satélite', 'no satellite'],
    'fmt.mkm2': ['mi km²', 'M km²'],
    'fmt.noColor': ['sem cor', 'no color'],
    'fmt.bright': ['brilho', 'bright'],
    'fmt.pct': ['{v} por cento', '{v} percent'],
    'temp.avg': ['na média de 1951 a 1980', 'at the 1951 to 1980 average'],
    'temp.words': ['{v} grau{s} {dir} da média de 1951 a 1980', '{v} degree{s} {dir} the 1951 to 1980 average'],
    'temp.above': ['acima', 'above'], 'temp.below': ['abaixo', 'below'],

    // cenários
    'scn.short.ssp126': ['emissões baixas', 'low emissions'],
    'scn.short.ssp245': ['intermediário', 'intermediate'],
    'scn.short.ssp585': ['emissões muito altas', 'very high emissions'],
    'scn.in.ssp126': ['no cenário de emissões baixas', 'in the low-emissions scenario'],
    'scn.in.ssp245': ['no cenário intermediário', 'in the intermediate scenario'],
    'scn.in.ssp585': ['no cenário de emissões muito altas', 'in the very-high-emissions scenario'],
    'scn.label.ssp126': ['SSP1-2.6 · Emissões baixas', 'SSP1-2.6 · Low emissions'],
    'scn.label.ssp245': ['SSP2-4.5 · Emissões intermediárias', 'SSP2-4.5 · Intermediate emissions'],
    'scn.label.ssp585': ['SSP5-8.5 · Emissões muito altas', 'SSP5-8.5 · Very high emissions'],
    'scn.changed': ['Cenário {label}. ', 'Scenario {label}. '],

    // ano / linha do tempo
    'year.measured': ['medido', 'measured'],
    'year.projection': ['projeção · {s}', 'projection · {s}'],
    'year.time': ['tempo', 'time'],
    'slider.year': ['Ano', 'Year'],
    'slider.video': ['Posição no vídeo', 'Position in the video'],
    'slider.value': ['{y}{proj}, temperatura {t}', '{y}{proj}, temperature {t}'],
    'slider.proj': [', projeção', ', projection'],
    'slider.event': [', acontecimento: {title}', ', event: {title}'],

    // acontecimentos do futuro
    'ev.start.title': ['Começam as projeções', 'Projections begin'],
    'ev.start.text': ['Daqui em diante, os números vêm do modelo climático da NASA, {scn}. Troque o cenário no painel Camadas para ouvir a diferença.',
                      'From here on, the numbers come from NASA\'s climate model, {scn}. Change the scenario in the Layers panel to hear the difference.'],
    'ev.future.text': ['{Scn}, o planeta fica {temp}, e o gás carbônico chega a {co2} partes por milhão.{ice} O mar sobe {sea} centímetros desde 1993.',
                       '{Scn}, the planet is {temp}, and carbon dioxide reaches {co2} parts per million.{ice} The sea rises {sea} centimeters since 1993.'],
    'ev.future.ice': [' O gelo do Ártico no fim do verão fica em {v} milhões de quilômetros quadrados.',
                      ' Arctic sea ice at the end of summer stands at {v} million square kilometers.'],
    'ev.t.2040': ['O mundo em 2040', 'The world in 2040'],
    'ev.t.2050': ['Meados do século', 'Mid-century'],
    'ev.t.2075': ['O mundo em 2075', 'The world in 2075'],
    'ev.t.2100': ['Fim do século', 'End of the century'],
    'ev.t.any': ['O mundo em {y}', 'The world in {y}'],
    'ev.end': [' Que música vamos deixar para quem vem depois?', ' What music will we leave for those who come after us?'],
    'ev.speech': ['{y}. {title}. {text} Impacto na Terra: {impact}{data}', '{y}. {title}. {text} Impact on Earth: {impact}{data}'],
    'ev.data': [' Naquele ano, a temperatura estava {temp}, e o gás carbônico em {co2} partes por milhão.',
                ' That year, the temperature was {temp}, and carbon dioxide was at {co2} parts per million.'],
    'ev.thisYear': ['Acontecimento deste ano: {title}. {impact} ', 'Event this year: {title}. {impact} '],
    'ev.last': ['Último acontecimento: {y}, {title}. Aperte fecha colchete para ouvir o próximo. ',
                'Last event: {y}, {title}. Press the right bracket key to hear the next one. '],
    'ev.none.next': ['Não há mais acontecimentos depois deste ano.', 'There are no more events after this year.'],
    'ev.none.prev': ['Este é o primeiro acontecimento.', 'This is the first event.'],

    // botão tocar
    'play.play': ['Tocar', 'Play'],
    'play.play.say': ['Tocar. Começa a música do clima: os anos passam de 1880 até 2100 e cada dado da NASA vira um instrumento. Atalho: barra de espaço.',
                      'Play. Starts the music of climate: the years go by from 1880 to 2100 and each NASA dataset becomes an instrument. Shortcut: space bar.'],
    'play.pause': ['Pausar', 'Pause'],
    'play.pause.say': ['Pausar. Para a música e a linha do tempo no ano atual. Atalho: barra de espaço.',
                       'Pause. Stops the music and the timeline at the current year. Shortcut: space bar.'],
    'play.again': ['Tocar de novo', 'Play again'],
    'play.again.say': ['Tocar de novo. A música chegou em 2100; aperte para recomeçar de 1880.',
                       'Play again. The music reached 2100; press to start over from 1880.'],
    'play.stop': ['Parar', 'Stop'],
    'play.stop.say': ['Parar. Interrompe a partitura que está tocando.', 'Stop. Interrupts the score that is playing.'],
    'play.key': ['Espaço', 'Space'],
    'play.from': ['Tocando a partir de {y}.', 'Playing from {y}.'],
    'play.paused': ['Pausado em {y}.', 'Paused at {y}.'],
    'play.stopped': ['Parado.', 'Stopped.'],
    'play.end': ['Fim da linha do tempo, 2100. Aperte tocar para recomeçar.', 'End of the timeline, 2100. Press play to start over.'],

    // descrição da tela
    'desc.score': ['Partitura {name}, com {n} notas. Aperte tocar para ouvir.', 'Score {name}, with {n} notes. Press play to listen.'],
    'desc.file': ['Arquivo {name}. ', 'File {name}. '],
    'desc.harmony': [' A música está em {mode}.', ' The music is in {mode}.'],
    'desc.noFrame': ['Ainda sem quadro analisado.', 'No frame analyzed yet.'],
    'desc.projected': [', projeção no cenário {s}', ', projection in the {s} scenario'],
    'desc.measured': [', valor medido', ', measured value'],
    'desc.values': ['Temperatura {temp} em relação à média de 1951 a 1980; CO₂ {co2}; gelo do Ártico {ice}; nível do mar {sea} em relação a 1993. ',
                    'Temperature {temp} relative to the 1951 to 1980 average; CO₂ {co2}; Arctic ice {ice}; sea level {sea} relative to 1993. '],
    'desc.music': ['A música está em {mode}: quanto mais quente, mais instável a harmonia. ', 'The music is in {mode}: the warmer it is, the more unstable the harmony. '],
    'desc.layers': ['Camadas ligadas no globo: {list}. ', 'Layers on the globe: {list}. '],
    'desc.noLayers': ['Nenhuma camada ligada. ', 'No layers turned on. '],
    'desc.harmonyShort': ['Harmonia: {mode}.', 'Harmony: {mode}.'],
    'layer.lights': ['luzes das cidades', 'city lights'], 'layer.sea': ['inundação', 'flooding'],
    'layer.ice': ['gelo do Ártico', 'Arctic ice'], 'layer.heat': ['mapa de calor', 'heat map'],
    'layer.clouds': ['nuvens', 'clouds'], 'layer.ndvi': ['vegetação', 'vegetation'], 'layer.fire': ['queimadas', 'fires'],
    'layer.wind': ['ventos', 'winds'], 'layer.ozone': ['ozônio', 'ozone'], 'layer.ocean': ['correntes do mar', 'ocean currents'],

    // botões e avisos
    'mute.on': ['Silenciar a música', 'Mute the music'],
    'mute.off': ['Devolver o som da música', 'Turn the music back on'],
    'scan.none': ['Nenhum quadro disponível para varrer ainda.', 'No frame available to scan yet.'],
    'scan.go': ['Varrendo a imagem da esquerda para a direita: notas mais agudas são partes mais altas da imagem. ',
                'Scanning the image from left to right: higher notes are higher parts of the image. '],
    'rec.start': ['Gravar áudio', 'Record audio'],
    'rec.stop': ['Parar gravação', 'Stop recording'],
    'rec.saved': ['Gravação salva na pasta de downloads.', 'Recording saved to your downloads folder.'],
    'rec.on': ['Gravando o áudio. Aperte tocar para gerar música e aperte de novo em gravar para salvar.',
               'Recording audio. Press play to make music and press record again to save.'],
    'rec.unsupported': ['Seu navegador não suporta gravação de áudio.', 'Your browser does not support audio recording.'],
    'profile.changed': ['Perfil de som: {label}', 'Sound profile: {label}'],
    'media.unsupported': ['Formato não suportado: use imagem ou vídeo.', 'Unsupported format: use an image or a video.'],
    'media.alt': ['Imagem carregada: {name}', 'Loaded image: {name}'],
    'media.scoreMsg': ['Partitura {name}: aperte Tocar (ou S) para ouvir a melodia.', 'Score {name}: press Play (or S) to hear the melody.'],
    'media.msg': ['{name}: escolha um perfil de som e aperte Tocar ou Varrer.', '{name}: choose a sound profile and press Play or Scan.'],
    'media.loaded': ['{kind} {name} carregado. Aperte tocar ou varrer para ouvir.', '{kind} {name} loaded. Press play or scan to listen.'],
    'media.video': ['Vídeo', 'Video'], 'media.image': ['Imagem', 'Image'],
    'media.back': ['De volta ao globo.', 'Back to the globe.'],
    'media.backMsg': ['De volta ao globo. Aperte Tocar para ouvir o clima.', 'Back to the globe. Press Play to hear the climate.'],

    // partituras
    'score.title': ['Partitura', 'Score'],
    'score.aria': ['Partitura {title} com {n} notas', 'Score {title} with {n} notes'],
    'score.readAria': ['Partitura lida: {n} notas em {staves} pautas', 'Score read: {n} notes on {staves} staves'],
    'score.reading': ['Lendo {name}…', 'Reading {name}…'],
    'score.useFormats': ['use MusicXML, MIDI ou imagem', 'use MusicXML, MIDI or an image'],
    'score.cantRead': ['Não consegui ler {name}: {err}', 'Could not read {name}: {err}'],
    'score.empty': ['A partitura não tem notas.', 'The score has no notes.'],
    'score.msg': ['{title}: {n} notas, {secs} s{exp}. Aperte Tocar.', '{title}: {n} notes, {secs} s{exp}. Press Play.'],
    'score.exp': [' (leitura de imagem experimental — confira as marcas verdes)', ' (experimental image reading — check the green marks)'],
    'score.loaded': ['Partitura carregada: {n} notas, {secs} segundos. Começa com {first}. Aperte tocar.',
                     'Score loaded: {n} notes, {secs} seconds. It starts with {first}. Press play.'],
    'score.err.xml': ['XML inválido', 'invalid XML'],
    'score.err.part': ['MusicXML sem <part>', 'MusicXML without <part>'],
    'score.err.mxl': ['.mxl sem partitura dentro', '.mxl file without a score inside'],
    'score.err.midi': ['não é um arquivo MIDI', 'not a MIDI file'],
    'score.err.smpte': ['MIDI com tempo SMPTE não suportado', 'MIDI with SMPTE timing is not supported'],
    'score.err.track': ['trilha MIDI inválida', 'invalid MIDI track'],
    'score.err.staff': ['não achei a pauta (5 linhas). Use uma imagem nítida e reta.', 'could not find the staff (5 lines). Use a sharp, straight image.'],
    'score.err.notes': ['achei a pauta, mas nenhuma nota cheia (preta).', 'found the staff, but no filled (black) notes.'],
    'score.err.format': ['formato não suportado', 'unsupported format'],

    // visão (descrição da imagem)
    'vis.dominated': ['dominada por {list}', 'dominated by {list}'],
    'vis.and': [' e ', ' and '],
    'vis.noColor': ['quase sem cor', 'almost colorless'],
    'vis.b0': ['muito escura', 'very dark'], 'vis.b1': ['escura', 'dark'], 'vis.b2': ['equilibrada', 'balanced'], 'vis.b3': ['clara', 'bright'],
    'vis.m0': ['sem movimento perceptível', 'with no noticeable motion'], 'vis.m1': ['com movimento suave', 'with gentle motion'],
    'vis.m2': ['com movimento forte', 'with strong motion'],
    'vis.sentence': ['Imagem {bright}, {colors}; {dens}% dos pixels são pontos brilhantes; {mov}.',
                     'A {bright} image, {colors}; {dens}% of the pixels are bright points; {mov}.'],

    // narração (a11y.js)
    'a.on': ['Ligado.', 'On.'], 'a.off': ['Desligado.', 'Off.'], 'a.toggleHint': ['Espaço ou Enter alterna.', 'Space or Enter toggles.'],
    'a.panelOpen': ['Painel aberto.', 'Panel open.'], 'a.panelClosed': ['Painel fechado.', 'Panel closed.'],
    'a.muted': ['Agora está silenciado.', 'Now muted.'], 'a.playing': ['Agora está tocando.', 'Now playing.'],
    'a.soloOn': ['Solo ligado.', 'Solo on.'], 'a.musicMuted': ['A música está silenciada.', 'The music is muted.'],
    'a.active': ['Ativado.', 'Active.'], 'a.inactive': ['Desativado.', 'Inactive.'],
    'a.checked': ['Marcado.', 'Checked.'], 'a.unchecked': ['Desmarcado.', 'Unchecked.'],
    'a.radio': ['Opção {i} de {n}{sel}. Setas trocam a opção.', 'Option {i} of {n}{sel}. Arrow keys change the option.'],
    'a.selected': [', selecionada', ', selected'],
    'a.value': ['Valor: {v}.', 'Value: {v}.'],
    'a.chosen': ['Selecionado: {v}.', 'Selected: {v}.'],
    'a.yearValue': ['Valor no ano atual: {v}.', 'Value in the current year: {v}.'],
    'a.newTab': ['Link, abre em nova aba.', 'Link, opens in a new tab.'],
    'a.disabled': ['Indisponível agora.', 'Unavailable right now.'],
    'a.welcome': ['Earth Jukebox, a música do clima. A narração por voz está ligada: cada botão diz o que faz quando você chega nele com Tab. Se você já usa um leitor de tela, aperte V para desligar a narração. Aperte interrogação para ver os atalhos, L para trocar o idioma, ou espaço para tocar.',
                  'Earth Jukebox, the music of climate. Voice narration is on: each button says what it does when you reach it with Tab. If you already use a screen reader, press V to turn the narration off. Press the question mark for shortcuts, L to change the language, or space to play.'],
    'a.switchState': ['{name}: {state}.', '{name}: {state}.'],
    'a.onWord': ['ligado', 'on'], 'a.offWord': ['desligado', 'off'],
    'a.layerMuted': ['Silenciado.', 'Muted.'], 'a.layerBack': ['Tocando de novo.', 'Playing again.'],
    'a.soloOnly': ['Ouvindo só {name}.', 'Listening only to {name}.'], 'a.allBack': ['Todos os instrumentos de volta.', 'All instruments back.'],
    'a.musicOff': ['Música silenciada.', 'Music muted.'], 'a.musicOn': ['Música de volta.', 'Music back on.'],
    'a.repeatOn': ['Repetir ligado.', 'Repeat on.'], 'a.repeatOff': ['Repetir desligado.', 'Repeat off.'],
    'a.hidden': ['Interface escondida. Aperte H, ou o botão Mostrar interface no canto inferior direito, para trazer os botões de volta.',
                 'Interface hidden. Press H, or the Show interface button in the bottom right corner, to bring the buttons back.'],
    'a.shown': ['Interface de volta.', 'Interface back.'],
    'a.fsExit': ['Sair da tela cheia', 'Exit full screen'], 'a.fsEnter': ['Tela cheia', 'Full screen'],
    'a.fsOn': ['Tela cheia. Aperte F ou Esc para sair.', 'Full screen. Press F or Escape to exit.'],
    'a.fsOff': ['Saiu da tela cheia.', 'Left full screen.'],
    'a.zoom': ['Zoom {v} por cento.', 'Zoom {v} percent.'],
    'a.centered': ['Terra centralizada.', 'Earth centered.'],
    'a.voiceOff': ['Narração desligada. Aperte V para ligar de novo.', 'Narration off. Press V to turn it back on.'],
    'a.voiceOn': ['Narração ligada.', 'Narration on.'],
    'a.storyOn': ['Contar a história ligado: a música pausa em cada acontecimento para contar o que aconteceu e o impacto na Terra.',
                  'Tell the story on: the music pauses at each event to tell what happened and the impact on Earth.'],
    'a.storyOff': ['Contar a história desligado: a música toca sem pausas.', 'Tell the story off: the music plays without pauses.'],
    'a.rate': ['Velocidade da voz ajustada.', 'Voice speed adjusted.'],
    'a.langSet': ['Idioma: português do Brasil.', 'Language: English.'],
    'a.tour': [
      'Guia do Earth Jukebox. No centro da tela está a Terra em 3D. Cada dado do clima medido pela NASA vira um instrumento: a temperatura é a melodia, o gás carbônico é um som grave, o gelo do Ártico são sinos e o nível do mar são ondas. Embaixo fica a barra de reprodução: o botão Tocar, o ano atual e a linha do tempo de 1880 a 2100. Até 2025 são medições; depois, projeções do modelo da NASA. Quanto mais quente, menos harmônica a música. No topo ficam cinco painéis: Camadas, para ligar o que aparece no globo e escolher o cenário do futuro; Instrumentos, para ouvir cada som sozinho; Ouvir, para transformar imagens e partituras em música; Acessibilidade; e Sobre. Atalhos: espaço toca e pausa; setas mudam o ano; colchetes pulam entre acontecimentos; D descreve a tela; V liga ou desliga esta narração; L troca o idioma; H esconde os botões; F deixa em tela cheia; mais e menos aproximam e afastam a Terra. Aperte Tab para começar a explorar. Boa viagem pelo clima do planeta.',
      'Earth Jukebox guide. In the center of the screen is the Earth in 3D. Each climate dataset measured by NASA becomes an instrument: temperature is the melody, carbon dioxide is a low drone, Arctic ice is bells and sea level is waves. At the bottom is the playback bar: the Play button, the current year and the timeline from 1880 to 2100. Up to 2025 these are measurements; after that, projections from NASA\'s model. The warmer it gets, the less harmonious the music. At the top are five panels: Layers, to turn on what appears on the globe and choose the future scenario; Instruments, to hear each sound alone; Listen, to turn images and scores into music; Accessibility; and About. Shortcuts: space plays and pauses; arrows change the year; brackets jump between events; D describes the screen; V turns this narration on or off; L changes the language; H hides the buttons; F goes full screen; plus and minus zoom the Earth in and out. Press Tab to start exploring. Enjoy your journey through the planet\'s climate.'],

    // easter egg
    'egg.local': ['Ocarina: tocando seu MIDI local ({s} s). Esc ou Tocar para parar.', 'Ocarina: playing your local MIDI ({s} s). Escape or Play to stop.'],
    'egg.found': ['Você achou o segredo da ocarina! "Canção do Planeta Azul" — Earth Jukebox.', 'You found the ocarina secret! "Song of the Blue Planet" — Earth Jukebox.'],

    // idioma
    'lang.btn': ['Idioma: português. Trocar idioma', 'Language: English. Change language'],
  };

  // ================================================================== TEXTOS DA PÁGINA (inglês)
  const SAY = 'say', TXT = 'text', HTML = 'html', LBL = 'label', ARIA = 'aria', TTL = 'title';
  const chip = (id, b, small, say) => [[`${id} b`, TXT, b], [`${id} small`, TXT, small], [id, SAY, say]];
  const card = (k, lbl, snd, say, muteAria, muteSay) => [
    [`.card[data-layer=${k}] .lbl`, TXT, lbl], [`.card[data-layer=${k}] .snd`, TXT, snd], [`.card[data-layer=${k}] .solo`, SAY, say],
    [`.card[data-layer=${k}] .mute-layer`, ARIA, muteAria], [`.card[data-layer=${k}] .mute-layer`, SAY, muteSay]];
  const panel = (id, title, say, closeName) => [
    [`#h-${id}`, TXT, title], [`#h-${id}`, SAY, say],
    [`#p-${id} .close`, ARIA, `Close the ${closeName} panel`], [`#p-${id} .close`, SAY, `Close the ${closeName} panel. Shortcut: Escape.`]];

  const DOM = [
    ['.skip', TXT, 'Skip to playback controls'],
    ['.skip', SAY, 'Skip to playback controls. Press Enter to go straight to the Play button.'],
    ['#globe', ARIA, '3D globe of the Earth showing the selected climate data layers'],
    ['#loading p', TXT, 'Loading the Earth…'],
    ['.tagline', TXT, 'The music of climate · NASA data'],
    ['.toolbar', ARIA, 'Main menu'],
    ['[aria-controls=p-layers] span', TXT, 'Layers'],
    ['[aria-controls=p-layers]', SAY, 'Layers. Opens the panel where you choose the future scenario and turn on or off what appears on the globe: heat, ice, flooding, city lights, clouds, winds, ozone, vegetation, fires and ocean currents.'],
    ['[aria-controls=p-sound] span', TXT, 'Instruments'],
    ['[aria-controls=p-sound]', SAY, 'Instruments. Opens the panel with the five instruments of the music and the values for the current year: temperature, carbon dioxide, Arctic ice, sea level and image reading. There you can hear each instrument alone, mute it and adjust the volume.'],
    ['[aria-controls=p-files] span', TXT, 'Listen'],
    ['[aria-controls=p-files]', SAY, 'Listen to files. Opens the panel to turn a NASA image or video into music, or to play a score in MusicXML, MIDI or image format.'],
    ['[aria-controls=p-a11y] span', TXT, 'Accessibility'],
    ['[aria-controls=p-a11y]', SAY, 'Accessibility. Opens the options for voice narration, voice speed, interface sounds, text size, high contrast and reduced motion, plus the list of keyboard shortcuts. Shortcut: question mark key.'],
    ['[aria-controls=p-about] span', TXT, 'About'],
    ['[aria-controls=p-about]', SAY, 'About. Explains the project, how the image becomes sound and where the NASA data comes from.'],
    ['.viewtools', ARIA, 'View'],
    ['#zoom-out', ARIA, 'Zoom out'], ['#zoom-out', TTL, 'Zoom out (−)'],
    ['#zoom-out', SAY, 'Zoom out. Moves the camera away to see the whole Earth. Shortcut: minus key.'],
    ['#zoom-in', ARIA, 'Zoom in'], ['#zoom-in', TTL, 'Zoom in (+)'],
    ['#zoom-in', SAY, 'Zoom in. Moves the camera closer to see the relief and the layers up close. Shortcut: plus key.'],
    ['#zoom-reset', ARIA, 'Center the Earth'], ['#zoom-reset', TTL, 'Center (0)'],
    ['#zoom-reset', SAY, 'Center. Returns the camera to its initial position and distance. Shortcut: zero key.'],
    ['#ui-hide', ARIA, 'Hide the interface'], ['#ui-hide', TTL, 'Hide the interface (H)'],
    ['#ui-hide', SAY, 'Hide the interface. Hides all buttons so you see only the Earth. To show them again, press H or the button in the bottom right corner.'],
    ['#fullscreen', TTL, 'Full screen (F)'],
    ['#fullscreen', SAY, 'Full screen. Makes Earth Jukebox fill the entire screen. Shortcut: F key. To exit, press F or Escape.'],
    ['#lang-btn', TTL, 'Language (L)'],
    ['#lang-btn', SAY, 'Language. Opens the language choice: Portuguese or English. Text, voice narration and descriptions all change. Shortcut: L key.'],

    // camadas
    ...panel('layers', 'Layers', 'Layers panel. Choose the future scenario and turn the globe layers on or off. Use Tab to move through it; Escape closes the panel.', 'Layers'),
    ['.scenarios legend', HTML, 'Future scenario <span class="hint">(projections from 2026 to 2100)</span>'],
    ['input[value=ssp126]', SAY, 'Low emissions, scenario SSP1-2.6: the world cuts emissions quickly; by 2100 the planet is about 1.8 degrees above the 1951 to 1980 average.'],
    ['.scn[data-tone=low] b', TXT, 'Low emissions'], ['.scn[data-tone=low] small', TXT, 'SSP1-2.6 · ~+1.8 °C by 2100'],
    ['input[value=ssp245]', SAY, 'Intermediate emissions, scenario SSP2-4.5: the world carries on roughly as today; by 2100 the planet is about 2.6 degrees above the 1951 to 1980 average.'],
    ['.scn[data-tone=mid] b', TXT, 'Intermediate'], ['.scn[data-tone=mid] small', TXT, 'SSP2-4.5 · ~+2.6 °C by 2100'],
    ['input[value=ssp585]', SAY, 'Very high emissions, scenario SSP5-8.5: fossil fuel use grows strongly; by 2100 the planet is about 4.5 degrees above the 1951 to 1980 average.'],
    ['.scn[data-tone=high] b', TXT, 'Very high'], ['.scn[data-tone=high] small', TXT, 'SSP5-8.5 · ~+4.5 °C by 2100'],
    ['#p-layers h3.group:nth-of-type(1)', TXT, 'Earth and climate'],
    ['#p-layers h3.group:nth-of-type(2)', TXT, 'Atmosphere'],
    ['#p-layers h3.group:nth-of-type(3)', TXT, 'Life and ocean'],
    ['#p-layers h3.group:nth-of-type(4)', TXT, 'Motion'],
    ...chip('.chip[data-viz=heat]', 'Heat map', 'temperature by region', 'Heat map. Paints the globe with each region\'s temperature compared with 1951 to 1980: blue is colder; yellow, red and purple are increasingly warmer.'),
    ...chip('.chip[data-viz=ice]', 'Arctic ice', 'September ice cap', 'Arctic ice. Shows the Arctic sea ice cap in September; it shrinks following NASA satellite data.'),
    ...chip('.chip[data-viz=sea]', 'Flooding', 'low coastlines', 'Flooding. Shows the low coastal areas that end up underwater as the sea level rises. The height is exaggerated so it is visible on the whole globe.'),
    ...chip('.chip[data-viz=lights]', 'City lights', 'night side', 'City lights. Shows the night lights, which turn on as industrialization advances. Flooded cities go dark.'),
    ...chip('.chip[data-viz=clouds]', 'Clouds', 'VIIRS satellite', 'Clouds. Shows sixteen consecutive days of real clouds photographed by NASA\'s VIIRS satellite, in motion.'),
    ...chip('.chip[data-viz=wind]', 'Winds', 'decade average', 'Winds. Thousands of light trails follow the average wind of each decade, calculated by NASA\'s climate model.'),
    ...chip('.chip[data-viz=ozone]', 'Ozone', 'Antarctic hole', 'Ozone. Shows the hole in the ozone layer over Antarctica, from 1979 to 2025. Below 220 Dobson units it appears in purple. It grew until the 2000s and is now recovering.'),
    ...chip('.chip[data-viz=ndvi]', 'Vegetation', '2001 to 2025', 'Vegetation. Shows the green of forests and crops in the greenest month of each year, measured by the MODIS satellite, from 2001 to 2025.'),
    ...chip('.chip[data-viz=fire]', 'Fires', '2001 to 2025', 'Fires. Glowing embers where fire was frequent in each year, detected by the MODIS satellites, from 2001 to 2025.'),
    ...chip('.chip[data-viz=ocean]', 'Ocean currents', 'water in motion', 'Ocean currents. The water flows along the great ocean currents, such as the Gulf Stream, and the trails turn sea-green where the current is strong.'),
    ...chip('.chip[data-viz=spin]', 'Spin the Earth', 'day and night', 'Spin the Earth. Makes the planet turn slowly, like day and night going by. When off, the Earth stays still and you can rotate it by dragging.'),

    // instrumentos
    ...panel('sound', 'Instruments', 'Instruments panel. Each climate dataset is an instrument. Press an instrument to hear it alone; the speaker button next to it mutes it. Escape closes the panel.', 'Instruments'),
    ['#p-sound > p.note', TXT, 'Tap an instrument to hear it alone. The speaker turns each one on or off.'],
    ['.volume > span', LBL, ' Music volume'],
    ['#volume', SAY, 'Music volume. The right and left arrows adjust the overall volume.'],
    ...card('temp', 'Temperature', 'melody: darkens and goes out of tune in the heat', 'Temperature, melody. The warmer the planet, the higher and more unstable the harmony. Press to hear only this instrument.', 'Mute temperature', 'Mute temperature. Turns the melody on or off in the music.'),
    ...card('co2', 'CO₂', 'drone: distorts with more CO₂', 'Carbon dioxide, drone. A low continuous sound that gets more distorted the more CO2 there is in the air. Press to hear only this instrument.', 'Mute CO₂', 'Mute carbon dioxide. Turns the drone on or off in the music.'),
    ...card('ice', 'Arctic ice', 'bells: fade as the ice melts', 'Arctic ice, bells. They ring often when there is a lot of ice and fade away as it melts. Press to hear only this instrument.', 'Mute Arctic ice', 'Mute Arctic ice. Turns the bells on or off in the music.'),
    ...card('sea', 'Sea level', 'waves: grow with the sea', 'Sea level, waves. An ocean sound that gets stronger and brighter as the sea rises. Press to hear only this instrument.', 'Mute sea level', 'Mute sea level. Turns the waves on or off in the music.'),
    ...card('img', 'Image', 'chords and arpeggios read from the pixels', 'Image, vision. The app looks at the globe drawn on screen and turns colors, brightness and motion into chords and arpeggios. Press to hear only this instrument.', 'Mute image reading', 'Mute image reading. Turns the vision chords on or off in the music.'),
    ['#chart', ARIA, 'Chart of temperature, CO₂, Arctic ice and sea level from 1880 to 2100'],
    ['.legend span:nth-child(1)', TXT, 'temperature'], ['.legend span:nth-child(3)', TXT, 'ice'], ['.legend span:nth-child(4)', TXT, 'sea'],

    // ouvir arquivos
    ...panel('files', 'Listen to files', 'Listen to files panel. Turn an image or video into music, or play a score. Escape closes the panel.', 'Listen to files'),
    ['#p-files h3.group:nth-of-type(1)', TXT, 'Image or video'],
    ['#p-files h3.group:nth-of-type(2)', TXT, 'Score'],
    ['#p-files > p.note:nth-of-type(1)', TXT, 'Open (or drag onto the screen) a visualization from NASA\'s Earth Information Center or Scientific Visualization Studio. Colors, brightness and motion become music.'],
    ['#p-files > p.note:nth-of-type(2)', HTML, '<b>MusicXML</b> or <b>MIDI</b> (MuseScore, IMSLP) play exactly. A <b>photo</b> of a score is experimental: straight staff, treble clef, a single melody line.'],
    ['#frame-btn', LBL, ' Open image or video'],
    ['#frame-btn', SAY, 'Open image or video. Choose a file from your computer; the app turns its colors, brightness and motion into music. You can also drag the file onto the screen.'],
    ['#globe-btn', LBL, ' Back to the globe'],
    ['#globe-btn', SAY, 'Back to the globe. Closes the open image and returns to the Earth and the timeline.'],
    ['#p-files label.field', LBL, 'Sound profile'],
    ['#profile', SAY, 'Sound profile. Changes how the image becomes music: balanced, pulse for lights and lightning, flow for currents and aerosols, or forest, where color decides the note. Up and down arrows choose.'],
    ['#scan', LBL, ' Scan '],
    ['#scan', SAY, 'Scan the image. A line sweeps the image from left to right and the higher parts become higher notes. It also works on the globe. Shortcut: S key.'],
    ['#rec', SAY, 'Record audio. Records everything that plays from now on; when you press it again, it downloads a sound file.'],
    ['#score-btn', LBL, ' Open score'],
    ['#score-btn', SAY, 'Open score. Plays a MusicXML or MIDI file exactly as written. It also tries to read a photo of a simple score, with a treble clef and a single melody line.'],

    // acessibilidade
    ...panel('a11y', 'Accessibility', 'Accessibility panel. Adjust voice narration, interface sounds, text size, contrast and motion. The keyboard shortcuts are at the end. Escape closes the panel.', 'Accessibility'),
    ...chip('#opt-voice', 'Voice narration', 'reads each button as you Tab · V key', 'Voice narration. When on, each button says out loud what it does when it receives focus with Tab, and screen descriptions are read too. If you already use a screen reader, you can turn it off to avoid hearing things twice. Shortcut: V key.'),
    ...chip('#opt-chimes', 'Interface sounds', 'chimes in the key of the music', 'Interface sounds. Short musical chimes, in the same key as the music, when you navigate, turn things on or off and open panels.'),
    ...chip('#opt-story', 'Tell the story', 'pauses at events and tells the impact on Earth', 'Tell the story. The music pauses at each important event, from 1880 to 2100, and the voice or your screen reader tells what happened and the impact on Earth. Then the music continues on its own.'),
    ['#p-a11y label.field', LBL, 'Voice speed'],
    ['#opt-rate', SAY, 'Voice speed. Choose slow, normal or fast.'],
    ['#opt-rate option[value="0.85"]', TXT, 'Slow'], ['#opt-rate option[value="1.35"]', TXT, 'Fast'],
    ['.segmented legend', LBL, ' Text size'],
    ['input[name=opt-size][value="1"]', SAY, 'Normal text.'],
    ['input[name=opt-size][value="1.18"]', SAY, 'Large text.'],
    ['input[name=opt-size][value="1.36"]', SAY, 'Extra large text.'],
    ['.segmented label:nth-of-type(2) span', TXT, 'Large'], ['.segmented label:nth-of-type(3) span', TXT, 'Extra large'],
    ...chip('#opt-contrast', 'High contrast', 'opaque panels, strong borders', 'High contrast. Makes the panels dark and opaque, with stronger borders and text, for people with low vision.'),
    ...chip('#opt-motion', 'Reduce motion', 'Earth still, no animations', 'Reduce motion. Stops the Earth\'s rotation and the interface animations, for people who feel dizzy or uncomfortable with motion.'),
    ['#tour', LBL, ' Listen to the guide'],
    ['#tour', SAY, 'Listen to the guide. A voice explains in one minute how to use Earth Jukebox.'],
    ['#opt-lang', LBL, ' Language: Português / English'],
    ['#opt-lang', SAY, 'Language. Opens the language choice: Portuguese or English. Shortcut: L key.'],
    ['#p-a11y h3.group', LBL, ' Keyboard shortcuts'],
    ['.keys dt:nth-of-type(2) kbd', TXT, 'Space'],
    ...['go to the next control (with narration)', 'play / pause', 'previous / next year (Shift: 10 years)',
        'previous / next event (and listen)', 'describe the screen', 'scan the image', 'mute the music',
        'turn narration on / off', 'change language', 'zoom in / zoom out / center', 'hide / show the interface',
        'full screen', 'opens this panel', 'closes the open panel']
      .map((t, i) => [`.keys dd:nth-of-type(${i + 1})`, TXT, t]),

    // sobre
    ...panel('about', 'About', 'About panel. Explains the project and the data. Use the down arrow to read the text with your screen reader, or Tab for the links. Escape closes the panel.', 'About'),
    ['#p-about > p:nth-of-type(1)', TXT, 'The music of climate: NASA data from 1880 to 2100 become instruments and layers over the Earth. The warmer the planet, the less harmonious the music.'],
    ['#p-about h3:nth-of-type(1)', TXT, 'How the image becomes sound'],
    ['#p-about h3:nth-of-type(2)', TXT, 'Data and credits'],
    ['#p-about ul:nth-of-type(1)', HTML,
      '<li><b>Color</b> → chord notes · <b>Brightness</b> → timbre</li>' +
      '<li><b>Bright points</b> → arpeggio · <b>Edges</b> → rhythmic hiss · <b>Motion</b> → low thumps</li>' +
      '<li><b>Scan</b> → from left to right; higher in the image = higher note</li>' +
      '<li><b>Heat</b> → the scale darkens (from major to Locrian) and goes out of tune</li>'],
    ['#p-about ul:nth-of-type(2)', HTML,
      '<li>Temperature: <a href="https://data.giss.nasa.gov/gistemp/" target="_blank" rel="noopener">NASA GISTEMP v4</a></li>' +
      '<li>CO₂: <a href="https://portal.nccs.nasa.gov/GISS_modelE/modelE_input_data/" target="_blank" rel="noopener">NASA GISS</a> (CMIP6 concentrations)</li>' +
      '<li>Arctic ice: <a href="https://earth.gsfc.nasa.gov/cryo/data/arcticantarctic-sea-ice-time-series" target="_blank" rel="noopener">NASA GSFC</a></li>' +
      '<li>Sea level: <a href="https://podaac.jpl.nasa.gov/dataset/NASA_SSH_GMSL_INDICATOR" target="_blank" rel="noopener">NASA-SSH</a> (being integrated)</li>' +
      '<li>Projections: <a href="https://data.giss.nasa.gov/modelE/cmip6/" target="_blank" rel="noopener">NASA GISS-E2.1-G</a> climate model (CMIP6)</li>' +
      '<li>Layers: <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" target="_blank" rel="noopener">NASA GIBS</a> (VIIRS clouds, MODIS vegetation and fires), GISTEMP map, GISS-E2.1-G winds and currents, ozone from <a href="https://ozonewatch.gsfc.nasa.gov" target="_blank" rel="noopener">NASA Ozone Watch</a></li>' +
      '<li>Textures: NASA Blue Marble &amp; Black Marble · 3D: three.js · Icons: <a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a> (ISC)</li>' +
      '<li>Visualizations to listen to: <a href="https://svs.gsfc.nasa.gov/" target="_blank" rel="noopener">NASA SVS</a> · <a href="https://earth.gov/" target="_blank" rel="noopener">Earth Information Center</a></li>'],
    ['#p-about > p.note', TXT, 'Flooding and the ice edge use real relief and extent, with visual exaggeration so they can be read at a global scale. The projections come from one simulation of NASA\'s model per SSP scenario; details and adjustments in the README.'],

    // barra de reprodução
    ['#ev-prev', ARIA, 'Previous event'], ['#ev-prev', TTL, 'Previous event ( [ )'],
    ['#ev-prev', SAY, 'Previous event. Goes back to the previous historical event on the timeline and tells what happened. Shortcut: left bracket key.'],
    ['#ev-next', ARIA, 'Next event'], ['#ev-next', TTL, 'Next event ( ] )'],
    ['#ev-next', SAY, 'Next event. Moves forward to the next historical event on the timeline and tells what happened and the impact on Earth. Shortcut: right bracket key.'],
    ['#slider', SAY, 'Timeline. Choose a year between 1880 and 2100. Up to 2025 these are measurements; after that, projections from NASA\'s model. The arrows change one year, Page Up and Page Down change ten years, Home goes to 1880 and End to 2100.'],
    ['.ticks .now', TXT, 'today'],
    ['#mute', TTL, 'Mute (M)'],
    ['#mute', SAY, 'Mute the music. Turns all the climate music off or back on. Shortcut: M key.'],
    ['#story', ARIA, 'Tell the story'], ['#story', TTL, 'Tell the story'],
    ['#story', SAY, 'Tell the story. When on, the music pauses at each important event, tells what happened and the impact on Earth, and then continues on its own.'],
    ['#describe', ARIA, 'Describe the screen'], ['#describe', TTL, 'Describe (D)'],
    ['#describe', SAY, 'Describe the screen. Reads out loud the year, the climate values, the harmony of the music and the layers turned on on the globe. Shortcut: D key.'],
    ['#loop-label', TTL, 'Repeat'],
    ['#loop', SAY, 'Repeat. When checked, the music goes back to 1880 when it reaches 2100 and keeps going.'],
    ['#loop-label .sr-only', TXT, 'Repeat without stopping'],
    ['#ui-show', ARIA, 'Show the interface'], ['#ui-show', TTL, 'Show the interface (H)'],
    ['#ui-show', SAY, 'Show the interface. Brings back all the buttons. Shortcut: H key.'],
    ['#ui-show span', TXT, 'Show interface'],
    ['meta[name=description]', 'content', 'The music of climate: NASA data from 1880 to 2100 become music and layers over an accessible 3D globe.'],
  ];

  // ================================================================== MOTOR
  const original = new Map();                       // elemento → { campo: texto em português }
  function lastText(el) {                           // último texto "solto" (ao lado de um ícone)
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
    return nodes[nodes.length - 1] || null;
  }
  function read(el, field) {
    if (field === TXT) return el.textContent;
    if (field === HTML) return el.innerHTML;
    if (field === LBL) { const n = lastText(el); return n ? n.nodeValue : null; }
    if (field === SAY) return el.dataset.say;
    if (field === ARIA) return el.getAttribute('aria-label');
    if (field === TTL) return el.getAttribute('title');
    return el.getAttribute(field);
  }
  function write(el, field, v) {
    if (v == null) return;
    if (field === TXT) el.textContent = v;
    else if (field === HTML) el.innerHTML = v;
    else if (field === LBL) { const n = lastText(el); if (n) n.nodeValue = v; }
    else if (field === SAY) el.dataset.say = v;
    else if (field === ARIA) el.setAttribute('aria-label', v);
    else if (field === TTL) el.setAttribute('title', v);
    else el.setAttribute(field, v);
  }
  function applyDOM() {
    for (const [sel, field, en] of DOM) {
      document.querySelectorAll(sel).forEach(el => {
        let o = original.get(el);
        if (!o) original.set(el, o = {});
        if (!(field in o)) o[field] = read(el, field);   // guarda o português na primeira vez
        write(el, field, lang === 'en' ? en : o[field]);
      });
    }
  }

  function t(key, vars) {
    const e = S[key];
    let s = e ? (lang === 'en' ? e[1] : e[0]) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  }

  function set(l, { silent = false } = {}) {
    lang = l === 'en' ? 'en' : 'pt';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* ok */ }
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    applyDOM();
    if (!silent) listeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
  }

  // aplica o idioma inicial (o salvo, ou o do navegador) antes de os outros módulos rodarem
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  if (lang === 'en') applyDOM();

  return {
    t, set,
    get lang() { return lang; },
    get chosen() { return !!saved; },               // já escolheu antes? (senão mostra a caixa)
    markChosen() { saved = lang; },
    locale: () => (lang === 'en' ? 'en-US' : 'pt-BR'),
    speechLang: () => (lang === 'en' ? 'en-US' : 'pt-BR'),
    onChange(fn) { listeners.push(fn); },
  };
})();
EJ.t = (k, v) => EJ.i18n.t(k, v);
