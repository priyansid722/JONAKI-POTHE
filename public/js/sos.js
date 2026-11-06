/**
 * sos.js — SOS module for Jonaki Pothe
 * Handles SOS countdown, geolocation, emergency contacts, and action screen.
 */

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Toast helper (falls back gracefully if utils not loaded) ────────────────
function _toast(msg, type = "error") {
  if (typeof window.showToast === "function") {
    window.showToast(msg, type);
    return;
  }
  // Minimal built-in fallback
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${type === "error" ? "#E5646E" : "#4CAF82"};color:#fff;
    padding:12px 20px;border-radius:10px;z-index:9999;font-size:0.95rem;
    box-shadow:0 4px 12px rgba(0,0,0,0.25);max-width:90vw;text-align:center;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ─── Overlay helpers ─────────────────────────────────────────────────────────
function _showOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = "flex";
    el.setAttribute("aria-hidden", "false");
  }
}
function _hideOverlay(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
  }
}

// ─── Build SOS action screen HTML ────────────────────────────────────────────
function _buildSOSActionScreen(lat, lng, contacts, locationFailed) {
  const mapLink =
    lat !== null && lng !== null
      ? `https://maps.google.com/?q=${lat},${lng}`
      : null;

  const shareMessage =
    lat !== null && lng !== null
      ? `I need help. My live location: ${mapLink} — sent via Jonaki Pothe`
      : `I need help. I am using Jonaki Pothe safety app. Please contact me immediately.`;

  let contactsHTML = "";
  if (contacts && contacts.length > 0) {
    contactsHTML = contacts
      .map(
        (c) => `
      <div class="sos-contact-row">
        <span class="sos-contact-name">${_escapeHtml(c.name)}</span>
        <a
          class="btn btn-whatsapp"
          href="https://wa.me/91${encodeURIComponent(c.phone)}?text=${encodeURIComponent(shareMessage)}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Send WhatsApp message to ${_escapeHtml(c.name)}"
        >WhatsApp ${_escapeHtml(c.name)}</a>
        <a
          class="btn btn-sms"
          href="sms:+91${encodeURIComponent(c.phone)}?body=${encodeURIComponent(shareMessage)}"
          aria-label="Send SMS to ${_escapeHtml(c.name)}"
        >SMS ${_escapeHtml(c.name)}</a>
      </div>`
      )
      .join("");
  }

  const locationFailedHtml = locationFailed
    ? `
    <div class="sos-manual-location">
      <label for="sos-manual-loc-input" class="sos-label">Type your location (landmark / address):</label>
      <input
        id="sos-manual-loc-input"
        type="text"
        class="input"
        placeholder="e.g. Near Central Park, main gate"
        aria-label="Your current location"
      />
    </div>`
    : "";

  const shareButtonHtml =
    !locationFailed && lat !== null
      ? `<button id="sos-share-btn" class="btn btn-secondary" aria-label="Share location link">
          📤 Share Location
        </button>`
      : "";

  return `
    <div id="sos-action" class="sos-action-panel" role="dialog" aria-modal="true" aria-label="SOS Actions">
      <div class="sos-action-inner">
        <div class="sos-action-header">
          <span class="sos-action-icon" aria-hidden="true">🚨</span>
          <h2 class="sos-action-title">Emergency Help</h2>
        </div>

        <a
          class="btn btn-call-112"
          href="tel:112"
          aria-label="Call emergency number 112"
        >📞 CALL 112</a>

        ${locationFailedHtml}

        ${
          contactsHTML
            ? `<div class="sos-contacts-section">
                <h3 class="sos-section-heading">Notify Your Contacts</h3>
                ${contactsHTML}
              </div>`
            : `<p class="sos-no-contacts">
                No emergency contacts saved.
                <a href="/emergency-contacts.html">Add contacts</a> to quickly notify them.
              </p>`
        }

        ${shareButtonHtml}

        <div class="sos-disclaimer" role="note">
          <strong>⚠️ Disclaimer:</strong> Jonaki Pothe does not replace emergency services.
          In an emergency, always call <strong>112</strong>.
        </div>

        <button id="sos-close-btn" class="btn btn-outline-red" aria-label="Close SOS panel">
          ✕ CLOSE
        </button>
      </div>
    </div>
  `;
}

// ─── Share / Clipboard helper ─────────────────────────────────────────────────
async function _shareOrCopy(lat, lng) {
  const url = `https://maps.google.com/?q=${lat},${lng}`;
  const text = `I need help. My live location: ${url} — sent via Jonaki Pothe`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "SOS – Jonaki Pothe", text, url });
      _toast("Location shared!", "success");
    } catch (err) {
      if (err.name !== "AbortError") {
        _toast("Could not share. Copying link instead…", "info");
        _copyToClipboard(url);
      }
    }
  } else {
    _copyToClipboard(url);
  }
}

function _copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => _toast("Location link copied to clipboard!", "success"))
      .catch(() => _toast("Could not copy. Please copy manually: " + text, "error"));
  } else {
    // Legacy fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      _toast("Location link copied!", "success");
    } catch {
      _toast("Could not copy. Please copy manually: " + text, "error");
    }
    document.body.removeChild(ta);
  }
}

// ─── HTML escape util ─────────────────────────────────────────────────────────
function _escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, (m) => map[m]);
}

// ─── Render action screen into DOM ────────────────────────────────────────────
function _renderSOSActionScreen(lat, lng, contacts, locationFailed = false) {
  // Remove any existing action panel
  const existing = document.getElementById("sos-action");
  if (existing) existing.remove();

  const html = _buildSOSActionScreen(lat, lng, contacts, locationFailed);
  document.body.insertAdjacentHTML("beforeend", html);

  // Share button
  const shareBtn = document.getElementById("sos-share-btn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => _shareOrCopy(lat, lng));
  }

  // Close button
  const closeBtn = document.getElementById("sos-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const panel = document.getElementById("sos-action");
      if (panel) panel.remove();
    });
  }
}

