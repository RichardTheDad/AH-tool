from __future__ import annotations

from pathlib import Path

from app.core.config import clear_settings_cache, get_settings
from app.services.tsm_service import TsmMarketService


def test_local_apphelper_region_and_realm_stats_are_loaded(tmp_path: Path, monkeypatch) -> None:
    appdata = tmp_path / "AppData.lua"
    appdata.write_text(
        '\n'.join(
            [
                'select(2, ...).LoadData("AUCTIONDB_REGION_STAT","US",[[return {downloadTime=1775722589,fields={"itemString","regionMarketValue"},data={{873,2N9C}}}]])',
                'select(2, ...).LoadData("AUCTIONDB_REGION_HISTORICAL","US",[[return {downloadTime=1775724011,fields={"itemString","regionHistorical"},data={{873,2J0G}}}]])',
                'select(2, ...).LoadData("AUCTIONDB_REGION_SALE","US",[[return {downloadTime=1775559300,fields={"itemString","regionSale","regionSoldPerDay","regionSalePercent"},data={{873,2M7S,1I,1E}}}]])',
                'select(2, ...).LoadData("AUCTIONDB_NON_COMMODITY_DATA","Stormrage",[[return {downloadTime=1775726997,fields={"itemString","minBuyout","numAuctions","marketValueRecent"},data={{873,2L7G,5,2N9C}}}]])',
                'select(2, ...).LoadData("AUCTIONDB_NON_COMMODITY_HISTORICAL","Stormrage",[[return {downloadTime=1775722829,fields={"itemString","historical"},data={{873,2J0G}}}]])',
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("AZEROTHFLIPLOCAL_TSM_API_KEY", "")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_TSM_APPHELPER_PATH", str(appdata))
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_API_REGION", "us")
    clear_settings_cache()

    service = TsmMarketService(get_settings())
    available, _message = service.is_available()
    assert available

    region_stats, _region_message = service.fetch_region_item_stats(873)
    assert region_stats is not None
    assert region_stats["db_region_market_avg"] == 89388
    assert region_stats["db_region_historical"] == 85008
    assert region_stats["db_region_sale_avg"] == 88316
    assert region_stats["db_region_sold_per_day"] == 0.05
    assert region_stats["db_region_sale_rate"] == 0.046

    realm_stats, _realm_message = service.fetch_realm_item_stats(873, "Stormrage")
    assert realm_stats is not None
    assert realm_stats["min_buyout"] == 87280
    assert realm_stats["market_value_recent"] == 89388
    assert realm_stats["historical"] == 85008
    assert realm_stats["num_auctions"] == 5

    clear_settings_cache()
