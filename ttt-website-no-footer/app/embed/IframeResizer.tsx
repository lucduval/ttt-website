"use client";

import { useEffect } from "react";

/**
 * Sends the page's scroll height to the parent window so the host iframe
 * can resize itself dynamically.
 *
 * Uses MutationObserver (not ResizeObserver) deliberately — ResizeObserver
 * on document.body would fire when the *parent* resizes the iframe container,
 * creating an infinite grow loop. MutationObserver only fires when the actual
 * DOM content changes.
 */
export default function IframeResizer() {
    useEffect(() => {
        const sendHeight = () => {
            // Use the larger of body/documentElement to handle all browser quirks.
            // +1px buffer prevents subpixel rounding from causing a brief scrollbar.
            const height =
                Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                ) + 1;
            window.parent.postMessage({ type: "FORM_HEIGHT", height }, "*");
        };

        // Fire immediately on mount
        sendHeight();

        // Fire on window resize (user resizing the browser window)
        window.addEventListener("resize", sendHeight);

        // Fire when DOM content changes (e.g. form steps, accordions, dynamic content).
        // MutationObserver does NOT fire when the iframe container is resized by the
        // parent — so there is no feedback loop.
        const mo = new MutationObserver(sendHeight);
        mo.observe(document.body, { childList: true, subtree: true, attributes: true });

        return () => {
            window.removeEventListener("resize", sendHeight);
            mo.disconnect();
        };
    }, []);

    return null;
}
