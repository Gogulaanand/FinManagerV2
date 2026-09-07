"""Compare restored public-table COPY data with the actual dump, without logging records.

Use psql COPY output for the same columns and sort lines to compare unordered rows.
The dump is the reference, so concurrent production writes after pg_dump do not
produce misleading mismatches. Raw records stay in process memory or temp files.
"""
import argparse
import os
import re
import subprocess
from collections import Counter
from pathlib import Path

COPY = re.compile(r'^COPY ("?public"?\."?[a-z_][a-z_0-9]*"?) \(([^;]+)\) FROM stdin;$')


def dump_tables(text):
    tables = []
    current = None
    for line in text.splitlines():
        if current is not None:
            if line == r'\.':
                tables.append(current)
                current = None
            else:
                current[2].append(line)
            continue
        match = COPY.fullmatch(line)
        if match:
            columns = match[2].split(', ')
            if not all(re.fullmatch(r'"?[a-z_][a-z_0-9]*"?', col) for col in columns):
                raise ValueError('Unsupported COPY column identifier')
            current = (match[1], columns, [])
    if current is not None:
        raise ValueError('Truncated COPY data')
    if not tables:
        raise ValueError('No public table COPY data found')
    return tables


def compare_rows(expected, actual):
    # COPY escaping retains embedded tabs/newlines, nulls, dates, and exact values.
    # An unordered multiset detects changed records even when totals still match.
    return Counter(expected) == Counter(actual)


def verify(dump_path):
    url = os.environ.get('DISPOSABLE_SUPABASE_DB_URL')
    if not url:
        raise ValueError('DISPOSABLE_SUPABASE_DB_URL is required')
    tables = dump_tables(Path(dump_path).read_text())
    compared = 0
    for table, columns, expected in tables:
        query = f"COPY (SELECT {', '.join(columns)} FROM {table}) TO STDOUT;"
        result = subprocess.run(['psql', '--no-psqlrc', '--quiet', '--set=ON_ERROR_STOP=1', '--command', query],
                                env={**os.environ, 'PGDATABASE': url, 'PGOPTIONS': '-c timezone=UTC -c DateStyle=ISO'},
                                capture_output=True, text=True)
        if result.returncode:
            raise ValueError(f'Restored table could not be read: {table}')
        actual = result.stdout.splitlines()
        if not compare_rows(expected, actual):
            raise ValueError(f'Restored records differ from backup: {table}')
        compared += len(expected)
    print(f'Exact record comparison passed for {len(tables)} public tables and {compared} rows. All backed-up field values, including financial inputs and relationship IDs, match.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('dump_path')
    args = parser.parse_args()
    verify(args.dump_path)
