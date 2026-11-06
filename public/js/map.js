/**
 * map.js — Main map page module for Jonaki Pothe
 * Uses Firebase v10 modular SDK, Leaflet 1.9.4
 */

import { db, auth } from './firebase-config.js';
import { onAuthChange } from './auth.js';
import { validateReportForm, checkRateLimit, showToast, formatTimeAgo, sanitizeText } from './utils.js';
import { initSOS } from './sos.js';
import { confirmReport, hasUserConfirmed, flagReport } from './report.js';

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment,
  getDocs,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ── Constants ──────────────────────────────────────────────── */
const SILIGURI_CENTER = [26.7271, 88.3953];
const DEFAULT_ZOOM = 13;

const CATEGORIES = [
  { id: 'dark_street',   label: 'Dark Street',    color: '#B9A7E8', emoji: '🌑' },
  { id: 'stray_dogs',    label: 'Stray Dogs',     color: '#F4A259', emoji: '🐕' },
  { id: 'waterlogging',  label: 'Waterlogging',   color: '#60b4d8', emoji: '💧' },
  { id: 'isolated_area', label: 'Isolated Area',  color: '#E5646E', emoji: '⚠️' },
  { id: 'broken_road',   label: 'Broken Road',    color: '#FFD166', emoji: '🚧' },
  { id: 'safe_spot',     label: 'Safe Spot',      color: '#4CAF82', emoji: '✅' },
];

/* ── State ──────────────────────────────────────────────────── */
let map;
let currentUser = null;
let activeCategories = new Set(CATEGORIES.map(c => c.id));
let timeFilter = 'all'; // 'all' | 'day' | 'night'
let reportMarkers = [];   // { marker, data }
let safeSpotMarkers = [];
let userLocationMarker = null;
let userAccuracyCircle = null;
let placedPin = null;    // { lat, lng }
let placedPinMarker = null;
let reportStep = 1;      // 1 or 2
let isPlacingPin = false;
let modalOpen = false;
let sosActive = false;

