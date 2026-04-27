# CodeReviewer

CodeReviewer is a full-stack AI-powered code review app.
It lets users paste code in the frontend and receive structured AI feedback from the backend, including:

- Verdict (`PASS`, `WARN`, `FAIL`)
- Numeric score (`0-100`)
- Review sections (`Bugs`, `Security`, `Performance`, `Style`)
- Refactored code suggestions

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- GSAP (animations)

### Backend

- Node.js
- Express
- Google Gemini API via `@google/genai`

## Project Structure

```text
CodeReviewer/
  Backend/
    Server.js
    src/
      app.js
      controllers/ai.controller.js
      routes/ai.routes.js
      services/ai.services.js
  Frontend/
    src/
      App.jsx
      LandingPage.jsx
      app.route.jsx
```

## Prerequisites

- Node.js 18+
- npm 9+
- A Gemini API key

## Environment Variables

### Backend (`Backend/.env`)

```env
GEMINI_API_KEY=your_gemini_api_key
# Optional (fallback is defined in code)
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

### Frontend (`Frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Run Locally

### 1. Install dependencies

```bash
cd Backend
npm install

cd ../Frontend
npm install
```

### 2. Start backend

```bash
cd Backend
npm start
```

Backend runs by default on `http://localhost:3000`.

### 3. Start frontend

Open a second terminal:

```bash
cd Frontend
npm run dev
```

Vite prints the frontend URL (usually `http://localhost:5173`).

## API

### `POST /ai/ai-review`

Request body:

```json
{
  "code": "function sum(a,b){ return a+b }",
  "language": "auto",
  "focusMode": "full"
}
```

Response shape:

```json
{
  "review": "VERDICT: WARN\nSCORE: 78\n## Bugs\n- ..."
}
```

Notes:

- `code` is required.
- `language` defaults to `auto`.
- Language directives at the top of the code are supported, for example `/python` or `language: cpp`.

## Useful Scripts

### Backend

- `npm start` - start server
- `npm run dev` - start server (currently same as start)

### Frontend

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## Deployment

- Frontend includes `vercel.json` for SPA rewrites.

## License

No license is currently specified.
