import urllib.request
import json
import subprocess
import os

def load_env():
    env = {}
    env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"))
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"')
    return env

env = load_env()
GITHUB_USER = env.get("GITHUB_USERNAME", "topaisaas-dev")
GITHUB_TOKEN = env.get("GITHUB_TOKEN", os.environ.get("GITHUB_TOKEN", ""))
REPO_NAME = "semantic-cache"
REPO_DESC = "Ultra-Fast Semantic Vector Cache & Token Saver for OpenAI GPT-4o, Claude 3.5 Sonnet, Gemini 1.5. Sub-millisecond similarity matching on Cloudflare Workers edge."

def create_github_repo():
    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "TopAI-Script/1.0"
    }
    payload = {
        "name": REPO_NAME,
        "description": REPO_DESC,
        "private": False,
        "homepage": "https://semantic-cache.topaisaas.workers.dev"
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"GitHub repo created successfully: {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        if "already exists" in body:
            print("GitHub repo already exists, proceeding to push.")
        else:
            print(f"GitHub repo creation notice: {e.code} -> {body}")

def git_init_and_push():
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Working in: {cwd}")
    
    subprocess.run(["git", "init"], cwd=cwd, check=True)
    subprocess.run(["git", "config", "user.name", GITHUB_USER], cwd=cwd, check=True)
    subprocess.run(["git", "config", "user.email", "top.ai.saas@gmail.com"], cwd=cwd, check=True)
    subprocess.run(["git", "branch", "-M", "main"], cwd=cwd, check=True)
    
    subprocess.run(["git", "add", "."], cwd=cwd, check=True)
    subprocess.run(["git", "commit", "-m", "Initial commit: Production Semantic Cache & Token Saver API"], cwd=cwd, check=True)
    
    remote_url = f"https://{GITHUB_USER}:{GITHUB_TOKEN}@github.com/{GITHUB_USER}/{REPO_NAME}.git"
    subprocess.run(["git", "remote", "remove", "origin"], cwd=cwd, check=False)
    subprocess.run(["git", "remote", "add", "origin", remote_url], cwd=cwd, check=True)
    
    result = subprocess.run(["git", "push", "-u", "origin", "main", "--force"], cwd=cwd, capture_output=True, text=True)
    print("Push stdout:", result.stdout)
    print("Push stderr:", result.stderr)
    if result.returncode == 0:
        print(f"Successfully pushed to https://github.com/{GITHUB_USER}/{REPO_NAME}")
    else:
        print("Git push encountered an issue.")

if __name__ == "__main__":
    create_github_repo()
    git_init_and_push()
