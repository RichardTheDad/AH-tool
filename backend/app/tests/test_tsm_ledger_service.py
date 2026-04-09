from __future__ import annotations

from pathlib import Path

from app.core.config import clear_settings_cache, get_settings
from app.services.tsm_ledger_service import TsmLedgerService


def test_tsm_ledger_item_history_is_loaded(tmp_path: Path, monkeypatch) -> None:
    saved = tmp_path / "TradeSkillMaster.lua"
    saved.write_text(
        '\n'.join(
            [
                '["r@Stormrage@internalData@csvSales"] = "itemString,stackSize,quantity,price,otherPlayer,player,time,source\\ni:873,1,2,150000,Buyerone,Divineares,1775405509,Auction\\ni:873,1,1,125000,Buyertwo,Divineares,1775405510,Auction"',
                '["r@Stormrage@internalData@csvBuys"] = "itemString,stackSize,quantity,price,otherPlayer,player,time,source\\ni:873,1,1,95000,Sellerone,Divineares,1775300000,Auction"',
                '["r@Stormrage@internalData@csvCancelled"] = "itemString,stackSize,quantity,player,time\\ni:873,1,1,Divineares,1775200000"',
                '["r@Stormrage@internalData@csvExpired"] = "itemString,stackSize,quantity,player,time\\ni:873,1,1,Divineares,1775100000"',
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("AZEROTHFLIPLOCAL_TSM_SAVEDVARIABLES_PATH", str(saved))
    clear_settings_cache()

    service = TsmLedgerService(get_settings())
    available, _message = service.is_available()
    assert available

    ledger, message = service.fetch_item_ledger(873, ["Stormrage"])
    assert ledger is not None
    assert message == "Local TSM ledger history loaded."
    assert ledger["auction_sale_count"] == 2
    assert ledger["auction_units_sold"] == 3
    assert ledger["auction_avg_unit_sale_price"] == 137500.0
    assert ledger["auction_buy_count"] == 1
    assert ledger["auction_avg_unit_buy_price"] == 95000.0
    assert ledger["cancel_count"] == 1
    assert ledger["expired_count"] == 1
    recent_sales = ledger["recent_sales"]
    assert isinstance(recent_sales, list)
    assert recent_sales[0]["realm"] == "Stormrage"
    assert recent_sales[0]["price"] == 125000.0

    clear_settings_cache()
