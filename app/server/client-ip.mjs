/**
 * 取请求来源 IP。
 *
 * 直接监听时用 socket 地址；只有显式开启 TRUST_PROXY=1（部署在 nginx 之类
 * 的可信反代后面）才读取 X-Forwarded-For，否则任何人都能伪造这个头绕过限流。
 */
export function clientIp(req, trustProxy = process.env.TRUST_PROXY === '1') {
  if (trustProxy) {
    const forwarded = req.headers?.['x-forwarded-for']
    if (typeof forwarded === 'string') {
      const first = forwarded.split(',')[0].trim()
      if (first) return first
    }
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

/**
 * 顺手清理过期的限流桶：按 IP 记账后 key 会越来越多，不清会一直涨。
 * 只在桶数量超过阈值时做一次全量扫描，正常情况几乎不产生开销。
 */
export function pruneRateBuckets(buckets, windowMs, now = Date.now(), threshold = 1000) {
  if (buckets.size <= threshold) return
  for (const [key, stamps] of buckets) {
    if (!Array.isArray(stamps) || !stamps.some((at) => now - at < windowMs)) {
      buckets.delete(key)
    }
  }
}
