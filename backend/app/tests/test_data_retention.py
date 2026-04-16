from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import clear_settings_cache
from app.db.init_db import initialize_app_data
from app.db.models import AppSettings, Item, ListingSnapshot, ScanPreset, ScanResult, ScanSession, TrackedRealm
from app.db.session import clear_db_caches, get_session_factory


def test_initialize_app_data_prunes_scan_data_older_than_1_year(tmp_path, monkeypatch) -> None:
    db_path = tmp_path / "retention.db"
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")

    clear_settings_cache()
    clear_db_caches()

    from app.db.init_db import create_db_and_tables

    create_db_and_tables()
    session = get_session_factory()()
    try:
        now = datetime.now(timezone.utc)
        old_time = now - timedelta(days=366)

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


def test_initialize_app_data_preserves_user_tables_while_pruning_scan_data(tmp_path, monkeypatch) -> None:
    db_path = tmp_path / "retention-user-data.db"
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")

    clear_settings_cache()
    clear_db_caches()

    from app.db.init_db import create_db_and_tables

    create_db_and_tables()
    session = get_session_factory()()
    try:
        now = datetime.now(timezone.utc)
        old_time = now - timedelta(days=366)

        session.add_all(
            [
                AppSettings(id=1, user_id="test-user"),
                TrackedRealm(user_id="test-user", realm_name="Stormrage", enabled=True),
                ScanPreset(user_id="test-user", name="Keep Me", is_default=True),
                Item(item_id=777, name="Old Scan Item", is_commodity=False),
            ]
        )
        old_scan = ScanSession(user_id="test-user", provider_name="blizzard_auctions", generated_at=old_time)
        session.add(old_scan)
        session.flush()
        session.add_all(
            [
                ScanResult(
                    scan_session_id=old_scan.id,
                    item_id=777,
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
                    item_id=777,
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

        assert session.query(ScanSession).count() == 0
        assert session.query(ListingSnapshot).count() == 0
        assert session.query(TrackedRealm).count() == 1
        assert session.query(ScanPreset).count() == 1
        assert session.query(AppSettings).count() == 1
    finally:
        session.close()
        clear_settings_cache()
        clear_db_caches()
