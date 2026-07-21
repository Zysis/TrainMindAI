"""
merge_and_convert.py
====================
Merge LoRA adapter into Mistral-7B base model and convert to GGUF format
for CPU inference with llama-cpp-python.

Prerequisites:
    pip install torch transformers peft safetensors llama-cpp-python[server]

Usage:
    python scripts/merge_and_convert.py

Output:
    models/trainmind-mistral-7b-Q4_K_M.gguf
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
SERVICE_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = SERVICE_DIR.parent.parent.parent  # TrainMindAI root

ADAPTER_PATH = PROJECT_ROOT / "model_production" / "llm_model" / "outputs" / "lora" / "lora" / "adapter"
MERGED_MODEL_DIR = SERVICE_DIR / "models" / "merged"
GGUF_OUTPUT_DIR = SERVICE_DIR / "models"
GGUF_FILENAME = "trainmind-mistral-7b-Q4_K_M.gguf"

BASE_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"


def check_dependencies():
    """Verify required packages are installed."""
    missing = []
    for pkg in ["torch", "transformers", "peft", "safetensors"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"❌ Missing packages: {', '.join(missing)}")
        print(f"   Install with: pip install {' '.join(missing)}")
        sys.exit(1)

    print("✅ All dependencies found")


def merge_lora():
    """Merge LoRA adapter into base model."""
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel
    import torch

    print(f"\n📥 Loading base model: {BASE_MODEL}")
    print("   (This will download ~14GB on first run)")

    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="cpu",
        trust_remote_code=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)

    print(f"\n🔗 Loading LoRA adapter from: {ADAPTER_PATH}")
    model = PeftModel.from_pretrained(base_model, str(ADAPTER_PATH))

    print("\n🔀 Merging LoRA weights into base model...")
    model = model.merge_and_unload()

    # Save merged model
    MERGED_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n💾 Saving merged model to: {MERGED_MODEL_DIR}")
    model.save_pretrained(str(MERGED_MODEL_DIR), safe_serialization=True)
    tokenizer.save_pretrained(str(MERGED_MODEL_DIR))

    print("✅ Merge complete")
    return MERGED_MODEL_DIR


def convert_to_gguf(merged_dir: Path):
    """Convert merged model to GGUF format using llama.cpp."""

    gguf_path = GGUF_OUTPUT_DIR / GGUF_FILENAME
    GGUF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Try using llama-cpp-python's built-in converter first
    # If not available, use llama.cpp convert script

    print("\n🔄 Converting to GGUF Q4_K_M format...")

    # Method 1: Use huggingface-hub convert (if available)
    try:
        from transformers import AutoModelForCausalLM

        # First convert to fp16 GGUF
        fp16_path = GGUF_OUTPUT_DIR / "trainmind-mistral-7b-f16.gguf"

        # Try llama.cpp python conversion
        convert_script = None

        # Check if llama-cpp-python has convert script
        try:
            import llama_cpp
            llama_dir = Path(llama_cpp.__file__).parent
            convert_script = llama_dir / "llama_cpp" / "convert.py"
        except:
            pass

        # Fallback: use pip-installed llama-cpp convert
        # We'll use the subprocess approach with convert-hf-to-gguf.py from llama.cpp
        print("   Using llama.cpp conversion pipeline...")

        # Install llama-cpp-python which includes conversion tools
        subprocess.run([
            sys.executable, "-m", "pip", "install",
            "llama-cpp-python[server]", "--quiet"
        ], check=True)

        # Use the convert_hf_to_gguf approach via Python
        # First try the pip-installed tool
        result = subprocess.run([
            sys.executable, "-m", "llama_cpp.convert",
            "--outfile", str(fp16_path),
            "--outtype", "f16",
            str(merged_dir)
        ], capture_output=True, text=True)

        if result.returncode != 0:
            # Fallback: clone llama.cpp and use its converter
            print("   Downloading llama.cpp converter...")
            llama_cpp_dir = SERVICE_DIR / "scripts" / "llama.cpp"

            if not llama_cpp_dir.exists():
                subprocess.run([
                    "git", "clone", "--depth", "1",
                    "https://github.com/ggerganov/llama.cpp.git",
                    str(llama_cpp_dir)
                ], check=True)

            # Install converter requirements
            req_file = llama_cpp_dir / "requirements" / "requirements-convert_hf_to_gguf.txt"
            if req_file.exists():
                subprocess.run([
                    sys.executable, "-m", "pip", "install",
                    "-r", str(req_file), "--quiet"
                ], check=True)

            # Convert HF to GGUF (fp16)
            convert_script = llama_cpp_dir / "convert_hf_to_gguf.py"
            subprocess.run([
                sys.executable, str(convert_script),
                str(merged_dir),
                "--outfile", str(fp16_path),
                "--outtype", "f16"
            ], check=True)

        print(f"   ✅ FP16 GGUF created: {fp16_path}")

        # Quantize to Q4_K_M
        print("   Quantizing to Q4_K_M...")

        # Try using llama-quantize binary
        quantize_bin = shutil.which("llama-quantize") or shutil.which("quantize")

        if quantize_bin:
            subprocess.run([
                quantize_bin, str(fp16_path), str(gguf_path), "Q4_K_M"
            ], check=True)
        else:
            # Use llama.cpp quantize
            llama_cpp_dir = SERVICE_DIR / "scripts" / "llama.cpp"
            quantize_bin = llama_cpp_dir / "build" / "bin" / "llama-quantize"

            if not quantize_bin.exists():
                print("   Building llama.cpp quantize tool...")
                build_dir = llama_cpp_dir / "build"
                build_dir.mkdir(exist_ok=True)
                subprocess.run(["cmake", "..", "-DLLAMA_NATIVE=OFF"],
                             cwd=str(build_dir), check=True)
                subprocess.run(["cmake", "--build", ".", "--target", "llama-quantize", "-j4"],
                             cwd=str(build_dir), check=True)

            subprocess.run([
                str(quantize_bin), str(fp16_path), str(gguf_path), "Q4_K_M"
            ], check=True)

        # Cleanup fp16
        fp16_path.unlink(missing_ok=True)

        print(f"✅ GGUF model ready: {gguf_path}")
        print(f"   Size: {gguf_path.stat().st_size / (1024**3):.1f} GB")

    except Exception as e:
        print(f"\n❌ Conversion failed: {e}")
        print("\n📋 Manual alternative:")
        print(f"   1. Download pre-quantized GGUF from HuggingFace:")
        print(f"      https://huggingface.co/models?search=mistral-7b-instruct-v0.3+gguf")
        print(f"   2. Place it at: {gguf_path}")
        print(f"   3. Note: Pre-quantized won't include LoRA fine-tuning")
        print(f"      For LoRA, you need to merge first then convert.")
        sys.exit(1)

    return gguf_path


def cleanup_merged(merged_dir: Path):
    """Remove intermediate merged model to save disk space."""
    if merged_dir.exists():
        print(f"\n🧹 Cleaning up merged model dir: {merged_dir}")
        shutil.rmtree(merged_dir)
        print("   Done")


def main():
    print("=" * 60)
    print("TrainMind — LoRA Merge & GGUF Conversion")
    print("=" * 60)
    print(f"Base model:  {BASE_MODEL}")
    print(f"LoRA adapter: {ADAPTER_PATH}")
    print(f"Output:      {GGUF_OUTPUT_DIR / GGUF_FILENAME}")
    print("=" * 60)

    # Check adapter exists
    if not ADAPTER_PATH.exists():
        print(f"❌ Adapter not found at {ADAPTER_PATH}")
        sys.exit(1)

    check_dependencies()
    merged_dir = merge_lora()
    gguf_path = convert_to_gguf(merged_dir)
    cleanup_merged(merged_dir)

    print("\n" + "=" * 60)
    print("✅ DONE! Model ready for serving.")
    print(f"   GGUF file: {gguf_path}")
    print("\n   Next step: start the model server with:")
    print("   python scripts/start_model_server.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
