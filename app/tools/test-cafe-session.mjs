/**
 * cafeSession state-machine unit tests (R3-EVIDENCE-06)
 *
 * Run: npm test  (tools/test-cafe-session.mjs)
 *
 * The domain logic lives in TypeScript, so this script bundles it with the
 * esbuild copy that already ships with Vite, loads the result as ESM and drives
 * the reducer directly. No extra dependency, no change to the shipped bundle.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'cafe-session-test-'))
const OUT_FILE = path.join(OUT_DIR, 'cafeSession.mjs')

await esbuild.build({
  entryPoints: [path.join(ROOT, 'src', 'game', 'cafeSession.ts')],
  outfile: OUT_FILE,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const { cafeReducer, createCafeSession, computeSettlement, deriveFromEquipment, getStep } =
  await import(pathToFileURL(OUT_FILE).href)

process.on('exit', () => rmSync(OUT_DIR, { recursive: true, force: true }))

/* ---------------- helpers ---------------- */

const BASE_EQUIPMENT = { machine: 1, oven: 1, counter: 1, signboard: 1 }

function makeSession(overrides = {}) {
  return createCafeSession({
    runId: 'unit-run',
    recipeIds: ['latte', 'croissant', 'soda'],
    equipment: BASE_EQUIPMENT,
    seed: 20261015,
    petName: 'Pudding',
    relationship: { id: 'linche', name: 'Linche', value: 6 },
    ...overrides,
  })
}

/** Advance the clock in fixed steps so every assertion stays deterministic. */
function tick(state, iterations, dt = 0.5) {
  let next = state
  for (let i = 0; i < iterations; i += 1) next = cafeReducer(next, { type: 'RUN', dt })
  return next
}

function tickUntil(state, predicate, maxIterations = 400, dt = 0.5) {
  let next = state
  for (let i = 0; i < maxIterations; i += 1) {
    if (predicate(next)) return next
    next = cafeReducer(next, { type: 'RUN', dt })
  }
  return next
}

function lastMessage(state) {
  return state.messages[state.messages.length - 1]
}

function orderById(state, orderId) {
  return state.orders.find((order) => order.id === orderId)
}

/** Play one step of the current order exactly as the UI would dispatch it. */
function playCurrentStep(state, orderId) {
  const step = getStep(orderById(state, orderId))
  assert.ok(step, 'order should still have a pending step')

  if (step.kind === 'load') {
    return cafeReducer(state, {
      type: 'LOAD',
      orderId,
      material: step.material,
      station: step.station,
    })
  }
  if (step.kind === 'process') {
    const started = cafeReducer(state, { type: 'PROCESS_START', orderId })
    return cafeReducer(started, { type: 'PROCESS_DONE', orderId })
  }
  if (step.kind === 'assemble') {
    return cafeReducer(state, {
      type: 'ASSEMBLE',
      orderId,
      station: step.station,
      material: step.inputs?.[0],
    })
  }
  if (step.kind === 'choose') {
    return cafeReducer(state, { type: 'CHOOSE', orderId, optionId: step.options[0].id })
  }
  return cafeReducer(state, { type: 'PLATE', orderId })
}

/** Bring a fresh session to the point where one order is accepted and ready to craft. */
function sessionWithAcceptedOrder(recipeIds, stateOverrides = {}) {
  const spawned = tickUntil(
    { ...makeSession(recipeIds ? { recipeIds } : {}), ...stateOverrides },
    (state) => state.orders.length > 0,
  )
  assert.equal(spawned.orders.length, 1, 'first arrival should create exactly one order')
  const orderId = spawned.orders[0].id
  const accepted = cafeReducer(spawned, { type: 'ACCEPT', orderId })
  return { state: accepted, orderId }
}

function advanceToProcess(state, orderId) {
  let next = state
  for (let guard = 0; guard < 8; guard += 1) {
    const step = getStep(orderById(next, orderId))
    if (step.kind === 'process') return next
    next = playCurrentStep(next, orderId)
  }
  throw new Error('order never reached a process step')
}

