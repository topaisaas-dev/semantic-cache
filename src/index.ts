import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  sanitizeQuery,
  sanitizeResponse,
  validateSimilarityThreshold,
  validateNamespace,
  validateTTL,
  validateBatchQueries
} from "./security";
import {
  checkCache,
  setCache,
  clearCache,
  getStats
} from "./vector_engine";

type Bindings = {
  SEMANTIC_CACHE_KV?: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-RapidAPI-Key", "X-RapidAPI-Host"]
}));

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  c.header("X-Response-Time", `${ms}ms`);
  c.header("X-Powered-By", "TopAI-Semantic-Cache");
});

app.get("/v1/health", (c) => {
  return c.json({
    status: "healthy",
    service: "semantic-cache",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

/**
 * 1. POST /v1/cache/check - Semantic Cache Lookup
 */
app.post("/v1/cache/check", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const query = sanitizeQuery(body.query);
    const namespace = validateNamespace(body.namespace);
    const threshold = validateSimilarityThreshold(body.similarity_threshold, 0.85);
    const kv = c.env?.SEMANTIC_CACHE_KV;

    const result = await checkCache(query, namespace, threshold, kv);

    return c.json({
      success: true,
      namespace,
      threshold_used: threshold,
      ...result
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message || "Cache lookup failed"
    }, 400);
  }
});

/**
 * 2. POST /v1/cache/set - Store Query and LLM Response
 */
app.post("/v1/cache/set", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const query = sanitizeQuery(body.query);
    const response = sanitizeResponse(body.response);
    const namespace = validateNamespace(body.namespace);
    const ttl = validateTTL(body.ttl_seconds, 86400);
    const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined;
    const kv = c.env?.SEMANTIC_CACHE_KV;

    const stored = await setCache(query, response, namespace, ttl, metadata, kv);

    return c.json({
      namespace,
      ...stored
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message || "Failed to store in cache"
    }, 400);
  }
});

/**
 * 3. POST /v1/cache/batch-check - Batch Semantic Lookups (up to 20 queries)
 */
app.post("/v1/cache/batch-check", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const queries = validateBatchQueries(body.queries, 20);
    const namespace = validateNamespace(body.namespace);
    const threshold = validateSimilarityThreshold(body.similarity_threshold, 0.85);
    const kv = c.env?.SEMANTIC_CACHE_KV;

    const start = performance.now();
    const tasks = queries.map(q => checkCache(q, namespace, threshold, kv));
    const results = await Promise.all(tasks);
    const totalExecMs = Math.round((performance.now() - start) * 100) / 100;

    const hits = results.filter(r => r.hit).length;
    const totalTokensSaved = results.reduce((sum, r) => sum + r.tokens_saved, 0);
    const totalCostSavedUsd = results.reduce((sum, r) => sum + r.estimated_cost_saved_usd, 0);

    return c.json({
      success: true,
      namespace,
      total_queries: queries.length,
      total_hits: hits,
      total_misses: queries.length - hits,
      total_tokens_saved: totalTokensSaved,
      total_estimated_usd_saved: Math.round(totalCostSavedUsd * 10000) / 10000,
      execution_time_ms: totalExecMs,
      results
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message || "Batch lookup failed"
    }, 400);
  }
});

/**
 * 4. GET /v1/cache/stats - Cache Efficiency & Savings Analytics
 */
app.get("/v1/cache/stats", (c) => {
  const stats = getStats();
  return c.json({
    success: true,
    stats
  });
});

/**
 * 5. POST /v1/cache/clear - Invalidate/Purge Cache Entries
 */
app.post("/v1/cache/clear", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const namespace = body.namespace ? validateNamespace(body.namespace) : "all";
    const kv = c.env?.SEMANTIC_CACHE_KV;

    const result = await clearCache(namespace, kv);

    return c.json({
      message: namespace === "all" ? "All cache namespaces cleared" : `Namespace '${namespace}' cleared`,
      ...result
    });
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message || "Failed to clear cache"
    }, 400);
  }
});

