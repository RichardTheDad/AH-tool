"""Run pending ALTER TABLE migrations on production Postgres."""
import os
import psycopg2

DATABASE_URL = os.environ["AZEROTHFLIPLOCAL_DATABASE_URL"]
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

# Check existing columns
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='scan_presets'")
existing = {r[0] for r in cur.fetchall()}
print("Existing scan_presets columns:", sorted(existing))

if "buy_realms" not in existing:
    cur.execute("ALTER TABLE scan_presets ADD COLUMN buy_realms JSON")
    print("Added buy_realms")

if "sell_realms" not in existing:
    cur.execute("ALTER TABLE scan_presets ADD COLUMN sell_realms JSON")
    print("Added sell_realms")

if "is_default" not in existing:
    cur.execute("ALTER TABLE scan_presets ADD COLUMN is_default BOOLEAN DEFAULT FALSE")
    cur.execute("""
        UPDATE scan_presets
        SET is_default = TRUE
        WHERE id IN (
            SELECT MIN(id)
            FROM scan_presets
            GROUP BY user_id
        )
    """)
    print("Added is_default and backfilled")

cur.close()
conn.close()
print("Done.")
