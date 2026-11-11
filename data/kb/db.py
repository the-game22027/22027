"""Connection and plain-SQL migrations for football_kb."""

import os
from pathlib import Path

import psycopg

DEFAULT_URL = "postgresql://game:game@localhost:5440/football_kb"
MIGRATIONS_DIR = Path(__file__).parent.parent / "kb_migrations"


def connect_to_knowledge_base(url: str | None = None) -> psycopg.Connection:
    return psycopg.connect(url or os.environ.get("FOOTBALL_KB_URL", DEFAULT_URL))


def apply_pending_migrations(connection: psycopg.Connection) -> list[str]:
    """Apply every migration file not applied yet, in file name order. Returns the applied names."""
    with connection.transaction():
        connection.execute(
            "CREATE TABLE IF NOT EXISTS public.kb_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())"
        )
        # Two runs at once would apply the same file twice.
        connection.execute("SELECT pg_advisory_xact_lock(hashtext('kb:migrate'))")
        applied = {row[0] for row in connection.execute("SELECT name FROM public.kb_migrations")}
        newly_applied = []
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in applied:
                continue
            connection.execute(path.read_text(encoding="utf-8"))
            connection.execute("INSERT INTO public.kb_migrations (name) VALUES (%s)", (path.name,))
            newly_applied.append(path.name)
    return newly_applied
