"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  updateDoc,
  writeBatch,
  deleteDoc
} from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/services/firebase";
import { INITIAL_STATS, EMPTY_STATS } from "@/utils/mockData";
import { computeSessionStats } from "@/utils/scoring";

const AuthContext = createContext({
  user: null,
  loading: true,
  isConfigured: false,
  stats: EMPTY_STATS,
  sessions: [],
  sessionsLoaded: false,
  setSessions: () => {},
  setStats: () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  syncGuestData: async () => {},
  addSessionToCloud: async () => {},
  updateSessionInCloud: async () => {},
  deleteSessionFromCloud: async () => {},
  deleteAllCloudHistory: async () => {},
  deleteAccount: async () => {}
});

export const useAuth = () => useContext(AuthContext);

// Firestore rejects `undefined` values and has a 1 MB document limit; blob: audio URLs are
// meaningless after a reload. Strip both before persisting a session.
function toFirestoreSession(session) {
  const clean = JSON.parse(JSON.stringify(session));
  if (clean.reportData) {
    clean.reportData.recordedAudios = {};
    clean.reportData.hindsightLoading = false;
  }
  return clean;
}

function safeIsoDate(value) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false); // cloud history fetched for the current user

  // Check if Firebase is fully initialized and operational
  const isConfigured = isFirebaseConfigured;

  // Firebase auth listener
  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setSessionsLoaded(false);
        setUser(firebaseUser);
        // Load stats and sessions from Firestore in the background (non-blocking)
        loadUserData(firebaseUser.uid, firebaseUser.displayName);
      } else {
        setUser(null);
        setSessions([]);
        setStats(INITIAL_STATS);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isConfigured]);

  // Loads Firestore user data (stats & sessions list)
  async function loadUserData(uid, displayName) {
    try {
      // 1. Fetch or initialize User Profile Doc
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // Initialize default record
        await setDoc(userRef, {
          uid,
          name: displayName || "Student",
          email: auth.currentUser?.email || "",
          createdAt: new Date().toISOString()
        });
      }

      // 2. Fetch user sessions sorted by timestamp/date
      const sessionsRef = collection(db, "users", uid, "vivas");
      const q = query(sessionsRef, orderBy("createdAt", "desc"));
      const sessionsSnap = await getDocs(q);
      
      const loadedSessions = [];
      sessionsSnap.forEach((docSnap) => {
        loadedSessions.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      
      setSessions(loadedSessions);

      // 3. Fetch or initialize User Stats with session-based reconciliation to prevent any mock stats leakage!
      // Same derivation the guest path uses, so identical history gives identical numbers.
      const reconciledStats = computeSessionStats(loadedSessions);

      // Sync computed stats back to Firestore if they differ, securing permanent cloud database consistency
      const statsRef = doc(db, "users", uid, "stats", "dashboard");
      const statsSnap = await getDoc(statsRef);
      let needsWrite = true;
      
      if (statsSnap.exists()) {
        const dbStats = statsSnap.data();
        if (
          dbStats.totalVivas === reconciledStats.totalVivas &&
          dbStats.avgConfidence === reconciledStats.avgConfidence &&
          dbStats.strongestSubject === reconciledStats.strongestSubject &&
          dbStats.weakestSubject === reconciledStats.weakestSubject
        ) {
          needsWrite = false;
        }
      }
      
      if (needsWrite) {
        await setDoc(statsRef, reconciledStats);
      }

      // 4. Fetch user mastery mapping from Firestore
      const masteryRef = doc(db, "users", uid, "mastery", "syllabus");
      const masterySnap = await getDoc(masteryRef);
      if (masterySnap.exists()) {
        localStorage.setItem("vivasim_mastery", JSON.stringify(masterySnap.data()));
      }
      
      setStats(reconciledStats);
    } catch (err) {
      console.error("Error loading user cloud database data:", err);
    } finally {
      setSessionsLoaded(true);
    }
  }

  // 1. Email and Password Signup
  const signupWithEmail = async (email, password, fullName) => {
    if (!isConfigured) throw new Error("Firebase is not configured in environment variables.");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Update display name
    await updateProfile(firebaseUser, { displayName: fullName });
    
    // Create base documents
    await setDoc(doc(db, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      name: fullName,
      email: firebaseUser.email,
      createdAt: new Date().toISOString()
    });

    await setDoc(doc(db, "users", firebaseUser.uid, "stats", "dashboard"), EMPTY_STATS);
    
    setUser({ ...firebaseUser, displayName: fullName });
    setStats(EMPTY_STATS);
    setSessions([]);
  };

  // 2. Email and Password Login
  const loginWithEmail = async (email, password) => {
    if (!isConfigured) throw new Error("Firebase is not configured in environment variables.");
    await signInWithEmailAndPassword(auth, email, password);
  };

  // 3. Google Sign-In (Popup mode is cleanest for browser)
  const loginWithGoogle = async () => {
    if (!isConfigured) throw new Error("Firebase is not configured in environment variables.");
    await signInWithPopup(auth, googleProvider);
  };

  // 4. Logout
  const logout = async () => {
    if (!isConfigured) return;
    await signOut(auth);
  };

  // 5. Add completed Session and update Stats
  const addSessionToCloud = async (newSessionData, updatedStatsData) => {
    if (!user || !isConfigured) return;

    try {
      const uid = user.uid;

      // Update local state first for instant UX responsiveness
      const sessionObj = toFirestoreSession({
        ...newSessionData,
        createdAt: new Date().toISOString()
      });
      
      setSessions((prev) => [sessionObj, ...prev]);
      setStats(updatedStatsData);

      // Write to Firestore in parallel
      const sessionRef = doc(db, "users", uid, "vivas", String(sessionObj.id || `session_${Date.now()}`));
      const statsRef = doc(db, "users", uid, "stats", "dashboard");
      const masteryRef = doc(db, "users", uid, "mastery", "syllabus");

      // Deterministic document id: retries and double-submits overwrite instead of duplicating.
      await setDoc(sessionRef, sessionObj);
      await setDoc(statsRef, updatedStatsData);

      // Upload mastery mapping if available locally
      const localMastery = localStorage.getItem("vivasim_mastery");
      if (localMastery) {
        await setDoc(masteryRef, JSON.parse(localMastery));
      }
    } catch (err) {
      console.error("Failed syncing finished viva session to Cloud Firestore:", err);
      // Roll back the optimistic update so the dashboard doesn't show a session that was never saved.
      setSessions((prev) => prev.filter((s) => s.id !== newSessionData.id));
      throw err;
    }
  };

  // 5b. Attach the (late-arriving) AI retrospective to an already saved session
  const updateSessionInCloud = async (sessionId, hindsightData) => {
    if (!user || !isConfigured || !sessionId || !hindsightData) return;
    try {
      const clean = JSON.parse(JSON.stringify(hindsightData));
      await updateDoc(doc(db, "users", user.uid, "vivas", String(sessionId)), {
        "reportData.hindsightData": clean,
        "reportData.hindsightLoading": false
      });
      setSessions((prev) => prev.map((s) => (s.id === sessionId
        ? { ...s, reportData: { ...(s.reportData || {}), hindsightData: clean, hindsightLoading: false } }
        : s)));
    } catch (err) {
      console.warn("Could not save the session retrospective to the cloud:", err);
    }
  };

  // 5c. Delete one saved session and recompute the dashboard stats from what is left.
  const deleteSessionFromCloud = async (sessionId) => {
    if (!user || !isConfigured || !sessionId) return;
    const uid = user.uid;
    await deleteDoc(doc(db, "users", uid, "vivas", String(sessionId)));
    const remaining = sessions.filter((s) => String(s.id) !== String(sessionId));
    const nextStats = computeSessionStats(remaining);
    await setDoc(doc(db, "users", uid, "stats", "dashboard"), nextStats);
    setSessions(remaining);
    setStats(nextStats);
  };

  // Deletes every practice document under users/{uid} (sessions, stats, topic progress).
  // Firestore batches hold at most 500 writes, so sessions are removed in chunks.
  async function deletePracticeData(uid) {
    const snap = await getDocs(collection(db, "users", uid, "vivas"));
    const refs = snap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 450) {
      const batch = writeBatch(db);
      refs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", uid, "stats", "dashboard"));
    batch.delete(doc(db, "users", uid, "mastery", "syllabus"));
    await batch.commit();
    localStorage.removeItem("vivasim_mastery");
  }

  // 5d. Delete the whole practice history but keep the account.
  const deleteAllCloudHistory = async () => {
    if (!user || !isConfigured) return;
    await deletePracticeData(user.uid);
    setSessions([]);
    setStats(EMPTY_STATS);
  };

  // 5e. Delete the account and everything stored for it. Firebase only allows deleting an account
  // shortly after signing in, so older sign-ins are confirmed again first (Google pop-up, or the
  // password for email accounts). Data is deleted before the account so the security rules still
  // allow it; if the final step fails, the error says so and the user can retry.
  const RECENT_SIGN_IN_MS = 4 * 60 * 1000;
  const deleteAccount = async (password) => {
    const current = auth?.currentUser;
    if (!current || !isConfigured) throw new Error("You need to be signed in to delete an account.");

    const lastSignIn = new Date(current.metadata?.lastSignInTime || 0).getTime();
    if (Date.now() - lastSignIn > RECENT_SIGN_IN_MS) {
      const usesPassword = current.providerData.some((p) => p.providerId === "password");
      if (usesPassword) {
        if (!password) {
          const err = new Error("Enter your password to confirm.");
          err.code = "needs-password";
          throw err;
        }
        await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      } else {
        await reauthenticateWithPopup(current, googleProvider);
      }
    }

    const uid = current.uid;
    await deletePracticeData(uid);
    await deleteDoc(doc(db, "users", uid));
    await deleteUser(current);
    setSessions([]);
    setStats(EMPTY_STATS);
  };

  // 6. Migrate guest sessions from Local Storage to Cloud Firestore
  const syncGuestData = async () => {
    if (!user || !isConfigured) return;

    try {
      const uid = user.uid;
      const cachedSessionsStr = localStorage.getItem("vivasim_sessions");
      const cachedStatsStr = localStorage.getItem("vivasim_stats");

      if (!cachedSessionsStr) return; // Nothing to migrate

      const cachedSessions = JSON.parse(cachedSessionsStr);
      const cachedStats = cachedStatsStr ? JSON.parse(cachedStatsStr) : INITIAL_STATS;

      const batch = writeBatch(db);
      
      // Upload each cached session
      for (const session of cachedSessions) {
        // Skip session placeholders if they already exist in cloud (optional protection)
        const sessionRef = session.id ? doc(db, "users", uid, "vivas", String(session.id)) : doc(collection(db, "users", uid, "vivas"));
        batch.set(sessionRef, toFirestoreSession({
          ...session,
          createdAt: session.createdAt || safeIsoDate(session.date)
        }));
      }

      // Upload merged stats
      const statsRef = doc(db, "users", uid, "stats", "dashboard");
      batch.set(statsRef, cachedStats);

      // Upload mastery if available
      const localMastery = localStorage.getItem("vivasim_mastery");
      if (localMastery) {
        const masteryRef = doc(db, "users", uid, "mastery", "syllabus");
        batch.set(masteryRef, JSON.parse(localMastery));
      }

      await batch.commit();

      // Clear local storage guest artifacts
      localStorage.removeItem("vivasim_sessions");
      localStorage.removeItem("vivasim_stats");
      localStorage.removeItem("vivasim_user");
      localStorage.removeItem("vivasim_paused_session");
      localStorage.removeItem("vivasim_mastery");

      // Reload user data to sync in-memory contexts
      await loadUserData(uid, user.displayName);
    } catch (err) {
      console.error("Local storage guest migration to Cloud Firestore failed:", err);
      throw err;
    }
  };

  const value = {
    user,
    loading,
    isConfigured,
    stats,
    sessions,
    sessionsLoaded,
    setSessions,
    setStats,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    logout,
    syncGuestData,
    addSessionToCloud,
    updateSessionInCloud,
    deleteSessionFromCloud,
    deleteAllCloudHistory,
    deleteAccount
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
