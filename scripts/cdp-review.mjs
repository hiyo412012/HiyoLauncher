// Dev-only CDP review helper: drives the running Electron window, captures screenshots and errors.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PORT = process.env.CDP_PORT ?? '9222'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(os.tmpdir(), 'hiyo-review')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
      if (page) return page
    } catch {}
    await sleep(500)
  }
  throw new Error('Could not find Electron page target')
}

const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

let nextId = 1
const pending = new Map()
const exceptions = []
const consoleErrors = []
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(msg.params?.exceptionDetails?.exception?.description ?? msg.params?.exceptionDetails?.text)
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
    consoleErrors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' '))
  }
}

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression, awaitPromise = false) {
  const source = awaitPromise ? `(async () => { return (${expression}) })()` : expression
  const result = await send('Runtime.evaluate', {
    expression: source,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }
  return result.result?.value
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  const file = path.join(OUT, `${name}.png`)
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'))
  return file
}

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
})

const report = { steps: [], exceptions, consoleErrors }

async function setup() {
  const info = await evaluate('window.hiyo ? await window.hiyo.app.info() : null', true)
  report.info = info
  if (!info) throw new Error('window.hiyo missing')
  await evaluate('await window.hiyo.settings.update({ onboardingDone: true, language: "en" })', true)
  const instances = await evaluate('await window.hiyo.instances.list()', true)
  if (!instances.length) {
    await evaluate(
      `await window.hiyo.instances.create({ name: "Demo Instance", mcVersion: "1.21.1", loader: "fabric" })`,
      true,
    )
  }
  const accounts = await evaluate('await window.hiyo.accounts.list()', true)
  if (!accounts.length) {
    await evaluate('await window.hiyo.accounts.addOffline("HiyoPlayer")', true)
  }
  report.instances = await evaluate('await window.hiyo.instances.list()', true)
  report.accounts = await evaluate('await window.hiyo.accounts.list()', true)
}

async function visit(name, hash, extraWait = 900) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await sleep(extraWait)
  const text = await evaluate('document.body.innerText.slice(0, 4000)')
  const file = await screenshot(name)
  report.steps.push({ name, hash, file, text })
}

try {
  await setup()
  await visit('01-home', '#/')
  await visit('02-instances', '#/instances')
  const id = report.instances?.[0]?.id
  if (id) await visit('03-instance-detail', `#/instances/${id}`)
  await visit('04-browse', '#/browse', 1800)
  await visit('05-modpacks', '#/modpacks', 1800)
  await visit('06-skins', '#/skins', 1200)
  await visit('07-servers', '#/servers', 2600)
  await visit('08-logs', '#/logs')
  await visit('09-settings', '#/settings', 1200)
  await visit('10-onboarding', '#/onboarding')
  console.log(JSON.stringify(report, null, 2))
} catch (e) {
  report.fatal = String(e?.stack ?? e)
  console.log(JSON.stringify(report, null, 2))
} finally {
  try {
    ws.close()
  } catch {}
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`OUTPUT_DIR=${OUT}`)
}