/* ── Map init ───────────────────────────────────────────────── */
function initMap() {
  map = L.map('map', {
    center: SILIGURI_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  map.on('click', onMapClick);
}

/* ── Custom marker icons ────────────────────────────────────── */
function createCategoryIcon(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div class="marker-dot ${cat.id}" title="${cat.label}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

function createSafeSpotIcon() {
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div class="safe-star-marker">⭐</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div class="user-location-marker"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function createPinIcon() {
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div style="font-size:28px;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

/* ── Load approved reports from Firestore ───────────────────── */
function loadReports() {
  const q = query(
    collection(db, 'reports'),
    where('status', '==', 'approved')
  );

  onSnapshot(q, (snapshot) => {
    // Clear existing markers
    reportMarkers.forEach(({ marker }) => marker.remove());
    reportMarkers = [];

    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      const marker = createReportMarker(data);
      reportMarkers.push({ marker, data });
    });

    applyFilters();
  }, (err) => {
    console.error('Error loading reports:', err);
  });
}

/* ── Create a report marker ─────────────────────────────────── */
function createReportMarker(data) {
  const icon = createCategoryIcon(data.category);
  const marker = L.marker([data.lat, data.lng], { icon });

  marker.on('click', () => {
    openReportPopup(marker, data);
  });

  return marker;
}

/* ── Report popup ───────────────────────────────────────────── */
async function openReportPopup(marker, data) {
  const cat = CATEGORIES.find(c => c.id === data.category) || { label: data.category, emoji: '' };
  const timeAgo = data.createdAt ? formatTimeAgo(data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : '';
  const confirmCount = data.confirmationsCount || 0;

  let confirmed = false;
  let flagged = false;
  if (currentUser) {
    try {
      confirmed = await hasUserConfirmed(data.id, currentUser.uid, db);
    } catch (_) {}
  }

  const timeLabel = data.timeOfDay === 'day' ? '☀️ Day' : data.timeOfDay === 'night' ? '🌙 Night' : '🕐 Any time';
  const sevLabel = data.severity === 'high' ? '🔴 High' : data.severity === 'medium' ? '🟡 Medium' : '🟢 Low';

  const descSafe = sanitizeText(data.description || '');

  const confirmBtn = currentUser
    ? `<button class="popup-btn confirm-btn${confirmed ? ' confirmed' : ''}" data-report-id="${data.id}">
         ${confirmed ? '✓ Confirmed' : '✓ Confirm this'}
       </button>`
    : '';

  const flagBtn = currentUser
    ? `<button class="popup-btn flag-btn" data-report-id="${data.id}">⚑ Flag</button>`
    : '';

  const popupHtml = `
    <div class="popup-inner">
      <div class="popup-category-badge badge-${data.category}">
        ${cat.emoji} ${cat.label}
      </div>
      <div class="popup-desc">${descSafe}</div>
      <div class="popup-meta">
        <span class="popup-meta-tag">${timeLabel}</span>
        <span class="popup-meta-tag">${sevLabel}</span>
        ${data.anonymous ? '<span class="popup-meta-tag">👤 Anonymous</span>' : ''}
      </div>
      <div class="popup-time-ago">${timeAgo}</div>
      <div class="popup-confirmations">✓ ${confirmCount} confirmation${confirmCount !== 1 ? 's' : ''}</div>
      <div class="popup-actions">
        ${confirmBtn}
        ${flagBtn}
      </div>
    </div>
  `;

  const popup = L.popup({
    className: 'marker-popup',
    maxWidth: 280,
    minWidth: 230,
  })
    .setLatLng([data.lat, data.lng])
    .setContent(popupHtml)
    .openOn(map);

  // Wire up popup buttons after open
  setTimeout(() => {
    const confirmBtnEl = document.querySelector(`.popup-btn.confirm-btn[data-report-id="${data.id}"]`);
    const flagBtnEl = document.querySelector(`.popup-btn.flag-btn[data-report-id="${data.id}"]`);

    if (confirmBtnEl && !confirmed) {
      confirmBtnEl.addEventListener('click', async () => {
        if (!currentUser) return;
        confirmBtnEl.disabled = true;
        try {
          await confirmReport(data.id, currentUser.uid, db);
          confirmBtnEl.textContent = '✓ Confirmed';
          confirmBtnEl.classList.add('confirmed');
          showToast('Thank you for confirming! 🙏', 'success');
        } catch (e) {
          console.error(e);
          showToast('Could not confirm. Try again.', 'error');
          confirmBtnEl.disabled = false;
        }
      });
    }

    if (flagBtnEl) {
      flagBtnEl.addEventListener('click', async () => {
        if (!currentUser) return;
        flagBtnEl.disabled = true;
        try {
          await flagReport(data.id, currentUser.uid, db);
          flagBtnEl.textContent = '⚑ Flagged';
          flagBtnEl.classList.add('flagged');
          showToast('Report flagged for review.', 'success');
        } catch (e) {
          console.error(e);
          showToast('Could not flag. Try again.', 'error');
          flagBtnEl.disabled = false;
        }
      });
    }
  }, 100);
}

/* ── Load safe spots ────────────────────────────────────────── */
function loadSafeSpots() {
  onSnapshot(collection(db, 'safe_spots'), (snapshot) => {
    safeSpotMarkers.forEach(m => m.remove());
    safeSpotMarkers = [];

    snapshot.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      const icon = createSafeSpotIcon();
      const marker = L.marker([data.lat, data.lng], { icon });

      const phone = data.phone
        ? `<a class="popup-phone-link" href="tel:${data.phone}">📞 ${data.phone}</a>`
        : '';
      const open24 = data.open24h
        ? '<span class="open-24h-badge">🕐 24h</span>'
        : '';

      marker.bindPopup(`
        <div class="popup-inner popup-safe-spot">
          <div class="popup-category-badge">✅ Safe Spot</div>
          <div class="popup-desc" style="font-weight:700">${sanitizeText(data.name || '')}</div>
          <div class="popup-meta-tag" style="margin-bottom:6px">${sanitizeText(data.type || '')}${open24}</div>
          ${phone}
        </div>
      `, {
        className: 'marker-popup',
        maxWidth: 260,
      });

      marker.addTo(map);
      safeSpotMarkers.push(marker);
    });
  });
}

/* ── Filtering ──────────────────────────────────────────────── */
function applyFilters() {
  reportMarkers.forEach(({ marker, data }) => {
    const catOk = activeCategories.has(data.category);
    const timeOk = timeFilter === 'all' ||
      data.timeOfDay === timeFilter ||
      data.timeOfDay === 'both';

    if (catOk && timeOk) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      if (map.hasLayer(marker)) marker.remove();
    }
  });
}

function setupFilterBar() {
  // Category chips
  document.querySelectorAll('.filter-chip[data-category]').forEach(chip => {
    chip.addEventListener('click', () => {
      const catId = chip.dataset.category;
      if (catId === 'all') {
        if (activeCategories.size === CATEGORIES.length) {
          activeCategories.clear();
          chip.classList.remove('active');
        } else {
          activeCategories = new Set(CATEGORIES.map(c => c.id));
          chip.classList.add('active');
          document.querySelectorAll('.filter-chip[data-category]:not([data-category="all"])').forEach(c => c.classList.add('active'));
        }
      } else {
        if (activeCategories.has(catId)) {
          activeCategories.delete(catId);
          chip.classList.remove('active');
        } else {
          activeCategories.add(catId);
          chip.classList.add('active');
        }
        const allChip = document.querySelector('.filter-chip[data-category="all"]');
        if (allChip) {
          allChip.classList.toggle('active', activeCategories.size === CATEGORIES.length);
        }
      }
      applyFilters();
    });
  });

  // Time chips
  document.querySelectorAll('.filter-chip[data-time]').forEach(chip => {
    chip.addEventListener('click', () => {
      timeFilter = chip.dataset.time;
      document.querySelectorAll('.filter-chip[data-time]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilters();
    });
  });
}

/* ── Geolocation ────────────────────────────────────────────── */
function setupMyLocationButton() {
  const btn = document.getElementById('btn-my-location');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.classList.add('active');
    if (!navigator.geolocation) {
      showToast('Geolocation not supported.', 'error');
      btn.classList.remove('active');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        map.flyTo([latitude, longitude], 16, { duration: 1.2 });

        if (userLocationMarker) userLocationMarker.remove();
        if (userAccuracyCircle) userAccuracyCircle.remove();

        userLocationMarker = L.marker([latitude, longitude], { icon: createUserIcon() }).addTo(map);
        userAccuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#4285f4',
          fillColor: '#4285f4',
          fillOpacity: 0.1,
          weight: 1.5,
        }).addTo(map);

        btn.classList.remove('active');
        showToast('Located you! 📍', 'success');
      },
      (err) => {
        btn.classList.remove('active');
        showToast('Could not get location: ' + err.message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

/* ── Map click handler (pin placement) ──────────────────────── */
function onMapClick(e) {
  if (!isPlacingPin) return;
  placePin(e.latlng.lat, e.latlng.lng);
}

function placePin(lat, lng) {
  placedPin = { lat, lng };
  if (placedPinMarker) placedPinMarker.remove();
  placedPinMarker = L.marker([lat, lng], { icon: createPinIcon(), draggable: true }).addTo(map);

  placedPinMarker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    placedPin = { lat: pos.lat, lng: pos.lng };
  });

  // Show placed info
  const pinInfo = document.getElementById('pin-placed-info');
  if (pinInfo) {
    pinInfo.classList.add('visible');
    pinInfo.textContent = `📍 Pin placed at ${lat.toFixed(4)}, ${lng.toFixed(4)}. Drag to adjust.`;
  }

  const nextBtn = document.getElementById('btn-next-step');
  if (nextBtn) nextBtn.classList.add('visible');

  hidePinInstruction();
  isPlacingPin = false;
  map.getContainer().style.cursor = '';
}

/* ── Pin instruction overlay ────────────────────────────────── */
function showPinInstruction() {
  const el = document.getElementById('pin-instruction');
  if (el) el.classList.add('active');
  isPlacingPin = true;
  map.getContainer().style.cursor = 'crosshair';
}

function hidePinInstruction() {
  const el = document.getElementById('pin-instruction');
  if (el) el.classList.remove('active');
}

/* ── Report modal ───────────────────────────────────────────── */
function setupReportModal() {
  const modal = document.getElementById('report-modal');
  const backdrop = document.querySelector('.report-modal-backdrop');
  const fab = document.querySelector('.add-report-fab');
  const closeBtns = document.querySelectorAll('.modal-close-btn');
  const cancelBtns = document.querySelectorAll('.btn-cancel-modal');

  if (fab) {
    fab.addEventListener('click', () => openReportModal());
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => closeReportModal());
  }

  closeBtns.forEach(btn => btn.addEventListener('click', () => closeReportModal()));
  cancelBtns.forEach(btn => btn.addEventListener('click', () => closeReportModal()));

  // Step 1 — Tap map
  const tapMapBtn = document.getElementById('btn-tap-map');
  if (tapMapBtn) {
    tapMapBtn.addEventListener('click', () => {
      closeReportModal(false); // keep backdrop, just slide down modal
      showPinInstruction();
    });
  }

  // Step 1 — Use my location
  const useLocBtn = document.getElementById('btn-use-my-location-pin');
  if (useLocBtn) {
    useLocBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation not supported.', 'error');
        return;
      }
      useLocBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          placePin(pos.coords.latitude, pos.coords.longitude);
          useLocBtn.disabled = false;
          showToast('Location captured!', 'success');
        },
        (err) => {
          useLocBtn.disabled = false;
          showToast('Could not get location: ' + err.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Cancel pin placement
  const pinCancelBtn = document.getElementById('pin-cancel-btn');
  if (pinCancelBtn) {
    pinCancelBtn.addEventListener('click', () => {
      hidePinInstruction();
      isPlacingPin = false;
      map.getContainer().style.cursor = '';
      openReportModal();
    });
  }

  // Step 1 → Step 2
  const nextBtn = document.getElementById('btn-next-step');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!placedPin) {
        showToast('Please place a pin first.', 'error');
        return;
      }
      setReportStep(2);
    });
  }

  // Description char counter
  const descTextarea = document.getElementById('report-description');
  const charCounter = document.getElementById('desc-char-counter');
  if (descTextarea && charCounter) {
    descTextarea.addEventListener('input', () => {
      const len = descTextarea.value.length;
      charCounter.textContent = `${len} / 500`;
      charCounter.classList.toggle('warn', len > 500 || (len > 0 && len < 10));
    });
  }

  // Submit
  const submitBtn = document.getElementById('btn-submit-report');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleReportSubmit);
  }
}

