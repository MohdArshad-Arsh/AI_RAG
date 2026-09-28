# 📄 RAG AI — React Frontend

AI-powered RAG Document Intelligence System

---

## 🚀 Quick Start (VS Code mein chalane ke liye)

### Step 1 — Install karo
```bash
cd docmind-ai
npm install
```

### Step 2 — .env file setup karo
```bash
cp .env.example .env
```

`.env` file mein:
- **Mock mode** (backend ke bina chalana): `VITE_USE_MOCK=true`
- **Real backend**: `VITE_USE_MOCK=false` aur `VITE_API_URL=http://192.168.1.65:9000/api`

### Step 3 — Run karo
```bash
npm run dev
```

Browser mein khulega: **http://localhost:3000**

---

## 📁 Folder Structure

```
docmind-ai/
├── public/
├── src/
│   ├── components/
│   │   ├── Auth/               # (future use)
│   │   ├── Layout/
│   │   │   ├── Topbar.jsx      # Top navigation bar
│   │   │   └── Sidebar.jsx     # Left icon sidebar
│   │   ├── Chat/
│   │   │   └── ChatPanel.jsx   # ⭐ Main chat interface
│   │   ├── Documents/
│   │   │   ├── DocumentsPanel.jsx  # Document table
│   │   │   └── UploadModal.jsx     # Drag & drop upload
│   │   ├── Analytics/
│   │   │   └── AnalyticsPanel.jsx  # Charts & stats
│   │   ├── Prompts/
│   │   │   └── PromptsPanel.jsx    # Prompt library
│   │   ├── History/
│   │   │   └── HistoryPanel.jsx    # Chat history
│   │   ├── Settings/
│   │   │   └── SettingsPanel.jsx   # Settings page
│   │   ├── Common/
│   │   │   └── RefModal.jsx        # Reference viewer popup
│   │   └── Dashboard.jsx           # Home screen
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx       # Login screen
│   │   └── AppShell.jsx        # Main app layout
│   │
│   ├── services/
│   │   ├── api.js              # ⭐ ALL API calls here
│   │   └── mockData.js         # Mock data (dev mode)
│   │
│   ├── store/
│   │   └── index.js            # Zustand global state
│   │
│   ├── hooks/
│   │   └── index.js            # React Query hooks
│   │
│   ├── styles/
│   │   └── globals.css         # Global CSS + animations
│   │
│   ├── App.jsx                 # Router
│   └── main.jsx                # Entry point
│
├── .env                        # Environment variables
├── .env.example                # Template
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 🔌 API Integration

Saare API calls `src/services/api.js` mein hain.

### Backend Connect Karne Ke Steps:

1. `.env` mein set karo:
   ```
   VITE_USE_MOCK=false
   VITE_API_URL=http://localhost:8000/api
   ```

2. Backend banao jo ye endpoints provide kare:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/documents` | All documents |
| POST | `/api/documents/upload` | Upload file |
| DELETE | `/api/documents/:id` | Delete |
| POST | `/api/chat/ask` | **Main RAG query** |
| GET | `/api/chat/sessions` | Chat history |
| GET | `/api/prompts` | Prompt library |
| GET | `/api/analytics/overview` | Stats |

### Chat API ka Request/Response:

**Request:**
```json
{
  "question": "What is the SLA mentioned?",
  "documentIds": ["doc-id-123"],
  "sessionId": "session-abc",
  "agenticRag": true,
  "multiModel": false
}
```

**Response:**
```json
{
  "answer": "The SLA includes...",
  "sources": [
    {
      "docName": "Contract.pdf",
      "pageNumber": "12",
      "sectionNumber": "8.3",
      "content": "highlighted text...",
      "confidenceScore": 0.87,
      "tokenCount": 43
    }
  ],
  "score": 9,
  "tokensUsed": 842,
  "sessionId": "session-abc"
}
```

---

## 📦 Install Kiya Kya Kya?

```bash
npm install
```

Ye sab install hoga:

| Package | Use |
|---------|-----|
| `react` + `react-dom` | Core React |
| `react-router-dom` | Page routing |
| `axios` | API calls |
| `zustand` | Global state |
| `react-hot-toast` | Toast notifications |
| `react-dropzone` | File drag & drop |
| `recharts` | Analytics charts |
| `lucide-react` | Icons |
| `@tanstack/react-query` | Server state / caching |
| `clsx` | Conditional classNames |
| `tailwindcss` | Styling |
| `vite` | Build tool |

---

## 🔧 Tech Stack

```
Frontend:  React 18 + Vite
Styling:   Tailwind CSS
State:     Zustand + React Query
Backend:   Spring Boot / Python FastAPI (aapka choice)
Vector DB: Pinecone / PGVector / Weaviate
LLM:       OpenAI / Azure OpenAI / Claude
```

---

## 🌐 Backend Recommendations

**Option 1 — Python FastAPI (Recommended for RAG)**
```python
# main.py
from fastapi import FastAPI
from langchain.chains import RetrievalQA

app = FastAPI()

@app.post("/api/chat/ask")
async def ask(request: ChatRequest):
    result = qa_chain({"query": request.question})
    return {"answer": result["result"], "sources": [...]}
```

**Option 2 — Spring Boot**
```java
// Java backend with Spring AI or custom RAG
@RestController
@RequestMapping("/api/chat")
public class ChatController {
    @PostMapping("/ask")
    public ChatResponse ask(@RequestBody ChatRequest req) { ... }
}
```

---

## ✅ Features

- 🔐 Login with mock/real auth
- 📄 Document table with search, delete, re-index
- 📤 Drag & drop upload with progress
- 💬 Real-time chat with AI
- 🔍 Reference viewer with confidence scores
- ⭐ Favourite answers
- 📚 Prompt library
- 📊 Analytics dashboard with charts
- 🕐 Chat history
- ⚙ Settings panel
- 🌙 Dark mode

---

## 🐛 Common Issues

**Q: `npm install` mein error?**
```bash
node --version  # v18+ hona chahiye
npm install --legacy-peer-deps
```

**Q: Fonts load nahi ho rahe?**
Internet connection check karo (Google Fonts use hoti hain)

**Q: API 404 error?**
`.env` mein `VITE_USE_MOCK=true` set karo pehle
