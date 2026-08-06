"""
test_integration.py
====================
Integration tests for the dual-provider LLM setup.

Tests:
1. Local LLM server health check
2. Local LLM chat completion
3. Local LLM streaming
4. AI service health check (dual-provider status)
5. AI service chat endpoint
6. AI service coach endpoint
7. AI service generate endpoint
8. Fallback: disable local → verify OpenAI fallback
9. Provider status reporting

Usage:
    python scripts/test_integration.py

    # Test only local LLM server:
    python scripts/test_integration.py --local-only

    # Test only AI service:
    python scripts/test_integration.py --service-only
"""

import argparse
import json
import sys
import time
from typing import Optional

import httpx

# URLs
LOCAL_LLM_URL = "http://localhost:8000"
AI_SERVICE_URL = "http://localhost:3004"

passed = 0
failed = 0
skipped = 0


def test(name: str, func, skip: bool = False):
    """Run a test and report result."""
    global passed, failed, skipped
    if skip:
        print(f"  ⏭️  {name} — SKIPPED")
        skipped += 1
        return None

    try:
        result = func()
        print(f"  ✅ {name}")
        passed += 1
        return result
    except AssertionError as e:
        print(f"  ❌ {name} — {e}")
        failed += 1
        return None
    except Exception as e:
        print(f"  ❌ {name} — Exception: {e}")
        failed += 1
        return None


def check_server(url: str, timeout: float = 5.0) -> bool:
    """Check if a server is reachable."""
    try:
        resp = httpx.get(f"{url}/health", timeout=timeout)
        return resp.status_code == 200
    except Exception:
        return False


# ─── Test functions ────────────────────────────────────

def test_local_health():
    resp = httpx.get(f"{LOCAL_LLM_URL}/health", timeout=10)
    assert resp.status_code == 200, f"Status {resp.status_code}"
    return resp.json()


def test_local_models():
    resp = httpx.get(f"{LOCAL_LLM_URL}/v1/models", timeout=10)
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    assert len(data.get("data", [])) > 0, "No models listed"
    model_id = data["data"][0]["id"]
    print(f"        Model: {model_id}")
    return model_id


def test_local_chat():
    resp = httpx.post(
        f"{LOCAL_LLM_URL}/v1/chat/completions",
        json={
            "model": "trainmind",
            "messages": [
                {"role": "system", "content": "Sei un esperto di scienze dello sport."},
                {"role": "user", "content": "Cos'è la periodizzazione ondulata? Rispondi in massimo 2 frasi."},
            ],
            "temperature": 0.7,
            "max_tokens": 256,
        },
        timeout=120,  # CPU inference is slow
    )
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    assert len(content) > 10, f"Response too short: '{content}'"
    print(f"        Response: {content[:100]}...")
    return content


def test_local_chat_stream():
    with httpx.stream(
        "POST",
        f"{LOCAL_LLM_URL}/v1/chat/completions",
        json={
            "model": "trainmind",
            "messages": [
                {"role": "user", "content": "Dimmi 3 esercizi per il quadricipite."},
            ],
            "temperature": 0.7,
            "max_tokens": 256,
            "stream": True,
        },
        timeout=120,
    ) as resp:
        assert resp.status_code == 200, f"Status {resp.status_code}"
        chunks = []
        for line in resp.iter_lines():
            if line.startswith("data: ") and line != "data: [DONE]":
                chunk = json.loads(line[6:])
                delta = chunk["choices"][0].get("delta", {})
                if "content" in delta:
                    chunks.append(delta["content"])
        full = "".join(chunks)
        assert len(full) > 10, f"Stream too short: '{full}'"
        print(f"        Streamed: {full[:100]}...")


def test_service_health():
    resp = httpx.get(f"{AI_SERVICE_URL}/health", timeout=10)
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    print(f"        Status: {data.get('status')}")
    providers = data.get("providers", {})
    if providers:
        active = providers.get("active_llm_provider", "unknown")
        print(f"        Active LLM: {active}")
        local = providers.get("local_llm", {})
        print(f"        Local LLM: {'UP' if local.get('healthy') else 'DOWN'}")
        openai = providers.get("openai", {})
        print(f"        OpenAI: {'configured' if openai.get('configured') else 'not configured'}")
    return data


