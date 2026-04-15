import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else "backend/azerothfliplocal.db"
conn = sqlite3.connect(db_path)
total = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
with_meta = conn.execute(
    "SELECT COUNT(*) FROM items WHERE metadata_json IS NOT NULL AND name NOT LIKE '%(metadata unavailable)'"
).fetchone()[0]
print(f"Total items: {total:,}")
print(f"With real metadata: {with_meta:,}")
conn.close()
