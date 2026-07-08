# Dome Deployment Notes

This MVP intentionally uses only Node built-ins. It can run locally, on a VPS, on Cloud Run, or on App Engine.

## Local

```bash
npm start
```

Open `http://localhost:8080`.

## Cloud Run

```bash
gcloud run deploy dome-platform \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,ADMIN_KEY=<strong-admin-key>,SESSION_SECRET=<strong-session-secret>
```

For production, use a managed database instead of the JSON data file because Cloud Run containers are ephemeral.

## App Engine

```bash
gcloud app deploy app.yaml
```

## OTP Providers

The server works in development without SMS by returning a dev OTP in the API response.

For Twilio SMS, set:

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
```

For India production, replace this with the final DLT-compliant SMS/WhatsApp provider selected by PrintoDome.
