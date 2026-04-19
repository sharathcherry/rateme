<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/943989c4-2ea4-46ef-ba12-88c4bce98410

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Secure S3 Upload Setup (Presigned URLs)

This project now uses a backend signer endpoint for profile photo uploads.  
No AWS secret keys should be in frontend code.

### 1. Configure frontend upload endpoint

Set this in your frontend env file:

`VITE_UPLOAD_SIGN_URL=http://localhost:4000/api/uploads/sign`

### 2. Configure signer backend

1. Copy `.env.server.example` to `.env.server`
2. Fill:
   - `AWS_REGION`
   - `AWS_S3_BUCKET`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `FIREBASE_PROJECT_ID`

### 3. Run signer backend

`npm run server:dev`

### 4. Run frontend

`npm run dev`

### Platform Notes

- Web: uses the same `VITE_UPLOAD_SIGN_URL` and presigned upload flow.
- Android (real device): run `adb reverse tcp:4000 tcp:4000` when using local signer at `http://localhost:4000`.
- iOS: `Info.plist` includes localhost ATS exceptions for local HTTP signer development.
- HEIF/HEIC: now supported by converting selected HEIF/HEIC files to JPEG before upload for reliable preview on web/iOS/Android.

### Vercel Deployment Notes

If deployed to Vercel, set these Project Environment Variables:

- `FIREBASE_PROJECT_ID`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- Optional: `AWS_S3_PUBLIC_BASE_URL`
- Optional: `SIGNED_URL_TTL_SECONDS`

Frontend signer URL options:

- Recommended on Vercel: leave `VITE_UPLOAD_SIGN_URL` unset and the app will use same-origin `/api/sign-upload` automatically.
- If using an external signer service, set `VITE_UPLOAD_SIGN_URL` to that full URL.
