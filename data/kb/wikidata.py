"""Wikidata SPARQL client with a database cache and polite retries (07 §4.2 etiquette)."""

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable

import psycopg
from psycopg.types.json import Jsonb

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = (
    "the-game-football-kb/0.1 (https://github.com/the-game22027/the-game; offline quiz content pipeline)"
)
ENTITY_PREFIX = "http://www.wikidata.org/entity/"
RETRY_STATUSES = {429, 500, 502, 503, 504}

Row = dict[str, str]


def qid_from_uri(uri: str) -> str:
    return uri.removeprefix(ENTITY_PREFIX)


def external_ref_from_qid(qid: str) -> str:
    return f"wikidata:{qid}"


def values_block(variable: str, qids: list[str]) -> str:
    return f"VALUES ?{variable} {{ {' '.join('wd:' + qid for qid in qids)} }}"


class WikidataClient:
    def __init__(
        self,
        connection: psycopg.Connection,
        refresh: bool = False,
        max_attempts: int = 6,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._connection = connection
        self._refresh = refresh
        self._max_attempts = max_attempts
        self._sleep = sleep

    def select_rows(self, query: str) -> list[Row]:
        """Run a SELECT and return each binding as {variable: plain value}. Cached by query text."""
        query_hash = hashlib.sha256(query.encode("utf-8")).hexdigest()
        if not self._refresh:
            cached = self._connection.execute(
                "SELECT response FROM raw.sparql_cache WHERE query_hash = %s", (query_hash,)
            ).fetchone()
            if cached:
                return _rows_from_response(cached[0])
        response = self._fetch_with_retries(query)
        self._connection.execute(
            """INSERT INTO raw.sparql_cache (query_hash, query_text, response) VALUES (%s, %s, %s)
               ON CONFLICT (query_hash) DO UPDATE SET response = EXCLUDED.response, fetched_at = now()""",
            (query_hash, query, Jsonb(response)),
        )
        self._connection.commit()
        return _rows_from_response(response)

    def _fetch_with_retries(self, query: str) -> dict:
        body = urllib.parse.urlencode({"query": query}).encode("utf-8")
        request = urllib.request.Request(
            ENDPOINT,
            data=body,
            headers={
                "Accept": "application/sparql-results+json",
                "User-Agent": USER_AGENT,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        for attempt in range(1, self._max_attempts + 1):
            try:
                with urllib.request.urlopen(request, timeout=90) as reply:
                    return json.loads(reply.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code not in RETRY_STATUSES or attempt == self._max_attempts:
                    raise
                retry_after = error.headers.get("Retry-After")
                self._sleep(float(retry_after) if retry_after and retry_after.isdigit() else 2**attempt)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
                # A query-service timeout returns a truncated or HTML body.
                if attempt == self._max_attempts:
                    raise
                self._sleep(2**attempt)
        raise RuntimeError("unreachable")


def _rows_from_response(response: dict) -> list[Row]:
    """Flatten bindings to {variable: value}; a language-tagged literal also gives {variable@lang: tag}."""
    rows = []
    for result in response["results"]["bindings"]:
        row = {}
        for variable, binding in result.items():
            row[variable] = binding["value"]
            if "xml:lang" in binding:
                row[f"{variable}@lang"] = binding["xml:lang"]
        rows.append(row)
    return rows
