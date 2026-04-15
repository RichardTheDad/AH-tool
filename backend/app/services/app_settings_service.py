from __future__ import annotations

from app.db.models import AppSettings


FIXED_AH_CUT_PERCENT = 0.05


def enforce_fixed_ah_cut(settings: AppSettings) -> bool:
    """Ensure AH cut percent is always locked to 5%. Returns True if changed."""
    current = float(settings.ah_cut_percent or 0)
    if abs(current - FIXED_AH_CUT_PERCENT) < 1e-9:
        return False
    settings.ah_cut_percent = FIXED_AH_CUT_PERCENT
    return True
