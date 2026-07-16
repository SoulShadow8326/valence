# Valence


## Stack

- **Backend** — Go gateway that spins up ephemeral nodes per browser session, connected via mDNS peer discovery and LiP (Lightweight Peer) sessions
- **Frontend** — Next.js UI

## Run locally

```bash
# dev mode (hot reload UI)
bash run.sh dev

# prod mode (builds UI first)
bash run.sh
```

App → `http://localhost:3000`  
Gateway → `http://localhost:8080`

> Open two windows with different Node IDs (e.g. normal + incognito) to demo convergence.

## Environment variables (.env in root)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Gemini API key used by the engine |
