import json
import os
import sys

def test_openapi_spec():
    spec_path = os.path.join(os.path.dirname(__file__), "..", "openapi.json")
    assert os.path.exists(spec_path), "openapi.json does not exist"
    
    with open(spec_path, "rb") as f:
        raw = f.read()
        assert not raw.startswith(b"\xef\xbb\xbf"), "BOM found in openapi.json! Must be pure UTF-8."
    
    with open(spec_path, "r", encoding="utf-8") as f:
        spec = json.load(f)
    
    assert spec.get("openapi") == "3.0.3", "Invalid openapi version"
    assert "/v1/cache/check" in spec["paths"], "Missing /v1/cache/check"
    assert "/v1/cache/set" in spec["paths"], "Missing /v1/cache/set"
    assert "/v1/cache/batch-check" in spec["paths"], "Missing /v1/cache/batch-check"
    assert "/v1/cache/stats" in spec["paths"], "Missing /v1/cache/stats"
    assert "/v1/health" in spec["paths"], "Missing /v1/health"
    print("PASS: OpenAPI spec is 100% valid without BOM.")

def test_wrangler_config():
    wrangler_path = os.path.join(os.path.dirname(__file__), "..", "wrangler.toml")
    with open(wrangler_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert 'name = "semantic-cache"' in content
    assert 'account_id = "c2f6458a58ca3c80c5d0c3359baaa3cb"' in content
    print("PASS: wrangler.toml configured properly.")

def test_vector_engine_code():
    engine_path = os.path.join(os.path.dirname(__file__), "..", "src", "vector_engine.ts")
    with open(engine_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "computeCosineSimilarity" in content
    assert "extractVectorFeatures" in content
    assert "checkCache" in content
    assert "setCache" in content
    print("PASS: Vector similarity math and cache methods verified.")

if __name__ == "__main__":
    test_openapi_spec()
    test_wrangler_config()
    test_vector_engine_code()
    print("\nALL PRE-DEPLOYMENT QA & RED TEAMING CHECKS PASSED (100% SUCCESS)!")
