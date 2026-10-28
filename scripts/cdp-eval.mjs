// Dev-only: evaluate an async expression inside the running Electron renderer.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const expression = process.argv.slice(2).join(' ')
if (!expression) {
  console.error('usage: node scripts/cdp-eval.mjs "<js expression>"')
  process.exit(1)
}

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
if (!page) throw new Error('No Electron page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

let id = 1
const pending = new Map()
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}

const result = await new Promise((resolve) => {
  pending.set(id, resolve)
  ws.send(
    JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: {
        expression: `(async () => { return (${expression}) })()`,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
    }),
  )
})

console.log(JSON.stringify(result.result?.result?.value ?? result.result?.exceptionDetails ?? result, null, 2))
ws.close()
const out = path.join(os.tmpdir(), 'hiyo-cdp-eval.txt')
fs.writeFileSync(out, JSON.stringify(result, null, 2))