/**
 * 6. GET /openapi.json - OpenAPI 3.0 specification
 */
app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.3",
    info: {
      title: "Semantic Cache & Token Saver API",
      description: "Ultra-Fast Algorithmic Semantic Vector Cache for LLMs (OpenAI GPT-4o, Claude 3.5, Gemini 1.5, Ollama). Eliminates redundant LLM API calls, cuts OpenAI token bills by 30-60%, and accelerates responses from 1500ms down to 10ms.",
      version: "1.0.0",
      contact: {
        name: "TopAI SaaS Dev",
        email: "top.ai.saas@gmail.com"
      }
    },
    servers: [
      {
        url: "https://semantic-cache.topaisaas.workers.dev",
        description: "Cloudflare Workers Edge Production"
      }
    ],
    paths: {
      "/v1/cache/check": {
        post: {
          summary: "Check Semantic Cache for a Query",
          description: "Performs instant vector similarity check against cached queries in < 2ms.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["query"],
                  properties: {
                    query: { type: "string", example: "How do I reset my account password?" },
                    namespace: { type: "string", example: "customer-support", default: "default" },
                    similarity_threshold: { type: "number", example: 0.85, default: 0.85 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Cache check result returned" },
            "400": { description: "Invalid parameters" }
          }
        }
      },
      "/v1/cache/set": {
        post: {
          summary: "Store Query and Response in Cache",
          description: "Saves a query-response pair and computes its feature vector for future hits.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["query", "response"],
                  properties: {
                    query: { type: "string", example: "How do I reset my account password?" },
                    response: { type: "string", example: "Navigate to Settings > Security > Click 'Reset Password' and follow email instructions." },
                    namespace: { type: "string", example: "customer-support", default: "default" },
                    ttl_seconds: { type: "integer", example: 86400, default: 86400 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Pair stored successfully" }
          }
        }
      },
      "/v1/cache/batch-check": {
        post: {
          summary: "Batch Semantic Cache Lookup",
          description: "Check up to 20 queries simultaneously for parallel agent pipelines.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["queries"],
                  properties: {
                    queries: {
                      type: "array",
                      items: { type: "string" },
                      example: ["Password reset guide", "Pricing plans for enterprise"]
                    },
                    namespace: { type: "string", default: "default" },
                    similarity_threshold: { type: "number", default: 0.85 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Batch check completed" }
          }
        }
      },
      "/v1/cache/stats": {
        get: {
          summary: "Get Cache & Cost Savings Statistics",
          description: "Returns hit ratio, total tokens saved, and estimated USD cost savings.",
          responses: {
            "200": { description: "Global stats returned" }
          }
        }
      },
      "/v1/cache/clear": {
        post: {
          summary: "Clear Namespace or All Cache",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    namespace: { type: "string", example: "customer-support" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Cache cleared" }
          }
        }
      },
      "/v1/health": {
        get: {
          summary: "API Healthcheck",
          responses: {
            "200": { description: "Service is operational" }
          }
        }
      }
    }
  });
});

/**
 * 7. GET / - Interactive Playground & Landing Page
 */
