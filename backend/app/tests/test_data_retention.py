from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import clear_settings_cache
from app.db.init_db import initialize_app_data
from app.db.models import AppSettings, Item, ListingSnapshot, ScanResult, ScanSession
from app.db.session import clear_db_caches, get_session_factory


def test_initialize_app_data_prunes_runtime_data_older_than_30_days(tmp_path, monkeypatch) -> None:
    db_path = tmp_path / "retention.db"
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")

    clear_settings_cache()
    clear_db_caches()

    from app.db.init_db import create_db_and_tables

    create_db_and_tables()
    session = get_session_factory()()
    try:
        now = datetime.now(timezone.utc)
        old_time = now - timedelta(days=31)

        session.add(AppSettings(id=1, user_id="test-user"))
        session.add_all(
            [
                Item(item_id=1, name="Fresh Item", is_commodity=False),
                Item(item_id=2, name="Old Item", is_commodity=False),
            ]
        )
        fresh_scan = ScanSession(user_id="test-user", provider_name="blizzard_auctions", generated_at=now)
        old_scan = ScanSession(user_id="test-user", provider_name="blizzard_auctions", generated_at=old_time)
        session.add_all([fresh_scan, old_scan])
        session.flush()
        session.add_all(
            [
                ScanResult(
                    scan_session_id=fresh_scan.id,
                    item_id=1,
                    cheapest_buy_realm="Stormrage",
                    cheapest_buy_price=100,
                    best_sell_realm="Zul'jin",
                    best_sell_price=200,
                    estimated_profit=90,
                    roi=0.9,
                    confidence_score=80,
                    liquidity_score=80,
                    volatility_score=80,
                    bait_risk_score=10,
                    final_score=80,
                    explanation="fresh",
                ),
                ScanResult(
                    scan_session_id=old_scan.id,
                    item_id=2,
                    cheapest_buy_realm="Stormrage",
                    cheapest_buy_price=100,
                    best_sell_realm="Zul'jin",
                    best_sell_price=200,
                    estimated_profit=90,
                    roi=0.9,
                    confidence_score=80,
                    liquidity_score=80,
                    volatility_score=80,
                    bait_risk_score=10,
                    final_score=80,
                    explanation="old",
                ),
                ListingSnapshot(
                    item_id=1,
                    realm="Stormrage",
                    lowest_price=100,
                    average_price=110,
                    quantity=5,
                    listing_count=4,
                    source_name="blizzard_auctions",
                    captured_at=now,
                    is_stale=False,
                ),
                ListingSnapshot(
                    item_id=2,
                    realm="Stormrage",
                    lowest_price=100,
                    average_price=110,
                    quantity=5,
                    listing_count=4,
                    source_name="blizzard_auctions",
                    captured_at=old_time,
                    is_stale=False,
                ),
            ]
        )
        session.commit()

        initialize_app_data(session)

        remaining_snapshot_item_ids = {snapshot.item_id for snapshot in session.query(ListingSnapshot).all()}
        remaining_scan_ids = {scan.id for scan in session.query(ScanSession).all()}
        remaining_item_ids = {item.item_id for item in session.query(Item).all()}

        assert remaining_snapshot_item_ids == {1}
        assert remaining_scan_ids == {fresh_scan.id}
        assert remaining_item_ids == {1}
    finally:
        session.close()
        clear_settings_cache()
        clear_db_caches()
