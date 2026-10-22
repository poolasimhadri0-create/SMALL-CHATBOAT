# Gemini AI Chatbot Backend

Production-ready, asynchronous backend for an AI chatbot powered by the official **Google Gen AI SDK (`google-genai`)**, **FastAPI**, **MySQL 8** (via SQLAlchemy 2.x async + aiomysql), and **Alembic**.

---

## 🚀 Key Features

- **Google Gen AI SDK**: Utilizes the modern `google-genai` SDK with async streaming.
- **Dynamic Model Configuration**: Configured via `GEMINI_MODEL` (e.g. `gemini-3.6-flash`, `gemini-2.5-flash`) — never hardcoded.
- **Multimodal Support**: Upload PNG, JPEG, or WEBP images (up to 5 MB) alongside text prompts.
- **Google Search Grounding**: Real-time web search grounding with live source citations emitted via SSE.
- **Server-Sent Events (SSE)**: Real-time token-by-token streaming with `token`, `sources`, `done`, and `error` events.
- **Background Title Generation**: Non-blocking background task using Gemini to generate descriptive 3–6 word titles for conversations.
- **History & Context Trimming**: Preserves conversation context across turns, automatically keeping the most recent messages to stay within token limits.
- **Cancellation & Partial Reply Persistence**: If a client disconnects mid-stream, generation halts and the partial reply is saved to the database.
- **Robust Security & Rate Limiting**: Client IP rate limiting (30 req/min via SlowAPI), strict CORS origins, max 8000 characters validation, and API key server-side isolation.
- **Resilience & Retries**: Tenacity-based exponential backoff for Gemini 429/503 rate limits and temporary network failures.
- **Logging with Request IDs**: Every request is assigned an `X-Request-ID` and tracked through structured logs.

---

## 📁 Project Structure

```
CHATBOAT SMALL/
├── backend/                     # Complete Python / FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py          # Image upload validation and processing
│   │   │   └── routes/
│   │   │       ├── chat.py      # /api/chat & /api/chat/{id}/regenerate (SSE)
│   │   │       ├── conversations.py # /api/conversations CRUD & search
│   │   │       └── health.py    # /api/health (MySQL ping)
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic v2 settings & system prompt
│   │   │   ├── database.py      # SQLAlchemy 2.x async engine & session
│   │   │   ├── exceptions.py    # Custom exceptions & global handlers
│   │   │   ├── logging_config.py# Request ID middleware & logger format
│   │   │   └── rate_limiter.py  # SlowAPI rate limiter
│   │   ├── models/
│   │   │   ├── conversation.py  # Conversation SQLAlchemy model
│   │   │   └── message.py       # Message SQLAlchemy model
│   │   ├── schemas/
│   │   │   ├── chat.py          # Pydantic validation schemas for chat
│   │   │   └── conversation.py  # Pydantic schemas for conversations
│   │   ├── services/
│   │   │   ├── conversation_service.py # Database persistence layer
│   │   │   └── gemini_service.py# Google GenAI client & grounding logic
│   │   └── main.py              # FastAPI application entrypoint & lifespan
│   ├── alembic/                 # Async Alembic migrations
│   ├── tests/
│   │   └── run_tests.py         # Automated async test suite
│   ├── uploads/                 # Static uploads directory
│   ├── run.py                   # Convenient backend runner
│   ├── alembic.ini              # Alembic config
│   ├── requirements.txt         # Python dependencies
│   ├── schema.sql               # Raw MySQL 8 schema script
│   └── .env                     # Backend environment configuration
├── frontend/                    # React 19 + Vite frontend
│   ├── src/                     # React components, stores, hooks
│   ├── package.json             # Frontend dependencies
│   └── ...
├── .venv/                       # Python virtual environment
└── README.md
```

---

## ⚙️ Environment Variables (`.env`)

Configuration files are located in `backend/.env` and `.env`:

```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

# Database Configuration (MySQL async with aiomysql)
DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/gemini_chatbot_db

# Client CORS Configuration
CLIENT_ORIGIN=http://localhost:5173

# Server Port
PORT=5000
```

---

## 🛠️ Database Setup

### Option 1: MySQL Schema Script (`schema.sql`)
Run the provided SQL script against your MySQL 8 instance:
```bash
mysql -u root -p < backend/schema.sql
```

### Option 2: Alembic Migrations
Run the async Alembic migration from the `backend/` directory:
```bash
cd backend
alembic upgrade head
```

---

## 🚀 Running the Application

### 1. Start Backend Server
```bash
# Option A: From root using the virtual environment
.\.venv\Scripts\python backend/run.py

# Option B: From the backend folder
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```
The API documentation is available at:
- Swagger UI: `http://localhost:5000/docs`
- ReDoc: `http://localhost:5000/redoc`

### 2. Start Frontend App
```bash
cd frontend
npm run dev
```

---

---

## 🐳 Docker Deployment

### 1. One-Command Fullstack Deployment (Docker Compose)
Deploy the entire stack (MySQL 8 database, FastAPI backend, and Nginx-powered React frontend) with a single command:

```bash
docker compose up --build -d
```

- **Frontend**: `http://localhost`
- **Backend API**: `http://localhost:5000`
- **Swagger Docs**: `http://localhost:5000/docs`
- **Database**: Port `3306` with automatic schema initialization

To stop all containers:
```bash
docker compose down
```

### 2. Standalone Container Builds

**Backend:**
```bash
docker build -t chatbot-backend ./backend
docker run -d -p 5000:5000 --env-file backend/.env chatbot-backend
```

**Frontend:**
```bash
docker build -t chatbot-frontend ./frontend
docker run -d -p 80:80 chatbot-frontend
```

---

## 🧪 Running Automated Tests

Run the test suite verifying all 9 core capabilities:
```bash
.\.venv\Scripts\python backend/tests/run_tests.py
```

---

## 📡 API Endpoints Reference

### 1. Chat Completion (SSE Streaming)
- **Endpoint**: `POST /api/chat`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `message` (string, required): Up to 8000 characters.
  - `conversation_id` (string, optional UUID): If omitted, a new conversation is started.
  - `image` (binary file, optional): PNG, JPEG, or WEBP up to 5 MB.
- **Response**: `text/event-stream` (SSE):
  ```
  event: sources
  data: {"sources": [{"title": "Example", "uri": "https://example.com"}]}

  event: token
  data: {"token": "Namaste! "}

  event: token
  data: {"token": "How can I help you today?"}

  event: done
  data: {"conversation_id": "953a075f-...", "message_id": 42, "title": "Greeting"}
  ```

### 2. Regenerate Answer
- **Endpoint**: `POST /api/chat/{conversation_id}/regenerate`
- **Response**: `text/event-stream` (re-runs last user prompt and replaces previous model answer).

### 3. List Conversations
- **Endpoint**: `GET /api/conversations?q={search_term}`
- **Response**: List of conversations with `message_count` and `last_message` preview, sorted newest first.

### 4. Get Conversation
- **Endpoint**: `GET /api/conversations/{id}`
- **Response**: Full conversation object with all chronological user and model messages.

### 5. Rename Conversation
- **Endpoint**: `PATCH /api/conversations/{id}`
- **Body**: `{"title": "New Title"}`

### 6. Delete Conversation
- **Endpoint**: `DELETE /api/conversations/{id}`
- **Response**: Cascades deletion to all messages.

### 7. Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "gemini_model": "gemini-3.6-flash",
    "timestamp": "2026-10-21T17:35:00.000000Z"
  }
  ```
