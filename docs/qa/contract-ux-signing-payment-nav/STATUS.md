# Contract UX — signing first-name + Lead payment nav — STATUS

**STATUS:** GREEN on exact Sandbox runtime `38e3d753`

## Runtime
- Image: `htc-sandbox-venue-app:38e3d753b4fe33277aff54306d3bce2ca3c5900d`
- Digest: `sha256:f67fb6faefaad32f789964f938c874659112f12ec571cdb4e1e80b0614b5e649`
- TD: `htc-sandbox-venue-app:521`
- Task: `308fccbbbe6b4be0a66a434828befbca` (sole RUNNING; PRIMARY COMPLETED 1/1/0)
- Health: `https://app.sandbox.hellotocheers.com/api/health` → 200

## 1. Signing confirmation first name — PROVEN
- Sign URL: `/sign/0916c45a-88a4-483d-ab8c-31addcfdfd40`
- Entered full legal name `Kermit Frog`
- Confirmation: **Thank you, Kermit.** (not “Kermit Frog”)
- DB `contract_signers.signer_name` = `Kermit Frog` (`signed_at` set)

## 2. Set up payments stays on Lead journey — PROVEN
- Fully Executed not-booked contract `107fcc2c-4fe6-436f-b9f3-149340cdbe79`
- **Set up payments** → `/leads/20e470d8-ab91-4db1-bbae-d75dad943b69?setupPayments=1#booking-journey-payments`
- Setup Payments sheet opened on Lead Overview; **not** `/clients/…`

## 3. Booked still uses client workspace — PROVEN
- Booked signed contract `e8485a5d-6190-4479-8ee9-eb1ddccf3bcb` (Ivy Quinn)
- **Set up payments** → `/clients/3c9ecc54-fe49-432a-b49e-9d68dee33575?setupPayments=1`

Production untouched.