// ─── Handle location success ──────────────────────────────────────────────────
async function handleSOSLocation(pos, auth, db) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  // Save SOS event to Firestore
  try {
    const uid = auth.currentUser ? auth.currentUser.uid : "anonymous";
    await addDoc(collection(db, "sos_events"), {
      uid,
      lat,
      lng,
      timestamp: serverTimestamp(),
      resolved: false,
    });
  } catch (err) {
    console.error("Failed to save SOS event:", err);
    // Non-fatal — still show action screen
  }

  // Fetch contacts
  let contacts = [];
  if (auth.currentUser) {
    try {
      contacts = await getEmergencyContacts(auth.currentUser.uid, db);
    } catch (err) {
      console.error("Failed to fetch emergency contacts:", err);
    }
  }

  _renderSOSActionScreen(lat, lng, contacts, false);
}

// ─── Handle location error ────────────────────────────────────────────────────
async function handleSOSError(err, auth, db) {
  let message;
  switch (err.code) {
    case err.PERMISSION_DENIED:
      message =
        "Location access denied. Please enable location in browser settings.";
      break;
    case err.POSITION_UNAVAILABLE:
      message =
        "Could not get your location. Please try again or call 112 directly.";
      break;
    case err.TIMEOUT:
      message = "Location request timed out. Call 112 for immediate help.";
      break;
    default:
      message = "Could not determine your location. Please call 112.";
  }
  _toast(message, "error");

  // Still show action screen with Call 112 and manual location field
  let contacts = [];
  if (auth && auth.currentUser) {
    try {
      contacts = await getEmergencyContacts(auth.currentUser.uid, db);
    } catch {
      // ignore
    }
  }

  _renderSOSActionScreen(null, null, contacts, true);
}

// ─── Main exported init function ──────────────────────────────────────────────
/**
 * initSOS(mapInstance, auth, db)
 * Sets up the SOS button with 5-second countdown overlay.
 */
export function initSOS(mapInstance, auth, db) {
  const sosBtn = document.getElementById("sos-btn");
  if (!sosBtn) {
    console.warn("initSOS: #sos-btn not found in DOM.");
    return;
  }

  // Ensure overlay exists in DOM
  let overlay = document.getElementById("sos-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sos-overlay";
    overlay.setAttribute("role", "alertdialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "SOS Countdown");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="sos-countdown-box">
        <p class="sos-countdown-label">Sending SOS in…</p>
        <div id="sos-countdown-number" class="sos-countdown-number" aria-live="assertive" aria-atomic="true">5</div>
        <p class="sos-countdown-hint">Stay calm. Emergency contacts will be notified.</p>
        <button id="sos-cancel-btn" class="btn btn-outline-light">Cancel</button>
      </div>
    `;
    overlay.style.display = "none";
    document.body.appendChild(overlay);
  }

  const cancelBtn = document.getElementById("sos-cancel-btn");
  const countdownEl = document.getElementById("sos-countdown-number");

  let countdownInterval = null;
  let count = 5;

  function startCountdown() {
    count = 5;
    if (countdownEl) countdownEl.textContent = count;
    _showOverlay("sos-overlay");

    countdownInterval = setInterval(() => {
      count--;
      if (countdownEl) countdownEl.textContent = count;

      if (count <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        _hideOverlay("sos-overlay");
        // Request geolocation
        navigator.geolocation.getCurrentPosition(
          (pos) => handleSOSLocation(pos, auth, db),
          (err) => handleSOSError(err, auth, db),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    }, 1000);
  }

  function cancelCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    _hideOverlay("sos-overlay");
    _toast("SOS cancelled.", "info");
  }

  sosBtn.addEventListener("click", startCountdown);

  if (cancelBtn) {
    cancelBtn.addEventListener("click", cancelCountdown);
  }

  // Also allow pressing Escape to cancel
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && countdownInterval) {
      cancelCountdown();
    }
  });
}

// ─── Emergency contact CRUD ───────────────────────────────────────────────────

/**
 * getEmergencyContacts(uid, db)
 * Fetches all docs from users/{uid}/contacts.
 * Returns array of { id, name, phone }.
 */
export async function getEmergencyContacts(uid, db) {
  const snap = await getDocs(collection(db, "users", uid, "contacts"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * saveEmergencyContact(uid, name, phone, db)
 * Validates and saves a contact. Throws on validation error.
 * Returns the new doc reference.
 */
export async function saveEmergencyContact(uid, name, phone, db) {
  const trimName = (name || "").trim();
  const trimPhone = (phone || "").trim().replace(/\s+/g, "");

  if (!trimName) {
    throw new Error("Contact name is required.");
  }
  if (!/^\d{10}$/.test(trimPhone)) {
    throw new Error(
      "Please enter a valid 10-digit Indian mobile number (no country code)."
    );
  }

  // Enforce max 3 contacts
  const existing = await getEmergencyContacts(uid, db);
  if (existing.length >= 3) {
    throw new Error(
      "You can save a maximum of 3 emergency contacts. Please delete one before adding another."
    );
  }

  const ref = await addDoc(collection(db, "users", uid, "contacts"), {
    name: trimName,
    phone: trimPhone,
    createdAt: serverTimestamp(),
  });

  return ref;
}

/**
 * deleteEmergencyContact(uid, contactId, db)
 * Deletes the contact document.
 */
export async function deleteEmergencyContact(uid, contactId, db) {
  await deleteDoc(doc(db, "users", uid, "contacts", contactId));
}
