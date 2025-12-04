"""
Generate Embeddings for Quote Descriptions
==========================================

This script generates vector embeddings for quote descriptions and stores them
in the separate `quote_embeddings` table (not in temp_quotes_bi which is ETL-managed).

These embeddings enable semantic search - finding quotes by meaning rather than
exact keyword matches.

Usage:
    python scripts/etl/generate_quote_embeddings.py

Requirements:
    - OPENROUTER_API_KEY environment variable
    - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
    - pgvector extension enabled in Supabase (run migration first)

Cost estimate:
    - ~2000 quotes * ~100 tokens avg = 200K tokens
    - text-embedding-3-small (via OpenRouter): $0.02 per 1M tokens
    - Total: ~$0.004 (very cheap!)
"""

import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from dotenv import load_dotenv

from supabase import Client, create_client

# Load environment variables - check both .env and .env.local
load_dotenv()  # Load .env first
load_dotenv(".env.local")  # Then .env.local (overrides .env)

# Configuration - use OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Embedding model configuration - using OpenRouter
# OpenRouter supports OpenAI embedding models
EMBEDDING_MODEL = "openai/text-embedding-3-small"  # 1536 dimensions via OpenRouter
BATCH_SIZE = 50  # Smaller batches for OpenRouter
MAX_TOKENS_PER_TEXT = 8000  # Model limit is 8191


def get_supabase_client() -> Client:
    """Create Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Get embeddings from OpenRouter API for a batch of texts.

    Args:
        texts: List of text strings to embed

    Returns:
        List of embedding vectors (1536 floats each)
    """
    if not OPENROUTER_API_KEY:
        raise ValueError("Missing OPENROUTER_API_KEY environment variable")

    # Truncate texts that are too long and clean them
    truncated_texts = []
    for text in texts:
        # Clean the text
        clean_text = (text or "").strip()
        if not clean_text:
            clean_text = "empty"
        # Rough estimate: 4 chars per token
        if len(clean_text) > MAX_TOKENS_PER_TEXT * 4:
            truncated_texts.append(clean_text[: MAX_TOKENS_PER_TEXT * 4])
        else:
            truncated_texts.append(clean_text)

    response = httpx.post(
        "https://openrouter.ai/api/v1/embeddings",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://imacx.pt",
            "X-Title": "IMACX Quote Embeddings",
        },
        json={"model": EMBEDDING_MODEL, "input": truncated_texts},
        timeout=120.0,
    )

    if response.status_code != 200:
        raise Exception(
            f"OpenRouter API error: {response.status_code} - {response.text}"
        )

    data = response.json()

    # Sort by index to ensure correct order
    embeddings_data = sorted(data["data"], key=lambda x: x["index"])
    embeddings = [item["embedding"] for item in embeddings_data]

    return embeddings


def get_quotes_needing_embeddings(
    supabase: Client, limit: int = 1000
) -> List[Dict[str, Any]]:
    """
    Fetch quotes from temp_quotes_bi that don't have embeddings yet.

    Returns unique document_number + description combinations that aren't
    already in the quote_embeddings table.
    """
    # Get distinct document_number + description from temp_quotes_bi
    # that don't exist in quote_embeddings yet
    response = supabase.rpc(
        "get_quotes_needing_embeddings", {"limit_count": limit}
    ).execute()

    return response.data or []


