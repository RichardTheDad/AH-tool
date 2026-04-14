from __future__ import annotations


def _normalize_realm_slug(realm_name: str) -> str:
    return (
        realm_name.strip()
        .lower()
        .replace("'", "")
        .replace(" ", "-")
    )


def build_undermine_item_url(item_id: int, realm_name: str | None, *, region: str = "us") -> str | None:
    if item_id <= 0 or not realm_name:
        return None
    realm_slug = _normalize_realm_slug(realm_name)
    if not realm_slug:
        return None
    return f"https://undermine.exchange/#{region.lower()}-{realm_slug}/{item_id}"
