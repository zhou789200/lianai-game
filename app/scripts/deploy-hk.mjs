#!/usr/bin/env node
/**
 * 海风镇 · 香港节点一键发布
 *
 * 本地：test → lint → build → 打包 → SHA256
 * 远端：校验包 → 备份 → 解压 → 依赖检查 → 切换 → 重启 → 健康检查
 * 最后：从本机验证 https://zljgg.xyz/ 的入口和新 bundle 指纹
 *
 * 用法：
 *   npm run deploy:hk
 *   npm run deploy:hk -- --skip-tests
 *   npm run deploy:hk -- --package-only
 *   npm run deploy:hk -- --rollback [备份时间戳]
 *   npm run deploy:hk -- --print-key
 *   npm run deploy:hk -- --dry-run
 *
 * 环境变量（一般不用改）：
 *   SEABREEZE_HOST=47.242.226.94
 *   SEABREEZE_USER=root
 *   SEABREEZE_DIR=/opt/seabreeze
 *   SEABREEZE_DOMAIN=zljgg.xyz
 *   SEABREEZE_SSH_KEY=~/.ssh/seabreeze_hk_deploy
 */
import { spawnSync } from 'node:child_process'
import { createHash, generateKeyPairSync } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..')
const WORK_ROOT = path.join(REPO_ROOT, 'work')
const RELEASES_ROOT = path.join(WORK_ROOT, 'releases')

const HOST = process.env.SEABREEZE_HOST ?? '47.242.226.94'
const USER = process.env.SEABREEZE_USER ?? 'root'
const REMOTE_DIR = process.env.SEABREEZE_DIR ?? '/opt/seabreeze'
const DOMAIN = process.env.SEABREEZE_DOMAIN ?? 'zljgg.xyz'
/**
 * Windows 上必须优先用 USERPROFILE。
 * 从 Git Bash / WSL 启动时 os.homedir() 可能返回 Linux 的 /root，
 * 会让部署密钥写到错误位置。
 */
const WINDOWS_HOME =
  process.platform === 'win32' ? process.env.USERPROFILE?.trim() : ''
const HOME = WINDOWS_HOME || os.homedir()
const KEY = expandHome(
  process.env.SEABREEZE_SSH_KEY ?? path.join(HOME, '.ssh', 'seabreeze_hk_deploy'),
)
const BACKUP_DIR = process.env.SEABREEZE_BACKUP_DIR ?? '/opt/seabreeze-backups'
const KEEP_BACKUPS = Number(process.env.SEABREEZE_KEEP_BACKUPS ?? 6)

const argv = process.argv.slice(2)
const has = (name) => argv.includes(name)
const valueAfter = (name, fallback = '') => {
  const index = argv.indexOf(name)
  if (index < 0) return fallback
  const next = argv[index + 1]
  return next && !next.startsWith('--') ? next : fallback
}

const OPTIONS = {
  help: has('--help') || has('-h'),
  printKey: has('--print-key'),
  checkKey: has('--check-key'),
  packageOnly: has('--package-only'),
  skipTests: has('--skip-tests') || has('--fast'),
  skipBuild: has('--skip-build'),
  noVerify: has('--no-verify'),
  dryRun: has('--dry-run'),
  rollback: has('--rollback'),
  rollbackStamp: valueAfter('--rollback'),
}

const TAR = process.platform === 'win32' ? 'tar.exe' : 'tar'
const SSH_OPTS = [
  '-i',
  KEY,
  '-o',
  'IdentitiesOnly=yes',
  '-o',
  'BatchMode=yes',
  '-o',
  'StrictHostKeyChecking=accept-new',
  '-o',
  'ConnectTimeout=20',
  '-o',
  'ConnectionAttempts=1',
  '-o',
  'TCPKeepAlive=yes',
  '-o',
  'ServerAliveInterval=15',
  '-o',
  'ServerAliveCountMax=4',
]
const TARGET = `${USER}@${HOST}`
const SSH_ATTEMPTS = 3

function expandHome(value) {
  if (value === '~') return HOME
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(HOME, value.slice(2))
  }
  return value
}

function log(message = '') {
  console.log(message)
}

function step(index, total, title) {
  log(`\n[${index}/${total}] ${title}`)
}

