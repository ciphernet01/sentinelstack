from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from threading import RLock

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    import faiss  # type: ignore

    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False


class IncidentStore:
    """Persists incidents and supports similarity search using FAISS or cosine fallback."""

    def __init__(self, db_path: str = "incident_store.db"):
        self.db_path = Path(db_path)
        self._lock = RLock()
        self._vectorizer = TfidfVectorizer(max_features=1024, ngram_range=(1, 2))
        self._incident_cache: list[dict] = []
        self._embeddings: np.ndarray | None = None
        self._faiss_index = None

        self._init_db()
        self._reload_cache()

    def add_incident(self, payload: dict) -> int:
        text = self._incident_text(payload)
        with self._lock:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO incidents (created_at, root_cause, payload_json, embedding_text)
                    VALUES (datetime('now'), ?, ?, ?)
                    """,
                    (payload.get("root_cause", ""), json.dumps(payload), text),
                )
                incident_id = int(cur.lastrowid)
                conn.commit()

            self._reload_cache()
            return incident_id

    def find_similar_incidents(self, current_incident: dict, top_k: int = 5) -> list[dict]:
        with self._lock:
            if not self._incident_cache:
                return []

            query_text = self._incident_text(current_incident)
            corpus = [item["embedding_text"] for item in self._incident_cache]
            docs = corpus + [query_text]
            matrix = self._vectorizer.fit_transform(docs).toarray().astype("float32")

            base_matrix = matrix[:-1]
            query_vec = matrix[-1].reshape(1, -1)

            if base_matrix.size == 0:
                return []

            if FAISS_AVAILABLE:
                faiss.normalize_L2(base_matrix)
                faiss.normalize_L2(query_vec)
                index = faiss.IndexFlatIP(base_matrix.shape[1])
                index.add(base_matrix)
                scores, indexes = index.search(query_vec, min(top_k, len(base_matrix)))
                selected = []
                for score, idx in zip(scores[0], indexes[0]):
                    if idx < 0:
                        continue
                    incident = dict(self._incident_cache[int(idx)])
                    incident["similarity_score"] = float(round(score * 100, 2))
                    selected.append(incident)
                return selected

            sims = cosine_similarity(query_vec, base_matrix)[0]
            ranked = np.argsort(sims)[::-1][:top_k]
            selected = []
            for idx in ranked:
                incident = dict(self._incident_cache[int(idx)])
                incident["similarity_score"] = float(round(float(sims[idx]) * 100, 2))
                selected.append(incident)
            return selected

    def total_incidents(self) -> int:
        return len(self._incident_cache)

    def _reload_cache(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT id, created_at, root_cause, payload_json, embedding_text
                FROM incidents
                ORDER BY id DESC
                LIMIT 2000
                """
            ).fetchall()

        self._incident_cache = []
        for row in rows:
            payload = json.loads(row["payload_json"])
            payload.update({
                "id": row["id"],
                "created_at": row["created_at"],
                "embedding_text": row["embedding_text"],
            })
            self._incident_cache.append(payload)

    def _init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    root_cause TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    embedding_text TEXT NOT NULL
                )
                """
            )
            conn.commit()

    @staticmethod
    def _incident_text(payload: dict) -> str:
        timeline = payload.get("timeline", [])
        timeline_text = []
        for item in timeline[:30]:
            if isinstance(item, dict):
                timeline_text.append(str(item.get("message", "")))
            else:
                timeline_text.append(str(item))

        return " ".join(
            [
                str(payload.get("root_cause", "")),
                str(payload.get("suggested_fix", "")),
                " ".join(payload.get("affected_services", [])),
                " ".join(timeline_text),
            ]
        ).strip()
