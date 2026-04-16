#!/usr/bin/env python3
"""Test manual refresh cycle with all batching fixes deployed."""
import sys
from app.jobs.refresh_jobs import run_refresh_cycle

print("=" * 70, flush=True)
print("Starting manual refresh cycle with batching fixes...", flush=True)
print("=" * 70, flush=True)

try:
    run_refresh_cycle()
    print("=" * 70, flush=True)
    print("✓ SUCCESS: Refresh cycle completed without timeout!", flush=True)
    print("=" * 70, flush=True)
    sys.exit(0)
except Exception as e:
    print("=" * 70, flush=True)
    print(f"✗ ERROR: {type(e).__name__}: {e}", flush=True)
    print("=" * 70, flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
