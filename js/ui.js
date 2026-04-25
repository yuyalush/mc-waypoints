import { getCategories, addCategory, updateCategory, deleteCategory,
         addWaypoint, updateWaypoint, deleteWaypoint, getWaypoints,
         getSettings, saveSetting, exportData, importAsNewProfile,
         getProfiles, getActiveProfileId, switchProfile,
         addProfile, renameProfile, deleteProfile, resetCurrentProfile,
         getActiveProfile } from './store.js';
import { refreshMap, jumpToWaypoint } from './map.js';
import { initSpeech, startListening, stopListening, parseCoordOnly } from './speech.js';

// ---- Escape HTML ----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Toast ----
export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

// ---- Modal helpers ----
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function categoryOptions(selectedId = '') {
  return getCategories().map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.icon} ${c.name}</option>`
  ).join('');
}

// ---- Waypoint Modal ----
export function openWaypointModal(wp = null, prefill = {}) {
  const isEdit = !!wp;
  const modal  = document.getElementById('modal-waypoint');
  modal.querySelector('h2').textContent = isEdit ? '地点を編集' : '地点を追加';

  const f = modal.querySelector('form');
  f.elements['name'].value      = wp?.name      ?? prefill.name ?? '';
  f.elements['x'].value         = wp?.x         ?? prefill.x   ?? '';
  f.elements['y'].value         = wp?.y         ?? prefill.y   ?? 64;
  f.elements['z'].value         = wp?.z         ?? prefill.z   ?? '';
  f.elements['note'].value      = wp?.note      ?? '';
  f.elements['category'].innerHTML = categoryOptions(wp?.categoryId ?? '');

  const delBtn = modal.querySelector('.btn-delete');
  delBtn.style.display = isEdit ? 'inline-flex' : 'none';
  delBtn.onclick = () => {
    if (confirm(`「${wp.name}」を削除しますか?`)) {
      deleteWaypoint(wp.id);
      refreshMap();
      renderWaypointList();
      closeModal('modal-waypoint');
      toast('地点を削除しました', 'warn');
    }
  };

  f.onsubmit = (e) => {
    e.preventDefault();
    const data = {
      name:       f.elements['name'].value.trim(),
      x:          +f.elements['x'].value,
      y:          +f.elements['y'].value,
      z:          +f.elements['z'].value,
      note:       f.elements['note'].value.trim(),
      categoryId: f.elements['category'].value,
    };
    if (!data.name) { toast('名前を入力してください', 'error'); return; }
    if (isEdit) { updateWaypoint(wp.id, data); toast('地点を更新しました'); }
    else        { addWaypoint(data);            toast('地点を追加しました', 'success'); }
    refreshMap();
    renderWaypointList();
    closeModal('modal-waypoint');
  };

  openModal('modal-waypoint');
  f.elements['name'].focus();
}

// ---- Category Modal ----
function openCategoryModal(cat = null) {
  const isEdit = !!cat;
  const modal  = document.getElementById('modal-category');
  modal.querySelector('h2').textContent = isEdit ? 'カテゴリを編集' : 'カテゴリを追加';

  const f = modal.querySelector('form');
  f.elements['catName'].value  = cat?.name  ?? '';
  f.elements['catColor'].value = cat?.color ?? '#7BC67E';
  f.elements['catIcon'].value  = cat?.icon  ?? '📍';

  const delBtn = modal.querySelector('.btn-delete');
  delBtn.style.display = (isEdit && !cat.isDefault) ? 'inline-flex' : 'none';
  delBtn.onclick = () => {
    if (confirm(`「${cat.name}」を削除しますか?`)) {
      deleteCategory(cat.id);
      renderCategoryList();
      closeModal('modal-category');
      toast('カテゴリを削除しました', 'warn');
    }
  };

  f.onsubmit = (e) => {
    e.preventDefault();
    const data = {
      name:  f.elements['catName'].value.trim(),
      color: f.elements['catColor'].value,
      icon:  f.elements['catIcon'].value.trim() || '📍',
    };
    if (!data.name) { toast('名前を入力してください', 'error'); return; }
    if (isEdit) { updateCategory(cat.id, data); toast('カテゴリを更新しました'); }
    else        { addCategory(data);             toast('カテゴリを追加しました', 'success'); }
    renderCategoryList();
    closeModal('modal-category');
  };

  openModal('modal-category');
}

// ---- Waypoint List ----
export function renderWaypointList(filterCat = '', query = '') {
  const list     = getWaypoints();
  const cats     = getCategories();
  const catMap   = Object.fromEntries(cats.map(c => [c.id, c]));
  const filtered = list.filter(w => {
    const matchCat = !filterCat || w.categoryId === filterCat;
    const matchQ   = !query || w.name.includes(query) || (w.note || '').includes(query);
    return matchCat && matchQ;
  });
  const el = document.getElementById('waypoint-list');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-msg">地点がありません</div>';
    return;
  }
  el.innerHTML = filtered.map(w => {
    const cat = catMap[w.categoryId] || { color: '#90A4AE', icon: '📍', name: '?' };
    return `<div class="wp-item" data-id="${escapeHtml(w.id)}">
      <div class="wp-dot" style="background:${escapeHtml(cat.color)}">${escapeHtml(cat.icon)}</div>
      <div class="wp-info">
        <div class="wp-name">${escapeHtml(w.name)}</div>
        <div class="wp-coords">X:${escapeHtml(w.x)} Y:${escapeHtml(w.y)} Z:${escapeHtml(w.z)}</div>
      </div>
      <div class="wp-actions">
        <button class="btn-icon btn-jump" title="マップで表示" data-id="${escapeHtml(w.id)}">🎯</button>
        <button class="btn-icon btn-edit" title="編集" data-id="${escapeHtml(w.id)}">✏️</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.btn-jump').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const wp = list.find(w => w.id === btn.dataset.id);
      if (wp) jumpToWaypoint(wp);
    };
  });
  el.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const wp = list.find(w => w.id === btn.dataset.id);
      if (wp) openWaypointModal(wp);
    };
  });
}

