# Fadinha — pacote para React + Vite + TypeScript

Modelo 3D estático, criado por geometria procedural a partir da referência frontal. É uma aproximação estilizada: proporções, rosto, cabelo e costas não reproduzem exatamente a imagem original. A prévia mostra o arquivo realmente entregue.

## Arquivos

- `fadinha.glb`: modelo glTF 2.0 binário, com todas as texturas embutidas.
- `Fadinha.tsx`: componente para inserir no Canvas existente do jogo.
- `ExemploFadinha.tsx`: cena de demonstração com botão de personalização.
- `PREVIA_3D.html`: visualizador independente; abra com duplo clique no Chrome ou Edge. Funciona offline e permite girar e ocultar peças.
- `PROMPT_CLAUDE_CODE.md`: instruções prontas para integração.
- `previa-frente.png`: captura frontal do modelo.
- `model-source.mjs`: fonte procedural das malhas, para alterações futuras. Exporta `createFairy()` e requer `three@0.184.0`; o GLB final também contém os mapas PBR procedurais descritos abaixo.
- `asset-info.json` e `validation.json`: medidas, estatísticas e validação do GLB.
- `TESTES.md`: verificações executadas e limitações.

## Especificação

| Propriedade | Valor |
|---|---|
| Altura | 1,20 m |
| Largura incluindo asas | aproximadamente 1,277 m |
| Profundidade | aproximadamente 0,388 m |
| Orientação | Y para cima; rosto para +Z |
| Origem | centro em X/Z; menor Y = 0, nos pés |
| Transformação raiz | posição zero, rotação zero, escala 1 |
| Rig / skins / animações | nenhum |
| Triângulos | 56.912 |
| Vértices | 35.090 |
| Malhas / materiais | 55 / 28 |
| Tamanho GLB | 2.180.088 bytes, aproximadamente 2,18 MB |
| Texturas embutidas | 3 PNGs de 128 × 128: baseColor, normal e metallicRoughness |
| Material | PBR metallic-roughness, asas com transparência e duas faces |
| Compressão especial | nenhuma; dispensa Draco, KTX2 e decodificadores extras |

Os mapas compartilhados adicionam microtextura discreta. As cores principais estão nos fatores dos materiais, e os gradientes das asas nas cores dos vértices. São materiais procedurais, sem texturas fotográficas projetadas da imagem. O canal G do mapa metallicRoughness contém roughness; B contém metallic. Os valores finais também usam os fatores de cada material.

## Integração

1. Copie `fadinha.glb` para `public/models/fadinha.glb`.
2. Copie `Fadinha.tsx` para a pasta de componentes do projeto.
3. Use `<Fadinha />` dentro do Canvas que o jogo já tem, envolvido por `Suspense` e pelo tratamento de erro existente.
4. O componente usa `${import.meta.env.BASE_URL}models/fadinha.glb`, compatível com o `base` do Vite. É possível passar outro endereço na prop `url`.
5. Reutilize as versões de React, Three, Fiber e Drei instaladas no jogo. O projeto já deve ter `vite/client` em seus tipos, como é comum no Vite + TypeScript.

```tsx
import { Suspense } from 'react';
import { Fadinha } from './components/Fadinha';

// Dentro do Canvas existente:
<Suspense fallback={null}>
  <Fadinha
    position={[0, 0, 0]}
    parts={{
      Vestido: { color: '#7d62d6' },
      Flor_E: { scale: 1.15 },
      Asa_D_Superior: { rotation: [0, 0.2, 0] },
    }}
  />
</Suspense>
```

Para outra altura, use `scale={alturaDesejadaEmMetros / 1.2}`. A escala positiva uniforme mantém os pés no chão.

## Objetos e personalização

Os nomes estáveis dos grupos são:

`Cabeca`, `Cabelo`, `Olhos`, `Sobrancelhas`, `Vestido`, `Cinto`, `Flor_E`, `Flor_D`, `Sapato_E`, `Sapato_D`, `Asa_E_Superior`, `Asa_E_Inferior`, `Asa_D_Superior`, `Asa_D_Inferior`, `Braco_E`, `Braco_D`, `Perna_E`, `Perna_D`.

E/D identificam respectivamente os lados X negativo e X positivo na pose frontal. Cada grupo contém malhas nomeadas com o padrão `Grupo__Material`. O nome de cada objeto é único.

- `parts[Nome].visible`: mostrar ou ocultar a peça.
- `position`: deslocamento em metros em relação à posição local original.
- `rotation`: deslocamento angular Euler XYZ, em radianos, em relação à rotação original.
- `scale`: multiplicador numérico ou por eixo em relação à escala original.
- `color`: substitui as cores dos materiais da peça; as subpeças também são afetadas. A cor de um filho pode ser sobrescrita depois por sua própria configuração.

Remover uma configuração restaura os valores originais. Trate `parts` como um objeto imutável; crie uma nova referência ao atualizar configurações. O componente clona objetos e materiais por personagem, preservando geometrias/texturas compartilhadas no cache de `useGLTF`.

O pivô do vestido e do cinto fica na cintura; o de cada sapato fica próximo ao pé; o de cada asa fica junto ao corpo. Cabelo, olhos e flores são filhos da cabeça, e os sapatos são filhos das pernas. Mover um grupo pai afeta seus filhos.

Para movimento leve em código, uma `ref` do tipo `FadinhaHandle` fornece `root` e `parts`. Por exemplo, acesse `ref.current?.parts.Asa_D_Superior` em `useFrame`. O GLB não inclui movimento automático. Não aplique simultaneamente animação imperativa e configurações reativas ao mesmo eixo sem definir quem controla o valor.

Para substituir uma peça por outro modelo: oculte o grupo original e use seu pivô como ponto de encaixe. Não achate a hierarquia ao otimizar o GLB, pois isso remove os pontos de personalização.

## Uso no jogo

Inclua iluminação PBR na cena. O GLB não incorpora luzes, câmera, chão ou pedestal: esses itens pertencem somente às prévias. As asas usam transparência padrão glTF; `Fadinha.tsx` desliga a escrita em profundidade de materiais transparentes para reduzir artefatos e desliga a projeção de sombra dessas membranas.

56,9 mil triângulos e 55 malhas são adequados como ponto de partida para uma personagem visível, mas várias personagens simultâneas exigem medir desempenho nos dispositivos alvo. O pacote não contém LODs nem foi medido em celular físico.

## Referências técnicas

- [Carregamento de modelos no React Three Fiber](https://r3f.docs.pmnd.rs/tutorials/loading-models)
- [Cache e compartilhamento de recursos no React Three Fiber](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [Clonagem de objetos no Drei](https://drei.docs.pmnd.rs/abstractions/clone)
- [GLTFLoader do Three.js](https://threejs.org/docs/pages/GLTFLoader.html)