function openReportModal(keepPlacedPin = true) {
  if (!keepPlacedPin) {
    // Reset pin info display if no pin
  }
  const modal = document.getElementById('report-modal');
  const backdrop = document.querySelector('.report-modal-backdrop');
  if (modal) modal.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  modalOpen = true;
  setReportStep(placedPin ? 1 : 1);
  updatePinPlacedDisplay();
}

function closeReportModal(resetPin = true) {
  const modal = document.getElementById('report-modal');
  const backdrop = document.querySelector('.report-modal-backdrop');
  if (modal) modal.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  modalOpen = false;
  if (resetPin) {
    resetReportModal();
  }
}

function resetReportModal() {
  placedPin = null;
  if (placedPinMarker) { placedPinMarker.remove(); placedPinMarker = null; }
  isPlacingPin = false;
  map.getContainer().style.cursor = '';
  setReportStep(1);

  const pinInfo = document.getElementById('pin-placed-info');
  if (pinInfo) pinInfo.classList.remove('visible');
  const nextBtn = document.getElementById('btn-next-step');
  if (nextBtn) nextBtn.classList.remove('visible');

  // Reset form
  const form = document.getElementById('report-form');
  if (form) form.reset();
  const charCounter = document.getElementById('desc-char-counter');
  if (charCounter) charCounter.textContent = '0 / 500';

  // Clear errors
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('visible'));
}

