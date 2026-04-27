# CodeReviewer

CodeReviewer is a full-stack AI code review web app that analyzes submitted code and returns structured feedback with a verdict, score, risk areas, and a refactored version.

## Highlights

- Structured output with fixed sections: Bugs, Security, Performance, Style, Refactored Code
- Verdict and scoring model: PASS, WARN, FAIL plus score out of 100
- Language hint support from payload and first-line directives
- Frontend review workspace with section parsing and readable output
- Backend validation and graceful handling for quota and availability issues

## How It Works

1. User pastes code in the frontend workspace.
2. Frontend sends the code to the backend endpoint.
3. Backend validates payload and normalizes language hints.
4. Backend requests review content from Gemini.
5. Frontend renders verdict, score, sections, and refactored code.

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- GSAP

### Backend

- Node.js
- Express
- @google/genai
- dotenv
- cors

## Project Structure

```text
CodeReviewer/
  Backend/
    Server.js
    package.json
    src/
      app.js
      routes/ai.routes.js
      controllers/ai.controller.js
      services/ai.services.js
  Frontend/
    package.json
    vercel.json
    src/
      App.jsx
      LandingPage.jsx
      app.route.jsx
      main.jsx
```

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Gemini API key

## Environment Variables

### Backend environment at Backend/.env

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

Notes:

- GEMINI_API_KEY is required.
- GEMINI_MODEL is optional.
- PORT defaults to 3000 when not set.

### Frontend environment at Frontend/.env

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Local Development

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

Backend default URL: http://localhost:3000

### 3. Start frontend

Run this in a second terminal:

```bash
cd Frontend
npm run dev
```

Frontend default URL: http://localhost:5173

## API Reference

### POST /ai/ai-review

Request body:

```json
{
  "code": "function sum(a, b) { return a + b; }",
  "language": "auto",
  "focusMode": "full"
}
```

Request fields:

- code: required string
- language: optional string, defaults to auto
- focusMode: optional string, defaults to full

Successful response:

```json
{
  "review": "VERDICT: WARN\nSCORE: 78\n## Bugs\n- ..."
}
```

Possible error responses:

- 400: invalid input or non-code text
- 429: API quota exceeded
- 503: AI service temporarily unavailable
- 500: unexpected server error

Language directive support:

- slash form on first non-empty line, such as /python or /c++
- key-value form, such as language: cpp or lang=java

## Scripts

### Backend scripts

- npm start: start backend server
- npm run dev: start backend server

### Frontend scripts

- npm run dev: start Vite dev server
- npm run build: create production build
- npm run preview: preview production build
- npm run lint: run ESLint

## Deployment Notes

- Frontend includes vercel.json for SPA rewrite routing.
- Backend can be deployed to any Node.js host by setting GEMINI_API_KEY and start command npm start.

## Troubleshooting

- If frontend cannot reach backend, verify VITE_API_BASE_URL and backend PORT.
- If requests fail with 429, your Gemini free tier quota is exhausted.
- If requests fail with 503, retry after a short delay.
- If backend fails on startup, verify GEMINI_API_KEY is present in Backend/.env.

## Contributing

1. Fork the repository
2. Create a branch
3. Commit focused changes
4. Open a pull request with testing notes

## License

No license is currently specified for this repository.
