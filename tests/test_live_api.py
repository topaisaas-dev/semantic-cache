import urllib.request
import json

BASE_URL = "https://semantic-cache.topaisaas.workers.dev"

def make_request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"User-Agent": "TopAI-TestClient/1.0"}
    encoded_data = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        encoded_data = json.dumps(data).encode("utf-8")
    
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def main():
    print("Testing Live Cloudflare Worker for Semantic Cache...")
    
    # 1. Healthcheck
    status, res = make_request("/v1/health")
    print(f"Healthcheck: {status} -> {res.get('status')}")
    assert status == 200 and res.get("status") == "healthy"

    # 2. OpenAPI Spec
    status, res = make_request("/openapi.json")
    print(f"OpenAPI Spec: {status} -> {res.get('info', {}).get('title')}")
    assert status == 200 and "paths" in res

    # 3. Store pair: POST /v1/cache/set
    print("Testing POST /v1/cache/set...")
    status, res = make_request("/v1/cache/set", method="POST", data={
        "query": "How do I reset my account password?",
        "response": "Go to Settings > Security > Click Reset Password.",
        "namespace": "test-suite",
        "ttl_seconds": 3600
    })
    print(f"POST /v1/cache/set: {status} -> success={res.get('success')}, entry_id={res.get('entry_id')}")
    assert status == 200
    assert res.get("success") is True

    # 4. Semantic check (variation of phrasing): POST /v1/cache/check
    print("Testing POST /v1/cache/check with semantic variation 'Reset my account password please'...")
    status, res = make_request("/v1/cache/check", method="POST", data={
        "query": "Reset my account password please",
        "namespace": "test-suite",
        "similarity_threshold": 0.60
    })
    print(f"POST /v1/cache/check: {status} -> hit={res.get('hit')}, similarity={res.get('similarity')}")
    assert status == 200
    assert res.get("hit") is True
    assert "Settings > Security" in res.get("cached_response", "")

    # 5. Batch Check: POST /v1/cache/batch-check
    print("Testing POST /v1/cache/batch-check...")
    status, res = make_request("/v1/cache/batch-check", method="POST", data={
        "queries": [
            "How do I reset my account password?",
            "Completely unrelated question about astrophysics"
        ],
        "namespace": "test-suite",
        "similarity_threshold": 0.75
    })
    print(f"POST /v1/cache/batch-check: {status} -> hits={res.get('total_hits')}, misses={res.get('total_misses')}")
    assert status == 200
    assert res.get("total_hits") == 1
    assert res.get("total_misses") == 1

    # 6. Stats: GET /v1/cache/stats
    status, res = make_request("/v1/cache/stats")
    print(f"GET /v1/cache/stats: {status} -> total_lookups={res['stats']['total_lookups']}, total_hits={res['stats']['total_hits']}")
    assert status == 200

    print("\nALL LIVE PRODUCTION API TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    main()