function setReportStep(step) {
  reportStep = step;
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step-panel-${step}`);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.report-step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    const stepNum = i + 1;
    if (stepNum < step) s.classList.add('done');
    else if (stepNum === step) s.classList.add('active');
  });
}

function updatePinPlacedDisplay() {
  const pinInfo = document.getElementById('pin-placed-info');
  const nextBtn = document.getElementById('btn-next-step');
  if (placedPin) {
    if (pinInfo) {
      pinInfo.classList.add('visible');
      pinInfo.textContent = `📍 Pin at ${placedPin.lat.toFixed(4)}, ${placedPin.lng.toFixed(4)}. Drag on map to adjust.`;
    }
    if (nextBtn) nextBtn.classList.add('visible');
  } else {
    if (pinInfo) pinInfo.classList.remove('visible');
    if (nextBtn) nextBtn.classList.remove('visible');
  }
}

/* ── Report submit ──────────────────────────────────────────── */
async function handleReportSubmit() {
  if (!currentUser) {
    showToast('Please sign in to report.', 'error');
    return;
  }
  if (!placedPin) {
    showToast('Please place a pin first.', 'error');
    setReportStep(1);
    return;
  }

  const category = document.getElementById('report-category')?.value;
  const description = document.getElementById('report-description')?.value?.trim();
  const timeOfDay = document.querySelector('input[name="timeOfDay"]:checked')?.value;
  const severity = document.querySelector('input[name="severity"]:checked')?.value;
  const anonymous = document.getElementById('report-anonymous')?.checked || false;

  // Validate
  const { errors } = validateReportForm({ category, description, timeOfDay, severity });
  let hasErrors = false;
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('visible'));

  if (errors.category) {
    const el = document.getElementById('error-category');
    if (el) { el.textContent = errors.category; el.classList.add('visible'); }
    hasErrors = true;
  }
  if (errors.description) {
    const el = document.getElementById('error-description');
    if (el) { el.textContent = errors.description; el.classList.add('visible'); }
    hasErrors = true;
  }
  if (errors.timeOfDay) {
    const el = document.getElementById('error-timeofday');
    if (el) { el.textContent = errors.timeOfDay; el.classList.add('visible'); }
    hasErrors = true;
  }
  if (errors.severity) {
    const el = document.getElementById('error-severity');
    if (el) { el.textContent = errors.severity; el.classList.add('visible'); }
    hasErrors = true;
  }
  if (hasErrors) return;

  // Rate limit
  try {
    const { allowed: rateLimitAllowed } = await checkRateLimit(currentUser.uid, db);
    if (!rateLimitAllowed) {
      showToast('You\'ve reached the daily report limit. Try tomorrow.', 'error');
      return;
    }
  } catch (e) {
    console.error('Rate limit check error:', e);
  }

  const submitBtn = document.getElementById('btn-submit-report');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const batch = writeBatch(db);

    const reportRef = doc(collection(db, 'reports'));
    batch.set(reportRef, {
      category,
      description: sanitizeText(description),
      timeOfDay,
      severity,
      lat: placedPin.lat,
      lng: placedPin.lng,
      status: 'pending',
      confirmationsCount: 0,
      createdAt: serverTimestamp(),
      anonymous,
      flagged: false,
    });

    const authorRef = doc(collection(db, 'report_authors'));
    batch.set(authorRef, {
      uid: currentUser.uid,
      reportId: reportRef.id,
      createdAt: serverTimestamp(),
    });

    // Update user daily count
    const userRef = doc(db, 'users', currentUser.uid);
    batch.set(userRef, {
      dailyReportCount: increment(1),
      dailyReportDate: new Date().toISOString().split('T')[0],
    }, { merge: true });

    await batch.commit();

    showToast('Report submitted! It will appear after review. 🙏', 'success');
    closeReportModal();
  } catch (e) {
    console.error('Submit error:', e);
    showToast('Failed to submit. Please try again.', 'error');
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ── Legend ─────────────────────────────────────────────────── */
function buildLegend() {
  const content = document.getElementById('legend-content');
  if (!content) return;

  content.innerHTML = CATEGORIES.map(cat => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${cat.color}"></div>
      <span>${cat.emoji} ${cat.label}</span>
    </div>
  `).join('');

  const toggleBtn = document.querySelector('.legend-toggle-btn');
  const box = document.getElementById('legend-box');
  if (toggleBtn && box) {
    toggleBtn.addEventListener('click', () => {
      box.classList.toggle('collapsed');
    });
  }
}

