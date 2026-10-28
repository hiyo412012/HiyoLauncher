# Offline mode

Offline accounts let you play Minecraft without a Microsoft login. They are
intended for:

- Offline-mode servers and LAN worlds.
- Testing and development.
- Users who already own Minecraft but want a local profile.

## How it works

An offline account uses a deterministic UUID derived from the chosen name
(`OfflinePlayer:<name>` MD5 v3) and a `legacy`/`offline` user type. No network
authentication is performed and no token is stored.

## Legal and ethical disclaimer

- HiyoLauncher does **not** ship any Minecraft game assets. Minecraft is
  downloaded from Mojang's servers on demand and requires a valid installation.
- Offline accounts must **not** be used to bypass Minecraft ownership on online
  servers. Playing on online-mode servers with an offline account is not
  supported by those servers and may violate their terms.
- You are responsible for complying with Mojang/Microsoft's End User License
  Agreement and the terms of any server you join.
- HiyoLauncher is not affiliated with Mojang Studios or Microsoft.

## Server requirements

The target server must be running in **offline mode** (`online-mode=false` in
`server.properties`) for an offline account to join. Online-mode servers will
reject the connection.