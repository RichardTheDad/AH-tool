from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TrackedRealm(Base):
    __tablename__ = "tracked_realms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    realm_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    region: Mapped[str] = mapped_column(String(16), default="us")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Item(Base):
    __tablename__ = "items"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    class_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subclass_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    quality: Mapped[str | None] = mapped_column(String(64), nullable=True)
    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metadata_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_commodity: Mapped[bool] = mapped_column(Boolean, default=False)


class ListingSnapshot(Base):
    __tablename__ = "listing_snapshots"
    __table_args__ = (
        Index("ix_listing_snapshots_item_realm_captured", "item_id", "realm", "captured_at"),
        Index("ix_listing_snapshots_realm_item_captured", "realm", "item_id", "captured_at"),
        Index("ix_listing_snapshots_source_realm_captured", "source_name", "realm", "captured_at"),
        Index("ux_listing_snapshots_exact", "item_id", "realm", "source_name", "captured_at", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.item_id"), index=True)
    realm: Mapped[str] = mapped_column(String(120), index=True)
    lowest_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    average_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    listing_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_name: Mapped[str] = mapped_column(String(64))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, default=utcnow)
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False)

    item: Mapped[Item] = relationship()


class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider_name: Mapped[str] = mapped_column(String(64), default="stored")
    warning_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, default=utcnow)

    results: Mapped[list["ScanResult"]] = relationship(
        back_populates="scan_session",
        cascade="all, delete-orphan",
        order_by=lambda: ScanResult.final_score.desc(),
    )


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_session_id: Mapped[int] = mapped_column(ForeignKey("scan_sessions.id"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.item_id"), index=True)
    cheapest_buy_realm: Mapped[str] = mapped_column(String(120))
    cheapest_buy_price: Mapped[float] = mapped_column(Float)
    best_sell_realm: Mapped[str] = mapped_column(String(120))
    best_sell_price: Mapped[float] = mapped_column(Float)
    estimated_profit: Mapped[float] = mapped_column(Float)
    roi: Mapped[float] = mapped_column(Float)
    confidence_score: Mapped[float] = mapped_column(Float)
    sellability_score: Mapped[float] = mapped_column(Float, default=0)
    liquidity_score: Mapped[float] = mapped_column(Float)
    volatility_score: Mapped[float] = mapped_column(Float)
    bait_risk_score: Mapped[float] = mapped_column(Float)
    final_score: Mapped[float] = mapped_column(Float)
    turnover_label: Mapped[str] = mapped_column(String(24), default="slow")
    explanation: Mapped[str] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    has_stale_data: Mapped[bool] = mapped_column(Boolean, default=False)
    is_risky: Mapped[bool] = mapped_column(Boolean, default=False)

    scan_session: Mapped[ScanSession] = relationship(back_populates="results")
    item: Mapped[Item] = relationship()


class ScanPreset(Base):
    __tablename__ = "scan_presets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    min_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_roi: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_buy_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    allow_stale: Mapped[bool] = mapped_column(Boolean, default=False)
    hide_risky: Mapped[bool] = mapped_column(Boolean, default=True)
    category_filter: Mapped[str | None] = mapped_column(String(120), nullable=True)


class RealmSuggestionRun(Base):
    __tablename__ = "realm_suggestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, default=utcnow)
    target_set_key: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    target_realms_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    source_realms_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    batch_start: Mapped[int] = mapped_column(Integer, default=0)
    batch_size: Mapped[int] = mapped_column(Integer, default=0)
    source_realm_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    recommendations: Mapped[list["RealmSuggestionRecommendation"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by=lambda: RealmSuggestionRecommendation.consistency_score.desc(),
    )


class RealmSuggestionRecommendation(Base):
    __tablename__ = "realm_suggestion_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("realm_suggestion_runs.id"), index=True)
    realm: Mapped[str] = mapped_column(String(120), index=True)
    opportunity_count: Mapped[int] = mapped_column(Integer, default=0)
    cheapest_source_count: Mapped[int] = mapped_column(Integer, default=0)
    average_profit: Mapped[float] = mapped_column(Float, default=0)
    average_roi: Mapped[float] = mapped_column(Float, default=0)
    average_confidence: Mapped[float] = mapped_column(Float, default=0)
    average_sellability: Mapped[float] = mapped_column(Float, default=0)
    consistency_score: Mapped[float] = mapped_column(Float, default=0)
    median_buy_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    best_target_realm: Mapped[str | None] = mapped_column(String(120), nullable=True)
    latest_captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    explanation: Mapped[str] = mapped_column(Text, default="")
    top_items_json: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)

    run: Mapped[RealmSuggestionRun] = relationship(back_populates="recommendations")


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    ah_cut_percent: Mapped[float] = mapped_column(Float, default=0.05)
    flat_buffer: Mapped[float] = mapped_column(Float, default=0)
    refresh_interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    stale_after_minutes: Mapped[int] = mapped_column(Integer, default=120)
    scoring_preset: Mapped[str] = mapped_column(String(32), default="balanced")
    non_commodity_only: Mapped[bool] = mapped_column(Boolean, default=True)
