# Semantic Cache & Token Saver API

> **Ultra-Fast Semantic Vector Cache & Cost-Reduction Engine for LLMs (OpenAI GPT-4o, Claude 3.5 Sonnet, Gemini 1.5, Ollama).**

Save 30% to 60% on your OpenAI / Anthropic bills and accelerate user responses from **1,500ms down to 10ms** using sub-millisecond semantic similarity caching on the Cloudflare Workers global edge.

---

## ⚡ The Problem vs The Solution

- **The Problem**: 30% to 50% of prompts received by AI agents and customer-facing LLMs are duplicates or semantic variations of previous questions (*e.g., "How do I reset my password?", "Password reset steps", "Forgot password"*). Passing every duplicate to GPT-4o burns money and adds 1.5s to 3s of latency per user.
- **The Solution**: Query the Semantic Cache first. If a semantic match exists above your threshold (e.g. 85%), return the cached completion instantly in **< 10ms at zero token cost**. If not, call your LLM and store the pair in the cache with 1 API call.

---

## 🚀 Key Features

- **Sub-Millisecond Vector Matching**: Algorithmic character n-gram and token cosine similarity calculated on the global edge in < 2ms.
- **Dynamic Similarity Threshold**: Customize your match strictness per query (e.g., `0.85` for general chat, `0.95` for precise financial/code queries).
- **Multi-Tenant Namespaces**: Partition cache stores per application, customer, or agent (`namespace: "support-bot"`, `namespace: "sales-sdr"`).
- **Built-in Token & Dollar Analytics**: Automatically computes total tokens saved, estimated USD saved, and roundtrip latency saved.
- **Batch Lookups**: Check up to 20 queries simultaneously for parallel agent pipelines.

---

## 📡 Quick Start & Endpoints

Base URL: `https://semantic-cache.topaisaas.workers.dev`

### 1. Check Cache (`POST /v1/cache/check`)

Check if a semantically similar prompt already has a cached response.

```bash
curl -X POST "https://semantic-cache.topaisaas.workers.dev/v1/cache/check" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I reset my account password?",
    "namespace": "customer-support",
    "similarity_threshold": 0.85
  }'
```

**Example Hit Response:**
```json
{
  "success": true,
  "namespace": "customer-support",
  "threshold_used": 0.85,
  "hit": true,
  "query": "How do I reset my account password?",
  "similarity": 0.94,
  "cached_response": "Navigate to Settings > Security > Click 'Reset Password' and follow the verification email.",
  "cached_query": "Forgot password instructions",
  "entry_id": "sc_7f8a9b2c",
  "hit_count": 14,
  "tokens_saved": 185,
  "estimated_cost_saved_usd": 0.0022,
  "estimated_latency_saved_ms": 1200,
  "lookup_time_ms": 1.2
}
```

---

### 2. Store Prompt & LLM Response (`POST /v1/cache/set`)

Store a newly generated response for future cache hits.

```bash
curl -X POST "https://semantic-cache.topaisaas.workers.dev/v1/cache/set" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I reset my account password?",
    "response": "Navigate to Settings > Security > Click Reset Password and follow the email.",
    "namespace": "customer-support",
    "ttl_seconds": 86400
  }'
```

---

### 3. Batch Check (`POST /v1/cache/batch-check`)

Check up to 20 prompts in parallel.

```bash
curl -X POST "https://semantic-cache.topaisaas.workers.dev/v1/cache/batch-check" \
  -H "Content-Type: application/json" \
  -d '{
    "queries": [
      "How to reset password?",
      "Enterprise pricing details",
      "API rate limit docs"
    ],
    "namespace": "customer-support"
  }'
```

---

### 4. Cache & Savings Stats (`GET /v1/cache/stats`)

Inspect your real-time ROI, token savings, and hit ratio.

```bash
curl -X GET "https://semantic-cache.topaisaas.workers.dev/v1/cache/stats"
```

---

## 🛠️ Code Examples

### Python (OpenAI Wrapper Integration)
```python
import requests
from openai import OpenAI

client = OpenAI()
CACHE_URL = "https://semantic-cache.topaisaas.workers.dev/v1/cache"

def ask_ai(prompt: str) -> str:
    # 1. Check Semantic Cache
    check = requests.post(f"{CACHE_URL}/check", json={
        "query": prompt,
        "namespace": "prod-assistant",
        "similarity_threshold": 0.88
    }).json()

    if check.get("hit"):
        print(f"⚡ Cache Hit! Saved {check['tokens_saved']} tokens ({check['lookup_time_ms']}ms)")
        return check["cached_response"]

    # 2. Cache Miss -> Call OpenAI
    print("🐢 Cache Miss -> Calling OpenAI...")
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    answer = completion.choices[0].message.content

    # 3. Store in Semantic Cache for future hits
    requests.post(f"{CACHE_URL}/set", json={
        "query": prompt,
        "response": answer,
        "namespace": "prod-assistant",
        "ttl_seconds": 86400
    })

    return answer
```

---

## 📄 License
MIT License. Maintained by [TopAI SaaS Dev](https://github.com/topaisaas-dev).