function finishOrder(state, orderId) {
  let next = state
  for (let guard = 0; guard < 12; guard += 1) {
    if (orderById(next, orderId).status === 'ready') return next
    next = playCurrentStep(next, orderId)
  }
  throw new Error('order never reached the tray')
}

function imperfectProcess(state, orderId, quality) {
  const started = cafeReducer(state, { type: 'PROCESS_START', orderId })
  return cafeReducer(started, { type: 'PROCESS_IMPERFECT', orderId, quality })
}

/* ---------------- session creation ---------------- */

test('createCafeSession starts a running session with equipment-derived numbers', () => {
  const state = makeSession()

  assert.equal(state.phase, 'running')
  assert.equal(state.elapsed, 0)
  assert.equal(state.duration, 120)
  assert.equal(state.tables.length, 4)
  assert.deepEqual(state.orders, [])
  assert.deepEqual(state.tray.items, [])
  assert.equal(state.stations.machine.capacity, 1)
  assert.equal(state.tray.capacity, 1)
  assert.equal(state.servedCount, 0)
  assert.equal(state.failedCount, 0)
  assert.equal(state.coins, 0)
})

test('deriveFromEquipment unlocks parallel stations and longer shifts by level', () => {
  const levelOne = deriveFromEquipment(BASE_EQUIPMENT)
  const upgraded = deriveFromEquipment({ machine: 3, oven: 3, counter: 3, signboard: 4 })

  assert.equal(levelOne.duration, 120)
  assert.equal(levelOne.stations.machine.capacity, 1)

  assert.equal(upgraded.duration, 140)
  assert.equal(upgraded.stations.machine.capacity, 2)
  assert.equal(upgraded.stations.oven.capacity, 2)
  assert.equal(upgraded.trayCapacity, 3)
  assert.ok(upgraded.maxOrders > levelOne.maxOrders)
  assert.ok(upgraded.cleanTip > levelOne.cleanTip)
})

/* ---------------- order lifecycle ---------------- */

test('RUN spawns a customer with a pending order on a free table', () => {
  const state = tickUntil(makeSession(), (s) => s.orders.length > 0)

  assert.equal(state.customers.length, 1)
  assert.equal(state.orders[0].status, 'pending')
  assert.equal(state.tables.find((t) => t.id === state.orders[0].tableId).status, 'ordering')
})

test('ACCEPT moves the order to crafting and puts the table in waiting', () => {
  const { state, orderId } = sessionWithAcceptedOrder()
  const order = orderById(state, orderId)

  assert.equal(order.status, 'crafting')
  assert.equal(state.tables.find((t) => t.id === order.tableId).status, 'waiting')
  assert.equal(lastMessage(state).kind, 'info')
})

test('LOAD rejects a wrong material and a wrong station without advancing the step', () => {
  const { state, orderId } = sessionWithAcceptedOrder()
  const step = getStep(orderById(state, orderId))
  assert.equal(step.kind, 'load')

  const wrongMaterial = cafeReducer(state, {
    type: 'LOAD',
    orderId,
    material: step.material === 'cup' ? 'milk' : 'cup',
    station: step.station,
  })
  assert.equal(orderById(wrongMaterial, orderId).stepIndex, 0)
  assert.equal(lastMessage(wrongMaterial).kind, 'error')

  const wrongStation = cafeReducer(state, {
    type: 'LOAD',
    orderId,
    material: step.material,
    station: step.station === 'machine' ? 'oven' : 'machine',
  })
  assert.equal(orderById(wrongStation, orderId).stepIndex, 0)
  assert.equal(lastMessage(wrongStation).kind, 'error')
})

