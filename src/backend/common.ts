/**
 * common.ts
 * 
 * @Author  : hikaridai(hikaridai@tencent.com)
 * @Date    : 11/30/2022, 10:52:49 PM
 */
export const DAV_PREFIX = 'http://AwakenWebDav:';

export function webdavStatusText(status: number, data: unknown, fallback = ''): string {
  const names = {200: 'OK', 201: 'Created', 204: 'No Content', 207: 'Multi-Status',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    409: 'Conflict', 412: 'Precondition Failed', 413: 'Payload Too Large',
    429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable'};
  const reason = fallback || names[status] || `HTTP ${status}`;
  if (status < 400 || typeof data !== 'string') { return reason; }
  const match = data.match(/<(?:[\w.-]+:)?message\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?message>/i);
  let detail = match?.[1];
  if (!detail) {
    try { detail = JSON.parse(data).message; } catch (_) { /* Not a JSON error. */ }
  }
  if (typeof detail !== 'string' || !detail) { return reason; }
  detail = detail.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').slice(0, 800);
  return `${reason}: ${detail}`;
}

export function webdavLogUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${decodeURIComponent(parsed.pathname)}`;
  } catch (_) { return '(invalid URL)'; }
}
