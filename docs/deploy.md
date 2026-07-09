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

## Render

Render can run this app as a Web Service with:

```bash
npm start
```

Set these environment variables in Render:

```bash
NODE_ENV=production
ADMIN_KEY=<strong-admin-key>
SESSION_SECRET=<strong-session-secret>
PAYMENT_MODE=mock
```

Use `/healthz` as the health check path.

On Render's free plan, the service can sleep after inactivity. The first visitor after a sleep may wait while the service wakes up. The code now keeps the first page lighter, adds retry messaging, and exposes `/healthz`, but a fully instant first request needs either a paid always-on instance or an external uptime monitor that pings `/healthz` regularly.

## Recommended Production Providers

For the India launch workflow, this build is prepared for:

- Phone OTP: MSG91 first choice for India/DLT workflows, Twilio as fallback.
- Email OTP: Resend for quick setup, SendGrid as fallback.
- Payments: Razorpay for the Rs 500 contact reveal bundle and paid OEM microsites.
- GST lookup: connect a GST/GSP provider behind `GST_API_URL`; the current demo mode returns clearly marked sample data.

Supported environment variables:

```bash
# SMS OTP
MSG91_AUTH_KEY=
MSG91_TEMPLATE_ID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=

# Email OTP
RESEND_API_KEY=
SENDGRID_API_KEY=
EMAIL_FROM="Dome <verify@yourdomain.com>"

# GST lookup
GST_API_URL=
GST_API_KEY=

# Payments
PAYMENT_MODE=mock
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Keep `PAYMENT_MODE=mock` for demos. Switch it away from mock only after Razorpay order/payment-link creation and webhook settlement are connected.

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