test('LOAD with the expected material and station advances exactly one step', () => {
  const { state, orderId } = sessionWithAcceptedOrder()
  const step = getStep(orderById(state, orderId))

  const next = cafeReducer(state, {
    type: 'LOAD',
    orderId,
    material: step.material,
    station: step.station,
  })

  assert.equal(orderById(next, orderId).stepIndex, 1)
  assert.equal(next.messages.length, state.messages.length, 'successful load should not add a message')
})

test('PROCESS occupies the station, finishes forward, and cancels in place', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  state = playCurrentStep(state, orderId) // load
  const step = getStep(orderById(state, orderId))
  assert.equal(step.kind, 'process')
  const stepIndexBefore = orderById(state, orderId).stepIndex

  const started = cafeReducer(state, { type: 'PROCESS_START', orderId })
  assert.equal(orderById(started, orderId).processing, true)
  assert.deepEqual(started.stations[step.station].busy, [orderId])

  const cancelled = cafeReducer(started, { type: 'PROCESS_CANCEL', orderId })
  assert.equal(orderById(cancelled, orderId).processing, false)
  assert.equal(orderById(cancelled, orderId).stepIndex, stepIndexBefore)
  assert.deepEqual(cancelled.stations[step.station].busy, [])

  const restarted = cafeReducer(cancelled, { type: 'PROCESS_START', orderId })
  const done = cafeReducer(restarted, { type: 'PROCESS_DONE', orderId })
  assert.equal(orderById(done, orderId).stepIndex, stepIndexBefore + 1)
  assert.equal(orderById(done, orderId).processing, false)
  assert.deepEqual(done.stations[step.station].busy, [])
})

test('PROCESS_IMPERFECT records under/over quality, frees the station, and keeps the step', () => {
  for (const quality of ['under', 'over']) {
    let { state, orderId } = sessionWithAcceptedOrder(['latte'])
    state = advanceToProcess(state, orderId)
    const stepIndexBefore = orderById(state, orderId).stepIndex

    const imperfect = imperfectProcess(state, orderId, quality)
    const order = orderById(imperfect, orderId)
    assert.equal(order.pendingQuality, quality)
    assert.equal(order.processing, false)
    assert.equal(order.stepIndex, stepIndexBefore)
    assert.deepEqual(imperfect.stations.machine.busy, [])
    assert.match(lastMessage(imperfect).text, quality === 'under' ? /萃取不足/ : /过萃了/)
  }
})

test('PROCESS_RETRY clears pending quality without a penalty and allows another attempt', () => {
  let { state, orderId } = sessionWithAcceptedOrder(['latte'])
  state = advanceToProcess(state, orderId)
  const stepIndex = orderById(state, orderId).stepIndex
  const retry = cafeReducer(imperfectProcess(state, orderId, 'under'), {
    type: 'PROCESS_RETRY',
    orderId,
  })

  const order = orderById(retry, orderId)
  assert.equal(order.pendingQuality, undefined)
  assert.equal(order.qualityPenalty, 0)
  assert.equal(order.stepIndex, stepIndex)
  assert.equal(order.processing, false)
  assert.equal(retry.coins, state.coins)
  assert.deepEqual(retry.stations.machine.busy, [])
  assert.equal(lastMessage(retry).kind, 'info')

  const restarted = cafeReducer(retry, { type: 'PROCESS_START', orderId })
  assert.equal(orderById(restarted, orderId).processing, true)
})