app.get("/", (c) => {
  const accept = c.req.header("accept") || "";
  const format = c.req.query("format");

  if (format === "json" || (!accept.includes("text/html") && accept.includes("application/json"))) {
    return c.json({
      service: "Semantic Cache & Token Saver API",
      tagline: "Cut LLM bills by 30-60% with sub-millisecond semantic vector caching",
      version: "1.0.0",
      docs_url: "/openapi.json",
      health_url: "/v1/health",
      endpoints: {
        "POST /v1/cache/check": "Vector similarity check for prompts",
        "POST /v1/cache/set": "Store prompt and LLM completion",
        "POST /v1/cache/batch-check": "Batch lookup for up to 20 queries",
        "GET /v1/cache/stats": "Live metrics: tokens saved, USD saved, hit ratio",
        "POST /v1/cache/clear": "Purge namespace or all cache"
      }
    });
  }

  c.header("Cache-Control", "no-cache, no-store, must-revalidate");

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Semantic Cache & Token Saver API • Live Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #e2e8f0; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 214, 0, 0.15); color: #ffd600; border: 1px solid rgba(255, 214, 0, 0.3); padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin-bottom: 16px; }
    .badge::before { content: ''; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #22c55e; }
    h1 { font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
    p.subtitle { font-size: 16px; color: #94a3b8; margin-bottom: 24px; }
    .playground { background: #1a2234; border: 1px solid #2d3748; border-radius: 12px; padding: 24px; margin-bottom: 28px; }
    .input-row { display: flex; gap: 12px; margin-bottom: 16px; }
    input[type="text"] { flex: 1; padding: 14px 16px; background: #0b1120; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s; }
    input[type="text"]:focus { border-color: #ffd600; }
    button { background: #ffd600; color: #000; border: none; padding: 14px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.1s, background 0.2s; }
    button:hover { background: #ffea00; }
    button:active { transform: scale(0.98); }
    #output { display: none; margin-top: 16px; }
    pre { background: #070b12; border: 1px solid #1e293b; color: #38bdf8; padding: 16px; border-radius: 8px; overflow-x: auto; max-height: 400px; font-size: 13px; font-family: monospace; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .chip { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 13px; text-decoration: none; }
    .links-bar { margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f2937; display: flex; gap: 16px; font-size: 14px; }
    .links-bar a { color: #ffd600; text-decoration: none; font-weight: 600; }
    .links-bar a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Live 24/7 on Cloudflare Global Edge</div>
    <h1>Semantic Cache & Token Saver API</h1>
    <p class="subtitle">Sub-millisecond vector similarity cache for OpenAI, Claude, and Gemini. Cut inference costs by 30-60%.</p>

    <div class="playground">
      <div class="input-row">
        <input type="text" id="query" value="How can I reset my account password?" placeholder="Enter prompt to check semantic cache...">
        <button onclick="runCacheCheck()" id="btn">Check Semantic Cache</button>
      </div>
      <div id="output">
        <div style="margin-bottom: 8px; font-size: 14px; color: #a3e635;" id="stats"></div>
        <pre id="json"></pre>
      </div>
    </div>

    <h3 style="color:#fff; font-size:16px; margin-bottom: 8px;">📚 Official Endpoints</h3>
    <div class="chips">
      <span class="chip"><code>POST /v1/cache/check</code> (Similarity Match)</span>
      <span class="chip"><code>POST /v1/cache/set</code> (Store Prompt/Response)</span>
      <span class="chip"><code>POST /v1/cache/batch-check</code> (Batch Lookups)</span>
      <span class="chip"><code>GET /v1/cache/stats</code> (Live Savings Metrics)</span>
      <span class="chip"><code>GET /v1/health</code> (Healthcheck)</span>
    </div>

    <div class="links-bar">
      <a href="https://rapidapi.com/user/topaisaas-dev" target="_blank">⚡ RapidAPI Marketplace</a>
      <a href="https://github.com/topaisaas-dev/semantic-cache" target="_blank">📦 GitHub Repository</a>
      <a href="/openapi.json" target="_blank">📄 OpenAPI Specification</a>
    </div>
  </div>

  <script>
    async function runCacheCheck() {
      const btn = document.getElementById('btn');
      const q = document.getElementById('query').value.trim();
      if (!q) return;

      btn.innerText = 'Checking Cache...';
      btn.disabled = true;

      try {
        const start = Date.now();
        const res = await fetch('/v1/cache/check', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ query: q, namespace: 'demo', similarity_threshold: 0.82 })
        });
        const data = await res.json();
        const elapsed = Date.now() - start;

        document.getElementById('output').style.display = 'block';
        document.getElementById('stats').innerText = (data.hit ? '⚡ CACHE HIT!' : 'ℹ CACHE MISS') + ' (lookup took ' + elapsed + ' ms)';
        document.getElementById('json').innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        alert('Cache check failed: ' + err.message);
      } finally {
        btn.innerText = 'Check Semantic Cache';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`);
});

export default app;
