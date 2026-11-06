/**
 * report.js — Report CRUD module for Jonaki Pothe
 *
 * Exports:
 *   submitReport(reportData, uid, db)   – Save report + author atomically
 *   deleteReport(reportId, uid, db)     – Delete own report
 *   getUserReports(uid, db)             – Fetch user's own reports
 *   confirmReport(reportId, uid, db)    – Add a confirmation
 *   hasUserConfirmed(reportId, uid, db) – Check if already confirmed
 *   flagReport(reportId, uid, db)       – Flag a report for review
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── Submit a new report (atomic batch) ──────────────────────────────────────

/**
 * Save a new report and its author record atomically.
 *
 * The report document deliberately omits the author's uid.
 * The uid is stored only in report_authors/{reportId} (private collection).
 *
 * @param {{ category, description, timeOfDay, severity, lat, lng, anonymous }} reportData
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<string>} The new report's document ID
 */
export async function submitReport(reportData, uid, db) {
  const { category, description, timeOfDay, severity, lat, lng, anonymous } = reportData;

  const batch = writeBatch(db);

  // Generate a new report doc ref
  const reportRef = doc(collection(db, 'reports'));
  batch.set(reportRef, {
    category,
    description,     // already sanitized by caller (via sanitizeText)
    timeOfDay,
    severity,
    lat,
    lng,
    status:              'pending',
    confirmationsCount:  0,
    anonymous:           !!anonymous,
    flagged:             false,
    createdAt:           serverTimestamp(),
  });

  // Author record — private collection, uid here only
  const authorRef = doc(db, 'report_authors', reportRef.id);
  batch.set(authorRef, {
    uid,
    reportId:  reportRef.id,
    createdAt: serverTimestamp(),
  });

  // Update daily counter on the user doc
  const userRef = doc(db, 'users', uid);
  const todayStr = _todayString();
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    const isSameDay = data.dailyReportDate === todayStr;
    batch.update(userRef, {
      dailyReportCount: isSameDay ? increment(1) : 1,
      dailyReportDate:  todayStr,
    });
  }

  await batch.commit();
  return reportRef.id;
}

// ─── Delete a report (owner only) ────────────────────────────────────────────

/**
 * Delete a report and its author record.
 * Verifies that the report belongs to the requesting user first.
 *
 * @param {string} reportId
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<void>}
 */
export async function deleteReport(reportId, uid, db) {
  // Verify ownership via report_authors
  const authorRef  = doc(db, 'report_authors', reportId);
  const authorSnap = await getDoc(authorRef);

  if (!authorSnap.exists()) {
    throw new Error('Report not found or already deleted.');
  }
  if (authorSnap.data().uid !== uid) {
    throw new Error('You can only delete your own reports.');
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, 'reports', reportId));
  batch.delete(authorRef);
  await batch.commit();
}

// ─── Get a user's own reports ─────────────────────────────────────────────────

/**
 * Fetch the signed-in user's own reports by joining report_authors → reports.
 *
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<Array<Object>>}  Array of report objects (with id field)
 */
export async function getUserReports(uid, db) {
  if (!uid) return [];

  // 1. Get all report_authors docs for this user
  const authorsQ    = query(collection(db, 'report_authors'), where('uid', '==', uid));
  const authorsSnap = await getDocs(authorsQ);

  if (authorsSnap.empty) return [];

  // 2. Fetch each corresponding report doc
  const fetches = authorsSnap.docs.map(async (authorDoc) => {
    const reportId   = authorDoc.data().reportId;
    if (!reportId) return null;
    const reportSnap = await getDoc(doc(db, 'reports', reportId));
    if (!reportSnap.exists()) return null;
    return { id: reportId, ...reportSnap.data() };
  });

  const results = await Promise.all(fetches);
  // Sort newest first; filter nulls
  return results
    .filter(Boolean)
    .sort((a, b) => {
      const aT = a.createdAt?.seconds ?? 0;
      const bT = b.createdAt?.seconds ?? 0;
      return bT - aT;
    });
}

// ─── Confirm a report ─────────────────────────────────────────────────────────

/**
 * Add a confirmation for a report (once per user).
 * Writes to reports/{reportId}/confirmations/{uid} and
 * increments reports/{reportId}.confirmationsCount.
 *
 * @param {string} reportId
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<void>}
 */
export async function confirmReport(reportId, uid, db) {
  const confirmRef = doc(db, 'reports', reportId, 'confirmations', uid);

  // Guard: already confirmed?
  const snap = await getDoc(confirmRef);
  if (snap.exists()) {
    throw new Error('You have already confirmed this report.');
  }

  const batch = writeBatch(db);
  batch.set(confirmRef, { confirmedAt: serverTimestamp() });
  batch.update(doc(db, 'reports', reportId), {
    confirmationsCount: increment(1),
  });
  await batch.commit();
}

// ─── Check if user has confirmed ─────────────────────────────────────────────

/**
 * @param {string} reportId
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<boolean>}
 */
export async function hasUserConfirmed(reportId, uid, db) {
  if (!reportId || !uid) return false;
  try {
    const snap = await getDoc(doc(db, 'reports', reportId, 'confirmations', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

// ─── Flag a report ────────────────────────────────────────────────────────────

/**
 * Flag a report for admin review (once per user).
 * If a report accumulates 3+ flags it is also marked flagged=true.
 *
 * @param {string} reportId
 * @param {string} uid
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<void>}
 */
export async function flagReport(reportId, uid, db) {
  const flagRef = doc(db, 'reports', reportId, 'flags', uid);

  const snap = await getDoc(flagRef);
  if (snap.exists()) {
    throw new Error('You have already flagged this report.');
  }

  const batch = writeBatch(db);
  batch.set(flagRef, { flaggedAt: serverTimestamp() });

  // Count existing flags to decide whether to mark the report flagged
  const flagsSnap = await getDocs(collection(db, 'reports', reportId, 'flags'));
  if (flagsSnap.size >= 2) {   // 2 existing + this one = 3
    batch.update(doc(db, 'reports', reportId), { flagged: true });
  }

  await batch.commit();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
