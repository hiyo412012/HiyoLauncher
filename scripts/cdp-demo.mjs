// Dev-only: seed a clean demo profile for README screenshots.
const cover = (a, b, c) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/><stop offset="55%" stop-color="${b}"/><stop offset="100%" stop-color="${c}"/>
    </linearGradient>
    <radialGradient id="h" cx="18%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="420" fill="url(#g)"/>
  <rect width="1200" height="420" fill="url(#h)"/>
  <path d="M0 300 C160 250 260 330 430 300 C610 268 730 340 900 300 C1040 268 1130 300 1200 285 L1200 420 L0 420 Z" fill="#ffffff" opacity="0.10"/>
  <path d="M0 340 C180 300 300 370 470 340 C650 308 780 372 960 340 C1080 318 1140 340 1200 330 L1200 420 L0 420 Z" fill="#000000" opacity="0.18"/>
  <circle cx="1000" cy="90" r="46" fill="#ffffff" opacity="0.18"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
}

const covers = {
  forge: cover('#2a1a3e', '#7a3b5e', '#f0a36b'),
  survival: cover('#062b3a', '#0c6b7a', '#7fe3d4'),
  fabric: cover('#071a22', '#12627a', '#6fd6e4'),
}

const expr = `(async () => {
  const api = window.hiyo;
  await api.settings.update({ onboardingDone: true, language: 'en', theme: 'ocean', mode: 'dark' });
  let instances = await api.instances.list();
  if (!instances.length) {
    await api.instances.create({ name: 'Forge Adventure', mcVersion: '1.20.1', loader: 'forge', loaderVersion: '47.4.28' });
    await api.instances.create({ name: 'Survival 1.21', mcVersion: '1.21.1', loader: 'vanilla' });
    await api.instances.create({ name: 'Fabric Performance', mcVersion: '1.21.1', loader: 'fabric', loaderVersion: '0.20.1' });
    instances = await api.instances.list();
  }
  const byName = Object.fromEntries(instances.map((i) => [i.name, i]));
  const now = Date.now();
  const patches = {
    'Forge Adventure': { memoryMb: 4096, playTimeMs: 1000 * 60 * 60 * 87, lastPlayedAt: now - 1000 * 60 * 60 * 30, cover: ${JSON.stringify(covers.forge)} },
    'Survival 1.21': { memoryMb: 4096, playTimeMs: 1000 * 60 * 60 * 142, lastPlayedAt: now - 1000 * 60 * 60 * 5, cover: ${JSON.stringify(covers.survival)} },
    'Fabric Performance': { memoryMb: 6144, playTimeMs: 1000 * 60 * 60 * 64, lastPlayedAt: now - 1000 * 60 * 45, cover: ${JSON.stringify(covers.fabric)} },
  };
  for (const [name, patch] of Object.entries(patches)) {
    if (byName[name]) await api.instances.update(byName[name].id, patch);
  }
  let accounts = await api.accounts.list();
  if (!accounts.length) {
    await api.accounts.addOffline('Steve');
    accounts = await api.accounts.list();
  }
  const servers = await api.servers.list();
  if (!servers.some((s) => s.ip === 'mc.hypixel.net')) {
    await api.servers.add({ name: 'Hypixel', ip: 'mc.hypixel.net' });
  }
  return { instances: await api.instances.list(), accounts: await api.accounts.list() };
})()`

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
if (!page) throw new Error('No Electron page target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})
const id = 1
const result = await new Promise((resolve) => {
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id === id) resolve(msg)
  }
  ws.send(
    JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true },
    }),
  )
})
console.log(JSON.stringify(result.result?.result?.value ?? result.result?.exceptionDetails ?? result, null, 2))
ws.close()