test('PROCESS_ADOPT applies the recipe penalty, advances the step, and can still be plated', () => {
  const cases = [
    ['latte', 20],
    ['croissant', 25],
    ['soda', 15],
  ]

  for (const [recipeId, expectedPenalty] of cases) {
    let { state, orderId } = sessionWithAcceptedOrder([recipeId])
    state = advanceToProcess(state, orderId)
    const stepIndexBefore = orderById(state, orderId).stepIndex
    const adopted = cafeReducer(imperfectProcess(state, orderId, 'over'), {
      type: 'PROCESS_ADOPT',
      orderId,
    })
    const order = orderById(adopted, orderId)

    assert.equal(order.pendingQuality, undefined)
    assert.equal(order.qualityPenalty, expectedPenalty)
    assert.equal(order.stepIndex, stepIndexBefore + 1)
    assert.match(lastMessage(adopted).text, new RegExp(`满意度 -${expectedPenalty}`))

    const ready = finishOrder(adopted, orderId)
    assert.equal(orderById(ready, orderId).status, 'ready')
    assert.ok(ready.tray.items.includes(orderId))
  }
})

test('an adopted imperfection lowers final satisfaction and reports the exact penalty', () => {
  function readySession(adoptImperfection) {
    let { state, orderId } = sessionWithAcceptedOrder(['latte'], {
      customerWeights: {
        officeWorker: 1000,
        tourist: 0,
        catLover: 0,
        regular: 0,
      },
    })
    state = advanceToProcess(state, orderId)
    if (adoptImperfection) {
      state = cafeReducer(imperfectProcess(state, orderId, 'under'), {
        type: 'PROCESS_ADOPT',
        orderId,
      })
    } else {
      state = cafeReducer(state, { type: 'PROCESS_START', orderId })
      state = cafeReducer(state, { type: 'PROCESS_DONE', orderId })
    }
    return { state: finishOrder(state, orderId), orderId }
  }

  const clean = readySession(false)
  const flawed = readySession(true)
  const cleanServed = cafeReducer(clean.state, {
    type: 'SERVE',
    orderId: clean.orderId,
    tableId: orderById(clean.state, clean.orderId).tableId,
  })
  const flawedServed = cafeReducer(flawed.state, {
    type: 'SERVE',
    orderId: flawed.orderId,
    tableId: orderById(flawed.state, flawed.orderId).tableId,
  })

  assert.ok(
    orderById(flawedServed, flawed.orderId).satisfaction <
      orderById(cleanServed, clean.orderId).satisfaction,
  )
  assert.match(lastMessage(flawedServed).text, /操作瑕疵 -20/)
})

test('ASSEMBLE rejects the wrong station and accepts the listed inputs', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  for (let guard = 0; guard < 8; guard += 1) {
    const step = getStep(orderById(state, orderId))
    if (step.kind === 'assemble') break
    state = playCurrentStep(state, orderId)
  }
  const step = getStep(orderById(state, orderId))
  assert.equal(step.kind, 'assemble')
  const stepIndexBefore = orderById(state, orderId).stepIndex

  const wrongStation = cafeReducer(state, {
    type: 'ASSEMBLE',
    orderId,
    station: step.station === 'assembly' ? 'machine' : 'assembly',
  })
  assert.equal(orderById(wrongStation, orderId).stepIndex, stepIndexBefore)
  assert.equal(lastMessage(wrongStation).kind, 'error')

  const wrongInput = cafeReducer(state, {
    type: 'ASSEMBLE',
    orderId,
    station: step.station,
    material: 'butter',
  })
  assert.equal(orderById(wrongInput, orderId).stepIndex, stepIndexBefore)
  assert.equal(lastMessage(wrongInput).kind, 'error')

  const ok = cafeReducer(state, {
    type: 'ASSEMBLE',
    orderId,
    station: step.station,
    material: step.inputs[0],
  })
  assert.equal(orderById(ok, orderId).stepIndex, stepIndexBefore + 1)
})

