# Deploying

The app runs on Vercel under your own domain. No `*.vercel.app` link is shared with anyone.

## 1. Accounts to create

| Service | What for | What you need from it |
| --- | --- | --- |
| Vercel | Hosting | A project linked to this GitHub repo |
| Neon | Postgres (US region) | The **pooled** connection string |
| AWS | S3 bucket for page photos | Bucket name, region, an IAM user or role limited to that bucket, optionally a KMS key |
| Inngest | Background jobs | Event key and signing key (install the Vercel integration to set them automatically) |
| Anthropic | Transcription and scoring | API key. Ask for zero data retention on the organization |
| Google Cloud | Sign in with Google | OAuth client ID and secret |

## 2. S3 bucket

- Block all public access. Default encryption: SSE-KMS.
- CORS, so browsers can upload directly:

```json
[
  {
    "AllowedOrigins": ["https://app.yourdomain.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

- IAM policy for the app: `s3:PutObject`, `s3:GetObject` on `arn:aws:s3:::BUCKET/*`, plus `kms:Encrypt`, `kms:Decrypt`, `kms:GenerateDataKey` on the key if you use one.

## 3. Google sign-in

Google Cloud console, APIs and Services, Credentials, OAuth client (web):
- Authorized JavaScript origin: `https://app.yourdomain.com`
- Authorized redirect URI: `https://app.yourdomain.com/api/auth/callback/google`

## 4. Vercel environment variables (Production)

```
APP_URL=https://app.yourdomain.com
DATABASE_URL=<Neon pooled connection string>
BETTER_AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ENABLE_DEV_LOGIN=false
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_REGION=us-east-1
S3_KMS_KEY_ID=<optional>
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
MODEL_MODE=anthropic
ANTHROPIC_API_KEY=...
JOBS_DRIVER=inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
ADMIN_EMAILS=you@yourdomain.com
# Optional: run background jobs on your own computer. See "Local inference with Ollama" in the README.
LLM_WORKER_TOKEN=<openssl rand -hex 32>
```

The app refuses to start on a public https `APP_URL` with dev login on, fake models, in-process jobs or local storage.

## 5. Domain

Vercel project, Settings, Domains: add `app.yourdomain.com` and follow the DNS instructions. Under Deployment Protection, turn on Vercel Authentication for preview deployments so only your team can open them.

## 6. Database migrations

Run once per release, before or during the deploy:

```bash
DATABASE_URL="<Neon direct connection string>" npm run db:migrate
```

Or set the Vercel build command to `npm run db:migrate && npm run build`.

## 7. Inngest

Install the Inngest Vercel integration, or register `https://app.yourdomain.com/api/inngest` in the Inngest dashboard. Functions: process-page, transcribe-page, split-pdf, score-submission.

## 8. Check

1. Sign in with Google.
2. Create a class, an assignment, print a packet.
3. Photograph one answer sheet with your phone and watch it go through.
