"use client";

import { useEffect } from "react";

/**
 * Sends the page's scroll height to the parent window so the host iframe
 * can resize itself dynamically. Fires on mount, on window resize, and
 * whenever the DOM changes (via ResizeObserver on document.body).
 */
export default function IframeResizer() {
  useEffect(() => {
    const sendHeight = () => {
      const height = document.body.scrollHeight;
      window.parent.postMessage({ type: "FORM_HEIGHT", height }, "*");
    };

    // Fire immediately on mount
    sendHeight();

    // Fire on every window resize
    window.addEventListener("resize", sendHeight);

    // Fire whenever any element on the page changes size
    const ro = new ResizeObserver(sendHeight);
    ro.observe(document.body);

    return () => {
      window.removeEventListener("resize", sendHeight);
      ro.disconnect();
    };
  }, []);

  return null;
}