test('CHOOSE records the option and only marks preference when the option matches', () => {
  const session = makeSession({ recipeIds: ['croissant'] })
  let state = tickUntil(session, (s) => s.orders.length > 0)
  const orderId = state.orders[0].id
  assert.equal(state.orders[0].recipeId, 'croissant')
  state = cafeReducer(state, { type: 'ACCEPT', orderId })
  for (let guard = 0; guard < 8; guard += 1) {
    const step = getStep(orderById(state, orderId))
    if (step.kind === 'choose') break
    state = playCurrentStep(state, orderId)
  }

  const step = getStep(orderById(state, orderId))
  assert.equal(step.kind, 'choose')
  const matched = step.options.find((option) => option.matchesPreference)
  const plain = step.options.find((option) => !option.matchesPreference)

  const plainNext = cafeReducer(state, { type: 'CHOOSE', orderId, optionId: plain.id })
  assert.equal(orderById(plainNext, orderId).preferenceMatched, false)
  assert.equal(orderById(plainNext, orderId).selectedOptionId, plain.id)

  const matchedNext = cafeReducer(state, { type: 'CHOOSE', orderId, optionId: matched.id })
  assert.equal(orderById(matchedNext, orderId).preferenceMatched, true)
})

test('PLATE puts a finished order on the tray and SERVE accepts its own table', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  for (let guard = 0; guard < 10; guard += 1) {
    if (orderById(state, orderId).status === 'ready') break
    state = playCurrentStep(state, orderId)
  }
  const order = orderById(state, orderId)

  assert.equal(order.status, 'ready')
  assert.ok(state.tray.items.includes(orderId))

  const served = cafeReducer(state, { type: 'SERVE', orderId, tableId: order.tableId })
  assert.equal(orderById(served, orderId).status, 'served')
  assert.equal(served.servedCount, 1)
  assert.equal(served.coins, order.baseCoins)
  assert.equal(served.exp, order.baseExp)
  assert.equal(served.tray.items.length, 0)
  assert.equal(served.tables.find((table) => table.id === order.tableId).status, 'served')
})

test('SERVE to the wrong table opens a three-second recovery window and keeps the tray item', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  state = finishOrder(state, orderId)
  const order = orderById(state, orderId)
  const wrongTable = state.tables.find((table) => table.id !== order.tableId).id

  const misplaced = cafeReducer(state, { type: 'SERVE', orderId, tableId: wrongTable })
  const misplacedOrder = orderById(misplaced, orderId)
  assert.equal(misplacedOrder.status, 'ready')
  assert.equal(misplacedOrder.misplacedTableId, wrongTable)
  assert.equal(misplacedOrder.misplacedUntil, state.elapsed + 3)
  assert.ok(misplaced.tray.items.includes(orderId))
  assert.equal(misplaced.servedCount, 0)
  assert.match(lastMessage(misplaced).text, /3 秒内取回/)
})

test('RECOVER_MISPLACED clears the wrong-table state without a penalty', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  state = finishOrder(state, orderId)
  const order = orderById(state, orderId)
  const wrongTable = state.tables.find((table) => table.id !== order.tableId).id
  const misplaced = cafeReducer(state, { type: 'SERVE', orderId, tableId: wrongTable })
  const recovered = cafeReducer(misplaced, { type: 'RECOVER_MISPLACED', orderId })
  const recoveredOrder = orderById(recovered, orderId)

  assert.equal(recoveredOrder.misplacedTableId, undefined)
  assert.equal(recoveredOrder.misplacedUntil, undefined)
  assert.equal(recoveredOrder.wrongTablePenalty, 0)
  assert.ok(recovered.tray.items.includes(orderId))
  assert.match(lastMessage(recovered).text, /没有扣分/)
})

test('an expired wrong-table window keeps the tray item, adds -30, and reports it on delivery', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  state = finishOrder(state, orderId)
  const order = orderById(state, orderId)
  const wrongTable = state.tables.find((table) => table.id !== order.tableId).id
  const misplaced = cafeReducer(state, { type: 'SERVE', orderId, tableId: wrongTable })
  const expired = tick(misplaced, 7, 0.5)
  const penalizedOrder = orderById(expired, orderId)

  assert.equal(penalizedOrder.misplacedTableId, undefined)
  assert.equal(penalizedOrder.wrongTablePenalty, 30)
  assert.ok(expired.tray.items.includes(orderId))
  assert.match(lastMessage(expired).text, /满意度 -30/)

  const served = cafeReducer(expired, { type: 'SERVE', orderId, tableId: penalizedOrder.tableId })
  assert.equal(orderById(served, orderId).status, 'served')
  assert.equal(served.tray.items.length, 0)
  assert.match(lastMessage(served).text, /上错桌 -30/)
})

