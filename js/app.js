import { initStore } from './store.js';
import { initMap, rotateMap, resetMapView, setWaypointModalOpener } from './map.js';
import { initUI, openWaypointModal } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initStore();
  initMap(document.getElementById('map-canvas'));
  setWaypointModalOpener(openWaypointModal);
  initUI();

  document.getElementById('btn-rotate').onclick    = rotateMap;
  document.getElementById('btn-reset-view').onclick = resetMapView;
});
