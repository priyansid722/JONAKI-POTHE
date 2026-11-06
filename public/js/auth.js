/**
 * auth.js
 * Authentication helper module for Jonaki Pothe.
 *
 * Exports:
 *   signInWithGoogle()          – Google OAuth popup sign-in
 *   createUserProfile()         – Create Firestore users/{uid} doc after consent
 *   signOutUser()               – Firebase sign-out
 *   getCurrentUser()            – Returns auth.currentUser
 *   isAdmin()                   – Checks custom claim admin === true (Promise<boolean>)
 *   onAuthChange()              – Wraps onAuthStateChanged
 *   checkUserProfileExists()    – Returns boolean for users/{uid} existence
 *   getUserProfile()            – Fetches users/{uid} doc data
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { auth, db } from './firebase-config.js';

// ─── Google Auth Provider ────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google via popup.
 *
 * Does NOT create a Firestore user profile — that is deferred until the user
 * accepts the consent checkbox (call createUserProfile() separately).
 *
 * @returns {Promise<{ user: import('firebase/auth').User, isNewUser: boolean }>}
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Determine whether this uid already has a profile doc
    const profileExists = await checkUserProfileExists(user.uid);

    return { user, isNewUser: !profileExists };
  } catch (error) {
    // Surface meaningful errors to the caller
    console.error('[auth] signInWithGoogle error:', error.code, error.message);
    throw _mapAuthError(error);
  }
}

/**
 * Create a Firestore profile document for a newly consenting user.
 * Must only be called AFTER the user has checked the consent checkbox.
 *
 * @param {import('firebase/auth').User} user       – Firebase Auth user object
 * @param {boolean}                      consentAccepted – must be true
 * @returns {Promise<void>}
 */
export async function createUserProfile(user, consentAccepted) {
  if (!consentAccepted) {
    throw new Error('Consent must be accepted before creating a user profile.');
  }

  if (!user || !user.uid) {
    throw new Error('A valid Firebase user object is required.');
  }

  try {
    const userRef = doc(db, 'users', user.uid);

    // Guard: do not overwrite an existing profile
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      console.info('[auth] User profile already exists for uid:', user.uid);
      return;
    }

    await setDoc(userRef, {
      name:             user.displayName  || 'Anonymous',
      email:            user.email        || '',
      photoURL:         user.photoURL     || '',
      joinedAt:         serverTimestamp(),
      consentAccepted:  true,
      role:             'user',
      // Rate-limiting counters (maintained in utils.js)
      dailyReportCount: 0,
      dailyReportDate:  null
    });

    console.info('[auth] User profile created for uid:', user.uid);
  } catch (error) {
    console.error('[auth] createUserProfile error:', error);
    throw error;
  }
}

/**
 * Sign the current user out.
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  try {
    await signOut(auth);
    console.info('[auth] User signed out.');
  } catch (error) {
    console.error('[auth] signOut error:', error);
    throw error;
  }
}

/**
 * Return the currently authenticated Firebase user, or null.
 * @returns {import('firebase/auth').User | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Check whether the current user has the `admin` custom claim.
 *
 * Custom claims are set server-side via the Firebase Admin SDK (Cloud Function).
 * Returns false if no user is signed in.
 *
 * @returns {Promise<boolean>}
 */
export async function isAdmin() {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    // Force-refresh to get latest claims
    const tokenResult = await user.getIdTokenResult(/* forceRefresh */ true);
    return tokenResult.claims.admin === true;
  } catch (error) {
    console.error('[auth] isAdmin error:', error);
    return false;
  }
}

/**
 * Subscribe to authentication state changes.
 *
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Check whether a Firestore profile document exists for the given uid.
 *
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function checkUserProfileExists(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists();
  } catch (error) {
    console.error('[auth] checkUserProfileExists error:', error);
    return false;
  }
}

/**
 * Fetch the Firestore profile data for a given uid.
 *
 * @param {string} uid
 * @returns {Promise<Record<string, any> | null>}
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch (error) {
    console.error('[auth] getUserProfile error:', error);
    return null;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Map Firebase Auth error codes to user-friendly Error objects.
 * @param {import('firebase/auth').FirebaseError} error
 * @returns {Error}
 */
function _mapAuthError(error) {
  const messages = {
    'auth/popup-closed-by-user':     'Sign-in was cancelled. Please try again.',
    'auth/popup-blocked':            'Pop-up was blocked by your browser. Please allow pop-ups for this site.',
    'auth/cancelled-popup-request':  'Sign-in was cancelled.',
    'auth/network-request-failed':   'A network error occurred. Please check your connection.',
    'auth/too-many-requests':        'Too many sign-in attempts. Please wait a moment and try again.',
    'auth/user-disabled':            'This account has been disabled. Please contact support.',
    'auth/account-exists-with-different-credential':
      'An account already exists with the same email address but a different sign-in method.'
  };

  const friendlyMessage = messages[error.code] || `Sign-in failed: ${error.message}`;
  const mappedError = new Error(friendlyMessage);
  mappedError.code  = error.code;
  return mappedError;
}