test('CLEAN returns a table to empty and pays the cleaning tip', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  for (let guard = 0; guard < 10; guard += 1) {
    if (orderById(state, orderId).status === 'ready') break
    state = playCurrentStep(state, orderId)
  }
  const tableId = orderById(state, orderId).tableId
  state = cafeReducer(state, { type: 'SERVE', orderId, tableId })

  const cleaned = cafeReducer(state, { type: 'CLEAN', tableId })
  const table = cleaned.tables.find((item) => item.id === tableId)
  assert.equal(table.status, 'empty')
  assert.equal(table.hasEmptyCup, false)
  assert.equal(cleaned.tips, state.tips + state.cleanTip)
})

/* ---------------- clock, settlement, ending ---------------- */

test('RUN pauses on demand and stops entirely once settled', () => {
  const paused = cafeReducer(makeSession(), { type: 'PAUSE', paused: true })
  assert.equal(tick(paused, 20).elapsed, 0)
  assert.equal(cafeReducer(paused, { type: 'RUN', dt: 5 }).elapsed, 0)

  const resumed = cafeReducer(paused, { type: 'PAUSE', paused: false })
  assert.equal(tick(resumed, 20).elapsed, 10)

  const settled = cafeReducer(resumed, { type: 'CLOSE' })
  assert.equal(settled.phase, 'settled')
  assert.equal(tick(settled, 20).elapsed, resumed.elapsed)
})

test('CLOSE is idempotent and computeSettlement summarises the run', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  for (let guard = 0; guard < 10; guard += 1) {
    if (orderById(state, orderId).status === 'ready') break
    state = playCurrentStep(state, orderId)
  }
  const order = orderById(state, orderId)
  state = cafeReducer(state, { type: 'SERVE', orderId, tableId: order.tableId })

  const settled = cafeReducer(state, { type: 'CLOSE' })
  const settledAgain = cafeReducer(settled, { type: 'SETTLE' })
  assert.equal(settledAgain, settled, 'settling twice must not change the state')

  const summary = computeSettlement(settled)
  assert.equal(summary.runId, settled.runId)
  assert.equal(summary.served, 1)
  assert.equal(summary.failed, 0)
  assert.equal(summary.coins, order.baseCoins)
  assert.equal(summary.exp, order.baseExp)
  assert.ok(summary.rating >= 1 && summary.rating <= 5)
})

test('ignored customers eventually fail their order without draining coins', () => {
  const waited = tickUntil(makeSession(), (state) => state.failedCount > 0, 500, 1)

  assert.ok(waited.failedCount >= 1, 'patience should expire when nothing is served')
  assert.ok(waited.orders.some((order) => order.status === 'failed'))
  assert.equal(waited.coins, 0)
  assert.equal(waited.servedCount, 0)
})

test('a served run reports server-authored rewards for the save layer', () => {
  let { state, orderId } = sessionWithAcceptedOrder()
  for (let guard = 0; guard < 10; guard += 1) {
    if (orderById(state, orderId).status === 'ready') break
    state = playCurrentStep(state, orderId)
  }
  const order = orderById(state, orderId)
  const served = cafeReducer(state, { type: 'SERVE', orderId, tableId: order.tableId })
  const summary = computeSettlement(cafeReducer(served, { type: 'CLOSE' }))

  assert.equal(summary.served, 1)
  assert.equal(summary.coins + summary.tips, order.baseCoins + served.tips)
  assert.ok(summary.tips >= 0)
})
