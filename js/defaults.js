const DEFAULT_CATEGORIES = [
  { id: 'spawn',        name: '生まれた場所',         color: '#E8D44D', icon: '🏠' },
  { id: 'village',      name: '村',                   color: '#7BC67E', icon: '🏘️' },
  { id: 'nether_portal',name: 'ネザーゲート',          color: '#9B59B6', icon: '🌀' },
  { id: 'end_portal',   name: 'エンドポータル',        color: '#2C3E50', icon: '⭐' },
  { id: 'desert_temple',name: '砂漠の神殿',            color: '#E67E22', icon: '🏛️' },
  { id: 'ocean_monument',name:'海底神殿',              color: '#3498DB', icon: '🔱' },
  { id: 'jungle_temple',name: 'ジャングルの神殿',      color: '#27AE60', icon: '🌿' },
  { id: 'mineshaft',    name: '廃坑',                  color: '#795548', icon: '⛏️' },
  { id: 'stronghold',   name: '要塞',                  color: '#607D8B', icon: '🏰' },
  { id: 'pillager_post',name: '略奪者の前哨基地',      color: '#C0392B', icon: '🗼' },
  { id: 'mansion',      name: 'ウッドランドマンション', color: '#6D4C41', icon: '🏚️' },
  { id: 'shipwreck',    name: '沈没船',                color: '#1A6B8A', icon: '⚓' },
  { id: 'nether_fortress',name:'ネザー要塞',           color: '#BF360C', icon: '🔥' },
  { id: 'bastion',      name: 'バスチョン遺跡',        color: '#4A148C', icon: '👹' },
  { id: 'end_city',     name: 'エンドシティ',          color: '#880E4F', icon: '🌸' },
  { id: 'ruined_portal',name: '廃墟ポータル',          color: '#6A1B9A', icon: '🪨' },
  { id: 'buried_treasure',name:'埋蔵宝',              color: '#F9A825', icon: '💎' },
  { id: 'base',         name: '拠点',                  color: '#E53935', icon: '�' },
  { id: 'mining',       name: 'マイニング拠点',        color: '#546E7A', icon: '⛏️' },
  { id: 'farm',         name: '農場',                  color: '#558B2F', icon: '🌾' },
  { id: 'other',        name: 'その他',                color: '#90A4AE', icon: '📍' },
];

const DEFAULT_WAYPOINTS = [
  { id: 'w1', name: '生まれた場所',    x:    0, y: 64, z:    0, categoryId: 'spawn',    note: 'スポーン地点' },
  { id: 'w2', name: '最初の村',        x:  120, y: 64, z:  -85, categoryId: 'village',  note: '交易に便利' },
  { id: 'w3', name: 'ネザーゲート#1',  x:  -32, y: 64, z:   48, categoryId: 'nether_portal', note: '拠点近く' },
  { id: 'w4', name: 'マイニング入口',  x:  -45, y: 12, z:   33, categoryId: 'mining',   note: 'ダイヤ層付近' },
  { id: 'w5', name: '拠点',            x:   80, y: 64, z:  -20, categoryId: 'base',     note: 'メイン拠点' },
  { id: 'w6', name: '砂漠の神殿',      x:  340, y: 64, z:  210, categoryId: 'desert_temple', note: '宝箱あり' },
];

export { DEFAULT_CATEGORIES, DEFAULT_WAYPOINTS };
