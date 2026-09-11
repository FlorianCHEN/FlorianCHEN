const PROJECT_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'dish-images';
const ALLOWED_ORIGINS = new Set(['https://florianchen.github.io']);

function cors(origin: string | null) {
  const allowed = !origin || ALLOWED_ORIGINS.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': origin && allowed ? origin : 'https://florianchen.github.io',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  };
}

function json(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

function base64url(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sign(value: string) {
  const config = await getConfig();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.token_secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

async function issueToken() {
  const config = await getConfig();
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ user: config.admin_user, exp: Date.now() + 12 * 60 * 60 * 1000 })));
  return `${payload}.${await sign(payload)}`;
}

async function isAuthorized(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== await sign(payload)) return false;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), (c) => c.charCodeAt(0))));
    const config = await getConfig();
    return parsed.user === config.admin_user && Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

function serviceFetch(path: string, init: RequestInit = {}) {
  return fetch(`${PROJECT_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...(init.headers || {}) },
  });
}

let configPromise: Promise<Record<string, string>> | null = null;

function getConfig() {
  if (!configPromise) {
    configPromise = serviceFetch('/rest/v1/kitchen_config?select=key,value').then(async (response) => {
      if (!response.ok) throw new Error('Cloud configuration is unavailable');
      const rows = await response.json() as Array<{ key: string; value: string }>;
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    });
  }
  return configPromise;
}

async function getDish(id: string) {
  const response = await serviceFetch(`/rest/v1/dishes?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!response.ok) throw new Error(await response.text());
  return (await response.json())[0] || null;
}

async function removeObject(path: string | null) {
  if (!path) return;
  await serviceFetch(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  });
}

async function readPayload(req: Request) {
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await req.formData();
    return {
      action: String(form.get('action') || ''),
      id: String(form.get('id') || ''),
      name: String(form.get('name') || ''),
      category: String(form.get('category') || ''),
      description: String(form.get('description') || ''),
      ingredients: JSON.parse(String(form.get('ingredients') || '[]')),
      file: form.get('image') instanceof File ? form.get('image') as File : null,
    };
  }
  return await req.json();
}

Deno.serve(async (req) => {
  const access = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: access.allowed ? 204 : 403, headers: access.headers });
  if (!access.allowed) return json({ error: 'Origin not allowed' }, 403, access.headers);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, access.headers);

  try {
    const payload = await readPayload(req);

    if (payload.action === 'login') {
      const config = await getConfig();
      const valid = payload.username === config.admin_user && await sha256(String(payload.password || '')) === config.password_sha256;
      return valid ? json({ token: await issueToken() }, 200, access.headers) : json({ error: '账号或密码不正确' }, 401, access.headers);
    }

    if (payload.action === 'list') {
      const response = await serviceFetch('/rest/v1/dishes?select=*&order=position.asc,created_at.asc');
      return json(response.ok ? await response.json() : { error: await response.text() }, response.ok ? 200 : 500, access.headers);
    }

    if (!await isAuthorized(req)) return json({ error: '登录已过期，请重新登录' }, 401, access.headers);

    if (payload.action === 'save') {
      const id = String(payload.id || `custom-${crypto.randomUUID()}`);
      const name = String(payload.name || '').trim();
      const category = String(payload.category || '其他').trim();
      const description = String(payload.description || '').trim();
      const ingredients = Array.isArray(payload.ingredients) ? [...new Set(payload.ingredients.map(String).map((item) => item.trim()).filter(Boolean))] : [];
      if (!/^[a-z0-9-]{3,80}$/.test(id) || !name || !ingredients.length) return json({ error: '菜名或食材不完整' }, 400, access.headers);
      const existing = await getDish(id);
      let imageUrl = existing?.image_url || null;
      let imagePath = existing?.image_path || null;
      const file = payload.file instanceof File ? payload.file : null;
      if (file) {
        if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) return json({ error: '图片格式不正确或超过 20 MB' }, 400, access.headers);
        const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
        const newPath = `${id}/${Date.now()}.${extension}`;
        const upload = await serviceFetch(`/storage/v1/object/${BUCKET}/${newPath.split('/').map(encodeURIComponent).join('/')}`, {
          method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file,
        });
        if (!upload.ok) return json({ error: '图片上传失败' }, 500, access.headers);
        imageUrl = `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${newPath.split('/').map(encodeURIComponent).join('/')}`;
        const previousPath = imagePath;
        imagePath = newPath;
        if (previousPath && previousPath !== newPath) await removeObject(previousPath);
      }
      const row = {
        id, name, category, ingredients, description,
        image_url: imageUrl,
        original_image_url: existing?.original_image_url ?? existing?.image_url ?? null,
        image_path: imagePath,
        shot: existing?.shot || null,
        is_custom: existing?.is_custom ?? id.startsWith('custom-'),
        position: existing?.position ?? Date.now(),
        updated_at: new Date().toISOString(),
      };
      const response = await serviceFetch('/rest/v1/dishes?on_conflict=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row),
      });
      return json(response.ok ? (await response.json())[0] : { error: await response.text() }, response.ok ? 200 : 500, access.headers);
    }

    if (payload.action === 'restore') {
      const dish = await getDish(String(payload.id || ''));
      if (!dish) return json({ error: '菜品不存在' }, 404, access.headers);
      const response = await serviceFetch(`/rest/v1/dishes?id=eq.${encodeURIComponent(dish.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ image_url: dish.original_image_url, image_path: null, updated_at: new Date().toISOString() }),
      });
      if (response.ok) await removeObject(dish.image_path);
      return json(response.ok ? (await response.json())[0] : { error: await response.text() }, response.ok ? 200 : 500, access.headers);
    }

    if (payload.action === 'delete') {
      const dish = await getDish(String(payload.id || ''));
      if (!dish) return json({ error: '菜品不存在' }, 404, access.headers);
      const response = await serviceFetch(`/rest/v1/dishes?id=eq.${encodeURIComponent(dish.id)}`, { method: 'DELETE' });
      if (response.ok) await removeObject(dish.image_path);
      return json(response.ok ? { ok: true } : { error: await response.text() }, response.ok ? 200 : 500, access.headers);
    }

    return json({ error: 'Unknown action' }, 400, access.headers);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500, access.headers);
  }
});