/* ── SOS button ─────────────────────────────────────────────── */
function setupSOSButton() {
  const sosFab = document.querySelector('.sos-fab');
  if (!sosFab) return;

  sosFab.addEventListener('click', () => {
    if (!currentUser) return;
    initSOS(map, auth, db);
  });
}

/* ── Auth state ─────────────────────────────────────────────── */
function setupAuth() {
  onAuthChange((user) => {
    currentUser = user;
    updateAuthUI(user);
  });
}

function updateAuthUI(user) {
  const dot = document.querySelector('.auth-dot');
  const label = document.querySelector('.auth-indicator .auth-label');
  const loginBtn = document.querySelector('.header-login-btn');
  const sosFab = document.querySelector('.sos-fab');

  if (user) {
    if (dot) dot.classList.add('logged-in');
    if (label) label.textContent = user.displayName || user.email || 'Signed in';
    if (loginBtn) loginBtn.style.display = 'none';
    if (sosFab) sosFab.classList.remove('hidden');
  } else {
    if (dot) dot.classList.remove('logged-in');
    if (label) label.textContent = 'Not signed in';
    if (loginBtn) loginBtn.style.display = '';
    if (sosFab) sosFab.classList.add('hidden');
  }
}

/* ── Zoom controls ──────────────────────────────────────────── */
function setupZoomControls() {
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => map.zoomIn());
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => map.zoomOut());
}

