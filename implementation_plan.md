# Implementation Plan: Firebase Auth (with Google Sign-in) & Firestore Database for VivaSim

This revised plan details transitioning the VivaSim application to use **Firebase Authentication** (supporting both Google Sign-in and standard Email/Password accounts) and **Cloud Firestore** as our persistent database. 

We will transition the application from using isolated `localStorage` to a fully synchronized cloud database where students can log in from any device, practice with AI examiners, and have their analytics and history saved securely.

---

## User Review Required

To implement Firebase, we will need to install the core `firebase` npm library and set up environment variables.

> [!IMPORTANT]
> **Key Architecture Decisions:**
> 1. **Why Firebase is the Perfect Fit:** 
>    - **Native Google Auth**: Firebase provides native, robust SDK functions (`signInWithPopup` / `signInWithRedirect`) to sign in with Google accounts in one click.
>    - **Flexible Document Database**: Since our Viva reports (`reportData`) contain complex, nested JSON objects (arrays of questions, full answer transcripts, exact emotion classification matrices, and confidence timelines), storing them in a NoSQL document database like Cloud Firestore is exceptionally clean. It avoids complex SQL schema migrations and table joins.
> 2. **Environment Variables Needed**: We will configure standard Firebase credentials in `.env.local`. We will provide a fallback mock database mode if these variables are not present, ensuring the app still runs perfectly in offline environments.
> 3. **Seamless Guest Data Syncing**: When a user registers or logs in with Google, we will check their `localStorage` for any historical "Guest" sessions and offer to **import them into their cloud database**. This is a premium-grade UX feature!

---

## Proposed Changes

We will introduce a Firebase configuration, create an Auth Context Provider, upgrade the Auth Screen UI with beautiful designs and Google Sign-in, and integrate session saving and loading from Firestore.

```mermaid
graph TD
    Client[Next.js App Client] -->|Uses| AuthProvider[src/context/AuthContext.js]
    AuthProvider -->|Initializes| FirebaseSDK[src/services/firebase.js]
    FirebaseSDK -->|Performs Auth| FirebaseService[Firebase Auth]
    FirebaseSDK -->|Reads/Writes| Firestore[Cloud Firestore]
    
    FirebaseService -->|Google OAuth Popup| Google[Google Identity Provider]
    Firestore -->|Stores| UsersColl[(users / {uid})]
    UsersColl -->|Subcollection| Vivas[(vivas / {sessionId})]
    UsersColl -->|Field| Stats[(stats)]
```

### 1. Firebase Initialization & SDK

#### [NEW] [firebase.js](file:///c:/Users/Kesha/OneDrive/Desktop/viva-semulator/src/services/firebase.js)
We will create a service file that initializes Firebase using environment variables:
```javascript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
```

---

### 2. State & Context Management

#### [NEW] [AuthContext.js](file:///c:/Users/Kesha/OneDrive/Desktop/viva-semulator/src/context/AuthContext.js)
We will create a React context that wraps the application to:
- Monitor auth state transitions using `onAuthStateChanged(auth, callback)`.
- Expose functions: `loginWithEmail`, `signupWithEmail`, `loginWithGoogle`, `logout`.
- Fetch user stats and historical viva sessions from Firestore on login.
- Provide a `syncGuestData()` utility that moves any local mock sessions into the user's new Firestore account.

---

### 3. Frontend Component & UI Upgrades

#### [MODIFY] [AuthScreen.jsx](file:///c:/Users/Kesha/OneDrive/Desktop/viva-semulator/src/components/AuthScreen.jsx)
We will overhaul the Auth Screen to feature a stunning, state-of-the-art UI:
- **Google Sign-In Button**: Re-wire the "Google Academic ID" button to call the `loginWithGoogle()` provider.
- **Form Controls**: Wire email and password fields to the actual Firebase signup/login functions.
- **Gorgeous Feedback Alerts**: Glassmorphic alerts for error states (e.g. "Wrong password", "User not found") and validation.
- **Glassmorphic Spinner Overlay**: Display a modern loading spinner when authentication is in progress.
- **Guest Sync Modal**: If localStorage contains previous offline sessions, display a micro-banner and confirmation modal: *"We found previous offline sessions. Would you like to merge them with your cloud account?"*

#### [MODIFY] [Header.jsx](file:///c:/Users/Kesha/OneDrive/Desktop/viva-semulator/src/components/Header.jsx)
- Uncomment the **Sign Out** button (lines 30-32).
- Wire the button to the Firebase sign-out method.
- Animate the hover states and text fading for a polished, modern look.

#### [MODIFY] [layout.js](file:///c:/Users/Kesha/OneDrive/Desktop/viva-semulator/src/app/layout.js)
Wrap the entire App body inside the `AuthProvider` component to make authentication states globally accessible.

#### [MODIFY] [page.js](file:///c:/Users/Kesha/OneDrive/Desktop/viva-semulator/src/app/page.js)
Integrate the global Auth Context:
- Show a premium shimmer skeleton screen while the Firebase SDK determines the user's initial auth state.
- If the user is unauthenticated, redirect them to the `AuthScreen`.
- Once authenticated, pull user stats and historical sessions from Firebase instead of standard `localStorage`.
- Update `handleFinishViva` to write the finalized session details and updated aggregate stats directly to Firestore under `/users/{uid}/vivas/` and `/users/{uid}/` respectively.

---

## Verification Plan

### Automated/Local API & SDK Tests
1. **Firebase Initialization**:
   - Verify that the app builds and initializes the Firebase SDK without error.
2. **Credential Testing**:
   - Validate that Email/Password and Google popup login methods execute without errors.
3. **Database Write Validation**:
   - Verify that completing a simulated Viva exam correctly saves a nested document under the user's Firestore collection.
   - Verify that stats recalculate and save successfully on Firestore.

### Manual Verification
1. **Interactive Integration**:
   - Attempt to log in with Google, verify that the redirect/popup launches, signs in, and loads correct dashboard stats.
   - Check if offline historical data properly merges with a newly created account.
   - Click Sign Out, verify that the session is closed and the app returns to the Auth screen.
