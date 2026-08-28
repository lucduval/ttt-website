# TTT Header & Styling Handoff

Everything needed to rebuild the TTT header and match the site's styling in a new Next.js app.

**Source of truth:** `app/globals.css`, `app/layout.tsx`, `app/components/TTTHeader.tsx`
**Stack:** Next.js 16 · Tailwind v4 (no config file) · `next/font`

---

## 1. Header anatomy

Two full-bleed bars in different blues — a thin darker utility strip above the main nav. Both centre their content in a `max-w-7xl` container. The whole `<header>` is `sticky top-0 z-50`.

| Part | Spec |
|---|---|
| Utility bar | Height `h-9` (36px) · `bg-[#0168A2]` |
| Main nav bar | Height `h-16` (64px) · `bg-[#0077BB]` |
| Container | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |
| Logo | `/ttt-logo-white.png` · `h-10 w-auto` (h-8 in mobile drawer) |
| Scroll state | Past 20px scrollY adds `shadow-lg shadow-black/30` to the nav bar |
| Nav breakpoint | Desktop links from `lg` up; below that a right-slide drawer, `w-80 max-w-[90vw]` |

Utility bar contents: social pills left (`w-6 h-6 rounded-full bg-white/10`, hover `bg-white/25`), email + phone right (hidden below `sm`).

---

## 2. Brand palette

Two hues carry the whole site. `#0077BB` is primary — header, footer, hero gradients, icons, links, active states. `#E8872E` is reserved for calls to action and the active-nav underline; it appears roughly a third as often as the blue by design, meaning "act here".

| Hex | Name | CSS var | Used for |
|---|---|---|---|
| `#0077BB` | TTT Blue | `--blue` | Main nav bar, footer, hero gradients, icons, links, active text |
| `#0168A2` | TTT Blue Dark | `--blue-dark` | Utility bar, footer bottom bar, gradient mid-stops |
| `#01527e` | TTT Blue Deeper | `--blue-deeper` | Darkest gradient stop on the `navy` hero variant only |
| `#E8872E` | TTT Orange | `--orange` | CTA buttons, active-nav underline, eyebrow labels, footer icons |
| `#d4771f` | TTT Orange Dark | `--orange-dark` | Hover state for every orange button |
| `#F8FAFC` | Surface | `--surface` | Alternating page-section background (Tailwind `slate-50`) |
| `#FFFFFF` | Background | `--background` | Default page ground — the site is light-mode only |
| `#171717` | Foreground | `--foreground` | Token on `body`; in practice headings use `slate-800/900` |

Beyond the brand hues, everything neutral is Tailwind's **slate** scale — a blue-biased grey, which is why it sits well against `#0077BB`. Don't substitute `gray` or `zinc`; the cool cast is deliberate.

---

## 3. Typography

One face does nearly all the work: **Roboto**, loaded via `next/font/google` at weights 300–700, for both body and headings. **Roboto Slab** (400–700) is loaded and exposed as `--font-serif`, but `globals.css` deliberately points `h1`–`h6` back at Roboto to match the original site — treat the slab as available, not active.

Base: `16px / 1.7` on body · `1.25` line-height and `700` weight on headings · `-webkit-font-smoothing: antialiased`.

| Role | Size | Weight & tracking |
|---|---|---|
| Hero `h1` | `text-4xl` → `sm:text-5xl` → `lg:text-6xl` | 700 · `leading-tight` |
| Hero eyebrow | `text-xs sm:text-sm` | 700 · `tracking-widest` · uppercase · `#E8872E` |
| Nav link | `text-sm` (14px) | 500 · `tracking-wide` |
| Utility bar | `text-xs` (12px) | 400 |
| CTA button | `text-sm` (14px) | 600 · `rounded-full` |
| Body copy | 16px / 1.7 | 400 |
| Footer button label | `text-xs` (12px) | 700 · `tracking-widest` · `rounded-sm` |

---

## 4. Font colours in context

The part worth copying most carefully. **On blue, text is never a separate colour** — it's white at graded opacity, which is what keeps the header feeling like one surface. On white, text is the slate scale.

### On TTT blue

| Opacity | Applied to |
|---|---|
| `text-white` | Logo, active nav link, hovered nav link |
| `text-white/90` | Services dropdown trigger |
| `text-white/85` | Idle nav links |
| `text-white/70` | Hero subtitle |
| `text-white/60` | Utility bar email & phone |
| `text-white/20` | Divider pipe |

Backgrounds follow the same ladder: `bg-white/10` for social pills and nav hover, `bg-white/15` for the active nav pill, `bg-white/25` for social hover.

### On white

| Colour | Hex | Applied to |
|---|---|---|
| `slate-900` | `#0F172A` | Page headings |
| `slate-800` | `#1E293B` | Drawer links, card titles |
| `slate-700` | `#334155` | Dropdown items |
| `slate-600` | `#475569` | Body copy |
| `slate-500` | `#64748B` | Muted text, contact rows |
| `slate-400` | `#94A3B8` | Icons, captions, chevrons |
| TTT Blue | `#0077BB` | Active & hover link |

Borders are `slate-100` (`#F1F5F9`). The active dropdown/drawer item sits on `bg-blue-50` with `#0077BB` semibold text.

