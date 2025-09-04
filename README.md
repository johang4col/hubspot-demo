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
3. Add redirect URI:
