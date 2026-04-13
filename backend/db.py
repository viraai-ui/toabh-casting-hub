import os
import re
import sqlite3
from dataclasses import dataclass
from typing import Any, Iterable, Optional

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class DatabaseConfig:
    backend: str
    sqlite_path: str
    database_url: str = ''

    @property
    def is_postgres(self) -> bool:
        return self.backend == 'postgres'


def get_database_config(sqlite_path: str) -> DatabaseConfig:
    database_url = os.environ.get('DATABASE_URL', '').strip()
    if database_url:
        return DatabaseConfig(backend='postgres', sqlite_path=sqlite_path, database_url=database_url)
    return DatabaseConfig(backend='sqlite', sqlite_path=sqlite_path)


class DatabaseError(Exception):
    pass


class IntegrityError(DatabaseError):
    pass


class HybridRow(dict):
    def __init__(self, data: dict[str, Any]):
        super().__init__(data)
        self._keys = list(data.keys())

    def __getitem__(self, key):
        if isinstance(key, int):
            return super().__getitem__(self._keys[key])
        return super().__getitem__(key)


class PostgresCursor:
    def __init__(self, conn, cur, sql: str):
        self._conn = conn
        self._cur = cur
        self._sql = sql
        self.lastrowid = self._resolve_lastrowid()

    def _resolve_lastrowid(self):
        normalized = self._sql.strip().lower()
        if not normalized.startswith('insert into '):
            return None
        match = re.search(r'insert\s+into\s+([a-zA-Z_][\w.]*)', normalized, re.IGNORECASE)
        if not match:
            return None
        table = match.group(1).split('.')[-1]
        try:
            with self._conn.cursor() as seq_cur:
                seq_cur.execute(
                    '''
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = %s
                      AND column_name = %s
                    ''',
                    (table, 'id'),
                )
                if seq_cur.fetchone() is None:
                    return None
                seq_cur.execute('SELECT pg_get_serial_sequence(%s, %s) AS seq', (table, 'id'))
                row = seq_cur.fetchone()
                sequence_name = row['seq'] if row else None
                if not sequence_name:
                    return None
                seq_cur.execute('SELECT currval(%s::regclass) AS id', (sequence_name,))
                row = seq_cur.fetchone()
                return row['id'] if row else None
        except Exception:
            return None

    def fetchone(self):
        row = self._cur.fetchone()
        return HybridRow(row) if row is not None else None

    def fetchall(self):
        return [HybridRow(row) for row in self._cur.fetchall()]

    def __getattr__(self, name):
        return getattr(self._cur, name)


class PostgresConnection:
    def __init__(self, database_url: str):
        self._conn = psycopg.connect(database_url, row_factory=dict_row)
        self._conn.autocommit = False

    def execute(self, sql: str, params: Optional[Iterable[Any]] = None):
        cur = self._conn.cursor()
        try:
            cur.execute(translate_sql(sql), normalize_params(params))
            return PostgresCursor(self._conn, cur, translate_sql(sql))
        except psycopg.IntegrityError as exc:
            cur.close()
            raise IntegrityError(str(exc)) from exc

    def executemany(self, sql: str, seq_of_params: Iterable[Iterable[Any]]):
        cur = self._conn.cursor()
        try:
            cur.executemany(translate_sql(sql), [normalize_params(p) for p in seq_of_params])
            return PostgresCursor(self._conn, cur, translate_sql(sql))
        except psycopg.IntegrityError as exc:
            cur.close()
            raise IntegrityError(str(exc)) from exc

    def executescript(self, script: str):
        for statement in split_sql_script(script):
            self.execute(statement)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def connect(config: DatabaseConfig):
    if config.is_postgres:
        return PostgresConnection(config.database_url)
    conn = sqlite3.connect(config.sqlite_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def normalize_params(params: Optional[Iterable[Any]]):
    if params is None:
        return None
    if isinstance(params, tuple):
        return params
    if isinstance(params, list):
        return tuple(params)
    return params


def split_sql_script(script: str):
    return [part.strip() for part in script.split(';') if part.strip()]


def translate_sql(sql: str) -> str:
    translated = sql
    translated = translated.replace('INSERT OR IGNORE INTO', 'INSERT INTO')
    translated = translated.replace("datetime('now')", 'CURRENT_TIMESTAMP')
    translated = translated.replace('datetime("now")', 'CURRENT_TIMESTAMP')
    translated = translated.replace("date('now')", 'CURRENT_DATE')
    translated = translated.replace('COLLATE NOCASE', '')
    translated = _replace_group_concat(translated)
    translated = _replace_placeholders(translated)
    if 'INSERT INTO' in translated and 'ON CONFLICT' not in translated and 'INSERT OR IGNORE INTO' in sql:
        translated += ' ON CONFLICT DO NOTHING'
    return translated


_GROUP_CONCAT_RE = re.compile(r'GROUP_CONCAT\(([^)]+)\)', re.IGNORECASE)


def _replace_group_concat(sql: str) -> str:
    def repl(match: re.Match[str]) -> str:
        expr = match.group(1).strip()
        return f"STRING_AGG(({expr})::text, ',')"

    return _GROUP_CONCAT_RE.sub(repl, sql)


def _replace_placeholders(sql: str) -> str:
    result = []
    in_single = False
    in_double = False
    for char in sql:
        if char == "'" and not in_double:
            in_single = not in_single
            result.append(char)
            continue
        if char == '"' and not in_single:
            in_double = not in_double
            result.append(char)
            continue
        if char == '?' and not in_single and not in_double:
            result.append('%s')
        else:
            result.append(char)
    return ''.join(result)
