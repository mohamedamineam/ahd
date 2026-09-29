// POST /api/comments — a visitor's message, stored privately in D1 (binding DB). The site has no way to read
// messages back: only the owner can, signed in to Cloudflare (dashboard or `node comments.mjs`, see README.md).
import { json, sha256 } from '../../lib/util.js';

const KINDS = ['suggestion', 'problem', 'thanks'];
const PER_HOUR = 5;

export async function onRequestPost({ request, env }) {
  // only from this site's own pages
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  // spam traps: a hidden field real visitors never fill, and forms sent within 3 s of opening the page
  if (body.website || (typeof body.elapsed === 'number' && body.elapsed < 3000)) return json({ ok: true }, 201);

  const message = String(body.message ?? '').trim();
  const name = String(body.name ?? '').trim().slice(0, 80);
  const email = String(body.email ?? '').trim().slice(0, 120);
  const kind = KINDS.includes(body.kind) ? body.kind : 'suggestion';
  const lang = body.lang === 'en' ? 'en' : 'ar';
  if (message.length < 3) return json({ error: 'too_short' }, 400);
  if (message.length > 2000) return json({ error: 'too_long' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'bad_email' }, 400);

  // rate limit per visitor without storing the address itself
  const ipHash = await sha256(`${env.HASH_SALT ?? 'ahd-feedback'}:${request.headers.get('CF-Connecting-IP') ?? ''}`);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ?1 AND created_at > datetime('now', '-1 hour')").bind(ipHash).first('n');
  if (recent >= PER_HOUR) return json({ error: 'rate_limited' }, 429);

  await env.DB.prepare("INSERT INTO comments (created_at, kind, name, email, message, lang, country, ip_hash) VALUES (datetime('now'), ?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(kind, name, email, message, lang, request.cf?.country ?? '', ipHash)
    .run();
  return json({ ok: true }, 201);
}
