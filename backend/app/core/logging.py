from __future__ import annotations

import logging
from typing import Optional

from app.core.config import get_settings


def is_search_crawler(user_agent: Optional[str]) -> bool:
    """
    Detect known search engine and bot crawlers.
    Used for logging and monitoring crawl patterns.
    """
    if not user_agent:
        return False
    
    ua_lower = user_agent.lower()
    
    # Search engine crawlers
    search_crawlers = [
        "googlebot",
        "bingbot",
        "slurp",
        "duckduckbot",
        "baiduspider",
        "yandexbot",
        "applebot",
    ]
    
    # LLM/AI crawlers
    llm_crawlers = [
        "chatgpt",
        "gpt-4",
        "claude",
        "llama",
        "perplexity",
        "anthropic",
    ]
    
    return any(
        crawler in ua_lower 
        for crawler in search_crawlers + llm_crawlers
    )


def configure_logging() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


