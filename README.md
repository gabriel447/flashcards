# Flashcards Inteligentes

Aplicativo de flashcards com revisão espaçada (estilo Anki/SM-2), interface em React + TypeScript (Vite) e backend em Express. Permite gerar decks, revisar cards com notas em português ("Mal", "Bem", "Excelente"), e persiste progresso em `data/store.json`.

## Tecnologias
- Frontend: React 19, TypeScript, Vite
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

## Fluxo de revisão (agendamento)
- Notas 0–2: reforço rápido em minutos (ex.: 5/10/30), mantendo `interval = 0` dias
- Notas 3–5: SM-2 clássico (dias), ajustando `easeFactor` e `interval`
- Cada revisão atualiza `repetitions`, `interval`, `easeFactor`, `due`, `reviews` e `lastReviewedAt`

## Endpoints principais (backend)
- `GET /api/decks?userId=...` — lista decks, garantindo `reviewedCount` migrado
- `POST /api/decks` — cria deck (`{ userId, name }`)
- `POST /api/decks/:deckId/cards` — cria card
- `PUT /api/decks/:deckId/cards/:cardId` — edita card
- `DELETE /api/decks/:deckId/cards/:cardId` — remove card
- `DELETE /api/decks/:deckId` — remove deck
- `POST /api/review` — avalia um card e retorna `{ card, reviewedCount }`

## Estrutura do projeto
```
server/
  index.cjs          # servidor Express e rotas
  utils/
    sm2.cjs          # lógica de agendamento SM-2
    store.cjs        # persistência em JSON
src/
  App.tsx            # app principal
  components/        # UI (Due, Review, DeckManager, Stats, etc.)
data/store.json      # dados persistidos por usuário
```

## Ambiente
- Variáveis de ambiente em `.env` (ex.: `OPENAI_API_KEY`). Veja `.env.example`.
- Se `OPENAI_API_KEY` estiver definido, o gerador pode usar OpenAI; caso contrário, funciona sem IA.

## Observações
- Usuário padrão: `anon` (dados em `users.anon` no `store.json`).
- Após revisar cards, os contadores em Decks/Estatísticas persistem mesmo em reload duro (Ctrl+Shift+R).

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
