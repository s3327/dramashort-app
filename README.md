# DramaShort — Project Package

Everything built so far, in one place.

## Structure

```
dramashort/
├── app/                          # Next.js App Router source
│   ├── layout.tsx                 # data-theme="dark", loads Fredoka + Plus Jakarta Sans
│   ├── globals.css                # tailwind directives + imports design-tokens/tokens.css
│   ├── page.tsx                   # landing page ("/") — hero + Enter CTA → /home
│   └── home/
│       └── page.tsx               # /home — now renders <Header /> at the top
│
├── components/
│   └── Header.tsx                 # logo · nav menu · search/user icons (lucide-react)
│
├── data/
│   └── nav-links.mock.ts          # mock menu links — swap for real routes later
│
├── design-tokens/
│   ├── tokens.css                 # brand color scales + light/soft/dark theme surfaces
│   └── tailwind.config.js         # tailwind theme wired to the CSS variables
│
├── public/brand/
│   ├── dramashort-logo.png        # wordmark + star (used by Header)
│   ├── dramashort-wordmark.png    # wordmark only, no star
│   └── dramashort-icon-circle.png # circular icon mark
│
├── preview/                       # standalone HTML — open directly in a browser, no build needed
│   ├── index.html                 # landing page mockup
│   ├── home.html                  # /home placeholder mockup
│   └── design-tokens-preview.html # full palette / type / button / link reference
│
├── package.json                   # all dependencies (Next.js, React, Tailwind, lucide-react)
├── tsconfig.json
├── next.config.mjs
├── postcss.config.js
├── tailwind.config.js             # copy of design-tokens/tailwind.config.js, at root where Tailwind expects it
├── next-env.d.ts
└── .gitignore
```

## Status

| Piece | Status |
|---|---|
| Design tokens (colors, themes, type) | ✅ Done |
| Landing page (`/`) | ✅ Done |
| `/home` route | 🟡 Placeholder, Header wired in |
| Header component | ✅ Built and wired into `/home` |
| Main feed | ⬜ Not started |
| Admin site | ⬜ Not started |
| Telegram Mini App | ⬜ Not started |

## Getting it running

This folder is now a complete, installable project — no `create-next-app` step needed.

```bash
cd dramashort
npm install
npm run dev
```

Then open `localhost:3000` and `localhost:3000/home`.

## Notes for later

- Public site → Next.js (SEO + ISR for synced drama metadata). Admin site → lighter Vite + React, importing the same `design-tokens/` files to stay visually consistent.
- Telegram Mini App reuses the same two token files — one design system, three surfaces.
- Wiring `Header` into `/home` and building the real feed are the next steps, pending your review.
