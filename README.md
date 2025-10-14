# Flashcards Inteligentes

Aplicativo de flashcards com revisão espaçada (estilo Anki/SM-2), interface em React + TypeScript (Vite) e backend em Express. Permite gerar decks, revisar cards com notas em português ("Mal", "Bem", "Excelente"), e persiste progresso em `data/store.json`.

## Tecnologias
- Frontend: `react` 19, TypeScript, Vite
- UI: Swiper para navegação entre cards
- Backend: Node.js + Express
- Persistência: JSON local em `data/store.json`

## Como rodar
Pré-requisitos: Node.js 18+

Instale as dependências:

```bash
npm install
```

Inicie o cliente (Vite):

```bash
npm run dev
```

Inicie o servidor (Express):

```bash
npm run dev:server
```

Opcional: iniciar ambos em paralelo

```bash
npm run dev:all
```

Frontend: `http://localhost:5173/`

Backend: `http://localhost:4000/`

## Recursos principais
- Gerar decks e cards manualmente ou via assistente (opcional com OpenAI)
- Revisão por deck com notas: "Mal" (1), "Bem" (4), "Excelente" (5)
- Contadores de revisões por deck persistentes (não zeram após reload)
- Agendamento de próxima revisão: curto prazo para erros, SM-2 para acertos
- Importar/Exportar dados do usuário e exportar deck específico

## Fluxo de revisão (agendamento)
- Notas 0–2: reforço rápido em minutos (ex.: 5/10/30), mantendo `interval = 0` dias
- Notas 3–5: SM-2 clássico (dias), ajustando `easeFactor` e `interval`
 - Cada revisão atualiza `repetitions`, `interval`, `easeFactor`, `nextReviewAt`, `reviews` e `lastReviewedAt`

## Endpoints principais (backend)
- `POST /api/auth/login` — autenticação simples; retorna `{ userId }`
- `GET /api/decks?userId=...` — lista decks, garantindo `reviewedCount` migrado
- `POST /api/decks` — cria deck (`{ userId, name }`)
- `POST /api/decks/:deckId/cards` — cria card (`{ userId, card }`)
- `PUT /api/decks/:deckId/cards/:cardId` — edita card (`{ userId, card }`)
- `DELETE /api/decks/:deckId/cards/:cardId` — remove card (`?userId=`)
- `DELETE /api/decks/:deckId` — remove deck (`?userId=`)
- `POST /api/review` — avalia um card e retorna `{ card, reviewedCount }`
- `GET /api/decks/:deckId/export?userId=...` — exporta apenas um deck
- `GET /api/export?userId=...` — exporta todos os dados do usuário
- `POST /api/import` — importa dados completos do usuário (`{ userId, data }`)
- `POST /api/generate` — gera cards (usa OpenAI se `OPENAI_API_KEY` existir; caso contrário, fallback local)
- `POST /api/generate-from-pdf` — gera cards a partir de PDF. Prioriza um padrão de texto explícito (FC-*); mantém fallbacks (OCR/bullets) quando o padrão não existe.

Observação: o backend normaliza dados automaticamente para usar somente `nextReviewAt` (remove `due`) tanto ao iniciar quanto após `POST /api/import`.

## Estrutura do projeto
```
server/
  index.cjs          # servidor Express e rotas
  utils/
    sm2.cjs          # lógica de agendamento SM-2
    store.cjs        # persistência em JSON
src/
  App.tsx            # app principal
  components/        # UI (Review, DeckManager, Stats, Generator, etc.)
data/store.json      # dados persistidos por usuário
```

## Ambiente
- Variáveis de ambiente em `.env` (ex.: `OPENAI_API_KEY`). Veja `.env.example`.
- Se `OPENAI_API_KEY` estiver definido, o gerador pode usar OpenAI; caso contrário, funciona sem IA.

## Observações
- Usuário padrão: `anon` (dados em `users.anon` no `store.json`).
- Após revisar cards, os contadores em Decks/Estatísticas persistem mesmo em reload duro (Ctrl+Shift+R).

## Padrão de PDF (FC-*) para geração determinística
Para obter os melhores resultados ao enviar PDFs, utilize TEXTO PLANO dentro do PDF seguindo os marcadores `FC-*` abaixo. O backend lê esses marcadores diretamente do texto, sem depender de palavras como "Summary/Resumo".

Linhas suportadas (uma por linha):
- `FC-SCHEMA: 1.0` (opcional)
- `FC-CATEGORY: <Categoria>` — inicia um bloco de itens da categoria
- `FC-ITEM: <Nome do item>` — pode ser no formato `Nome: descrição` para embutir o essencial
- `FC-INFO: <Informação essencial>` — complemente o item atual (pode repetir)
- `FC-POINT: <Ponto-chave>` — ponto adicional sobre o item (pode repetir)
- Opcional: `FC-BULLET: Título: descrição` — atalho equivalente a um item simples

Exemplo de conteúdo (texto convertido para PDF):
```
FC-SCHEMA: 1.0
FC-CATEGORY: AWS S3
FC-ITEM: S3: armazenamento de objetos; 11 9s de durabilidade; classes Standard/IA/Glacier
FC-INFO: políticas IAM e Bucket; SSE-S3; SSE-KMS
FC-POINT: data transfer impacta custo
FC-ITEM: S3 Lifecycle
FC-INFO: transição entre classes; expiração de objetos
FC-POINT: útil para arquivamento com Glacier

FC-CATEGORY: AWS Lambda
FC-ITEM: Lambda: compute serverless; triggers; limites de memória/tempo
FC-POINT: billing por invocação e tempo
```

Recomendações:
- Use PDFs com texto (exportado do editor), evite PDFs escaneados; OCR é apenas fallback.
- Mantenha o conteúdo em PT-BR; evite links e cabeçalhos/rodapés.
- Estruture 2–5 categorias, cada uma com 3–6 itens; adicione `FC-POINT` para pontos-chave.

Com esse padrão, o app gera 1–2 cards por item e completa com os `FC-POINT` quando necessário.