function fail(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? APP_ROOT,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: options.shell ?? false,
    timeout: options.timeout,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`${command} ${args.join(' ')} 退出码 ${result.status}${detail ? `\n${detail}` : ''}`)
  }
  return result
}

function runNpm(args, options = {}) {
  if (process.platform === 'win32') {
    return run(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', `npm ${args.join(' ')}`],
      options,
    )
  }
  return run('npm', args, options)
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: options.shell ?? false,
  })
  if (result.error) throw result.error
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    status: result.status,
  }
}

function git(args) {
  const result = capture('git', args, { cwd: REPO_ROOT })
  return result.ok ? result.stdout : ''
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function makeStamp() {
  const now = new Date()
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function makePublicKey() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 3072 })
  const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' })
  const jwk = publicKey.export({ format: 'jwk' })

  const sshString = (value) => {
    const body = Buffer.isBuffer(value) ? value : Buffer.from(value)
    const length = Buffer.alloc(4)
    length.writeUInt32BE(body.length)
    return Buffer.concat([length, body])
  }
  const sshMpint = (value) => {
    let body = value
    let index = 0
    while (index < body.length && body[index] === 0) index += 1
    body = body.subarray(index)
    if (body.length === 0) body = Buffer.from([0])
    if (body[0] & 0x80) body = Buffer.concat([Buffer.from([0]), body])
    return sshString(body)
  }

  const blob = Buffer.concat([
    sshString('ssh-rsa'),
    sshMpint(Buffer.from(jwk.e, 'base64url')),
    sshMpint(Buffer.from(jwk.n, 'base64url')),
  ])
  mkdirSync(path.dirname(KEY), { recursive: true })
  writeFileSync(KEY, privatePem, { mode: 0o600 })
  writeFileSync(`${KEY}.pub`, `ssh-rsa ${blob.toString('base64')} seabreeze-hk-deploy\n`)
  return readFileSync(`${KEY}.pub`, 'utf8').trim()
}

function printKey() {
  if (!existsSync(`${KEY}.pub`)) {
    if (existsSync(KEY)) {
      fail(`找到了私钥 ${KEY}，但缺少公钥 ${KEY}.pub。请重新生成或从私钥导出公钥。`)
    }
    makePublicKey()
    log(`已生成新的 RSA 部署密钥：${KEY}`)
  }
  const pub = readFileSync(`${KEY}.pub`, 'utf8').trim()
  log('\n把下面这一整行追加到服务器 /root/.ssh/authorized_keys：\n')
  log(pub)
  log(`\n本机私钥：${KEY}`)
  log('安装后运行：npm run deploy:hk -- --check-key')
}

function ensureKey() {
  if (!existsSync(KEY)) {
    log(`未找到部署私钥：${KEY}`)
    printKey()
    fail('请先把公钥安装到服务器，再重新运行发布脚本。')
  }
  if (!existsSync(`${KEY}.pub`)) {
    fail(`缺少公钥 ${KEY}.pub。请重新生成部署密钥。`)
  }
  try {
    const stat = statSync(KEY)
    if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
      fail(`私钥权限过宽：${KEY}。请执行 chmod 600 ${KEY}`)
    }
  } catch {
    /* Windows ACL 由系统管理，忽略 */
  }
}

function sshFailureHint(detail) {
  if (/Connection timed out|Connection reset|kex_exchange_identification|banner exchange/i.test(detail)) {
    return (
      '服务器可访问，但 SSH 在密钥交换阶段超时或被重置。\n' +
      '这通常是云防火墙/SSH 服务瞬时限流，或服务器内存紧张导致 sshd 无法及时响应；' +
      '网站 HTTPS 仍可能正常。请稍后重试，或到云控制台检查实例负载与安全组。'
    )
  }
  if (/Permission denied|publickey/i.test(detail)) {
    return (
      'SSH 认证失败。请确认公钥已加入服务器 /root/.ssh/authorized_keys，' +
      '私钥路径正确，并检查 authorized_keys 权限。\n' +
      '查看本机公钥：npm run deploy:hk -- --print-key'
    )
  }
  if (/Could not resolve|Name or service not known/i.test(detail)) {
    return '无法解析服务器地址，请检查网络与 SEABREEZE_HOST。'
  }
  return (
    '请检查：1) 服务器 22 端口是否可连；2) 公钥是否正确安装；' +
    '3) 本机网络是否限制了 SSH。\n查看本机公钥：npm run deploy:hk -- --print-key'
  )
}

