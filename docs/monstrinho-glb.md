# Monstrinho laranja — GLB para o jogo

Versão 3D estilizada do personagem da imagem: corpo arredondado, juba laranja, dois chifres claros, olhos turquesa, bochechas rosadas, sorriso aberto com um dente, mão levantada e pés pequenos. Laterais e costas foram interpretadas a partir da referência frontal.

## Comece por aqui

1. Abra `PREVIA_3D.html` com duplo clique para girar o personagem e mostrar/ocultar peças. Funciona offline em navegador com WebGL.
2. O arquivo para o jogo é `monstrinho.glb`.
3. Entregue esta pasta ao Claude Code e use `PROMPT_CLAUDE_CODE.md`.

## Arquivos

- `monstrinho.glb`: modelo glTF 2.0 binário, com texturas embutidas.
- `Monstrinho.tsx`: componente React para o Canvas existente.
- `ExemploMonstrinho.tsx`: demonstração de iluminação e personalização.
- `PREVIA_3D.html`: visualizador independente, sem instalação ou internet.
- `monstrinho-previa.png`: imagem transparente de 1200 × 1200, renderizada do GLB entregue.
- `model-source.mjs`: fonte procedural das malhas. Requer `three@0.184.0` e exporta `createMonster()`; o GLB final inclui também os mapas PBR descritos abaixo.
- `asset-info.json`, `validation.json` e `TESTES.md`: medidas e verificações.
- `PROMPT_CLAUDE_CODE.md`: instruções de integração.

## Especificação

| Item | Valor |
|---|---|
| Formato | GLB único / glTF 2.0 |
| Altura | 1,20 m, incluindo chifres |
| Largura | aproximadamente 1,199 m, incluindo mãos |
| Profundidade | aproximadamente 0,616 m |
| Orientação | Y para cima; rosto voltado para +Z |
| Origem | centro dos limites em X/Z; pés com menor Y=0 |
| Raiz | posição zero, rotação zero, escala 1 |
| Rig / skins / animações | nenhum |
| Pose | mão no lado X negativo levantada |
| Triângulos | 45.716 |
| Vértices | 27.917 |
| Malhas / materiais | 39 / 18 |
| Tamanho | 1.717.080 bytes, aproximadamente 1,72 MB |
| PBR | baseColor, normal e metallicRoughness embutidos |
| Texturas | três PNGs de 128 × 128 |

Os mapas PBR compartilhados dão microtextura discreta. As cores ficam nos fatores de cada material. Roughness usa o canal G do mapa metallicRoughness, e metallic usa o canal B. O arquivo não exige Draco, KTX2, arquivos de textura separados, APIs ou serviços de geração.

A boca, a língua, as bochechas e as pintinhas são malhas curvas sobre o rosto; a boca é uma superfície gráfica, não uma cavidade articulada. Isso preserva o visual de desenho e permite mover as peças sem um esqueleto. O modelo não inclui pelos individuais, LODs ou animações de fala.

## Objetos nomeados

`Corpo`, `Juba`, `Rosto`, `Olhos`, `Olho_E`, `Olho_D`, `Sobrancelhas`, `Boca`, `Dente`, `Lingua`, `Bochechas`, `Pintinhas`, `Chifres`, `Chifre_E`, `Chifre_D`, `Topete`, `Braco_E`, `Braco_D`, `Mao_E`, `Mao_D`, `Pernas`, `Perna_E`, `Perna_D`, `Pe_E`, `Pe_D`.

E/D correspondem aos lados X negativo e positivo na vista frontal. Os nomes não dependem da ordem dos objetos no arquivo. As malhas dentro dos grupos têm nomes como `Juba__Juba_laranja` e `Olho_E__Iris_turquesa`.

Hierarquia importante:

- Cada mão acompanha seu braço.
- Cada pé acompanha sua perna; as pernas são filhas de `Pernas`.
- `Dente` e `Lingua` acompanham `Boca`.
- Os olhos individuais acompanham `Olhos`.
- Os chifres individuais acompanham `Chifres`.
- `Modelo` centraliza o conjunto; mova a instância completa pelo grupo externo do componente.

Não una todos os grupos em uma única malha ao otimizar, pois isso remove os pontos de personalização.

## Uso no React + Vite + TypeScript

Copie o GLB para `public/models/monstrinho.glb` e `Monstrinho.tsx` para a pasta de componentes. Use as dependências já instaladas no jogo: React, three, @react-three/fiber e @react-three/drei.

```tsx
import { Suspense } from 'react';
import { Monstrinho } from './components/Monstrinho';

// Dentro do Canvas existente:
<Suspense fallback={null}>
  <Monstrinho position={[0, 0, 0]} />
</Suspense>
```

O caminho padrão usa `import.meta.env.BASE_URL` para respeitar o `base` do Vite. É possível passar uma prop `url` diferente. `ExemploMonstrinho.tsx` serve para testar o modelo isoladamente; não substitua o Canvas do jogo por esse exemplo.

Para outra altura, use `scale={alturaEmMetros / 1.2}`. Garanta iluminação PBR na cena. Câmera, luzes, chão e pedestal só existem na prévia, não fazem parte do GLB.

```tsx
<Monstrinho
  parts={{
    Corpo: { color: '#956ce0' },
    Juba: { color: '#b37cec' },
    Chifres: { scale: 0.75 },
    Braco_E: { rotation: [0, 0, -0.25] },
    Dente: { visible: false },
  }}
/>
```

`position` é um deslocamento local em metros; `rotation` é um deslocamento Euler XYZ em radianos; `scale` é um multiplicador relativo à escala original; `visible` mostra/oculta a peça. `color` recolore todos os materiais daquela peça e de seus filhos. Para trocar apenas a íris, preserve branco, pupila e brilho e altere o material `Iris_turquesa` da instância clonada.

Use objetos `parts` imutáveis: crie uma nova referência ao atualizar. Remover uma configuração restaura o valor original. O componente clona objetos e materiais por personagem; geometrias e texturas ficam compartilhadas no cache. A ref `MonstrinhoHandle` expõe `root` e `parts` para movimentos leves em `useFrame`.

## Limites de integração

Este pacote representa um personagem e sua pose. Ele não contém uma biblioteca de outros corpos, bocas ou expressões. O Claude Code deverá mapear o modelo ao personagem/opção apropriado do jogo, preservando as demais opções e os personagens já existentes.

Os componentes foram testados em uma cena separada, não no repositório real do jogo. Para várias cópias simultâneas, meça desempenho nos dispositivos alvo; 39 malhas por instância somam chamadas de desenho.