---

## 5. Component recipes

| Element | Shape & spacing | Colour |
|---|---|---|
| Primary CTA | `px-5 py-2 rounded-full font-semibold shadow-md` → `shadow-lg` · `hover:-translate-y-0.5` | `#E8872E` → `#d4771f` |
| Secondary CTA (on blue) | `px-7 py-3.5 rounded-full border` | `bg-white/10 border-white/30 hover:bg-white/20` |
| Footer button | `px-6 py-2 rounded-sm text-xs font-bold tracking-widest` | `#E8872E` |
| Nav link (idle → hover) | `px-4 py-2 rounded-lg text-sm font-medium tracking-wide` | `text-white/85` → `text-white` + `bg-white/10` |
| Nav link (active) | + 2px underline inset 16px each side, `bottom-1`, `rounded-full` | `#E8872E` on `bg-white/15` |
| Desktop dropdown | `min-w-[200px] rounded-xl py-2 shadow-2xl`, items `px-4 py-2.5` | `bg-white border-slate-100` |
| Mobile drawer | `w-80 max-w-[90vw]`, right slide, spring `damping 28 / stiffness 260`, items `rounded-xl min-h-[44px]` | `bg-white`, `#0077BB` header strip, `bg-black/50` backdrop |
| Hero gradients | `bg-gradient-to-br` | blue: `#0077BB`→`#0168A2` · navy: `#0168A2`→`#01527e`→`#0077BB` · light: `#f0f7ff`→`#fff`→`#f8fafc` |
| Photo hero overlay | `linear-gradient` over the image | `rgba(0,0,0,0.52)` → `rgba(0,0,0,0.42)` |
| Focus ring | 2px · offset 3px · radius 4px | `#0077BB` |

---

## 6. Drop-in setup

Paste these into the new app and the brand colours become Tailwind utilities — `bg-blue-ttt`, `text-orange-ttt`, `bg-surface` — alongside the raw hex values, which the existing codebase uses interchangeably.

### `app/globals.css`

```css
@import "tailwindcss";

/* Design tokens */
:root {
  --background:    #ffffff;
  --foreground:    #171717;
  --blue:          #0077BB;
  --blue-dark:     #0168A2;
  --blue-deeper:   #01527e;
  --orange:        #E8872E;
  --orange-dark:   #d4771f;
  --surface:       #F8FAFC;
}

/* Expose them to Tailwind v4 */
@theme inline {
  --color-background:    var(--background);
  --color-foreground:    var(--foreground);
  --color-blue-ttt:      var(--blue);
  --color-blue-ttt-dark: var(--blue-dark);
  --color-blue-deeper:   var(--blue-deeper);
  --color-orange-ttt:    var(--orange);
  --color-surface:       var(--surface);
  --font-sans:  var(--font-roboto);
  --font-serif: var(--font-roboto-slab);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-roboto), 'Roboto', Arial, Helvetica, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

/* Headings stay on Roboto, matching the original site */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-roboto), 'Roboto', Arial, Helvetica, sans-serif;
  line-height: 1.25;
  font-weight: 700;
}

html { scroll-behavior: smooth; }

:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 3px;
  border-radius: 4px;
}
```

### `app/layout.tsx`

```tsx
import { Roboto, Roboto_Slab } from "next/font/google";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// …then on <body>:
<body className={`${roboto.variable} ${robotoSlab.variable} antialiased`}>
```

---

## 7. Worth knowing before you build

1. **The hex values are hardcoded, not tokenised, in components.** `TTTHeader.tsx` writes `bg-[#0077BB]` directly rather than `bg-blue-ttt` — `#0077BB` appears ~714 times across `app/` this way. If you want token-driven styling in the new app, decide that upfront; retrofitting is a find-and-replace across every component.

2. **There is no dark mode.** The site is light-only — no `dark:` variants, no `prefers-color-scheme` handling. If the new app needs dark, the white-opacity ladder on blue transfers cleanly, but the slate-on-white scale needs a fresh set of values.

3. **Roboto Slab is loaded but unused.** It costs a font download for nothing. Either drop it from `layout.tsx` or actually use `font-serif` on display headings — a real choice, not the current in-between.

4. **Nav labels are uppercase in the markup, not in CSS.** The `navLinks` array literally contains `"ABOUT US"`. Screen readers read it as written; if that matters, move to sentence case plus `uppercase tracking-wide`.

5. **Mobile targets are set to 44px deliberately.** Drawer items carry `min-h-[44px]` and the hamburger is `w-11 h-11`. Keep these — the calculators' `.calc-slider` rule exists for the same reason, giving a thin 8px track a 2.75rem grab area.

6. **The logo is a PNG, white-only.** `/ttt-logo-white.png` is used in both the header and drawer; `/ttt-logo.svg` also exists in `public/`. Both header placements sit on blue, so the white version is the one you need — there's no dark-on-light lockup in the repo.

7. **Framer Motion drives the drawer and hero reveals.** The header imports `motion` and `AnimatePresence`; heroes fade up 28px over 0.55s `easeOut`. If you skip Framer Motion in the new app, the drawer needs a CSS transition replacement — it slides from `x: 100%` on a spring.