// ---- Category List ----
function renderCategoryList() {
  const cats = getCategories();
  const el   = document.getElementById('category-list');
  el.innerHTML = cats.map(c => `
    <div class="cat-item">
      <span class="cat-swatch" style="background:${escapeHtml(c.color)}">${escapeHtml(c.icon)}</span>
      <span class="cat-name">${escapeHtml(c.name)}</span>
      <button class="btn-icon btn-edit-cat" data-id="${escapeHtml(c.id)}">✏️</button>
    </div>`).join('');
  el.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.onclick = () => {
      const cat = cats.find(c => c.id === btn.dataset.id);
      if (cat) openCategoryModal(cat);
    };
  });
}

// ---- Speech UI ----
function initSpeechUI() {
  const btn  = document.getElementById('btn-voice');
  const supported = initSpeech(
    // onInterim: 認識中のテキストをリアルタイム表示
    (text) => {
      if (text) document.getElementById('voice-raw').textContent = `🎤 ${text}`;
    },
    // onError: 認識エラー時にボタンをリセット
    () => { btn.classList.remove('listening'); }
  );
  if (!supported) {
    btn.title = '音声入力は非対応のブラウザです';
    btn.style.opacity = '0.4';
    btn.disabled = true;
    return;
  }
  btn.onclick = () => {
    if (btn.classList.contains('listening')) {
      // もう一度押したら停止 → その時点までの認識テキストから座標をパース
      const raw = stopListening();
      btn.classList.remove('listening');
      if (!raw) return;
      const coords = parseCoordOnly(raw);
      document.getElementById('voice-raw').textContent = coords
        ? `「${raw}」`
        : `「${raw}」（座標を認識できませんでした）`;
      document.getElementById('voice-name').value  = '';
      document.getElementById('voice-x').value     = coords?.x ?? '';
      document.getElementById('voice-y').value     = coords?.y ?? 64;
      document.getElementById('voice-z').value     = coords?.z ?? '';
      document.getElementById('voice-category').innerHTML = categoryOptions();
      openModal('modal-voice');
    } else {
      btn.classList.add('listening');
      document.getElementById('voice-raw').textContent = '🎤 座標を話してください…';
      startListening();
    }
  };

  document.getElementById('form-voice').onsubmit = (e) => {
    e.preventDefault();
    const f = document.getElementById('form-voice');
    const data = {
      name:       f.elements['voice-name'].value.trim(),
      x:          +f.elements['voice-x'].value,
      y:          +f.elements['voice-y'].value,
      z:          +f.elements['voice-z'].value,
      note:       '',
      categoryId: f.elements['voice-category'].value,
    };
    if (!data.name) { toast('名前を入力してください', 'error'); return; }
    addWaypoint(data);
    refreshMap();
    renderWaypointList();
    closeModal('modal-voice');
    toast('音声から地点を登録しました', 'success');
  };
}

