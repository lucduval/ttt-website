# WhatsApp Refer-and-Earn — WordPress Implementation Guide

We're shipping a WhatsApp Refer-and-Earn campaign. Existing TTT clients receive a WhatsApp template message with a "Share with a friend" button that produces a pre-filled share message containing a signup link back to TTT.

The redirect side of the flow has already been handled outside WordPress (it now lives on the Next.js production domain at `ttt-financial-forms.vercel.app/r/{code}`, configured directly in the Meta template button URL — recipients never see the URL).

**The only remaining WordPress task is one small edit on the `/client-onboarding/` page**, so that when a referred friend taps the signup link `https://www.ttt-tax.co.za/client-onboarding/?ref={CODE}`, the embedded Next.js onboarding form actually receives the `?ref={CODE}` parameter (today it doesn't — the iframe `src` is hardcoded and ignores the WordPress URL's query string).

**No SFTP / SSH / filesystem access is required. No plugin install is required. No theme file edits are required. No WordPress administrator role is required.** All work happens inside the page editor for one page.

---

## Prerequisites

- A WordPress account on `ttt-tax.co.za` with the **Editor** role or higher (anyone who can edit pages).
- The `/client-onboarding/` WordPress page already exists and currently contains an iframe pointing at `https://ttt-financial-forms.vercel.app/embed/onboarding`.

---

## Step 1 — Open the page for editing

1. Log in to `https://ttt-tax.co.za/wp-admin`.
2. In the left sidebar, click **Pages → All Pages**.
3. Find the page titled **Client Onboarding** (the one whose permalink is `/client-onboarding/`).
4. Hover over the page title and click **Edit**.

You should now see the page contents in the WordPress editor.

---

## Step 2 — Locate and delete the existing iframe block

Find the existing iframe markup on the page. It currently contains:

- An `<iframe>` element with `src="https://ttt-financial-forms.vercel.app/embed/onboarding"` (or similar — look for any iframe whose `src` contains `ttt-financial-forms.vercel.app`).
- A `<script>` block immediately after it that listens for `message` events of type `FORM_HEIGHT`.

**Editor-specific notes:**

- **Block editor (Gutenberg) — most common:** look for a **Custom HTML** block containing the iframe + script. Click into it, then click the block's three-dot menu → **Remove**.
- **Classic editor:** switch to the **Text** (HTML) tab if you're not already on it. Find and delete the entire `<iframe>...</iframe>` and `<script>...</script>` markup.
- **Page builder (Elementor / Divi / WPBakery / etc.):** look for an "HTML" or "Code" widget/element containing the iframe markup, and delete it.

Do NOT delete any other content on the page. The header copy, intro paragraphs, and surrounding sections should stay exactly as they are. Only the iframe + its accompanying script block is being replaced.

---

## Step 3 — Insert the new Custom HTML block

In the same spot where the iframe used to be, insert a new **Custom HTML** block (or HTML widget, depending on editor) containing the exact code below.

### Block editor (Gutenberg)

1. Click the **+** button to add a new block.
2. Search for **Custom HTML** and select it.
3. Paste the code below into the block.

### Classic editor

1. Make sure you are on the **Text** (HTML) tab, not the **Visual** tab.
2. Paste the code below at the spot where the old iframe was.

### Page builder

1. Add an **HTML** widget/element (Elementor: "HTML"; Divi: "Code"; WPBakery: "Raw HTML").
2. Paste the code below into it.

### The code to paste

```html
<div id="ttt-onboarding-mount"></div>
<script>
  (function () {
    var qs = window.location.search || '';
    var iframe = document.createElement('iframe');
    iframe.id = 'ttt-onboarding-iframe';
    iframe.src = 'https://ttt-financial-forms.vercel.app/embed/onboarding' + qs;
    iframe.width = '100%';
    iframe.height = '800';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.title = 'Client Onboarding';
    iframe.loading = 'lazy';
    document.getElementById('ttt-onboarding-mount').appendChild(iframe);

    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'FORM_HEIGHT') return;
      if (typeof event.data.height === 'number') {
        iframe.style.height = event.data.height + 'px';
      }
    });
  })();
</script>
```

**What this code does, in plain English:** it reads the current page's URL query string (e.g. `?ref=ABC123`), builds an iframe pointing at the Next.js onboarding form with that same query string appended, and inserts the iframe into the page. It also listens for height-change messages from the form (the form posts its content height every time it changes) so the iframe resizes itself instead of showing an inner scrollbar.

---

## Step 4 — Save the page

