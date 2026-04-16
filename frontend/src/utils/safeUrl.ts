const ALLOWED_UNDERMINE_HOSTS = new Set(["undermine.exchange", "www.undermine.exchange"]);

function parseHttpsUrl(value: string | null | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isAllowedUndermineHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_UNDERMINE_HOSTS.has(host) || host.endsWith(".undermine.exchange");
}

function isAllowedIconHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".blizzard.com") ||
    host.endsWith(".battle.net") ||
    host.endsWith(".worldofwarcraft.com") ||
    host.endsWith(".wowhead.com") ||
    host === "wow.zamimg.com" ||
    host.endsWith(".wow.zamimg.com")
  );
}

export function getSafeUndermineUrl(value: string | null | undefined): string | null {
  const parsed = parseHttpsUrl(value);
  if (!parsed) {
    return null;
  }
  return isAllowedUndermineHost(parsed.hostname) ? parsed.toString() : null;
}

export function getSafeItemIconUrl(value: string | null | undefined): string | null {
  const parsed = parseHttpsUrl(value);
  if (!parsed) {
    return null;
  }
  return isAllowedIconHost(parsed.hostname) ? parsed.toString() : null;
}
