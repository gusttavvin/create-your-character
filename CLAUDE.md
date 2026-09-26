# Funny Games — instruções para o Claude

Site de jogos para as aulas de inglês da Teacher Clara: https://create-your-character.pages.dev
Duas pessoas mexem neste projeto, cada uma no seu computador: o **Gustavo** e a **Clara**
(a professora, que não é programadora). Os dois usam a mesma conta do GitHub (`gusttavvin`).

## Como falar e escrever

- Converse em **português**, simples e direto; com a Clara, evite jargão e explique o que
  vai fazer antes de fazer.
- Todo texto que aparece no site fica em **inglês** (é para aula de inglês): botões,
  frases, palavras dos jogos.
- Mensagens de commit em inglês: um título que diga o que mudou para quem usa o site, e um
  corpo curto dizendo por quê.

## Publicar = mudar o site dos alunos

- Todo push na `main` é publicado sozinho pelo Cloudflare Pages em 1–2 minutos.
- **Só faça commit + push quando a pessoa pedir ou confirmar.**
- Antes de começar qualquer mudança: `git pull` (a outra pessoa pode ter publicado algo).
- Antes de publicar: `npm run build` sem erros e a mudança conferida no navegador.
- Antes do push: `gh auth switch --user gusttavvin` (a máquina pode ter outra conta ativa).
- Push recusado porque chegou coisa nova: `git pull --rebase` e tente de novo. Se houver
  conflito, explique antes de resolver. Nunca use `--force`.
- Depois do push, confira que a versão nova entrou no ar no site de verdade.
- Nunca apague arquivos, branches ou histórico sem perguntar.

## Rodar e conferir

```bash
npm install      # uma vez, ou quando o package.json mudar
npm run dev      # http://localhost:9090 (porta fixa)
npm run build    # confere os tipos e gera o site
```

- No app Claude Desktop, use o preview com a configuração `dev` de `.claude/launch.json`.
  Se a porta 9090 já estiver em uso, provavelmente é este mesmo projeto já rodando: abra
  http://localhost:9090 em vez de iniciar outro.
- Toda mudança visível deve ser conferida no navegador, e personagens em **2D e em 3D**.
  Mostre um print para a pessoa antes de publicar.
- Sem o arquivo `.env` o site roda em modo convidado (salva no navegador). O `.env` tem as
  chaves do Supabase, não vai para o GitHub e nunca deve ser mostrado ou commitado.

## Mapa do projeto

- Vite + React 19 + TypeScript, CSS puro em `src/styles/global.css`.
- 3D com three.js via @react-three/fiber e @react-three/drei. Backend: Supabase (`supabase/schema.sql`).
- `src/games.ts` — lista de jogos da página inicial.
- `src/pages/` — páginas: montar personagem, galeria, professora, jogo da memória
  (`MemoryGame`, palavras em `MemoryWords` e `src/games/memory/`) e roleta (`WheelGame`).
- `src/characters/<personagem>/` — monster, dragon, princess, superhero, fairy:
  - `config.ts`: linhas da folha (categorias), opções, cores e a frase em inglês.
  - `parts.tsx`: desenhos 2D em SVG, cada peça numa caixa 512×512. O monstro é a exceção:
    suas peças 2D são imagens em `public/assets/monster/parts/`.
  - `<Nome>2D.tsx`: monta as camadas 2D (folha de 600×720 unidades).
  - `<Nome>3D.tsx`: o personagem em 3D.
- A fada em 3D é um modelo pronto: `public/models/fadinha.glb`, carregado por
  `src/components/Fadinha.tsx` (veja `docs/fadinha-glb.md`). Cada linha da folha comanda
  grupos do modelo em `Fairy3D.tsx`. O desenho 2D da fada segue o visual desse modelo.
- `src/components/Builder.tsx` e `Stage.tsx` — a folha, arrastar peças e mover/girar/
  redimensionar (`SizeRail`, `AdjustBar`). `Part3D.tsx` (`useDragPart`) faz o mesmo no 3D.
- `TASKS.md` — lista de pedidos da Clara e o que já foi feito. Atualize ao terminar algo.

## Cuidados que já custaram caro

- No 2D, a posição das peças usa as propriedades CSS `translate`, `scale` e `rotate`; a
  propriedade `transform` é da animação `pop` e não deve ser usada nas peças.
- No 3D, nunca guarde medidas de peças animadas em estado do React (gera loop e página em
  branco); escreva direto no objeto, como `Part3D` faz.
- Nuvens de brilho (`<Sparkles>`) precisam de `raycast={() => null}`, senão roubam o
  toque de outras peças.
- Arrastar no 3D move a peça só para cima/baixo/lados sobre o personagem, nunca para frente
  ou para trás: senão a peça sai do corpo quando o modelo gira.
- Uma peça que vem em par (braços, olhos, asas) é desenhada uma vez e espelhada.
