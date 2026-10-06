# Os seis monstros aprovados

Estes seis desenhos são a fonte de todas as peças do monstro no jogo. A Clara escolheu eles
e disse "eu amei esses que você criou", então nada aqui é redesenhado por cima: as peças do
jogo são fatias literais destes arquivos.

| desenho | é o corpo | também dá |
| --- | --- | --- |
| `1-Bricky.svg` | `square` | boca `teeth`, braço `claw`, perna `thick`, olho `angry` |
| `2-Fuzzbop.svg` | `round` | boca `big_tongue`, braço `fuzzy`, perna `stubby` |
| `3-Wobble.svg` | `egg` | olho `multiple`, boca `tongue` |
| `4-Bumblepop.svg` | `hourglass` | perna `bird` |
| `5-Bubblegoo.svg` | — | olho `one`, braço `tentacle`, perna `snake` |
| `6-SpikeaBoo.svg` | — | boca `jagged`, olho `stalks`, braço `pincher` |

Duas palavras da folha não existem em nenhum dos seis: ninguém tem olho em antena (`stalks`)
nem pinça (`pincher`). As duas são montadas sobre as peças do monstro azul, com o pedaço que
falta desenhado na espessura de linha e nas cores dele.

## Como isso vira código

```bash
node art-source/approved/flatten.cjs art-source/approved/2-Fuzzbop.svg art-source/approved/flat/2-Fuzzbop.json
node art-source/approved/gen.cjs
```

- `flatten.cjs` abre um desenho e escreve todas as formas dele numa lista numerada, na ordem
  em que são pintadas, já com a cor e a espessura que cada uma herdou do grupo em que estava.
- `flat/*.json` é essa lista. O número de cada forma é o que todo o resto usa para falar dela.
- `cuts/*.json` diz a que parte cada forma pertence (corpo, olhos, boca, braços, pernas) e o
  papel que cada cor tem — qual é a cor do bicho, qual é a sombra dela, qual é fixa.
- `bbox.json` é a caixa de cada forma, medida por um navegador de verdade (uma curva só sabe
  onde passa depois de desenhada), já com a sobra da linha de contorno.
- `gradients.json` guarda os degradês, que ficam fora da lista de formas.
- `gen.cjs` junta tudo e escreve dois arquivos do site:
  - `src/characters/monster/parts.tsx` — as vinte peças
  - `src/characters/monster/layout.ts` — onde cada corpo carrega o resto do monstro

**Não edite `parts.tsx` nem `layout.ts` na mão**: mude o desenho ou o corte aqui e rode o
`gen.cjs` de novo, senão a próxima geração apaga a correção.

## Por que as peças não estão num quadrado de 512

Cada peça mantém as coordenadas do desenho de onde saiu e carrega a própria caixa medida.
Colocar uma peça é encaixar a caixa dela na caixa que o corpo reserva para aquela linha. Uma
peça usada pelo bicho de onde ela veio cai exatamente onde a artista desenhou, porque as duas
caixas são a mesma caixa medida duas vezes.

## Cores

Cada corpo é um dos bichos e traz a cor dele. Uma peça emprestada de outro bicho é repintada
por `repainter` (`src/lib/color.ts`): ele mede a distância de cada tom até a cor-base do bicho
de origem, em matiz, saturação e claridade, e pendura essa mesma distância na cor nova. Uma
peça usada pelo próprio bicho recebe as cores dela de volta sem nenhuma mudança.

Ficam sempre iguais, em qualquer monstro: o contorno azul-marinho, o branco do olho, a íris,
as bochechas rosa, o roxo da boca, a língua, e os enfeites (chifre creme, bolinha da antena,
espinhos amarelos) — são parte do desenho, não da cor do bicho.

## A mãozinha do claw, tirada de uma foto

A Clara mandou a foto de uma mão e pediu aquela mão. `hand-ref.png` é a foto, e
`claw-hand.cjs` **não desenha** uma mão: lê os pixels dela (`png.cjs`, um leitor de PNG de
oito bits, porque não há biblioteca de imagem neste projeto) e caminha o contorno.

- A foto tem duas mãos, uma clara na frente e uma escura atrás. Os quatro dedos da da frente
  têm papel dos dois lados, então a borda deles é borda de verdade e dá para andar em cima
  dela. Só a parte de baixo da palma é inventada — ali a mão encosta na de trás — e é
  justamente onde o antebraço passa por cima.
- O contorno vira Béziers cúbicas, não uma fieira de retinhas.
- Dentro da mão, na foto, o laranja claro é uma região só e o laranja forte é a moldura dela:
  a mão é um formato claro deitado num escuro, e é assim que ela é montada aqui (silhueta na
  cor do bicho, claridade por cima, e o contorno num caminho à parte).
- O contorno é um caminho **aberto**: ele para onde o braço já esconde a mão, testado contra o
  contorno do próprio antebraço. Fechado, desenharia um risco atravessado no pulso.
- O pulso e a direção de cada braço saem do desenho do Bricky: cada antebraço termina numa
  reta, e essa reta é o pulso.

`claw-hand.cjs` escreve `extras.json`, que **os dois geradores leem** — `gen.cjs` para a folha
e `genpaths.cjs` para o modelo — de propósito: a queixa da Clara, rodada após rodada, era o
monstro da folha e o do 3D não serem a mesma criatura.

    node art-source/approved/claw-hand.cjs
    node art-source/approved/gen.cjs
    node art-source/approved/genpaths.cjs
