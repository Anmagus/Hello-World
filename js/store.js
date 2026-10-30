import { firebaseConfig } from "./firebase-config.js";

const LOCAL_KEY = "glh-trays-v1";

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(trays) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(trays));
}

function uid() {
  return crypto.randomUUID();
}

export function newId() {
  return uid();
}

export function createStore() {
  const listeners = new Set();
  let trays = loadLocal();
  let user = null;
  let mode = firebaseConfig ? "cloud-signed-out" : "local";
  let unsubSnap = null;
  let firebase = null;

  function emit() {
    const snapshot = {
      trays: trays.slice().sort((a, b) => a.harvestOn.localeCompare(b.harvestOn) || a.plantOn.localeCompare(b.plantOn)),
      user,
      mode,
      syncReady: Boolean(firebaseConfig),
    };
    listeners.forEach((fn) => fn(snapshot));
  }

  function subscribe(fn) {
    listeners.add(fn);
    emit();
    return () => listeners.delete(fn);
  }

  async function persist(next) {
    trays = next;
    if (mode === "cloud" && firebase) {
      return;
    }
    saveLocal(trays);
    emit();
  }

  async function upsert(tray) {
    const nextTray = { ...tray, updatedAt: Date.now(), updatedBy: user?.email ?? "local" };
    if (mode === "cloud" && firebase) {
      const { doc, setDoc } = firebase.fs;
      await setDoc(doc(firebase.db, "trays", nextTray.id), nextTray);
      return nextTray;
    }
    const idx = trays.findIndex((t) => t.id === nextTray.id);
    const next = idx === -1 ? trays.concat(nextTray) : trays.map((t) => (t.id === nextTray.id ? nextTray : t));
    await persist(next);
    return nextTray;
  }

  async function remove(id) {
    if (mode === "cloud" && firebase) {
      const { doc, deleteDoc } = firebase.fs;
      await deleteDoc(doc(firebase.db, "trays", id));
      return;
    }
    await persist(trays.filter((t) => t.id !== id));
  }

  function exportJson() {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), trays }, null, 2);
  }

  async function importJson(text) {
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : data.trays;
    if (!Array.isArray(incoming)) throw new Error("Backup file has no trays list.");
    for (const tray of incoming) {
      if (!tray.id) tray.id = uid();
      await upsert(tray);
    }
  }

  async function initCloud() {
    if (!firebaseConfig) return;
    const [
      { initializeApp },
      { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged },
      { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc },
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"),
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    firebase = {
      auth,
      db,
      provider: new GoogleAuthProvider(),
      signInWithPopup,
      signOut,
      fs: { collection, onSnapshot, doc, setDoc, deleteDoc },
    };

    onAuthStateChanged(auth, (u) => {
      user = u
        ? { email: u.email, name: u.displayName, photo: u.photoURL }
        : null;
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = null;
      }
      if (user) {
        mode = "cloud";
        unsubSnap = onSnapshot(collection(db, "trays"), (snap) => {
          trays = snap.docs.map((d) => d.data());
          emit();
        });
      } else {
        mode = "cloud-signed-out";
        trays = loadLocal();
        emit();
      }
    });
  }

  async function signIn() {
    if (!firebase) throw new Error("Firebase is not configured.");
    await firebase.signInWithPopup(firebase.auth, firebase.provider);
  }

  async function signOutUser() {
    if (!firebase) return;
    await firebase.signOut(firebase.auth);
  }

  initCloud().catch((err) => {
    console.error("Firebase failed to load", err);
    mode = "local";
    emit();
  });

  return { subscribe, upsert, remove, exportJson, importJson, signIn, signOut: signOutUser };
}
