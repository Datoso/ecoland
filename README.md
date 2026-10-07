# 🌱 EcoLand

Jogo de fazenda e sobrevivência no navegador, inspirado em Stardew Valley. O objetivo é transformar, aos poucos, um terreno abandonado num **sistema agropecuário autossuficiente e integrado**, no espírito do PAIS (Produção Agroecológica Integrada e Sustentável) e da ILPF (Integração Lavoura-Pecuária-Floresta) da Embrapa.

## Como jogar

Abra `index.html` no navegador. Não precisa instalar nada.

| Tecla | Ação |
|---|---|
| WASD / setas | andar |
| Clique / Espaço | usar ferramenta no tile destacado |
| E / botão direito | interagir (colher, coletar, construções, beber) |
| 1–8 / rodinha | trocar ferramenta |
| Q | trocar item na mão |
| F | comer o item na mão |
| I · C · J · T | inventário · criação · manual · terras |
| M | som liga/desliga |
| Esc | menu |

## Sistemas

- **Sobrevivência:** vida, energia, fome e sede. Água do lago pode dar dor de barriga, e a do poço é limpa. Às 2h da manhã você desmaia.
- **Lavoura:** arar, plantar, regar e colher. Cada cultura tem suas estações e algumas rebrotam. O adubo acelera o crescimento.
- **Pomar:** mudas frutíferas que produzem por estação.
- **Criação:** galinhas, porcos, vacas e ovelhas. Eles comem do cocho e os ruminantes também pastam. Os animais produzem ovos, leite e lã, se reproduzem e podem ser abatidos para dar carne, couro, banha e ossos.
- **Ciclo de nutrientes:** o esterco vai para a composteira e vira adubo. Os ossos viram farinha de osso no moinho. Os grãos viram ração caseira.
- **Processamento:** a fogueira cozinha, o moinho faz farinha, fubá e ração, e o defumador faz charque e linguiça.
- **Colmeias:** produzem mel e polinizam o que estiver num raio de 6 tiles.
- **Loja de materiais:** compra de sementes, mudas, materiais, ferragens, animais e melhorias. Também é onde você vende a produção.
- **Terras:** 9 lotes com biomas diferentes (pasto, mata, cerrado e lago), liberados aos poucos.
- **Manual da Autossuficiência:** 21 etapas que ensinam o caminho até o sistema integrado.

## Estrutura

```
index.html        página e HUD
css/style.css     visual da interface
js/data.js        itens, culturas, animais, construções, receitas, loja, lotes e manual
js/game.js        lógica (mundo, tempo, ações, noite, animais, economia, save)
js/render.js      desenho procedural em canvas
js/audio.js       efeitos sonoros e música sintetizados (Web Audio)
js/ui.js          painéis e HUD
js/main.js        entrada e laço principal
```