function checkSsh() {
  let detail = ''
  for (let attempt = 1; attempt <= SSH_ATTEMPTS; attempt += 1) {
    const result = spawnSync('ssh', [...SSH_OPTS, TARGET, 'echo __SEABREEZE_OK__'], {
      encoding: 'utf8',
      timeout: 45_000,
    })
    if (result.status === 0 && (result.stdout ?? '').includes('__SEABREEZE_OK__')) {
      log(`✓ SSH 免密登录正常：${TARGET}`)
      return
    }
    detail = [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join('\n')
      .trim()
    if (attempt < SSH_ATTEMPTS) {
      log(`  SSH 第 ${attempt} 次连接失败，3 秒后重试…`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
    }
  }
  fail(`SSH 登录失败：${TARGET}\n${detail}\n\n${sshFailureHint(detail)}`)
}

function remoteScript(body, { captureOutput = true } = {}) {
  if (OPTIONS.dryRun) {
    log('\n--- 远端脚本（dry-run，不执行）---')
    log(body)
    log('--- end ---\n')
    return { stdout: '', stderr: '', status: 0 }
  }
  const result = spawnSync('ssh', [...SSH_OPTS, TARGET, 'sh -s'], {
    input: body,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (captureOutput) {
    if (result.stdout) log(result.stdout.trimEnd())
    if (result.stderr) console.error(result.stderr.trimEnd())
  }
  return result
}

function remoteScriptText(stamp, digest) {
  return `set -eu

STAMP=${shQuote(stamp)}
EXPECTED_SHA=${shQuote(digest)}
REMOTE_DIR=${shQuote(REMOTE_DIR)}
BACKUP_ROOT=${shQuote(BACKUP_DIR)}
DOMAIN=${shQuote(DOMAIN)}
KEEP=${Number.isFinite(KEEP_BACKUPS) ? KEEP_BACKUPS : 6}
ARCHIVE="/tmp/seabreeze-$STAMP.tar.gz"
INCOMING="$REMOTE_DIR/.incoming-$STAMP"
BACKUP="$BACKUP_ROOT/$STAMP"

echo "==> 校验上传包"
cd "$REMOTE_DIR"
ACTUAL_SHA=$(sha256sum "$ARCHIVE" | cut -d' ' -f1)
echo "sha256=$ACTUAL_SHA"
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "!! 上传包 SHA256 不匹配，拒绝部署"
  exit 1
fi

echo "==> 备份当前版本到 $BACKUP"
mkdir -p "$BACKUP"
for item in dist server shared; do
  if [ -d "$REMOTE_DIR/$item" ]; then cp -a "$REMOTE_DIR/$item" "$BACKUP/"; fi
done
for item in package.json package-lock.json .env.local; do
  if [ -f "$REMOTE_DIR/$item" ]; then cp -a "$REMOTE_DIR/$item" "$BACKUP/"; fi
done

echo "==> 解压新版本"
rm -rf "$INCOMING"
mkdir -p "$INCOMING"
tar -xzf "$ARCHIVE" -C "$INCOMING"
test -f "$INCOMING/dist/index.html"
test -f "$INCOMING/server/serve.mjs"

echo "==> 依赖检查"
NEW_LOCK=$(sha256sum "$INCOMING/package-lock.json" | cut -d' ' -f1)
CURRENT_LOCK=$(sha256sum "$REMOTE_DIR/package-lock.json" | cut -d' ' -f1)
INSTALLED_LOCK=$(cat "$REMOTE_DIR/.package-lock.sha256" 2>/dev/null || echo "$CURRENT_LOCK")
DEPS_CHANGED=0
if [ ! -d "$REMOTE_DIR/node_modules/msedge-tts" ] || [ "$NEW_LOCK" != "$INSTALLED_LOCK" ]; then
  DEPS_CHANGED=1
  DEPS="$REMOTE_DIR/.deps-$STAMP"
  echo "依赖有变化，在临时目录安装生产依赖（可能需要 1-3 分钟）..."
  rm -rf "$DEPS"
  mkdir -p "$DEPS"
  cp "$INCOMING/package.json" "$INCOMING/package-lock.json" "$DEPS/"
  (cd "$DEPS" && npm ci --omit=dev --registry=https://registry.npmmirror.com --no-audit --no-fund)
  rm -rf "$REMOTE_DIR/node_modules.previous"
  if [ -d "$REMOTE_DIR/node_modules" ]; then
    mv "$REMOTE_DIR/node_modules" "$REMOTE_DIR/node_modules.previous"
  fi
  mv "$DEPS/node_modules" "$REMOTE_DIR/node_modules"
  rm -rf "$DEPS"
  echo "$NEW_LOCK" > "$REMOTE_DIR/.package-lock.sha256"
else
  echo "依赖未变化，跳过 npm ci"
fi

echo "==> 切换版本"
cd "$REMOTE_DIR"
if [ -f .deployed-stamp ]; then cp .deployed-stamp .previous-stamp; fi
rm -rf dist.old server.old shared.old
for item in dist server shared; do
  if [ -d "$item" ]; then mv "$item" "$item.old"; fi
done
mv "$INCOMING/dist" dist
mv "$INCOMING/server" server
mv "$INCOMING/shared" shared
cp "$INCOMING/package.json" package.json
cp "$INCOMING/package-lock.json" package-lock.json
echo "$STAMP" > .deployed-stamp

echo "==> 重启服务"
rc-service seabreeze restart

ok=0
i=0
while [ "$i" -lt 40 ]; do
  if curl -fsS -o /dev/null "http://127.0.0.1:4173/" 2>/dev/null; then ok=1; break; fi
  i=$((i + 1))
  sleep 0.5
done

if [ "$ok" != 1 ]; then
  echo "!! 新版本未在 20 秒内恢复，开始回滚"
  rm -rf dist server shared
  for item in dist server shared; do
    if [ -d "$BACKUP/$item" ]; then cp -a "$BACKUP/$item" "$REMOTE_DIR/"; fi
  done
  for item in package.json package-lock.json; do
    if [ -f "$BACKUP/$item" ]; then cp -a "$BACKUP/$item" "$REMOTE_DIR/"; fi
  done
  if [ "$DEPS_CHANGED" = 1 ] && [ -d "$REMOTE_DIR/node_modules.previous" ]; then
    rm -rf "$REMOTE_DIR/node_modules"
    mv "$REMOTE_DIR/node_modules.previous" "$REMOTE_DIR/node_modules"
  fi
  rc-service seabreeze restart || true
  echo "!! 已回滚到备份 $BACKUP"
  exit 1
fi

BUNDLE=$(curl -fsS -H "Host: $DOMAIN" -k "https://127.0.0.1/?deploy=$STAMP" 2>/dev/null | grep -o 'assets/index-[^" ]*\\.js' | head -1 || true)
echo "bundle=\${BUNDLE:-unknown}"
echo "deployed=$STAMP"
echo "backup=$BACKUP"

rm -rf "$INCOMING" dist.old server.old shared.old "$ARCHIVE"
rm -rf "$REMOTE_DIR/node_modules.previous"

echo "==> 清理旧备份（保留最近 $KEEP 个）"
if [ -d "$BACKUP_ROOT" ]; then
  ls -1dt "$BACKUP_ROOT"/* 2>/dev/null | tail -n +$((KEEP + 1)) | while IFS= read -r old; do
    [ -n "$old" ] && rm -rf "$old"
  done
fi

echo "REMOTE_OK"
`
}

function rollbackScript(stamp) {
  return `set -eu

REMOTE_DIR=${shQuote(REMOTE_DIR)}
BACKUP_ROOT=${shQuote(BACKUP_DIR)}
DOMAIN=${shQuote(DOMAIN)}
TARGET=${shQuote(stamp)}

if [ -z "$TARGET" ]; then
  TARGET=$(cat "$REMOTE_DIR/.previous-stamp" 2>/dev/null || true)
fi
if [ -z "$TARGET" ]; then
  CURRENT=$(cat "$REMOTE_DIR/.deployed-stamp" 2>/dev/null || true)
  TARGET=$(ls -1dt "$BACKUP_ROOT"/* 2>/dev/null | while IFS= read -r dir; do
    name=$(basename "$dir")
    if [ "$name" != "$CURRENT" ]; then echo "$name"; break; fi
  done)
fi

BACKUP="$BACKUP_ROOT/$TARGET"
if [ -z "$TARGET" ] || [ ! -d "$BACKUP" ]; then
  echo "找不到可回滚的备份：$BACKUP"
  echo "现有备份："
  ls -1dt "$BACKUP_ROOT"/* 2>/dev/null || true
  exit 1
fi

echo "==> 回滚到 $TARGET"
CURRENT=$(cat "$REMOTE_DIR/.deployed-stamp" 2>/dev/null || true)
cd "$REMOTE_DIR"
rm -rf dist server shared
for item in dist server shared; do
  if [ -d "$BACKUP/$item" ]; then cp -a "$BACKUP/$item" "$REMOTE_DIR/"; fi
done
for item in package.json package-lock.json; do
  if [ -f "$BACKUP/$item" ]; then cp -a "$BACKUP/$item" "$REMOTE_DIR/"; fi
done
if [ -n "$CURRENT" ]; then echo "$CURRENT" > "$REMOTE_DIR/.previous-stamp"; fi
echo "$TARGET" > "$REMOTE_DIR/.deployed-stamp"

if [ -f "$BACKUP/package-lock.json" ]; then
  TARGET_LOCK=$(sha256sum "$BACKUP/package-lock.json" | cut -d' ' -f1)
  INSTALLED_LOCK=$(cat "$REMOTE_DIR/.package-lock.sha256" 2>/dev/null || true)
  if [ "$TARGET_LOCK" != "$INSTALLED_LOCK" ] || [ ! -d "$REMOTE_DIR/node_modules/msedge-tts" ]; then
    echo "==> 回滚依赖"
    npm ci --omit=dev --registry=https://registry.npmmirror.com --no-audit --no-fund
    echo "$TARGET_LOCK" > "$REMOTE_DIR/.package-lock.sha256"
  fi
fi

rc-service seabreeze restart
ok=0
i=0
while [ "$i" -lt 40 ]; do
  if curl -fsS -o /dev/null "http://127.0.0.1:4173/" 2>/dev/null; then ok=1; break; fi
  i=$((i + 1))
  sleep 0.5
done
if [ "$ok" != 1 ]; then
  echo "!! 回滚后服务未恢复，请检查 rc-service seabreeze status"
  exit 1
fi

BUNDLE=$(curl -fsS -H "Host: $DOMAIN" -k "https://127.0.0.1/" 2>/dev/null | grep -o 'assets/index-[^" ]*\\.js' | head -1 || true)
echo "bundle=\${BUNDLE:-unknown}"
echo "ROLLBACK_OK"
`
}

function buildAndPack(stamp) {
  const releaseDir = path.join(RELEASES_ROOT, stamp)
  mkdirSync(releaseDir, { recursive: true })
  const archive = path.join(releaseDir, 'seabreeze-hk.tar.gz')

  if (!OPTIONS.skipBuild) {
    step(3, 6, '构建前端')
    runNpm(['run', 'build'])
  } else {
    log('\n[3/6] 跳过构建（--skip-build）')
  }

  if (!existsSync(path.join(APP_ROOT, 'dist', 'index.html'))) {
    fail('dist/index.html 不存在，请先构建。')
  }
  if (!existsSync(path.join(APP_ROOT, 'server', 'serve.mjs'))) {
    fail('server/serve.mjs 不存在，发布包不完整。')
  }

  const html = readFileSync(path.join(APP_ROOT, 'dist', 'index.html'), 'utf8')
  const assets = [...html.matchAll(/assets\/[^"']+\.(?:js|css)/g)].map((match) => match[0])
  const js = assets.find((asset) => asset.endsWith('.js')) ?? '(未找到 JS)'
  const css = assets.find((asset) => asset.endsWith('.css')) ?? '(未找到 CSS)'

  step(4, 6, '打包产物')
  rmSync(archive, { force: true })
  run(
    TAR,
    ['-czf', archive, 'dist', 'server', 'shared', 'package.json', 'package-lock.json'],
    { cwd: APP_ROOT },
  )
  if (!existsSync(archive) || statSync(archive).size === 0) fail('打包失败：压缩包为空。')

  const digest = sha256File(archive)
  const branch = git(['branch', '--show-current']) || '(detached)'
  const commit = git(['rev-parse', '--short', 'HEAD']) || '(unknown)'
  const subject = git(['log', '-1', '--pretty=%s']) || '(no commit)'
  const dirty = git(['status', '--porcelain', '--untracked-files=no'])
  const manifest = [
    `stamp: ${stamp}`,
    `date: ${new Date().toISOString()}`,
    `branch: ${branch}`,
    `commit: ${commit}`,
    `subject: ${subject}`,
    `dirty: ${dirty ? 'yes' : 'no'}`,
    `js: ${js}`,
    `css: ${css}`,
    `archive: ${path.basename(archive)}`,
    `size: ${statSync(archive).size}`,
    `sha256: ${digest}`,
    `host: ${HOST}`,
    `remoteDir: ${REMOTE_DIR}`,
    `backupDir: ${BACKUP_DIR}`,
  ].join('\n')
  writeFileSync(path.join(releaseDir, 'release-manifest.txt'), `${manifest}\n`)

  log(`✓ 压缩包：${archive}`)
  log(`  ${formatBytes(statSync(archive).size)}  sha256 ${digest.slice(0, 16)}…`)
  log(`  JS  ${js}`)
  log(`  CSS ${css}`)
  if (dirty) log('  ⚠ 工作区有未提交的已跟踪改动，建议先提交再发布。')

  return { releaseDir, archive, digest, js, css, branch, commit, subject }
}

async function verifyOnline(expectedJs, expectedCss) {
  if (OPTIONS.noVerify) {
    log('\n[6/6] 跳过线上校验（--no-verify）')
    return true
  }
  step(6, 6, '线上校验')
  const url = `https://${DOMAIN}/?deploy=${Date.now()}`
  let lastError = ''
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        signal: AbortSignal.timeout(15_000),
      })
      const html = await response.text()
      if (!response.ok) {
        lastError = `HTTP ${response.status}`
      } else if (expectedJs !== '(未找到 JS)' && !html.includes(expectedJs)) {
        lastError = `入口 HTML 未包含 ${expectedJs}`
      } else if (expectedCss !== '(未找到 CSS)' && !html.includes(expectedCss)) {
        lastError = `入口 HTML 未包含 ${expectedCss}`
      } else {
        const api = await fetch(`https://${DOMAIN}/api/auth/me?deploy=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(15_000),
        })
        const body = await api.text()
        if (!api.ok || !body.trim().startsWith('{')) {
          lastError = `/api/auth/me HTTP ${api.status}`
        } else {
          log(`✓ https://${DOMAIN}/ 200，入口已切到 ${expectedJs}`)
          log('✓ /api/auth/me 200，API 正常')
          return true
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    if (attempt < 12) {
      log(`  第 ${attempt} 次校验未通过（${lastError}），1.5s 后重试…`)
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  console.error(`\n✗ 线上校验失败：${lastError}`)
  console.error('  部署本身可能已经完成，请用浏览器强制刷新，或检查 nginx / 证书。')
  return false
}

async function deploy() {
  log('海风镇 · 香港节点发布')
  log(`目标：${TARGET}:${REMOTE_DIR}`)
  log(`域名：https://${DOMAIN}/`)
  if (!OPTIONS.packageOnly) {
    ensureKey()
    checkSsh()
  }

  if (!OPTIONS.skipTests) {
    step(1, 6, '运行测试')
    runNpm(['test'])
    step(2, 6, '运行 lint')
    runNpm(['run', 'lint'])
  } else {
    log('\n[1-2/6] 跳过测试与 lint（--skip-tests）')
  }

  const stamp = makeStamp()
  const release = buildAndPack(stamp)
  if (OPTIONS.packageOnly) {
    log('\n✓ 仅打包完成。把压缩包上传到服务器后，可运行远端解压/重启流程，或直接使用 npm run deploy:hk。')
    return
  }

  if (OPTIONS.dryRun) {
    step(5, 6, '远端切换（dry-run）')
    remoteScript(remoteScriptText(stamp, release.digest))
    log('\n✓ dry-run 完成，未上传、未修改服务器。')
    return
  }

  step(5, 6, '上传并切换')
  const remoteArchive = `/tmp/seabreeze-${stamp}.tar.gz`
  log(`上传 ${formatBytes(statSync(release.archive).size)} → ${TARGET}:${remoteArchive}`)
  let uploaded = false
  for (let attempt = 1; attempt <= SSH_ATTEMPTS; attempt += 1) {
    const result = spawnSync(
      'scp',
      [...SSH_OPTS, '-q', release.archive, `${TARGET}:${remoteArchive}`],
      { cwd: APP_ROOT, encoding: 'utf8', timeout: 5 * 60 * 1000 },
    )
    if (result.status === 0) {
      uploaded = true
      break
    }
    const detail = [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join('\n')
      .trim()
    if (attempt === SSH_ATTEMPTS) {
      fail(`上传失败（已重试 ${SSH_ATTEMPTS} 次）：${detail}\n\n${sshFailureHint(detail)}`)
    }
    log(`  上传第 ${attempt} 次失败，3 秒后重试…`)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  }
  if (!uploaded) fail('上传失败：未知错误。')

  const script = remoteScriptText(stamp, release.digest)
  const result = remoteScript(script)
  const logText = [result.stdout, result.stderr].filter(Boolean).join('\n')
  writeFileSync(path.join(release.releaseDir, 'deploy.log'), logText)
  if (result.status !== 0 || !logText.includes('REMOTE_OK')) {
    fail(`远端部署失败，日志已写入 ${path.join(release.releaseDir, 'deploy.log')}`)
  }

  writeFileSync(path.join(WORK_ROOT, '.last-release-stamp'), `${stamp}\n`)
  writeFileSync(path.join(WORK_ROOT, '.last-release-path'), `${release.releaseDir}\n`)

  const verified = await verifyOnline(release.js, release.css)
  log('\n========================================')
  log('发布完成')
  log(`版本：${stamp}`)
  log(`提交：${release.commit} ${release.subject}`)
  log(`入口：https://${DOMAIN}/`)
  log(`JS：${release.js}`)
  log(`备份：${BACKUP_DIR}/${stamp}`)
  log(`压缩包：${release.archive}`)
  log(`回滚：npm run deploy:hk -- --rollback ${stamp}`)
  log('========================================')
  if (!verified) process.exit(1)
}

async function rollback() {
  log('海风镇 · 香港节点回滚')
  ensureKey()
  checkSsh()
  const stamp = OPTIONS.rollbackStamp
  if (stamp) log(`目标备份：${stamp}`)
  else log('目标备份：自动选择 previous-stamp 或最近备份')
  const result = remoteScript(rollbackScript(stamp))
  const text = [result.stdout, result.stderr].filter(Boolean).join('\n')
  if (result.status !== 0 || !text.includes('ROLLBACK_OK')) {
    fail('回滚失败，请检查服务器输出。')
  }
  if (!OPTIONS.noVerify) {
    const response = await fetch(`https://${DOMAIN}/?rollback=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) fail(`回滚后线上返回 HTTP ${response.status}`)
    log(`✓ https://${DOMAIN}/ ${response.status}`)
  }
  log('\n✓ 回滚完成')
}

function help() {
  log(`海风镇 · 香港节点一键发布

用法：
  npm run deploy:hk                        完整发布
  npm run deploy:hk -- --skip-tests        跳过 test/lint（仍构建）
  npm run deploy:hk -- --skip-build        使用现有 dist
  npm run deploy:hk -- --package-only      只打包，不上传
  npm run deploy:hk -- --dry-run           跑到打包，打印远端脚本
  npm run deploy:hk -- --rollback [stamp]  回滚到指定/上一个备份
  npm run deploy:hk -- --print-key         打印部署公钥
  npm run deploy:hk -- --check-key         检查 SSH 免密
  npm run deploy:hk -- --no-verify         跳过本机 HTTPS 校验
  npm run deploy:hk -- --help              显示本帮助

环境变量：
  SEABREEZE_HOST / SEABREEZE_USER / SEABREEZE_DIR / SEABREEZE_DOMAIN
  SEABREEZE_SSH_KEY / SEABREEZE_BACKUP_DIR / SEABREEZE_KEEP_BACKUPS
`)
}

if (OPTIONS.help) {
  help()
} else if (OPTIONS.printKey) {
  printKey()
} else if (OPTIONS.checkKey) {
  ensureKey()
  checkSsh()
} else if (OPTIONS.rollback) {
  await rollback()
} else {
  await deploy()
}
