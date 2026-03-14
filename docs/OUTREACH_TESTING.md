# Outreach & Lead Intelligence — Testing Instructions

Outreach emails are **prepared automatically but only send when the admin clicks Send**. The sending persona is **Teryn** (teryn@gigxo.com).

## 1. Connect Microsoft Inbox

1. Set in Railway (or `.env`):
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_TENANT_ID` (optional; default `common`)
   - `MICROSOFT_REDIRECT_URI` (e.g. `https://yourdomain.com/api/auth/microsoft/callback`)

2. In the app: go to **Admin → Outreach** (or `/admin/outreach`).

3. Click **Connect Microsoft Inbox**.

4. Sign in with the Microsoft account you want to use for sending (e.g. teryn@gigxo.com). Grant scopes: `openid`, `profile`, `offline_access`, `User.Read`, `Mail.Send`.

5. After redirect, the dashboard should show: **Connected inbox: teryn@gigxo.com**.

## 2. Import (or add) leads

1. Go to **Outreach → Leads** (or `/admin/outreach/leads`).

2. Click **Add lead** and fill:
   - Lead type (Venue new, Venue existing, Performer)
   - Name, Business/Venue, Email, Phone, Instagram, City, State, Source

3. Lead **score** is computed automatically (e.g. +10 South Florida, +5 Instagram, etc.). Leads are sorted by score (highest first).

## 3. Create a template

1. Go to **Outreach → Templates** (or `/admin/outreach/templates`).

2. Click **New template**.

3. Set:
   - Name (e.g. "Venue new — congrats")
   - Target type (venue_new, venue_existing, performer)
   - **Subject template** — e.g. `Congrats on opening {{venue}} 🎉`
   - **Body template** — use variables: `{{name}}`, `{{venue}}`, `{{city}}`

   Example body:

   ```
   Hi {{name}},

   Congrats on opening {{venue}} in {{city}}.

   New venues usually see the best early traction when they host DJs or live performers.

   Gigxo helps venues quickly discover and book talent across South Florida.

   You can explore performers here: [gigxo link]

   – Teryn
   Gigxo
   ```

4. Save.

## 4. Preview email

1. On the **Leads** page, find a lead and click **Preview Email** or **Send Email** (both open the same modal).

2. In the modal, choose a **Template**. The subject and body will be rendered with that lead’s data ({{name}}, {{venue}}, {{city}}).

3. Edit the subject and/or body if you want.

4. Click **Cancel** to close without sending.

## 5. Send email (manual only)

1. In the same modal, after previewing/editing, click **Send Email**.

2. The server will:
   - Use the connected Microsoft tokens (refreshing if expired).
   - Send the email via Microsoft Graph `POST /me/sendMail`.
   - Log the message in the `outreach_messages` table.
   - Set the lead’s status to `contacted` and update `last_contacted`.

3. You should see a success toast and the modal close. The lead’s status will show **Contacted** and **Last Contacted** will update.

## 6. Confirm message logged

- Sent emails are stored in the **outreach_messages** table with: lead_id, subject, body, template_id, sender_email, provider (`microsoft`), sent_at, status.
- Reply tracking (matching replies and setting lead status to `replied`) is prepared for later; the architecture can use `GET /me/messages` and match by sender email.

## Troubleshooting

- **"Microsoft inbox not connected"** — Complete step 1 and ensure the redirect URI in Azure matches `MICROSOFT_REDIRECT_URI`.
- **401/403 on Send** — You must be logged in as an **admin**; the session cookie is sent with `credentials: 'include'`.
- **Token expired** — The server refreshes the Microsoft token automatically before sending when it’s within 5 minutes of expiry.
