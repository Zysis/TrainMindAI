"""
start_model_server.py
=====================
Start llama-cpp-python server exposing OpenAI-compatible API on port 8000.

This serves the merged TrainMind GGUF model for local inference without GPU.
The ai-service on port 3002 will connect to this server as primary LLM provider,
with OpenAI API as fallback.

Prerequisites:
    pip install llama-cpp-python[server]

Usage:
    python scripts/start_model_server.py

    # Custom port:
    python scripts/start_model_server.py --port 8000

    # Custom model path:
    python scripts/start_model_server.py --model /path/to/model.gguf

Endpoint:
    http://localhost:8000/v1/chat/completions  (OpenAI-compatible)
    http://localhost:8000/v1/models             (list models)
    http://localhost:8000/health                (health check)
"""

import argparse
import sys
from pathlib import Path

SERVICE_DIR = Path(__file__).parent.parent
DEFAULT_MODEL = SERVICE_DIR / "models" / "trainmind-mistral-7b-Q4_K_M.gguf"


def check_model(model_path: Path) -> bool:
    """Verify GGUF model file exists."""
    if not model_path.exists():
        print(f"❌ Model not found: {model_path}")
        print("\n   Run the conversion script first:")
        print("   python scripts/merge_and_convert.py")
        print("\n   Or download a pre-quantized Mistral-7B GGUF and place at:")
        print(f"   {model_path}")
        return False

    size_gb = model_path.stat().st_size / (1024**3)
    print(f"✅ Model found: {model_path.name} ({size_gb:.1f} GB)")
    return True


def main():
    parser = argparse.ArgumentParser(description="Start TrainMind local LLM server")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL),
                        help="Path to GGUF model file")
    parser.add_argument("--port", type=int, default=8000,
                        help="Server port (default: 8000)")
    parser.add_argument("--host", type=str, default="0.0.0.0",
                        help="Server host (default: 0.0.0.0)")
    parser.add_argument("--n-ctx", type=int, default=8192,
                        help="Context window size (default: 8192)")
    parser.add_argument("--n-threads", type=int, default=None,
                        help="Number of CPU threads (default: auto)")
    parser.add_argument("--n-gpu-layers", type=int, default=0,
                        help="GPU layers to offload (0 = CPU only)")
    args = parser.parse_args()

    model_path = Path(args.model)
    if not check_model(model_path):
        sys.exit(1)

    # Check llama-cpp-python[server] is installed
    try:
        from llama_cpp.server.app import create_app
        from llama_cpp.server.settings import ModelSettings, ServerSettings
    except ImportError:
        print("❌ llama-cpp-python[server] not installed")
        print("   pip install 'llama-cpp-python[server]'")
        sys.exit(1)

    print(f"\n🚀 Starting TrainMind LLM Server")
    print(f"   Model:    {model_path.name}")
    print(f"   Endpoint: http://{args.host}:{args.port}/v1")
    print(f"   Context:  {args.n_ctx} tokens")
    print(f"   Threads:  {args.n_threads or 'auto'}")
    print(f"   GPU layers: {args.n_gpu_layers}")
    print(f"\n   Press Ctrl+C to stop.\n")

    # Configure and start server
    import uvicorn

    model_settings = ModelSettings(
        model=str(model_path),
        model_alias="trainmind",
        n_ctx=args.n_ctx,
        n_threads=args.n_threads,
        n_gpu_layers=args.n_gpu_layers,
        chat_format="mistral-instruct",
        verbose=False,
    )

    server_settings = ServerSettings(
        host=args.host,
        port=args.port,
    )

    app = create_app(
        model_settings=[model_settings],
        server_settings=server_settings,
    )

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
