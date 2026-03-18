# Gelani AI Healthcare Assistant - Server & API Configuration

## 📋 Quick Reference

| Service | Status | Notes |
|---------|--------|-------|
| **Z.ai GLM-4.7-Flash** | ✅ Active | Primary AI Provider |
| **Google Gemini** | ⚠️ Region Blocked | API key valid but region restricted |
| **OpenAI** | ❌ Region Blocked | Not accessible from current region |
| **Ollama** | ❌ Not Installed | Local LLM option (not installed) |
| **SQLite Database** | ✅ Active | Local file-based storage |

---

## 🔑 Environment Variables (.env)

```bash
# Database Configuration
DATABASE_URL=file:/home/z/my-project/db/custom.db

# Google Gemini API
GEMINI_API_KEY=AIzaSyC6FNVWJHMwm67JSQEHTBJ3-XN0q7VC9BU

# Ollama Local LLM (Not Installed)
OLLAMA_BASE_URL=http://localhost:11434

# Z.ai Platform - GLM-4.7-Flash (PRIMARY - ACTIVE)
ZAI_API_KEY=f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
```

---

## 🤖 AI Provider Configurations

### 1. Z.ai Platform (GLM-4.7-Flash) - PRIMARY ✅

| Property | Value |
|----------|-------|
| **Provider** | `zai` |
| **Model** | `GLM-4.7-Flash` |
| **API Endpoint** | `https://api.z.ai/api/paas/v4` |
| **API Key** | `f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs` |
| **Status** | ✅ Connected & Working |
| **Features** | Thinking/Reasoning mode enabled |

**API Request Format:**
```bash
curl -X POST "https://api.z.ai/api/paas/v4/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs" \
  -d '{
    "model": "GLM-4.7-Flash",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 2048,
    "thinking": {"type": "disabled"}
  }'
```

**SDK Usage:**
```typescript
import ZAI from 'z-ai-web-dev-sdk';

const zai = new ZAI({
  apiKey: 'f631a18af3784849a366b18e513c4ca3.6GySmdn3jhAuZqQs',
  baseUrl: 'https://api.z.ai/api/paas/v4'
});

const completion = await zai.chat.completions.create({
  model: 'GLM-4.7-Flash',
  messages: [{ role: 'user', content: 'Hello' }],
  thinking: { type: 'enabled' } // Optional: enables reasoning
});
```

---

### 2. Google Gemini API - Region Blocked ⚠️

| Property | Value |
|----------|-------|
| **Provider** | `gemini` |
| **Model** | `gemini-pro` |
| **API Endpoint** | `https://generativelanguage.googleapis.com/v1` |
| **API Key** | `AIzaSyC6FNVWJHMwm67JSQEHTBJ3-XN0q7VC9BU` |
| **Status** | ⚠️ API Key valid but region blocked |

**Note:** The API key is valid, but the Gemini API is not accessible from the current server region.

---

### 3. OpenAI API - Region Blocked ❌

| Property | Value |
|----------|-------|
| **Provider** | `openai` |
| **Default Model** | `gpt-4` |
| **API Endpoint** | `https://api.openai.com/v1` |
| **Status** | ❌ Region blocked (no API key configured) |

---

### 4. Ollama Local LLM - Not Installed ❌

| Property | Value |
|----------|-------|
| **Provider** | `ollama` |
| **Default Model** | `llama2` |
| **API Endpoint** | `http://localhost:11434` |
| **Status** | ❌ Not installed on server |

**Installation (if needed):**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama2

# Start the server
ollama serve
```

---

## 🗄️ Database Configuration

### SQLite Database

| Property | Value |
|----------|-------|
| **Type** | SQLite |
| **File Location** | `/home/z/my-project/db/custom.db` |
| **Connection String** | `file:/home/z/my-project/db/custom.db` |
| **ORM** | Prisma |

**Prisma Schema Location:** `/home/z/my-project/prisma/schema.prisma`

**Database Commands:**
```bash
# Push schema changes
bun run db:push

# Generate Prisma Client
bun run db:generate

