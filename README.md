# HubSpot Demo

This is a demo project that shows how to connect a Next.js app with HubSpot using OAuth.  
It creates contacts, deals, and line items in HubSpot, and also lets you search a contact’s history by email.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind)
- HubSpot CRM APIs (v3/v4)
- OAuth (with refresh tokens)
- Redis (Upstash, optional) for token persistence

---

## Setup

### 1. HubSpot App

1. Create a **Developer Account** and a **Test Account** in HubSpot.
2. Go to **Developer → Projects** and create an app with:
   - Distribution: private
   - Auth: OAuth
   - Scopes required:
     - `oauth`
     - `crm.objects.contacts.read`
     - `crm.objects.contacts.write`
     - `crm.objects.deals.read`
     - `crm.objects.deals.write`
     - `crm.objects.line_items.read`
     - `crm.objects.line_items.write`
3. Add redirect URI: http://localhost:3000/api/auth/hubspot/callback

4. Copy your **Client ID** and **Client Secret**.

### 2. Environment Variables

Create a file `.env.local` in the root:

```env
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/auth/hubspot/callback
HUBSPOT_BASE_URL=https://api.hubapi.com

DEFAULT_PIPELINE=default
DEFAULT_DEALSTAGE=appointmentscheduled

# Optional: Redis for token persistence
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

```
