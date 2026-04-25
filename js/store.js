import { DEFAULT_CATEGORIES, DEFAULT_WAYPOINTS } from './defaults.js';

// ---- グローバルキー（プロファイル一覧・選択状態） ----
const G = {
  PROFILES: 'mc_profiles',       // [{ id, name, createdAt }]
  ACTIVE:   'mc_active_profile', // 現在のプロファイル ID
  SETTINGS: 'mc_settings',       // 表示設定はグローバル共通
};

// ---- プロファイルごとのキー生成 ----
function pk(id, suffix) { return `mc_p_${id}_${suffix}`; }

// ---- 低レベル IO ----
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ---- プロファイル一覧 ----
export function getProfiles() { return load(G.PROFILES, []); }
function saveProfiles(list)   { save(G.PROFILES, list); }

export function getActiveProfileId() {
  const id = localStorage.getItem(G.ACTIVE);
  const profiles = getProfiles();
  if (id && profiles.find(p => p.id === id)) return id;
  return profiles.length ? profiles[0].id : null;
}
function setActiveProfileId(id) {
  localStorage.setItem(G.ACTIVE, id);
}

export function getActiveProfile() {
  const id = getActiveProfileId();
  return getProfiles().find(p => p.id === id) || null;
}

// ---- プロファイル作成ヘルパー ----
function createProfileData(id, { waypoints, categories } = {}) {
  save(pk(id, 'waypoints'),  waypoints  ?? DEFAULT_WAYPOINTS.map(w => ({ ...w, createdAt: Date.now() })));
  save(pk(id, 'categories'), categories ?? DEFAULT_CATEGORIES.map(c => ({ ...c, isDefault: true })));
  save(pk(id, 'map_state'),  { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 });
}

// ---- 初期化 ----
export function initStore() {
  const profiles = getProfiles();
  if (profiles.length === 0) {
    const id   = 'p' + Date.now();
    const list = [{ id, name: 'ワールド1', createdAt: Date.now() }];
    saveProfiles(list);
    setActiveProfileId(id);
    createProfileData(id);
    save(G.SETTINGS, { showGrid: true, showChunks: false, showLabels: true });
  }
}

// ---- プロファイル CRUD ----
export function addProfile(name) {
  const id   = 'p' + Date.now();
  const list = [...getProfiles(), { id, name, createdAt: Date.now() }];
  saveProfiles(list);
  createProfileData(id);
  return id;
}

export function renameProfile(id, name) {
  saveProfiles(getProfiles().map(p => p.id === id ? { ...p, name } : p));
}

export function deleteProfile(id) {
  const profiles = getProfiles().filter(p => p.id !== id);
  saveProfiles(profiles);
  // そのプロファイルのキーを削除
  ['waypoints','categories','map_state'].forEach(s => {
    localStorage.removeItem(pk(id, s));
  });
  // 削除後に別プロファイルをアクティブに
  if (getActiveProfileId() === id) {
    setActiveProfileId(profiles.length ? profiles[0].id : null);
  }
}

export function switchProfile(id) {
  setActiveProfileId(id);
}

// ---- Waypoints（アクティブプロファイル対象） ----
export function getWaypoints()       { return load(pk(getActiveProfileId(), 'waypoints'), []); }
export function saveWaypoints(list)  { save(pk(getActiveProfileId(), 'waypoints'), list); }

export function addWaypoint(wp) {
  const list = getWaypoints();
  const item = { ...wp, id: 'w' + Date.now(), createdAt: Date.now() };
  list.push(item);
  saveWaypoints(list);
  return item;
}
export function updateWaypoint(id, patch) {
  saveWaypoints(getWaypoints().map(w => w.id === id ? { ...w, ...patch } : w));
}
export function deleteWaypoint(id) {
  saveWaypoints(getWaypoints().filter(w => w.id !== id));
}

// ---- Categories（アクティブプロファイル対象） ----
export function getCategories()      { return load(pk(getActiveProfileId(), 'categories'), []); }
export function saveCategories(list) { save(pk(getActiveProfileId(), 'categories'), list); }

export function addCategory(cat) {
  const list = getCategories();
  const item = { ...cat, id: 'cat' + Date.now(), isDefault: false };
  list.push(item);
  saveCategories(list);
  return item;
}
export function updateCategory(id, patch) {
  saveCategories(getCategories().map(c => c.id === id ? { ...c, ...patch } : c));
}
export function deleteCategory(id) {
  saveCategories(getCategories().filter(c => c.id !== id));
}

// ---- Map state（アクティブプロファイル対象） ----
export function getMapState()       { return load(pk(getActiveProfileId(), 'map_state'), { offsetX:0, offsetY:0, scale:1, rotation:0 }); }
export function saveMapState(state) { save(pk(getActiveProfileId(), 'map_state'), state); }

// ---- Settings（グローバル共通） ----
export function getSettings()         { return load(G.SETTINGS, { showGrid:true, showChunks:false, showLabels:true, mapTheme:'dark' }); }
export function saveSetting(key, val) { save(G.SETTINGS, { ...getSettings(), [key]: val }); }

// ---- Export（現在のプロファイルのみ） ----
export function exportData() {
  const profile = getActiveProfile();
  return JSON.stringify({
    version:    2,
    profileName: profile?.name ?? 'マップ',
    waypoints:  getWaypoints(),
    categories: getCategories(),
  }, null, 2);
}

// ---- Import（新規プロファイルとして追加） ----
export function importAsNewProfile(json) {
  const data = JSON.parse(json);
  if (!data.waypoints && !data.categories) throw new Error('invalid');
  const baseName = data.profileName || 'インポート';
  // 同名があれば連番を付ける
  const existing = getProfiles().map(p => p.name);
  let name = baseName;
  let n = 2;
  while (existing.includes(name)) { name = `${baseName} (${n++})`; }
  const id = addProfile(name);
  if (data.waypoints)  save(pk(id, 'waypoints'),  data.waypoints);
  if (data.categories) save(pk(id, 'categories'), data.categories.map(c => ({ ...c, isDefault: !!c.isDefault })));
  return { id, name };
}

// ---- Reset（現在のプロファイルをデフォルト状態に戻す） ----
export function resetCurrentProfile() {
  const id = getActiveProfileId();
  createProfileData(id);
  save(pk(id, 'map_state'), { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 });
}
