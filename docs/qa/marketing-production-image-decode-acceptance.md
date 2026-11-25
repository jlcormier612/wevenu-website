# Marketing Production — image decode acceptance (permanent)

## Why

HTTP 200 on a source PNG or `/_next/image` URL is **not** proof the visitor sees the image. Production ECS previously hung on a specific optimizer width (`w=828`) for an approved asset: the figure frame rendered, `naturalWidth` stayed `0`, and prior hero/LCP checks missed it.

## Gate (required after every Production marketing deploy)

Run against the live apex after the new task is healthy:

```bash
OUT_JSON=~/Desktop/HTC-marketing-image-decode.json \
  BASE_URL=https://hellotocheers.com \
  node marketing/scripts/image-decode-acceptance.mjs
```

Exit `0` only if **every** `<img>` on all **19** public sitemap paths decodes at:

- Desktop 1280×800 @ DPR 2  
- Mobile 390×844 @ DPR 3  

Including below-the-fold / lazy-loaded images (script scrolls each page).

## Also verify (smoke)

- Serving SHA / task definition matches the approved deploy tip  
- Cookie consent banner still gates analytics  
- Pricing + Walkthrough/Calendly surfaces load  
- GA4 remains closed GREEN unless the change intentionally touches analytics  

## Related

- Hotfix context: Client Home planning-cards `unoptimized` PNG delivery (PR restoring exact approved asset when `/_next/image` hung).  
- Broader static vs runtime optimizer strategy is a separate founder decision — this gate stays regardless of delivery approach.