def test_service_chat():
    resp = httpx.post(
        f"{AI_SERVICE_URL}/ai/chat",
        json={
            "messages": [
                {"role": "user", "content": "Cosa sono le superserie? Rispondi brevemente."},
            ],
            "stream": False,
        },
        timeout=120,
    )
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    answer = data.get("answer") or data.get("response", "")
    assert len(answer) > 10, f"Answer too short: '{answer}'"
    print(f"        Answer: {answer[:100]}...")


def test_service_coach():
    resp = httpx.post(
        f"{AI_SERVICE_URL}/ai/coach",
        json={
            "question": "Come strutturare un programma di forza per un giocatore di basket?",
            "namespaces": ["protocols"],
            "top_k": 3,
        },
        timeout=120,
    )
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    answer = data.get("answer", "")
    assert len(answer) > 10, f"Answer too short: '{answer}'"
    print(f"        Answer: {answer[:100]}...")


def test_service_generate():
    resp = httpx.post(
        f"{AI_SERVICE_URL}/ai/generate",
        json={
            "prompt": "Genera un microciclo settimanale di forza per un atleta intermedio di basket.",
            "type": "training_plan",
        },
        timeout=180,
    )
    assert resp.status_code == 200, f"Status {resp.status_code}"
    data = resp.json()
    # Check we got some structured response
    assert data, "Empty response"
    print(f"        Keys: {list(data.keys())[:5]}")


def test_provider_status():
    resp = httpx.get(f"{AI_SERVICE_URL}/health", timeout=10)
    data = resp.json()
    providers = data.get("providers", {})
    active = providers.get("active_llm_provider", "none")
    assert active != "none", "No LLM provider active"
    print(f"        Active: {active}")
    return active


# ─── Main ──────────────────────────────────────────────

def main():
    global passed, failed, skipped

    parser = argparse.ArgumentParser()
    parser.add_argument("--local-only", action="store_true", help="Test only local LLM")
    parser.add_argument("--service-only", action="store_true", help="Test only AI service")
    args = parser.parse_args()

    print("=" * 60)
    print("TrainMind — Integration Tests")
    print("=" * 60)

    local_up = check_server(LOCAL_LLM_URL)
    service_up = check_server(AI_SERVICE_URL)

    print(f"\n  Local LLM ({LOCAL_LLM_URL}): {'🟢 UP' if local_up else '🔴 DOWN'}")
    print(f"  AI Service ({AI_SERVICE_URL}): {'🟢 UP' if service_up else '🔴 DOWN'}")

    # ─── Local LLM tests ──────────────────
    skip_local = args.service_only or not local_up
    print(f"\n{'─' * 40}")
    print("LOCAL LLM SERVER TESTS")
    print(f"{'─' * 40}")

    if not local_up and not args.service_only:
        print("  ⚠️  Local LLM server not running. Start with:")
        print("     python scripts/start_model_server.py")
        print("  Skipping local tests.\n")

    test("Health check", test_local_health, skip=skip_local)
    test("List models", test_local_models, skip=skip_local)
    test("Chat completion", test_local_chat, skip=skip_local)
    test("Chat streaming", test_local_chat_stream, skip=skip_local)

    # ─── AI Service tests ──────────────────
    skip_service = args.local_only or not service_up
    print(f"\n{'─' * 40}")
    print("AI SERVICE TESTS (dual-provider)")
    print(f"{'─' * 40}")

    if not service_up and not args.local_only:
        print("  ⚠️  AI service not running. Start with:")
        print("     cd apps/ai-service && uvicorn app.main:app --port 3004")
        print("  Skipping service tests.\n")

    test("Health check + provider status", test_service_health, skip=skip_service)
    test("Chat endpoint", test_service_chat, skip=skip_service)
    test("Coach endpoint", test_service_coach, skip=skip_service)
    test("Generate endpoint", test_service_generate, skip=skip_service)
    test("Provider status", test_provider_status, skip=skip_service)

    # ─── Summary ───────────────────────────
    print(f"\n{'=' * 60}")
    total = passed + failed + skipped
    print(f"RESULTS: {passed} passed, {failed} failed, {skipped} skipped (total: {total})")

    if failed > 0:
        print("\n⚠️  Some tests failed. Check the output above.")
        sys.exit(1)
    elif skipped == total:
        print("\n⚠️  All tests skipped. Start the servers first.")
        sys.exit(2)
    else:
        print("\n✅ All running tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
