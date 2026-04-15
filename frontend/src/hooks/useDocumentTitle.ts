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
  "/public/docs": {
    title: "Documentation - Azeroth Flip",
    description: "Public documentation for Azeroth Flip. Learn about features, data freshness, API capabilities, and trust boundaries.",
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

/**
 * Hook to manage document title and metadata based on current route.
 * Updates meta tags for robots, description, og:title, og:description, twitter tags.
 * Public routes (home, docs) are indexable; authenticated routes are marked noindex.
 */
export function useDocumentTitle(pathname: string, options?: { title?: string; description?: string }) {
  useEffect(() => {
    // Get metadata for this route or use defaults
    let routeMetadata = ROUTE_METADATA[pathname];
    
    // If exact route not found, try pattern matching for nested app routes
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

    // Update title
    document.title = metadata.title;

    // Update or create meta tags
    updateMetaTag("name", "description", metadata.description);
    
    if (metadata.noindex) {
      updateMetaTag("name", "robots", "noindex, nofollow");
    } else {
      updateMetaTag("name", "robots", "index, follow");
    }

    // Update Open Graph tags
    updateMetaTag("property", "og:title", metadata.title);
    updateMetaTag("property", "og:description", metadata.description);

    // Update Twitter Card tags
    updateMetaTag("name", "twitter:title", metadata.title);
    updateMetaTag("name", "twitter:description", metadata.description);
  }, [pathname, options]);
}

/**
 * Helper function to update or create meta tags.
 */
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