# Open Prisma Studio
bun run db:studio
```

---

## 🌐 Server Configuration

### Development Server

| Property | Value |
|----------|-------|
| **Framework** | Next.js 16 (App Router) |
| **Runtime** | Bun |
| **Port** | 3000 |
| **URL** | `http://localhost:3000` |

**Commands:**
```bash
# Start development server
bun run dev

# Run linting
bun run lint

# Run build (not needed in dev)
bun run build
```

---

## 🔌 API Routes

### LLM Integration Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/llm-integrations` | GET | List all LLM providers |
| `/api/llm-integrations` | POST | Create new provider |
| `/api/llm-integrations/[id]` | PUT | Update provider |
| `/api/llm-integrations/[id]` | DELETE | Delete provider |
| `/api/llm-integrations/test` | POST | Test provider connection |
| `/api/llm-integrations/test/route` | POST | Test LLM request |

### RAG Healthcare Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rag-healthcare` | GET | Search knowledge base |
| `/api/rag-healthcare` | POST | RAG query with AI response |

### Knowledge Base Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge/embeddings` | GET | Get embedding statistics |
| `/api/knowledge/embeddings` | POST | Generate embeddings |

### Clinical Support Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinical-support` | POST | Clinical decision support |

---

## 📊 Knowledge Base Statistics

### Current Data

| Category | Count |
|----------|-------|
| **Clinical Guidelines** | 5 |
| **Lab Interpretation** | 2 |
| **Drug Interactions** | 11 |
| **Symptom Mappings** | 8 |
| **Total Entries** | 17+ |

### Knowledge Categories

1. `clinical-guideline` - Treatment protocols and guidelines
2. `drug-interaction` - Drug-drug interaction data
3. `lab-interpretation` - Lab value interpretation guides
4. `symptom` - Symptom-condition mappings
5. `treatment` - Treatment protocols

---

## 🔧 Provider Manager Configuration

The application uses a Single Source of Truth (SSOT) provider manager located at:
`/home/z/my-project/src/lib/llm/provider-manager.ts`

### Supported Providers

| Provider | API Format | Auth Method |
|----------|------------|-------------|
| `zai` | OpenAI-compatible | Bearer token |
| `openai` | OpenAI | Bearer token |
| `gemini` | Google AI | Query param (key) |
| `claude` | Anthropic | x-api-key header |
| `ollama` | Ollama | None (local) |
| `other` | OpenAI-compatible | Configurable |

### Request Routing Logic

1. Check if `providerId` is specified in request
2. If not, use the default provider (isDefault: true)
3. If no default, use first active provider by priority
4. If provider fails, automatically fallback to next active provider
5. If all providers fail, return error

---

## 🚀 GitHub Repository

| Property | Value |
|----------|-------|
| **Username** | `YOUR_GITHUB_USERNAME` |
| **Token** | `YOUR_GITHUB_TOKEN` |
| **Status** | Not yet pushed (committed locally as "Gelani V2") |

**To Push to GitHub:**
```bash
cd /home/z/my-project
git remote add origin https://github.com/MK428NP/gelani-healthcare.git
git push -u origin main
```

---

## 📝 Important Notes

1. **Primary AI Provider**: Z.ai GLM-4.7-Flash is the working provider
2. **Thinking Mode**: Enabled by default for medical transparency
3. **Vector RAG**: Semantic search with 768-dimensional embeddings
4. **Database**: SQLite file-based (suitable for development, consider PostgreSQL for production)
5. **Region Restrictions**: OpenAI and Gemini APIs are blocked in current region

---

## 🔒 Security Recommendations

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Rotate API keys** periodically
3. **Use environment variables** in production
4. **Enable rate limiting** on API routes
5. **Add authentication** for production deployment
6. **Use HTTPS** in production
7. **Encrypt sensitive data** in database

---

## 📞 Support

For issues with:
- **Z.ai API**: Contact Z.ai Platform support
- **Gemini API**: Check Google AI Studio for region availability
- **Application**: Check `/home/z/my-project/dev.log` for errors

---

*Last Updated: $(date)*
*Generated by Gelani AI Healthcare Assistant*
