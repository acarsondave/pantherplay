import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { store } from './store';

// NOTE: These are placeholder values. The user needs to supply real Firebase config.
const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "pantherplay.firebaseapp.com",
  projectId: "pantherplay",
  storageBucket: "pantherplay.appspot.com",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
  } else if (err.code == 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

// Listen to auth state
onAuthStateChanged(auth, (user) => {
  if (user && user.email) {
    store.update({ user: { uid: user.uid, email: user.email } });
  } else {
    store.update({ user: null });
  }
});

export const firebaseApi = {
  signIn: (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass),
  signUp: (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass),
  signOut: () => signOut(auth)
};
