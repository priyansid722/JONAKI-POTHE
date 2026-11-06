/**
 * utils.js
 * Shared utility functions for Jonaki Pothe.
 *
 * Exports:
 *   sanitizeText(str)
 *   formatTimeAgo(timestamp)
 *   formatDate(timestamp)
 *   showToast(message, type)
 *   showSpinner(container)
 *   hideSpinner(container)
 *   checkRateLimit(uid, db)
 *   updateRateLimitCounter(uid, db)
 *   getCategoryLabel(cat)
 *   getCategoryColor(cat)
 *   getCategoryIcon(cat)
 *   getSeverityLabel(sev)
 *   validateReportForm(data)
 *   debounce(fn, ms)
 *   generateId()
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORIES = {
  dark_street:   { label: 'Dark Street',    color: '#14213D', icon: '🌑' },
  stray_dogs:    { label: 'Stray Dogs',     color: '#F4A259', icon: '🐕' },
  waterlogging:  { label: 'Waterlogging',   color: '#B9A7E8', icon: '💧' },
  isolated_area: { label: 'Isolated Area',  color: '#F7A8C4', icon: '🚷' },
  broken_road:   { label: 'Broken Road',    color: '#E5646E', icon: '🚧' },
  safe_spot:     { label: 'Safe Spot',      color: '#4CAF82', icon: '✅' }
};

/**
 * Returns a human-readable label for a category code.
 * @param {string} cat
 * @returns {string}
 */
export function getCategoryLabel(cat) {
  return CATEGORIES[cat]?.label ?? cat;
}

/**
 * Returns the hex color associated with a category.
 * @param {string} cat
 * @returns {string}
 */
export function getCategoryColor(cat) {
  return CATEGORIES[cat]?.color ?? '#14213D';
}

/**
 * Returns an emoji icon for a category.
 * @param {string} cat
 * @returns {string}
 */
export function getCategoryIcon(cat) {
  return CATEGORIES[cat]?.icon ?? '📍';
}

// ─── Severity ─────────────────────────────────────────────────────────────────

const SEVERITY = {
  low:    'Low Risk',
  medium: 'Medium Risk',
  high:   'High Risk'
};

/**
 * Returns a human-readable severity label.
 * @param {'low'|'medium'|'high'} sev
 * @returns {string}
 */
export function getSeverityLabel(sev) {
  return SEVERITY[sev] ?? sev;
}

// ─── Text sanitization ───────────────────────────────────────────────────────

/**
 * Strip HTML tags from a string and enforce a 500-character limit.
 * Uses a temporary DOM element so no regex is needed for tag stripping.
 *
 * @param {string} str
 * @returns {string}
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  const el = document.createElement('div');
  el.innerHTML = str;
  return (el.textContent || el.innerText || '').trim().slice(0, 500);
}

// ─── Date / time helpers ─────────────────────────────────────────────────────

/**
 * Convert a Firestore Timestamp or JS Date to a relative "time ago" string.
 * @param {import('firebase/firestore').Timestamp | Date | null} timestamp
 * @returns {string}
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return '';

  const date = _toDate(timestamp);
  if (!date) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 30)   return 'just now';
  if (seconds < 90)   return '1 minute ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 7200) return '1 hour ago';
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return 'yesterday';
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 1209600) return '1 week ago';
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
  if (seconds < 5184000) return '1 month ago';
  return `${Math.floor(seconds / 2592000)} months ago`;
}

/**
 * Convert a Firestore Timestamp or JS Date to a readable date string.
 * @param {import('firebase/firestore').Timestamp | Date | null} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = _toDate(timestamp);
  if (!date) return '';
  return date.toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit'
  });
}

/**
 * Coerce a Firestore Timestamp, plain object with seconds, or JS Date → Date.
 * @param {any} ts
 * @returns {Date | null}
 */
function _toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();     // Firestore Timestamp
  if (ts.seconds != null) return new Date(ts.seconds * 1000); // Plain {seconds, nanoseconds}
  return null;
}

// ─── Toast notifications ─────────────────────────────────────────────────────

let _toastContainer = null;

function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

const TOAST_ICONS = {
  info:    'ℹ️',
  success: '✅',
  error:   '❌',
  warning: '⚠️'
};