Click the **Update** button (top-right) to save your changes.

---

## Step 5 — Verify the change works

### 5a. Confirm the `<script>` tag was not stripped

WordPress sometimes strips `<script>` tags from page content on certain configurations (specifically: WordPress multisite installs strip `<script>` for non-Super-Admin users). On a normal single-site WordPress install — which TTT runs — Editor and Administrator roles can both insert `<script>` tags via Custom HTML blocks without issue. This step is just to confirm.

1. Open `https://www.ttt-tax.co.za/client-onboarding/` in a browser.
2. Open **DevTools** (right-click → Inspect, or F12).
3. Go to the **Elements** tab.
4. Search for `ttt-onboarding-iframe` (Ctrl+F or Cmd+F inside the Elements panel).

**Expected:** you see an `<iframe id="ttt-onboarding-iframe">` element in the DOM, with `src="https://ttt-financial-forms.vercel.app/embed/onboarding"`.

**If you see the `<div id="ttt-onboarding-mount">` but NO `<iframe>` inside it:** the `<script>` tag was stripped on save. This means we hit the multisite-with-non-Super-Admin case. **STOP** — this requires the super admin's involvement after all. Tell Luc (luc@riivo.io); we'll fall back to the Code Snippets plugin path once the super admin is back.

### 5b. Confirm query-string forwarding works

1. In the same browser, open:
   ```
   https://www.ttt-tax.co.za/client-onboarding/?ref=TESTCODE123
   ```
2. In DevTools → Elements, re-locate the `<iframe id="ttt-onboarding-iframe">`. Its `src` attribute should now be:
   ```
   https://ttt-financial-forms.vercel.app/embed/onboarding?ref=TESTCODE123
   ```
   (with the `?ref=TESTCODE123` part appended). If the iframe `src` is still the bare URL without the query string, the JS isn't running — check the DevTools **Console** tab for errors.

3. In the rendered form, select **Tax** as the service. A "Referral code" field should appear, **pre-populated** with `TESTCODE123`.

If both checks pass, query-string forwarding is working.

### 5c. End-to-end smoke test (recommended)

From a mobile device:

1. Open `https://ttt-financial-forms.vercel.app/r/TESTCODE123` (or whatever URL the Meta template button uses for testing).
2. WhatsApp opens with the pre-filled share message ready to send. Pick yourself (or a test contact) and send the message.
3. In the received message, tap the `https://www.ttt-tax.co.za/client-onboarding/?ref=TESTCODE123` link.
4. The onboarding page opens. Select **Tax**. The referral-code field should be auto-filled with `TESTCODE123`.

If all four steps work, the flow is fully wired end-to-end.

---

## Caching note (important)

If `/client-onboarding/` is served from a page cache (WP Rocket, W3 Total Cache, LiteSpeed Cache, Cloudflare full-page cache, etc.), the cached HTML response is identical regardless of the query string — but the iframe `src` now depends on the query string, so a stale cache would freeze it on whatever query string was first cached.

**This is fine** because the query-string handling is done in JavaScript at runtime — the cached HTML is identical for every visitor, and the JS reads the live URL at the moment the page loads. No cache exclusion is needed.

If you ever observe the iframe loading without the `?ref=` part appended, the JS itself is broken; cache is not the issue.

---

## Rollback

If anything breaks, the change is fully reversible in seconds:

1. Edit the **Client Onboarding** page again.
2. Either: use **Page → Revisions** (top-right sidebar in the block editor) to restore the version from before this change — WordPress keeps revisions automatically; or, manually delete the new Custom HTML block and paste back the original iframe markup that was there before.
3. Click **Update**.

No database changes. No plugin installs to uninstall. No theme files modified.

---

## What's intentionally NOT here

For completeness — these are explicitly out of scope for the WP dev's task and are being handled elsewhere:

- **The `/r/{code}` → WhatsApp redirect:** handled by the Next.js app at `ttt-financial-forms.vercel.app/r/{code}`. Configured directly in the Meta WhatsApp template button URL. No WordPress work needed.
- **Spam protection / CAPTCHA on the redirect:** not needed — the endpoint produces a `wa.me` URL, no attacker value.
- **Analytics / share-intent logging:** out of scope for this delivery.
- **Changes to the `/embed/contact` iframe or any other page:** out of scope. This change touches only `/client-onboarding/`.

---

## Contact

Any questions on the Next.js side (the form, the embed URL, the referral-code field behaviour), reach out to Luc Duval at luc@riivo.io.
