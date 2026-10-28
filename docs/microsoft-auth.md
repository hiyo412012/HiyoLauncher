# Microsoft account setup (Azure app registration)

HiyoLauncher signs in to Minecraft with the **Microsoft device code flow** using a
**public client**. No client secret is required and no redirect URI is needed.

## 1. Create an app registration

1. Go to the [Azure portal](https://portal.azure.com/) → **Microsoft Entra ID**
   (formerly Azure AD) → **App registrations** → **New registration**.
2. Name it (e.g. `HiyoLauncher`).
3. Under **Supported account types**, choose
   **Personal Microsoft accounts only** (consumers).
4. Leave **Redirect URI** empty (device code flow does not use one).
5. Click **Register**.

## 2. Allow public client flows

1. In your app registration, open **Authentication**.
2. Under **Advanced settings**, set **Allow public client flows** to **Yes**.
3. Save.

## 3. (Optional) Add API permissions

The default scopes used are `XboxLive.signin offline_access`. If you want to
customize, add them under **API permissions** → **Add a permission** →
**APIs my organization uses** / Microsoft Graph as needed. The default is
sufficient for Minecraft login.

## 4. Copy the client ID

On the **Overview** page, copy the **Application (client) ID**. This is the only
value HiyoLauncher needs. **Do not create or use a client secret.**

## 5. Configure HiyoLauncher

Choose one of:

- **Settings UI**: open HiyoLauncher → Settings → Advanced → Microsoft client ID and paste the client ID.
- **Environment variable**: set `MS_CLIENT_ID` to the client ID before launching
  (useful for development or CI).

If no client ID is configured, Microsoft login is disabled but offline mode
remains fully available.

## Troubleshooting

- `AADSTS7000218`: public client flows are not enabled — revisit step 2.
- `AADSTS50126` / invalid credentials: re-run sign-in; device code expires.
- Ensure the account owns Minecraft: Java Edition for online play. Offline
  accounts are separate — see `offline-mode.md`.