/* ── Filter chip init (mark all active) ─────────────────────── */
function initFilterChips() {
  document.querySelectorAll('.filter-chip[data-category]').forEach(chip => {
    chip.classList.add('active');
  });
  const allTimeChip = document.querySelector('.filter-chip[data-time="all"]');
  if (allTimeChip) allTimeChip.classList.add('active');
}

/* ── On-page error banner ────────────────────────────────────── */
function showMapError(msg) {
  // Remove any existing banner first
  document.getElementById('map-error-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'map-error-banner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = [
    'position:fixed', 'top:60px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:9000', 'background:#E5646E', 'color:#fff',
    'padding:12px 20px', 'border-radius:12px', 'font-size:0.9rem',
    'max-width:90vw', 'text-align:center',
    'box-shadow:0 4px 16px rgba(0,0,0,0.25)', 'font-family:Nunito,sans-serif'
  ].join(';');
  banner.textContent = msg;
  document.body.appendChild(banner);
}

/* ── Boot ───────────────────────────────────────────────────── */
function boot() {
  // Guard: Leaflet must be loaded before we try to use L.*
  if (typeof L === 'undefined') {
    showMapError('Map library failed to load. Please check your connection and reload the page.');
    return;
  }

  try {
    initMap();
  } catch (e) {
    showMapError('Could not start the map: ' + e.message);
    console.error('[map] initMap failed:', e);
    return;
  }

  buildLegend();
  initFilterChips();
  setupFilterBar();
  setupMyLocationButton();
  setupZoomControls();
  setupReportModal();
  setupSOSButton();
  setupAuth();

  try {
    loadReports();
    loadSafeSpots();
  } catch (e) {
    showMapError('Could not connect to the database. Please reload the page.');
    console.error('[map] Firestore load failed:', e);
  }
}

document.addEventListener('DOMContentLoaded', boot);
