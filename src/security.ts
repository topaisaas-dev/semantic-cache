/**
 * Security & Input Validation Module for Semantic Cache & Token Saver API
 */

export function sanitizeQuery(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("Missing or invalid 'query' parameter. Must be a non-empty string.");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Field 'query' cannot be empty.");
  }

  if (trimmed.length > 10000) {
    throw new Error("Field 'query' exceeds maximum length of 10,000 characters.");
  }

  return trimmed;
}

export function sanitizeResponse(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("Missing or invalid 'response' parameter. Must be a non-empty string.");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Field 'response' cannot be empty.");
  }

  if (trimmed.length > 50000) {
    throw new Error("Field 'response' exceeds maximum length of 50,000 characters.");
  }

  return trimmed;
}

export function validateSimilarityThreshold(val: unknown, defaultVal = 0.85): number {
  if (val === undefined || val === null) return defaultVal;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num) || num < 0.0 || num > 1.0) {
    throw new Error("Field 'similarity_threshold' must be a float between 0.0 and 1.0 (e.g. 0.85).");
  }
  return num;
}

export function validateNamespace(val: unknown): string {
  if (typeof val !== "string" || !val.trim()) return "default";
  const clean = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return clean.slice(0, 64) || "default";
}

export function validateTTL(val: unknown, defaultVal = 86400): number {
  if (val === undefined || val === null) return defaultVal;
  const num = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(num) || num < 60) return defaultVal;
  return Math.min(num, 2592000); // Max 30 days
}

export function validateBatchQueries(queries: unknown, maxItems = 20): string[] {
  if (!Array.isArray(queries)) {
    throw new Error("Field 'queries' must be an array of strings.");
  }
  if (queries.length === 0) {
    throw new Error("Array 'queries' cannot be empty.");
  }
  if (queries.length > maxItems) {
    throw new Error(`Batch limit exceeded: maximum ${maxItems} queries per request.`);
  }

  const valid: string[] = [];
  for (const q of queries) {
    if (typeof q === "string" && q.trim().length > 0) {
      valid.push(q.trim().slice(0, 10000));
    }
  }

  if (valid.length === 0) {
    throw new Error("No valid query strings found in 'queries' array.");
  }

  return valid;
}
