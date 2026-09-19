import json
import os

spec = {
  "openapi": "3.0.3",
  "info": {
    "title": "Semantic Cache & Token Saver API",
    "description": "Ultra-Fast Algorithmic Semantic Vector Cache for LLMs (OpenAI GPT-4o, Claude 3.5, Gemini 1.5, Ollama). Eliminates redundant LLM API calls, cuts OpenAI token bills by 30-60%, and accelerates responses from 1500ms down to 10ms.",
    "version": "1.0.0",
    "contact": {
      "name": "TopAI SaaS Dev",
      "email": "top.ai.saas@gmail.com"
    }
  },
  "servers": [
    {
      "url": "https://semantic-cache.topaisaas.workers.dev",
      "description": "Cloudflare Workers Edge Production"
    }
  ],
  "paths": {
    "/v1/cache/check": {
      "post": {
        "summary": "Check Semantic Cache for a Query",
        "description": "Performs instant vector similarity check against cached queries in < 2ms.",
        "requestBody": {
          "required": True,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["query"],
                "properties": {
                  "query": { "type": "string", "example": "How do I reset my account password?" },
                  "namespace": { "type": "string", "example": "customer-support", "default": "default" },
                  "similarity_threshold": { "type": "number", "example": 0.85, "default": 0.85 }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Cache check result returned",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": True },
                    "hit": { "type": "boolean", "example": True },
                    "similarity": { "type": "number", "example": 0.94 },
                    "cached_response": { "type": "string" },
                    "tokens_saved": { "type": "integer", "example": 320 },
                    "estimated_cost_saved_usd": { "type": "number", "example": 0.0032 },
                    "estimated_latency_saved_ms": { "type": "integer", "example": 1200 }
                  }
                }
              }
            }
          },
          "400": { "description": "Invalid parameters" }
        }
      }
    },
    "/v1/cache/set": {
      "post": {
        "summary": "Store Query and Response in Cache",
        "description": "Saves a query-response pair and computes its feature vector for future hits.",
        "requestBody": {
          "required": True,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["query", "response"],
                "properties": {
                  "query": { "type": "string", "example": "How do I reset my account password?" },
                  "response": { "type": "string", "example": "Navigate to Settings > Security > Click 'Reset Password' and follow email instructions." },
                  "namespace": { "type": "string", "example": "customer-support", "default": "default" },
                  "ttl_seconds": { "type": "integer", "example": 86400, "default": 86400 }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Pair stored successfully" }
        }
      }
    },
    "/v1/cache/batch-check": {
      "post": {
        "summary": "Batch Semantic Cache Lookup",
        "description": "Check up to 20 queries simultaneously for parallel agent pipelines.",
        "requestBody": {
          "required": True,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["queries"],
                "properties": {
                  "queries": {
                    "type": "array",
                    "items": { "type": "string" },
                    "example": ["Password reset guide", "Pricing plans for enterprise"]
                  },
                  "namespace": { "type": "string", "default": "default" },
                  "similarity_threshold": { "type": "number", "default": 0.85 }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Batch check completed" }
        }
      }
    },
    "/v1/cache/stats": {
      "get": {
        "summary": "Get Cache & Cost Savings Statistics",
        "description": "Returns hit ratio, total tokens saved, and estimated USD cost savings.",
        "responses": {
          "200": { "description": "Global stats returned" }
        }
      }
    },
    "/v1/cache/clear": {
      "post": {
        "summary": "Clear Namespace or All Cache",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "namespace": { "type": "string", "example": "customer-support" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Cache cleared" }
        }
      }
    },
    "/v1/health": {
      "get": {
        "summary": "API Healthcheck",
        "responses": {
          "200": { "description": "Service is operational" }
        }
      }
    }
  }
}

target_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "openapi.json"))
with open(target_path, "w", encoding="utf-8") as f:
    json.dump(spec, f, indent=2, ensure_ascii=False)

print(f"Generated {target_path} successfully without BOM.")
