"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  addDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/services/firebase";
import { INITIAL_STATS, EMPTY_STATS } from "@/utils/mockData";

const AuthContext = createContext({
  user: null,
  loading: true,
  isConfigured: false,
  stats: EMPTY_STATS,
  sessions: [],
  setSessions: () => {},
  setStats: () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  syncGuestData: async () => {},
  addSessionToCloud: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [sessions, setSessions] = useState([]);

  // Check if Firebase is fully initialized and operational
  const isConfigured = isFirebaseConfigured;

  // Firebase auth listener
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
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
  const loadUserData = async (uid, displayName) => {
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

      // 3. Fetch or initialize User Stats with Self-Healing Reconciliation
      const statsRef = doc(db, "users", uid, "stats", "dashboard");
      const statsSnap = await getDoc(statsRef);
      
      let reconciledStats = EMPTY_STATS;
      
      if (statsSnap.exists()) {
        const dbStats = statsSnap.data();
        
        // Self-Healing Trigger: If a user has 0 actual sessions but has legacy mock stats in their database
        // (totalVivas > 0, typical of accounts created before our clean-slate update), we auto-reconcile to EMPTY_STATS.
        if (loadedSessions.length === 0 && dbStats.totalVivas > 0) {
          reconciledStats = EMPTY_STATS;
          await setDoc(statsRef, EMPTY_STATS); // Cleanse Firestore legacy record in background
        } else {
          reconciledStats = dbStats;
        }
      } else {
        // Initialize with empty template (or calculated from existing sessions if database was partially out of sync)
        if (loadedSessions.length > 0) {
          const totalVivas = loadedSessions.length;
          const avgConfidence = Math.round(
            loadedSessions.reduce((acc, s) => acc + (s.score || 0), 0) / totalVivas
          );
          let strongest = loadedSessions[0]?.subject || "None yet";
          let weakest = loadedSessions[0]?.subject || "None yet";
          loadedSessions.forEach(s => {
            if ((s.score || 0) > 86) strongest = s.subject;
            if ((s.score || 0) < 72) weakest = s.subject;
          });
          reconciledStats = {
            totalVivas,
            avgConfidence,
            strongestSubject: strongest,
            weakestSubject: weakest
          };
        } else {
          reconciledStats = EMPTY_STATS;
        }
        await setDoc(statsRef, reconciledStats);
      }

      setStats(reconciledStats);
    } catch (err) {
      console.error("Error loading user cloud database data:", err);
    }
  };

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
      const sessionObj = {
        ...newSessionData,
        createdAt: new Date().toISOString()
      };
      
      setSessions((prev) => [sessionObj, ...prev]);
      setStats(updatedStatsData);

      // Write to Firestore in parallel
      const sessionRef = collection(db, "users", uid, "vivas");
      const statsRef = doc(db, "users", uid, "stats", "dashboard");

      await addDoc(sessionRef, sessionObj);
      await setDoc(statsRef, updatedStatsData);
    } catch (err) {
      console.error("Failed syncing finished viva session to Cloud Firestore:", err);
    }
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
        const sessionRef = doc(collection(db, "users", uid, "vivas"));
        batch.set(sessionRef, {
          ...session,
          createdAt: session.createdAt || new Date(session.date).toISOString() || new Date().toISOString()
        });
      }

      // Upload merged stats
      const statsRef = doc(db, "users", uid, "stats", "dashboard");
      batch.set(statsRef, cachedStats);

      await batch.commit();

      // Clear local storage guest artifacts
      localStorage.removeItem("vivasim_sessions");
      localStorage.removeItem("vivasim_stats");
      localStorage.removeItem("vivasim_user");
      localStorage.removeItem("vivasim_paused_session");

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
    setSessions,
    setStats,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    logout,
    syncGuestData,
    addSessionToCloud
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
