# Biblioteca de modelos do monstro

Os modelos GLB substituem a construção por inflação de SVG no caminho normal do 3D.
O desenho 2D, os IDs, as frases e o formato dos personagens salvos permanecem iguais.
O arquivo original `public/models/monstrinho.glb` não foi alterado.

## Opções

| Fileira | Modelo original | Novos arquivos em `public/models/monster/` |
| ------- | --------------- | ------------------------------------------ |
| body    | round           | egg.glb, square.glb, hourglass.glb         |
| eyes    | angry           | stalks.glb, multiple.glb, one.glb          |
| mouth   | tongue          | smile.glb, fangs.glb, beak.glb             |
| arms    | fuzzy           | claw.glb, tentacle.glb, pincher.glb        |
| legs    | paws            | bird.glb, long.glb, snake.glb              |

São peças individuais, não quinze personagens completos. Cada GLB usa metros, Y para
cima, frente em +Z, base em Y=0 e centro X/Z na origem. O grupo raiz se chama
`<fileira>_<id>`; as submalhas e os materiais de cada região têm nomes. Não há rig,
animação, Draco, KTX2 ou arquivos externos. As cores são fatores PBR dos materiais,
portanto não precisam de mapas de textura. A montagem mantém a escala do jogo; a
referência de 1,20 m continua sendo o personagem original completo.

## Gerar novamente

Com Node 24 e dependências instaladas, executar `npm run models:monster`.
O gerador `art-source/approved/model-library.mjs` lê os desenhos aprovados, constrói
volumes e valida os arquivos. Também grava:

- `src/characters/monster/model-library.json`: grupos, limites e superfície frontal
  amostrada dos corpos, incluindo o original.
- `docs/monster-model-validation.json`: tamanho, triângulos e diagnóstico glTF.

As silhuetas aprovadas orientam os volumes; a profundidade é uma interpretação
procedural. Corpos têm seções fechadas, olhos têm globos próprios, dedos têm espessura
local e detalhes pintados acompanham a pele. Não é uma reconstrução 3D exata a partir
de fotografias nem uma escultura manual.

## Integração

`Monster3D.tsx` carrega apenas as opções escolhidas. As peças do modelo original também
podem ser usadas nos outros corpos. O encaixe usa os espaços existentes de `layout.ts`
e a superfície frontal medida dos modelos, com assentamento separado por olho. Os
olhos originais têm a inclinação do rosto original removida antes do novo encaixe.

Cada instância recebe materiais e geometrias próprios; o cache do carregador permanece
intacto. Trocar peças libera os recursos pertencentes à instância. Se uma peça falhar
ao carregar, somente essa fileira usa `Monster3DFallback.tsx`, carregado sob demanda.
Esse fallback mantém o visual antigo e não deve ser usado como referência de qualidade.

## Revisão local

Executar `npm run dev` e abrir `http://localhost:9090/monster-review.html`.
A página oferece desenho 2D e modelo lado a lado, comparação com a implementação
anterior, quatro ângulos e matrizes de opções. `Check model instances` confere
coordenadas e compartilhamento indevido de materiais. A página é uma entrada de
desenvolvimento e não é incluída no build normal do site.

Verificações realizadas em 7 de outubro de 2026:

- Quinze GLBs validados: zero erros e zero avisos; cada arquivo abaixo de 2 MB.
- Quatro corpos × quatro opções, para cada uma das quatro fileiras, vistos de frente,
  em três quartos, de lado e por trás: 256 casos de renderização. Coordenadas válidas
  e nenhum material compartilhado entre personagens em todas as matrizes.
- Falha de carregamento simulada em `one.glb`: fallback da fileira apareceu e o restante
  do personagem continuou funcionando. Arquivo restaurado após o teste.
- No jogo, personagem com egg/multiple/beak/pincher/snake salvo como convidado e
  reaberto; escolhas e frase preservadas ao alternar 2D/3D. Sem erros no console nesse fluxo.
- `npm run build`: tipos e versão de produção aprovados.

As matrizes variam uma fileira de cada vez; não são um teste exaustivo das 1.024
combinações possíveis. O salvamento foi testado no modo convidado, sem testar contas
ou o serviço remoto. A garra é a peça mais pesada (cerca de 102 mil triângulos);
não há LOD e o desempenho em celulares ainda precisa de medição. A revisão artística
final com Gustavo/Clara continua pendente. Nada foi commitado ou publicado.
