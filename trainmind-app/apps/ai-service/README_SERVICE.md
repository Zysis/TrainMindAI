# TrainMind AI Service

FastAPI service for LLM interactions and vector search powered by OpenAI GPT-4o and Pinecone.

## Overview

The TrainMind AI Service is a production-ready FastAPI application that provides:

- **LLM Integration**: ChatGPT-4o for intelligent text generation and consultation
- **Embeddings**: OpenAI text embeddings for semantic search
- **Vector Search**: Pinecone for retrieving relevant documents
- **RAG Pipeline**: Retrieval-Augmented Generation for context-aware responses
- **Streaming Support**: Server-Sent Events (SSE) for real-time responses

## Features

### Endpoints

1. **POST /ai/generate** - Content Generation
   - Generates training plans, sessions, and exercises
   - Context-aware using RAG from knowledge base
   - Returns generated content with source citations

2. **POST /ai/coach** - Expert Coach Consultation
   - Provides expert advice on training, form, recovery, nutrition
   - Returns answers with scientific references
   - Multi-namespace RAG search

3. **POST /ai/embed** - Embedding & Storage
   - Creates embeddings for texts
   - Stores vectors in Pinecone
   - Supports batch operations with metadata

4. **POST /ai/chat** - Conversational AI
   - RAG-enhanced chat interface
   - Supports streaming and non-streaming responses
   - Message history support

5. **GET /ai/embed/stats** - Index Statistics
   - Returns Pinecone index statistics
   - Shows vector counts per namespace

6. **GET /health** - Health Check
   - Service status verification
   - Dependent services health

## Installation

### Prerequisites

- Python 3.11+
- Docker (optional)
- OpenAI API key
- Pinecone API key

### Local Setup

1. Clone and navigate to the service directory:
```bash
cd apps/ai-service
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys
```

5. Run the service:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 3004
```

## Docker Setup

Build and run with Docker Compose:

```bash
cd ../..  # Navigate to root
docker-compose up -d ai-service
```

The service will be available at `http://localhost:3004`

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=trainmind-kb
PINECONE_ENVIRONMENT=us-east-1

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/trainmind

# Service Configuration
AI_SERVICE_PORT=3004
AI_SERVICE_HOST=0.0.0.0
LOG_LEVEL=info
```

## API Usage Examples

### Generate Training Plan

```bash
curl -X POST "http://localhost:3004/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Crea un piano di allenamento per la forza per un giocatore di basket",
    "context_type": "plan",
    "namespace": "protocols",
    "top_k": 5
  }'
```

### Get Coach Consultation

```bash
curl -X POST "http://localhost:3004/ai/coach" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Come migliorare il controllo della palla?",
    "category": "technique",
    "namespaces": ["protocols", "exercises"],
    "top_k": 5
  }'
```

### Upload Documents to Knowledge Base

```bash
curl -X POST "http://localhost:3004/ai/embed" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["Contenuto documento 1", "Contenuto documento 2"],
    "namespace": "protocols",
    "metadata": [
      {"title": "Doc 1", "category": "strength"},
      {"title": "Doc 2", "category": "conditioning"}
    ]
  }'
```

### Chat with RAG

```bash
curl -X POST "http://localhost:3004/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Cos'\''è la periodizzazione?"}
    ],
    "stream": false,
    "temperature": 0.7,
    "namespaces": ["protocols", "references"]
  }'
```

### Streaming Chat

For streaming responses, set `stream: true` and process SSE events.

## Architecture

### Components

- **FastAPI App** (`app/main.py`): Core application with middleware and lifecycle
- **OpenAI Client** (`app/clients/openai_client.py`): LLM and embedding interactions
- **Pinecone Client** (`app/clients/pinecone_client.py`): Vector database operations
- **RAG Service** (`app/services/rag.py`): Context retrieval and prompt building
- **Routers**: Modular endpoint implementations
- **Schemas** (`app/models/schemas.py`): Pydantic models for validation

### Data Flow

1. User sends request to endpoint
2. Query is embedded using OpenAI embeddings
3. Vector search retrieves relevant documents from Pinecone
4. Context is built from retrieved documents
5. LLM generates response using system prompt + context + user query
6. Response is returned with source citations

### Namespaces

Pinecone index uses these namespaces:

- **exercises**: Exercise descriptions and movement patterns
- **protocols**: Training protocols and programs
- **periodization**: Training periodization strategies
- **references**: Scientific research and studies

## Logging

The service uses structured logging with `structlog`. Logs include:

- Request/response tracking
- Service initialization
- Error details with stack traces
- Performance metrics

Set `LOG_LEVEL=debug` for detailed logging.

## Error Handling

- **400 Bad Request**: Invalid request format
- **500 Internal Server Error**: Service errors
- **503 Service Unavailable**: External service errors (OpenAI, Pinecone)

All errors include descriptive messages for debugging.

## Performance Considerations

- **Token Counting**: Built-in token counting via tiktoken
- **Batch Operations**: Efficient batch embedding creation
- **Caching**: Singleton pattern for client instances
- **Streaming**: SSE support for large responses
- **Retry Logic**: Exponential backoff with tenacity for API calls

## Development

### Project Structure

```
apps/ai-service/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration management
│   ├── clients/
│   │   ├── openai_client.py # OpenAI integration
│   │   └── pinecone_client.py # Pinecone integration
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   ├── routers/
│   │   ├── generate.py      # Content generation
│   │   ├── coach.py         # Coach consultation
│   │   ├── embed.py         # Embedding management
│   │   └── chat.py          # Chat endpoint
│   └── services/
│       ├── rag.py           # RAG service
│       ├── prompts.py       # System prompts
│       └── context_builder.py # Context building
├── Dockerfile               # Docker configuration
├── requirements.txt         # Python dependencies
├── pyproject.toml          # Project metadata
└── README.md               # This file
```

### Code Style

- Type hints throughout
- Docstrings in Italian and English
- Structured logging with context
- Error handling and validation

## Troubleshooting

### OpenAI Connection Issues

- Verify API key is valid and has quota
- Check rate limits

### Pinecone Connection Issues

- Verify Pinecone API key and environment
- Check index exists: `GET /ai/embed/stats`

### Service Won't Start

- Check logs: `docker logs trainmind-ai-service`
- Verify all environment variables are set
- Ensure port 3004 is available

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, contact the TrainMind development team.
