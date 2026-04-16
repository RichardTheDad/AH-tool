import { useEffect } from "react";

export interface DocumentMetadata {
  title: string;
  description: string;
  noindex?: boolean;
}

const DEFAULT_METADATA: DocumentMetadata = {
  title: "Azeroth Flip - WoW Market Flipping Tool",
  description: "Monitor WoW realm markets and find profitable flipping opportunities.",
  noindex: true,
};

const ROUTE_METADATA: Record<string, DocumentMetadata> = {
  "/": {
    title: "Azeroth Flip - WoW Market Flipping Tool",
    description: "Find profitable market opportunities in World of Warcraft.",
    noindex: false,
  },
  "/home": {
    title: "Azeroth Flip - WoW Market Flipping Tool",
    description: "Find profitable market opportunities in World of Warcraft. Monitor realm markets, track price trends, and optimize your gold strategies with real-time auction house data.",
    noindex: false,
  },
  "/HowItWorks": {
    title: "How It Works - Azeroth Flip",
    description: "Learn how Azeroth Flip helps compare realms, rank opportunities, and make more informed World of Warcraft auction house decisions.",
    noindex: false,
  },
  "/privacy": {
    title: "Privacy - Azeroth Flip",
    description: "Read how Azeroth Flip handles accounts, browser storage, and public World of Warcraft market data.",
    noindex: false,
  },
  "/app": {
    title: "Scanner - Azeroth Flip",
    description: "Real-time WoW auction house scanner and market analysis.",
    noindex: true,
  },
  "/app/": {
    title: "Scanner - Azeroth Flip",
    description: "Real-time WoW auction house scanner and market analysis.",
    noindex: true,
  },
  "/app/suggested-realms": {
    title: "Suggested Realms - Azeroth Flip",
    description: "Discover high-opportunity realms based on market activity.",
    noindex: true,
  },
  "/app/realms": {
    title: "Realms - Azeroth Flip",
    description: "Manage tracked WoW realms and market monitors.",
    noindex: true,
  },
  "/app/presets": {
    title: "Presets - Azeroth Flip",
    description: "Create and manage scanner filter presets.",
    noindex: true,
  },
  "/app/account": {
    title: "Account - Azeroth Flip",
    description: "Manage your Azeroth Flip account security and deletion options.",
    noindex: true,
  },
  "/login": {
    title: "Login - Azeroth Flip",
    description: "Sign in to your Azeroth Flip account.",
    noindex: true,
  },
  "/reset-password": {
    title: "Reset Password - Azeroth Flip",
    description: "Reset your Azeroth Flip account password.",
    noindex: true,
  },
};

export function useDocumentTitle(pathname: string, options?: { title?: string; description?: string }) {
  useEffect(() => {
    let routeMetadata = ROUTE_METADATA[pathname];

    if (!routeMetadata) {
      if (pathname.startsWith("/app")) {
        routeMetadata = ROUTE_METADATA["/app"];
      }
    }

    routeMetadata = routeMetadata || DEFAULT_METADATA;

    const metadata: DocumentMetadata = {
      ...routeMetadata,
      ...(options || {}),
    };

    document.title = metadata.title;
    updateMetaTag("name", "description", metadata.description);

    if (metadata.noindex) {
      updateMetaTag("name", "robots", "noindex, nofollow");
    } else {
      updateMetaTag("name", "robots", "index, follow");
    }

    updateMetaTag("property", "og:title", metadata.title);
    updateMetaTag("property", "og:description", metadata.description);
    updateMetaTag("name", "twitter:title", metadata.title);
    updateMetaTag("name", "twitter:description", metadata.description);
  }, [pathname, options]);
}

function updateMetaTag(
  attributeName: "name" | "property",
  attributeValue: string,
  content: string
) {
  let metaTag = document.querySelector(`meta[${attributeName}="${attributeValue}"]`) as HTMLMetaElement;

  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(metaTag);
  }

  metaTag.content = content;
}
