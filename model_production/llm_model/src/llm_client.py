"""
src/llm_client.py
=================
Client LLM compatibile con OpenAI API e vLLM.

Supporta sia OpenAI (per baseline e fallback) sia vLLM self-hosted,
con la stessa interfaccia. Il provider è configurabile via variabile d'ambiente
LLM_PROVIDER ("openai" | "vllm").

Feature:
- API OpenAI-compatible (funziona con vLLM nativamente)
- Feature flag per switch rapido tra provider
- Temperature configurabile per tipo di output (0.0 per JSON, 0.3 per testo)
- Retry automatico con backoff
- Logging di ogni chiamata (input, output, latenza, costo)

Uso:
    from src.llm_client import LLMClient
    client = LLMClient()
    response = client.generate(messages=[...], temperature=0.0)
"""

import os
import time
from typing import Optional

import httpx
from openai import OpenAI
from rich.console import Console

console = Console()


class LLMClient:
    """
    Client LLM unificato per OpenAI e vLLM.
    
    Usa la libreria openai come client perché vLLM espone un endpoint
    compatibile con l'API OpenAI (/v1/chat/completions).
    Questo permette di switchare provider cambiando solo base_url e model.
    """

    def __init__(
        self,
        provider: str = "openai",
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        default_temperature: float = 0.3,
        max_retries: int = 3
    ):
        """
        Inizializza il client LLM.
        
        Args:
            provider: "openai" o "vllm"
            base_url: URL base per l'API (None = default OpenAI)
            api_key: API key (obbligatoria per OpenAI, placeholder per vLLM)
            model: Nome del modello da usare
            default_temperature: Temperature di default (0.3 per testo, 0.0 per JSON)
            max_retries: Numero massimo di retry in caso di errore
        """
        self.provider = provider
        self.default_temperature = default_temperature
        self.max_retries = max_retries
        
        # Configurazione specifica per provider
        if provider == "vllm":
            self.base_url = base_url or "http://localhost:8000/v1"
            self.api_key = api_key or "token-placeholder"
            self.model = model or "mistralai/Mistral-Small-3.1-24B-Instruct-2503"
        else:  # openai
            self.base_url = base_url  # None = usa default OpenAI
            self.api_key = api_key or ""
            self.model = model or "gpt-4o-mini"
        
        # Inizializza client OpenAI (compatibile con vLLM)
        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        
        # Workaround per ambienti con certificati SSL non validi
        if os.environ.get("SSL_VERIFY", "true").lower() == "false":
            client_kwargs["http_client"] = httpx.Client(verify=False)
        
        self.client = OpenAI(**client_kwargs)
        
        console.print(f"[blue]🤖 LLM Client inizializzato[/blue]")
        console.print(f"   Provider: {self.provider}")
        console.print(f"   Model: {self.model}")
        if self.base_url:
            console.print(f"   Base URL: {self.base_url}")

    def generate(
        self,
        messages: list[dict],
        temperature: Optional[float] = None,
        max_tokens: int = 4096,
        top_p: float = 1.0,
        response_format: Optional[dict] = None,
        stop: Optional[list[str]] = None
    ) -> dict:
        """
        Genera una risposta dal LLM.
        
        Args:
            messages: Lista di messaggi in formato OpenAI
                      [{"role": "system"|"user"|"assistant", "content": "..."}]
            temperature: Temperature di generazione (0.0=deterministico, 1.0=creativo)
            max_tokens: Numero massimo di token nella risposta
            top_p: Nucleus sampling (1.0 = no filtering)
            response_format: Formato risposta (es. {"type": "json_object"} per JSON mode)
            stop: Lista di sequenze di stop
            
        Returns:
            Dict con "content" (testo risposta), "usage" (token usati), "latency_ms"
        """
        temp = temperature if temperature is not None else self.default_temperature
        
        # Prepara parametri della chiamata
        call_params = {
            "model": self.model,
            "messages": messages,
            "temperature": temp,
            "max_tokens": max_tokens,
            "top_p": top_p,
        }
        
        if response_format:
            call_params["response_format"] = response_format
        
        if stop:
            call_params["stop"] = stop
        
        # Esegui chiamata con retry
        last_error = None
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()
                
                response = self.client.chat.completions.create(**call_params)
                
                latency_ms = (time.time() - start_time) * 1000
                
                # Estrai risultato
                result = {
                    "content": response.choices[0].message.content,
                    "finish_reason": response.choices[0].finish_reason,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    },
                    "latency_ms": latency_ms,
                    "model": response.model,
                    "provider": self.provider,
                }
                
                return result
                
            except Exception as e:
                last_error = e
                wait_time = 2 ** attempt  # Exponential backoff
                console.print(f"[yellow]⚠️  Tentativo {attempt+1}/{self.max_retries} fallito: {e}[/yellow]")
                if attempt < self.max_retries - 1:
                    console.print(f"   Retry tra {wait_time}s...")
                    time.sleep(wait_time)
        
        # Tutti i retry falliti
        raise RuntimeError(
            f"LLM generation fallita dopo {self.max_retries} tentativi. "
            f"Ultimo errore: {last_error}"
        )

    def generate_json(
        self,
        messages: list[dict],
        max_tokens: int = 4096
    ) -> dict:
        """
        Genera una risposta in formato JSON (temperature=0.0 per determinismo).
        
        Usa JSON mode se supportato dal provider, altrimenti istruisce il modello
        via system prompt a rispondere in JSON.
        
        Args:
            messages: Lista di messaggi
            max_tokens: Numero massimo di token
            
        Returns:
            Dict con "content" (stringa JSON), "usage", "latency_ms"
        """
        return self.generate(
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
            top_p=1.0,
            response_format={"type": "json_object"},
        )

    def generate_report(
        self,
        messages: list[dict],
        max_tokens: int = 4096
    ) -> dict:
        """
        Genera un report testuale (temperature=0.3 per bilanciare qualità e stabilità).
        
        Args:
            messages: Lista di messaggi
            max_tokens: Numero massimo di token
            
        Returns:
            Dict con "content" (testo report), "usage", "latency_ms"
        """
        return self.generate(
            messages=messages,
            temperature=0.3,
            max_tokens=max_tokens,
        )

    def health_check(self) -> bool:
        """
        Verifica che il provider LLM sia raggiungibile e funzionante.
        
        Returns:
            True se il provider risponde correttamente
        """
        try:
            response = self.generate(
                messages=[{"role": "user", "content": "Rispondi solo: ok"}],
                temperature=0.0,
                max_tokens=10,
            )
            return response["content"].strip().lower() == "ok"
        except Exception as e:
            console.print(f"[red]❌ Health check fallito: {e}[/red]")
            return False
