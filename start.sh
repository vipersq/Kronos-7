#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v ollama >/dev/null || echo "Uwaga: brak Ollamy (https://ollama.com). Terminal ruszy bez analizy AI."
pgrep -x ollama >/dev/null || (command -v ollama >/dev/null && (ollama serve >/dev/null 2>&1 &))
exec python3 server.py
