const API_URL = 'https://vqgpbepmuteoszdagxjl.supabase.co/functions/v1/kitchen-api';
const SESSION_KEY = 'kaikai-cloud-session';

function token() {
  return wx.getStorageSync(SESSION_KEY) || '';
}

function parseBody(value) {
  if (typeof value === 'object' && value !== null) return value;
  try { return JSON.parse(value); } catch (error) { return { error: '云端没有返回有效内容' }; }
}

function handleResult(statusCode, raw, resolve, reject) {
  const data = parseBody(raw);
  if (statusCode >= 200 && statusCode < 300) return resolve(data);
  if (statusCode === 401) wx.removeStorageSync(SESSION_KEY);
  reject(new Error(data.error || '云端操作失败'));
}

function request(action, payload = {}, authenticated = false) {
  return new Promise((resolve, reject) => {
    const authorization = authenticated && token() ? { Authorization: `Bearer ${token()}` } : {};
    wx.request({
      url: API_URL,
      method: 'POST',
      header: { 'content-type': 'application/json', ...authorization },
      data: { action, ...payload },
      success: (response) => handleResult(response.statusCode, response.data, resolve, reject),
      fail: () => reject(new Error('暂时无法连接云端'))
    });
  });
}

function uploadDish(filePath, dish) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: API_URL,
      filePath,
      name: 'image',
      header: { Authorization: `Bearer ${token()}` },
      formData: {
        action: 'save',
        id: dish.id || '',
        name: dish.name,
        category: dish.category,
        ingredients: JSON.stringify(dish.ingredients),
        description: dish.description || ''
      },
      success: (response) => handleResult(response.statusCode, response.data, resolve, reject),
      fail: () => reject(new Error('图片上传失败，请重试'))
    });
  });
}

function normalizeDish(row) {
  const remoteImage = /^https:\/\//.test(row.image_url || '') ? row.image_url : '';
  const seed = [...row.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const ratios = [0.76, 0.84, 0.92, 1, 1.12, 1.28, 1.42];
  const ratio = ratios[seed % ratios.length];
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    description: row.description || '',
    image: remoteImage || `/assets/dishes/${row.id}.jpg`,
    imagePath: row.image_path || '',
    ratio,
    height: Math.round(350 / ratio)
  };
}

function list() {
  return request('list').then((rows) => rows.map(normalizeDish));
}

function login(username, password) {
  return request('login', { username, password }).then((result) => {
    wx.setStorageSync(SESSION_KEY, result.token);
    return result;
  });
}

function save(dish, filePath) {
  if (filePath) return uploadDish(filePath, dish).then(normalizeDish);
  return request('save', dish, true).then(normalizeDish);
}

module.exports = {
  list,
  login,
  save,
  restore: (id) => request('restore', { id }, true).then(normalizeDish),
  remove: (id) => request('delete', { id }, true),
  isAdmin: () => Boolean(token()),
  logout: () => wx.removeStorageSync(SESSION_KEY)
};