/**
 * Display a toast notification that auto-dismisses after 4 seconds.
 *
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 * @param {number} [duration=4000] – milliseconds before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = _getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] ?? 'ℹ️'}</span>
    <span class="toast-msg">${sanitizeText(message)}</span>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  const removeToast = () => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => toast.remove(), 600);
  };

  setTimeout(removeToast, duration);

  // Click to dismiss early
  toast.addEventListener('click', removeToast, { once: true });
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

const SPINNER_ATTR = 'data-spinner';

/**
 * Inject a loading spinner into a container element.
 * Hides the container's existing content while loading.
 *
 * @param {HTMLElement} container
 */
export function showSpinner(container) {
  if (!container) return;

  // Avoid duplicate spinners
  if (container.querySelector('.spinner-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'spinner-wrap';
  wrap.setAttribute(SPINNER_ATTR, 'true');
  wrap.innerHTML = '<div class="spinner" role="status" aria-label="Loading…"></div>';

  container.setAttribute('aria-busy', 'true');
  container.appendChild(wrap);
}

/**
 * Remove the spinner injected by showSpinner().
 *
 * @param {HTMLElement} container
 */
export function hideSpinner(container) {
  if (!container) return;
  const wrap = container.querySelector('.spinner-wrap');
  if (wrap) wrap.remove();
  container.removeAttribute('aria-busy');
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

const DAILY_LIMIT = 10;

/**
 * Check whether a user is allowed to submit another report today.
 *
 * Uses users/{uid}.dailyReportCount and users/{uid}.dailyReportDate.
 * Does NOT mutate; call updateRateLimitCounter() after a successful save.
 *
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(uid, db) {
  if (!uid) return { allowed: false, remaining: 0 };

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { allowed: true, remaining: DAILY_LIMIT };

    const data = snap.data();
    const count = data.dailyReportCount ?? 0;
    const dateStr = data.dailyReportDate ?? null;

    const todayStr = _todayString();

    // If the stored date is not today, the counter resets
    if (dateStr !== todayStr) {
      return { allowed: true, remaining: DAILY_LIMIT };
    }

    const remaining = Math.max(0, DAILY_LIMIT - count);
    return { allowed: remaining > 0, remaining };
  } catch (error) {
    console.error('[utils] checkRateLimit error:', error);
    // Fail open — let the server-side rule handle enforcement
    return { allowed: true, remaining: DAILY_LIMIT };
  }
}

/**
 * Increment the user's daily report counter.
 * Resets to 1 if the stored date is not today.
 *
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<void>}
 */
export async function updateRateLimitCounter(uid, db) {
  if (!uid) return;

  try {
    const userRef = doc(db, 'users', uid);
    const snap    = await getDoc(userRef);
    if (!snap.exists()) return;

    const data     = snap.data();
    const todayStr = _todayString();
    const isSameDay = data.dailyReportDate === todayStr;

    await updateDoc(userRef, {
      dailyReportCount: isSameDay ? (data.dailyReportCount ?? 0) + 1 : 1,
      dailyReportDate:  todayStr
    });
  } catch (error) {
    console.error('[utils] updateRateLimitCounter error:', error);
  }
}

/**
 * Returns today's date as a simple YYYY-MM-DD string in local time.
 * @returns {string}
 */
function _todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Form validation ──────────────────────────────────────────────────────────

const VALID_CATEGORIES = Object.keys(CATEGORIES);
const VALID_SEVERITIES = ['low', 'medium', 'high'];

/**
 * Validate a report form's data object.
 *
 * @param {{ category: string, severity: string, description: string, lat?: number, lng?: number }} data
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateReportForm(data) {
  const errors = {};

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.category = 'Please select a valid category.';
  }

  if (!data.severity || !VALID_SEVERITIES.includes(data.severity)) {
    errors.severity = 'Please select a severity level.';
  }

  const desc = (data.description ?? '').trim();
  if (!desc) {
    errors.description = 'Please describe the hazard.';
  } else if (desc.length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  } else if (desc.length > 500) {
    errors.description = 'Description must not exceed 500 characters.';
  }

  if (data.lat == null || data.lng == null) {
    errors.location = 'Location is required. Please pick a point on the map.';
  } else if (typeof data.lat !== 'number' || typeof data.lng !== 'number') {
    errors.location = 'Invalid location coordinates.';
  } else if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
    errors.location = 'Location coordinates are out of range.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Debounce ──────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that waits `ms` milliseconds before calling.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} ms
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── ID generator ─────────────────────────────────────────────────────────────

/**
 * Generate a random alphanumeric ID string (16 characters).
 * Not cryptographically secure — for client-side UI use only.
 *
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
