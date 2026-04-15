"""Check current Supabase schema state."""
import sys
import psycopg2

target = sys.argv[1] if len(sys.argv) > 1 else None
if not target:
    sys.exit("Pass the PostgreSQL URL as argument.")

conn = psycopg2.connect(target)
cur = conn.cursor()

# Check alembic version
try:
    cur.execute("SELECT version_num FROM alembic_version")
    rows = cur.fetchall()
    print(f"Alembic version: {rows}")
except Exception as e:
    print(f"No alembic_version table: {e}")
    conn.rollback()

# List tables
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
""")
print("\nTables:", [r[0] for r in cur.fetchall()])

# Check tuning_action_audit columns
try:
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tuning_action_audit'
        ORDER BY ordinal_position
    """)
    print("\ntuning_action_audit columns:", [r[0] for r in cur.fetchall()])
except Exception as e:
    print(f"Error checking tuning_action_audit: {e}")

cur.close()
conn.close()