def get_quotes_needing_embeddings_fallback(
    supabase: Client, limit: int = 1000
) -> List[Dict[str, Any]]:
    """
    Fallback method if the RPC doesn't exist yet.
    Gets all unique descriptions from temp_quotes_bi joined with temp_quotes_bo.

    Schema:
    - phc.temp_quotes_bo: document_id (PK), document_number
    - phc.temp_quotes_bi: document_id (FK), description
    """
    # First get ALL existing embeddings (paginate to avoid 1000 row limit)
    existing_set = set()
    page_size = 1000
    offset = 0

    while True:
        existing = (
            supabase.table("quote_embeddings")
            .select("document_number, description")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not existing.data:
            break
        for row in existing.data:
            existing_set.add((row["document_number"], row["description"]))
        if len(existing.data) < page_size:
            break
        offset += page_size

    # Paginate through BI lines to find ones without embeddings.
    # This avoids stopping early if the first chunk is already embedded.
    page_size = 1000
    offset = 0
    quotes_to_process: List[Dict[str, Any]] = []
    seen = set()

    while len(quotes_to_process) < limit:
        response = (
            supabase.schema("phc")
            .table("temp_quotes_bi")
            .select("document_id, description, temp_quotes_bo!inner(document_number)")
            .not_.is_("description", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        rows = response.data or []
        if not rows:
            break

        for row in rows:
            bo_data = row.get("temp_quotes_bo")
            if not bo_data:
                continue
            doc_num = (
                bo_data.get("document_number") if isinstance(bo_data, dict) else None
            )
            if not doc_num:
                continue

            description = row.get("description")
            if not description:
                continue

            key = (str(doc_num), description)
            if key not in existing_set and key not in seen:
                seen.add(key)
                quotes_to_process.append(
                    {"document_number": str(doc_num), "description": description}
                )
                if len(quotes_to_process) >= limit:
                    break

        if len(rows) < page_size:
            break
        offset += page_size

    return quotes_to_process


def insert_embedding(
    supabase: Client, document_number: str, description: str, embedding: List[float]
) -> bool:
    """Insert a new embedding into quote_embeddings table."""
    try:
        # Format embedding as PostgreSQL vector string
        embedding_str = f"[{','.join(map(str, embedding))}]"

        supabase.table("quote_embeddings").upsert(
            {
                "document_number": document_number,
                "description": description,
                "description_embedding": embedding_str,
            },
            on_conflict="document_number,description",
        ).execute()
        return True
    except Exception as e:
        print(f"  Error inserting embedding for {document_number}: {e}")
        return False


def generate_embeddings_batch(supabase: Client, quotes: List[Dict[str, Any]]) -> int:
    """
    Generate and store embeddings for a batch of quotes.

    Returns number of successfully inserted embeddings.
    """
    if not quotes:
        return 0

    # Prepare texts for embedding
    texts = [q["description"] or "" for q in quotes]

    # Get embeddings from OpenRouter
    try:
        embeddings = get_embeddings(texts)
    except Exception as e:
        print(f"  Error getting embeddings: {e}")
        return 0

    # Insert each embedding
    success_count = 0
    for quote, embedding in zip(quotes, embeddings):
        if insert_embedding(
            supabase, quote["document_number"], quote["description"], embedding
        ):
            success_count += 1

    return success_count


def main():
    """Main function to generate embeddings for all quotes."""
    print("=" * 60)
    print("QUOTE EMBEDDINGS GENERATOR")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Validate configuration
    if not OPENROUTER_API_KEY:
        print("\nERROR: OPENROUTER_API_KEY not set!")
        print("Please add it to your .env.local file")
        sys.exit(1)

    print(f"\nModel: {EMBEDDING_MODEL} (1536 dimensions)")
    print(f"Batch size: {BATCH_SIZE}")

    # Connect to Supabase
    print("\nConnecting to Supabase...")
    supabase = get_supabase_client()

    # Check if quote_embeddings table exists
    try:
        test = supabase.table("quote_embeddings").select("id").limit(1).execute()
        print("quote_embeddings table found")
    except Exception as e:
        print(f"\nERROR: quote_embeddings table not found!")
        print("Please run the migration first:")
        print("  npx supabase db push")
        print(f"\nDetails: {e}")
        sys.exit(1)

    # Get total counts for progress tracking
    existing_count = (
        supabase.table("quote_embeddings")
        .select("*", count="exact", head=True)
        .execute()
        .count
        or 0
    )
    total_quotes = (
        supabase.schema("phc")
        .from_("temp_quotes_bi")
        .select("*", count="exact", head=True)
        .execute()
        .count
        or 0
    )

    print(
        f"\nProgress: {existing_count:,} / {total_quotes:,} ({(existing_count / total_quotes * 100):.1f}%) already embedded"
    )
    remaining = total_quotes - existing_count
    est_mins = (remaining // BATCH_SIZE * 3) // 60
    print(f"Remaining: ~{remaining:,} quotes (~{est_mins} mins)")

    # Process in batches
    total_processed = 0
    total_success = 0
    batch_num = 0
    start_count = existing_count

    while True:
        batch_num += 1
        print(f"\n--- Batch {batch_num} ---")

        # Get next batch of quotes needing embeddings
        try:
            quotes = get_quotes_needing_embeddings(supabase, limit=BATCH_SIZE)
        except Exception:
            # RPC might not exist, use fallback
            print("  Using fallback method to find quotes...")
            quotes = get_quotes_needing_embeddings_fallback(supabase, limit=BATCH_SIZE)

        if not quotes:
            print("No more quotes to process")
            break

        print(f"Processing {len(quotes)} quotes...")

        # Generate embeddings
        success = generate_embeddings_batch(supabase, quotes)

        total_processed += len(quotes)
        total_success += success
        current_total = start_count + total_success
        pct = (current_total / total_quotes * 100) if total_quotes > 0 else 0

        print(
            f"Success: {success}/{len(quotes)} | Overall: {current_total:,}/{total_quotes:,} ({pct:.1f}%)"
        )

        # Rate limiting - be nice to OpenAI API
        if len(quotes) == BATCH_SIZE:
            print("Waiting 1s before next batch...")
            time.sleep(1)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total processed: {total_processed}")
    print(f"Successfully embedded: {total_success}")
    print(f"Failed: {total_processed - total_success}")
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if total_success == total_processed:
        print("\n__ETL_DONE__ success=true")
    else:
        print("\n__ETL_DONE__ success=false")


if __name__ == "__main__":
    main()
