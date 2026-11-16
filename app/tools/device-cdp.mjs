/**
 * 真机 CDP 小工具（开发工具，不参与打包）
 *
 * 默认连接已通过 adb forward 暴露的调试端口，并只操作指定 target：
 *   node tools/device-cdp.mjs eval E0E875... "document.title"
 *   node tools/device-cdp.mjs backup ../local-storage-backup.json E0E875...
 *   node tools/device-cdp.mjs restore ../local-storage-backup.json E0E875...
 *
 * 这样测试真机时不会误改其它隐藏标签页的存档。
 */
import fs from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'

const DEBUG_HOST = process.env.CDP_HOST ?? '127.0.0.1'
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9222)

function usage() {
  console.error(
    [
      '用法:',
      '  node tools/device-cdp.mjs targets',
      '  node tools/device-cdp.mjs eval <targetId> <expression>',
      '  node tools/device-cdp.mjs backup <outputFile> <targetId>',
      '  node tools/device-cdp.mjs restore <backupFile> <targetId>',
      '  node tools/device-cdp.mjs reload <targetId>',
    ].join('\n'),
  )
  process.exitCode = 2
}

async function listTargets() {
  const response = await fetch(`http://${DEBUG_HOST}:${DEBUG_PORT}/json/list`)
  if (!response.ok) throw new Error(`调试端口返回 ${response.status}`)
  return response.json()
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()

    ws.on('message', (data) => {
      const message = JSON.parse(String(data))
      if (!message.id || !pending.has(message.id)) return
      const { resolve: finish, reject: fail, timer } = pending.get(message.id)
      pending.delete(message.id)
      clearTimeout(timer)
      if (message.error) fail(new Error(JSON.stringify(message.error)))
      else finish(message.result)
    })

    ws.once('error', reject)
    ws.once('open', () => {
      resolve({
        send(method, params = {}, timeoutMs = 30_000) {
          const requestId = ++id
          return new Promise((finish, fail) => {
            const timer = setTimeout(() => {
              pending.delete(requestId)
              fail(new Error(`${method} 超时`))
            }, timeoutMs)
            pending.set(requestId, { resolve: finish, reject: fail, timer })
            ws.send(JSON.stringify({ id: requestId, method, params }))
          })
        },
        close() {
          ws.close()
        },
      })
    })
  })
}

async function findTarget(targetId) {
  const targets = await listTargets()
  const target = targets.find((item) => item.id === targetId)
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`没有找到 target ${targetId}`)
  }
  return target
}

async function openTarget(targetId) {
  const target = await findTarget(targetId)
  const client = await connect(target.webSocketDebuggerUrl)
  await client.send('Runtime.enable')
  return { client, target }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? '页面脚本执行失败')
  }
  return result.result?.value
}

async function backup(client, outputFile) {
  const storage = await evaluate(
    client,
    `JSON.stringify(Object.fromEntries(
      Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])
    ))`,
  )
  const absolute = path.resolve(outputFile)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  fs.writeFileSync(absolute, storage)
  console.log(`已备份 ${Object.keys(JSON.parse(storage)).length} 项到 ${absolute}`)
}

async function restore(client, backupFile) {
  const absolute = path.resolve(backupFile)
  const storage = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  const expression = `(() => {
    localStorage.clear()
    const entries = ${JSON.stringify(storage)}
    Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, value))
    return Object.keys(entries).length
  })()`
  const count = await evaluate(client, expression)
  console.log(`已从 ${absolute} 恢复 ${count} 项`)
}

async function main() {
  const [command, first, second] = process.argv.slice(2)
  if (!command) return usage()

  if (command === 'targets') {
    const targets = await listTargets()
    for (const target of targets) {
      console.log(
        [
          target.id,
          target.type,
          target.url,
          target.description || '',
        ].join('\t'),
      )
    }
    return
  }

  if (command === 'reload') {
    const { client } = await openTarget(first)
    await client.send('Page.reload', { ignoreCache: true })
    client.close()
    return
  }

  const targetId = command === 'eval' ? first : second
  const value = command === 'eval' ? second : first
  if (!targetId || !value) return usage()

  const { client } = await openTarget(targetId)
  try {
    if (command === 'eval') {
      const result = await evaluate(client, value)
      if (typeof result === 'string') console.log(result)
      else console.log(JSON.stringify(result, null, 2))
    } else if (command === 'backup') {
      await backup(client, value)
    } else if (command === 'restore') {
      await restore(client, value)
    } else {
      usage()
    }
  } finally {
    client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