// ---- Settings UI ----
function initSettingsUI() {
  const settings = getSettings();
  document.getElementById('toggle-grid').checked   = settings.showGrid;
  document.getElementById('toggle-chunks').checked = settings.showChunks;
  document.getElementById('toggle-labels').checked = settings.showLabels;
  document.getElementById('toggle-theme').checked  = (settings.mapTheme === 'light');
  document.getElementById('toggle-grid').onchange   = (e) => { saveSetting('showGrid',   e.target.checked); refreshMap(); };
  document.getElementById('toggle-chunks').onchange = (e) => { saveSetting('showChunks', e.target.checked); refreshMap(); };
  document.getElementById('toggle-labels').onchange = (e) => { saveSetting('showLabels', e.target.checked); refreshMap(); };
  document.getElementById('toggle-theme').onchange  = (e) => { saveSetting('mapTheme', e.target.checked ? 'light' : 'dark'); refreshMap(); };
}

// ---- Export/Import ----
function initDataUI() {
  document.getElementById('btn-export').onclick = () => {
    const profile = getActiveProfile();
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    const safeName = (profile?.name ?? 'map').replace(/[\\/:*?"<>|]/g, '_');
    a.download = `mc-waypoints-${safeName}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('エクスポートしました');
  };
  document.getElementById('btn-import').onclick = () => {
    document.getElementById('file-import').click();
  };
  document.getElementById('file-import').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { id, name } = importAsNewProfile(ev.target.result);
        switchProfile(id);
        reloadAll();
        toast(`「${name}」を新しいマップとしてインポートしました`, 'success');
      } catch { toast('インポート失敗: 無効なファイルです', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
}

// ---- Tab switching ----
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'waypoints') renderWaypointList();
      if (btn.dataset.tab === 'categories') renderCategoryList();
    };
  });
}

// ---- Search / filter ----
function initSearch() {
  const searchEl = document.getElementById('search-input');
  const filterEl = document.getElementById('filter-category');
  const update   = () => renderWaypointList(filterEl.value, searchEl.value.trim());
  searchEl.oninput  = update;
  filterEl.onchange = update;

  // populate filter dropdown
  const cats = getCategories();
  filterEl.innerHTML = '<option value="">すべて</option>' +
    cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

// ---- Modal close buttons ----
function initModalClose() {
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.onclick = () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('open');
    };
  });
  // 範囲外クリックでは閉じない（×・キャンセルボタンのみで閉じる）
}

// ---- Sidebar toggle ----
function initSidebar() {
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  const sidebar   = document.getElementById('sidebar');
  const scrim     = document.getElementById('sidebar-scrim');

  function updateState() {
    const collapsed = sidebar.classList.contains('collapsed');
    toggleBtn.textContent = collapsed ? '☰' : '✕';
    if (scrim) scrim.classList.toggle('visible', !collapsed);
  }

  toggleBtn.onclick = () => {
    sidebar.classList.toggle('collapsed');
    updateState();
  };

  if (scrim) {
    scrim.onclick = () => {
      sidebar.classList.add('collapsed');
      updateState();
    };
  }
}

// ---- Profile (マップ切り替え) ----

// 画面全体をアクティブプロファイルで再描画するヘルパー
function reloadAll() {
  renderProfileList();
  renderWaypointList();
  renderCategoryList();
  // カテゴリフィルタを再構築
  const cats   = getCategories();
  const filter = document.getElementById('filter-category');
  if (filter) {
    filter.innerHTML = '<option value="">すべて</option>' +
      cats.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`).join('');
  }
  refreshMap();
}

function renderProfileList() {
  const profiles  = getProfiles();
  const activeId  = getActiveProfileId();
  const el        = document.getElementById('profile-list-area');
  if (!el) return;

  el.innerHTML = profiles.map(p => `
    <div class="profile-item ${p.id === activeId ? 'active' : ''}" data-id="${escapeHtml(p.id)}">
      <span class="profile-name">${escapeHtml(p.name)}</span>
      <div class="profile-actions">
        <button class="btn-icon btn-profile-edit"   data-id="${escapeHtml(p.id)}" title="名前を変更">✏️</button>
      </div>
    </div>`).join('');

  // 選択（クリックでアクティブ切り替え）
  el.querySelectorAll('.profile-item').forEach(item => {
    item.onclick = (e) => {
      if (e.target.closest('.btn-icon')) return;
      const id = item.dataset.id;
      if (id === getActiveProfileId()) return;
      switchProfile(id);
      reloadAll();
      toast(`「${profiles.find(p => p.id === id)?.name}」に切り替えました`);
    };
  });

  // 名前変更
  el.querySelectorAll('.btn-profile-edit').forEach(btn => {
    btn.onclick = () => openProfileModal(btn.dataset.id);
  });
}

function openProfileModal(id) {
  const profiles  = getProfiles();
  const profile   = profiles.find(p => p.id === id);
  if (!profile) return;

  const modal    = document.getElementById('modal-profile');
  const input    = document.getElementById('profile-name-input');
  const delBtn   = modal.querySelector('.btn-delete-profile');
  const form     = document.getElementById('form-profile');

  input.value = profile.name;
  // プロファイルが1つだけの場合は削除不可
  delBtn.style.display = profiles.length > 1 ? 'inline-flex' : 'none';

  delBtn.onclick = () => {
    if (!confirm(`「${profile.name}」を削除しますか？\nこのマップの地点データはすべて失われます。`)) return;
    deleteProfile(id);
    reloadAll();
    closeModal('modal-profile');
    toast('マップを削除しました', 'warn');
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { toast('マップ名を入力してください', 'error'); return; }
    renameProfile(id, name);
    renderProfileList();
    closeModal('modal-profile');
    toast('マップ名を変更しました');
  };

  openModal('modal-profile');
  input.focus();
}

function initProfileUI() {
  document.getElementById('btn-add-profile').onclick = () => {
    const name = prompt('新しいマップの名前を入力してください', 'ワールド' + (getProfiles().length + 1));
    if (!name || !name.trim()) return;
    const id = addProfile(name.trim());
    switchProfile(id);
    reloadAll();
    toast(`「${name.trim()}」を作成しました`, 'success');
  };

  document.getElementById('btn-reset-profile').onclick = () => {
    const profile = getActiveProfile();
    if (!confirm(`「${profile?.name}」をリセットしますか？\nすべての地点・カテゴリがデフォルトに戻ります。`)) return;
    resetCurrentProfile();
    reloadAll();
    toast('マップをリセットしました', 'warn');
  };

  renderProfileList();
}

// ---- Init all UI ----
export function initUI() {
  initTabs();
  initSearch();
  initModalClose();
  initSpeechUI();
  initSettingsUI();
  initDataUI();
  initProfileUI();
  initSidebar();

  document.getElementById('btn-add-waypoint').onclick  = () => openWaypointModal();
  document.getElementById('btn-add-category').onclick  = () => openCategoryModal();

  renderWaypointList();
  renderCategoryList();
}
