import { useCallback, useSyncExternalStore } from "react";

function getMediaQueryMatches(query: string): MediaQueryList | null {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia(query);
  }

  return null;
}

export default function useMediaQuery(query: string) {
  return useSyncExternalStore(
    useCallback(
      function subscribe(onMediaChange: () => void) {
        const matchMedia = getMediaQueryMatches(query);
        if (matchMedia) {
          matchMedia.addEventListener("change", onMediaChange);
          return function unsubscribe() {
            matchMedia.removeEventListener("change", onMediaChange);
          };
        } else {
          return function unsubscribe() {};
        }
      },
      [query]
    ),
    function getSnapshot() {
      const mediaQueryList = getMediaQueryMatches(query);
      return mediaQueryList?.matches;
    },
    function getServerSnapshot() {
      return false;
    }
  );
}
