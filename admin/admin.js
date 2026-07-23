import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  reload
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWPuECsVNQy0lACwG7OkNkkWD6ZXlSsPU",
  authDomain: "pulse-messaging-6d6ca.firebaseapp.com",
  projectId: "pulse-messaging-6d6ca",
  storageBucket: "pulse-messaging-6d6ca.firebasestorage.app",
  messagingSenderId: "89142546151",
  appId: "1:89142546151:web:3f90bbd29a2341377d5c42"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  profile: null,
  users: [],
  messages: [],
  chats: [],
  broadcasts: [],
  logs: []
};

function show(view) {
  ["loginView", "verifyView", "loadingView", "deniedView", "dashboardView"].forEach((id) => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", id !== view);
  });
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function isWithinHours(value, hours) {
  const d = value?.toDate?.() || (value ? new Date(value) : null);
  return !!(d && !Number.isNaN(d.getTime()) && Date.now() - d.getTime() <= hours * 3600 * 1000);
}

function toDate(value) {
  return value?.toDate?.() || (value ? new Date(value) : null);
}

function fmtDate(value) {
  const d = toDate(value);
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Unknown";
}

function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function profileName(profile = {}) {
  return (profile.displayName || profile.name || profile.fullName || profile.email || profile.uid || "Unknown").trim();
}

function isAdminProfile(profile = {}) {
  return String(profile.role || "").toLowerCase() === "admin" ||
    profile.isAdmin === true ||
    profile.admin === true;
}

async function verifyAdmin(user) {
  const [profileSnap, adminSnap] = await Promise.allSettled([
    getDoc(doc(db, "users", user.uid)),
    getDoc(doc(db, "admins", user.uid))
  ]);

  const profile = profileSnap.status === "fulfilled" && profileSnap.value.exists()
    ? profileSnap.value.data()
    : {};

  return {
    allowed: isAdminProfile(profile) ||
      (adminSnap.status === "fulfilled" && adminSnap.value.exists()),
    profile
  };
}

function setBusy(busy, text = "") {
  const ids = [
    "signInBtn",
    "refreshBtn",
    "analyticsRefresh",
    "storageRefresh",
    "logsRefresh",
    "sendBroadcast",
    "searchModeration",
    "signOutBtn",
    "logoutBtn",
    "reloadVerifyBtn",
    "resendVerifyBtn",
    "logoutVerifyBtn"
  ];
  ids.forEach((id) => {
    const el = $(id);
    if (el) el.disabled = busy;
  });
  if (text) setText("loadingText", text);
}

function renderAnalytics(users) {
  const total = users.length || 1;
  const online = users.filter((u) => u.online === true).length;
  const active24h = users.filter((u) => u.online === true || isWithinHours(u.lastSeen, 24)).length;
  const active7d = users.filter((u) => u.online === true || isWithinHours(u.lastSeen, 24 * 7)).length;
  const new7d = users.filter((u) => isWithinHours(u.createdAt, 24 * 7)).length;
  const new30d = users.filter((u) => isWithinHours(u.createdAt, 24 * 30)).length;
  const admins = users.filter((u) => isAdminProfile(u)).length;
  const verified = users.filter((u) => u.emailVerified === true).length;

  setText("totalUsers", users.length);
  setText("activeUsers", active24h);
  setText("onlineUsers", `${online} online now`);
  setText("newUsers30d", `${new30d} new in 30 days`);

  const items = [
    ["Online now", online, total],
    ["Active 24h", active24h, total],
    ["Active 7d", active7d, total],
    ["New 7d", new7d, total],
    ["New 30d", new30d, total],
    ["Verified", verified, total],
    ["Admins", admins, total]
  ];

  const box = $("analyticsBars");
  clearNode(box);

  items.forEach(([label, value, max]) => {
    const row = document.createElement("div");
    row.className = "barRow";
    row.innerHTML = `
      <label><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></label>
      <div class="track"><i style="width:${Math.max(3, Math.round((Number(value) / Number(max || 1)) * 100))}%"></i></div>
    `;
    box.append(row);
  });
}

function renderStorage(messages) {
  const groups = {
    Images: 0,
    Videos: 0,
    Audio: 0,
    Documents: 0,
    Other: 0
  };

  messages.forEach((m) => {
    const size = Number(m.fileSize || 0);
    const type = String(m.fileType || m.mimeType || "").toLowerCase();
    const hasFile = !!(m.filePath || m.fileUrl || m.fileName);

    if (type.startsWith("image/")) groups.Images += size;
    else if (type.startsWith("video/")) groups.Videos += size;
    else if (type.startsWith("audio/")) groups.Audio += size;
    else if (type.includes("pdf") || type.includes("text") || type.includes("doc") || type.includes("sheet") || type.includes("document")) groups.Documents += size;
    else if (hasFile) groups.Other += size;
  });

  const total = Object.values(groups).reduce((sum, value) => sum + value, 0) || 1;
  const box = $("storageBreakdown");
  clearNode(box);

  Object.entries(groups).sort((a, b) => b[1] - a[1]).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "storageRow";
    row.innerHTML = `
      <label><span>${escapeHtml(label)}</span><b>${escapeHtml(fmtBytes(value))}</b></label>
      <div class="track"><i style="width:${Math.max(3, Math.round((value / total) * 100))}%"></i></div>
    `;
    box.append(row);
  });

  setText("storageUsage", fmtBytes(total));
  setText("mediaCount", `${messages.filter((m) => m.filePath || m.fileUrl || m.fileName).length} shared files`);
}

function renderBroadcastHistory(items) {
  const box = $("broadcastHistory");
  clearNode(box);

  if (!items.length) {
    box.innerHTML = '<div class="historyRow"><b>No broadcasts yet</b><small>Create a broadcast to notify users.</small></div>';
    return;
  }

  items.slice(0, 5).forEach((item) => {
    const row = document.createElement("div");
    row.className = "historyRow";
    row.innerHTML = `
      <b>${escapeHtml(item.title || "Untitled broadcast")}</b>
      <small>${escapeHtml(item.body || "")}</small>
      <small>${escapeHtml(String(item.target || "everyone"))} · ${escapeHtml(fmtDate(item.createdAt))}</small>
    `;
    box.append(row);
  });
}

function renderLogs(items) {
  const box = $("adminLogs");
  clearNode(box);

  if (!items.length) {
    box.innerHTML = '<div class="logRow"><b>No admin logs</b><small>Actions will appear here.</small></div>';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "logRow";
    row.innerHTML = `
      <b>${escapeHtml(item.action || "Action")}</b>
      <small>${escapeHtml(item.target || item.userId || "—")} · ${escapeHtml(fmtDate(item.createdAt))}</small>
      <small>${escapeHtml(item.details || "")}</small>
    `;
    box.append(row);
  });
}

function renderUserList(users) {
  const term = ($("userSearch").value || $("moderationSearch").value || "").trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (!term) return true;
    const hay = [
      u.displayName,
      u.name,
      u.fullName,
      u.email,
      u.phone,
      u.uid,
      u.role,
      u.about
    ].join(" ").toLowerCase();
    return hay.includes(term);
  });

  const box = $("activeUsersList");
  clearNode(box);

  if (!filtered.length) {
    box.innerHTML = '<div class="historyRow"><b>No users found</b><small>Try a different search term.</small></div>';
    return;
  }

  filtered.sort((a, b) => {
    const aScore = (a.online === true ? 3 : 0) + (isWithinHours(a.lastSeen, 24) ? 2 : 0) + (isWithinHours(a.createdAt, 7 * 24) ? 1 : 0);
    const bScore = (b.online === true ? 3 : 0) + (isWithinHours(b.lastSeen, 24) ? 2 : 0) + (isWithinHours(b.createdAt, 7 * 24) ? 1 : 0);
    return bScore - aScore;
  }).slice(0, 40).forEach((u) => {
    const row = document.createElement("div");
    row.className = "userRow";

    const status = u.banned ? "Banned" : u.muted ? "Muted" : u.online ? "Online" : isWithinHours(u.lastSeen, 24) ? "Away" : "Offline";

    row.innerHTML = `
      <div class="userMeta">
        <b>${escapeHtml(profileName(u))}</b>
        <small>${escapeHtml(u.email || u.phone || "No contact info")}</small>
        <small>UID: ${escapeHtml(u.uid || "—")}</small>
        <small>Joined: ${escapeHtml(fmtDate(u.createdAt))} · Last seen: ${escapeHtml(fmtDate(u.lastSeen))}</small>
        <div class="badge">${escapeHtml(status)}${isAdminProfile(u) ? " · Admin" : ""}</div>
      </div>
      <div class="userActions" data-uid="${escapeHtml(u.uid || "")}">
        <button class="danger" data-action="ban">${u.banned ? "Unban" : "Ban"}</button>
        <button data-action="mute">${u.muted ? "Unmute" : "Mute"}</button>
        <button class="accent" data-action="admin">${isAdminProfile(u) ? "Remove admin" : "Make admin"}</button>
        <button class="blue" data-action="profile">Open profile</button>
      </div>
    `;
    box.append(row);
  });
}

async function moderateUser(uid, patch) {
  if (!uid) return;
  await updateDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() });

  await addDoc(collection(db, "adminLogs"), {
    action: Object.prototype.hasOwnProperty.call(patch, "banned")
      ? (patch.banned ? "Banned user" : "Unbanned user")
      : Object.prototype.hasOwnProperty.call(patch, "muted")
        ? (patch.muted ? "Muted user" : "Unmuted user")
        : "Updated user",
    target: uid,
    details: JSON.stringify(patch),
    adminId: state.user?.uid || null,
    createdAt: serverTimestamp()
  }).catch(() => {});

  await loadAll("Moderation updated");
}

async function sendBroadcast() {
  const title = $("broadcastTitle").value.trim();
  const body = $("broadcastBody").value.trim();
  const target = $("broadcastTarget").value;

  if (!title || !body) {
    alert("Please add a title and a message first.");
    return;
  }

  await addDoc(collection(db, "broadcasts"), {
    title,
    body,
    target,
    status: "active",
    createdAt: serverTimestamp(),
    createdBy: state.user?.uid || null
  });

  await addDoc(collection(db, "adminLogs"), {
    action: "Broadcast sent",
    target,
    details: title,
    adminId: state.user?.uid || null,
    createdAt: serverTimestamp()
  }).catch(() => {});

  $("broadcastTitle").value = "";
  $("broadcastBody").value = "";
  await loadAll("Broadcast sent");
}

async function loadAll(reason = "Refresh complete") {
  show("loadingView");
  setBusy(true, "Loading users, chats, messages, broadcasts, and logs…");

  const [usersSnap, chatsSnap, messagesSnap, broadcastsSnap, logsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "chats")),
    getDocs(collectionGroup(db, "messages")).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(10))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "adminLogs"), orderBy("createdAt", "desc"), limit(12))).catch(() => ({ docs: [] }))
  ]);

  state.users = usersSnap.docs.map((d) => ({ uid: d.id, id: d.id, ...d.data() }));
  state.chats = chatsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.messages = messagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.broadcasts = broadcastsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.logs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  renderAnalytics(state.users);
  renderUserList(state.users);
  renderStorage(state.messages);
  renderBroadcastHistory(state.broadcasts);
  renderLogs(state.logs);

  setText("totalChats", String(state.chats.length));
  setText("totalMessages", `${state.messages.length} messages`);
  setText("lastUpdated", `${reason} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);

  show("dashboardView");
  setBusy(false);
}

async function signIn() {
  try {
    setText("authStatus", "Signing in…");
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) {
      setText("authStatus", "Enter your email and password.");
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    setText("authStatus", "");
  } catch (e) {
    setText("authStatus", e?.message || "Sign-in failed.");
  }
}

async function refreshVerification() {
  try {
    setText("verifyStatus", "Checking verification…");
    await reload(auth.currentUser);
    if (!auth.currentUser?.emailVerified) {
      setText("verifyStatus", "Email is still not verified.");
      return;
    }
    setText("verifyStatus", "Verified ✓");
  } catch (e) {
    setText("verifyStatus", e?.message || "Could not verify email.");
  }
}

onAuthStateChanged(auth, async (user) => {
  state.user = user || null;

  if (!user) {
    show("loginView");
    return;
  }

  if (!user.emailVerified) {
    $("verifyText").textContent = `A verification email was sent to ${user.email || "your address"}. Open the email, tap the link, then return here.`;
    show("verifyView");
    return;
  }

  show("loadingView");
  setBusy(true, "Verifying admin permissions…");

  try {
    const access = await verifyAdmin(user);
    state.profile = access.profile || {};

    if (!access.allowed) {
      setText("deniedText", `Signed in as ${user.email || user.uid}, but this account is not marked as admin in Firestore.`);
      show("deniedView");
      setBusy(false);
      return;
    }

    $("adminLabel").textContent = `${profileName(access.profile || user)} · Admin`;
    await loadAll("Connected to live app");
  } catch (e) {
    console.error(e);
    setText("loadingText", e?.message || "Could not load the dashboard.");
    show("deniedView");
    setBusy(false);
  }
});

$("signInBtn").onclick = signIn;
$("refreshBtn").onclick = () => loadAll("Refresh complete");
$("analyticsRefresh").onclick = () => loadAll("Analytics updated");
$("storageRefresh").onclick = () => loadAll("Storage updated");
$("logsRefresh").onclick = () => loadAll("Logs updated");
$("sendBroadcast").onclick = sendBroadcast;
$("searchModeration").onclick = () => renderUserList(state.users);
$("userSearch").addEventListener("input", () => renderUserList(state.users));
$("moderationSearch").addEventListener("input", () => renderUserList(state.users));
$("signOutBtn").onclick = () => signOut(auth);
$("logoutBtn").onclick = () => signOut(auth);
$("reloadVerifyBtn").onclick = refreshVerification;
$("resendVerifyBtn").onclick = async () => {
  try {
    setText("verifyStatus", "Resending verification email…");
    await sendEmailVerification(auth.currentUser);
    setText("verifyStatus", "Verification email sent.");
  } catch (e) {
    setText("verifyStatus", e?.message || "Could not resend verification email.");
  }
};
$("logoutVerifyBtn").onclick = () => signOut(auth);

$("activeUsersList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const wrap = btn.closest(".userActions");
  const uid = wrap?.dataset?.uid;
  const user = state.users.find((u) => u.uid === uid || u.id === uid);
  if (!uid || !user) return;

  const action = btn.dataset.action;
  if (action === "ban") {
    await moderateUser(uid, { banned: !user.banned, status: !user.banned ? "banned" : "active", online: false });
  } else if (action === "mute") {
    await moderateUser(uid, { muted: !user.muted });
  } else if (action === "admin") {
    const nextAdmin = !isAdminProfile(user);
    await moderateUser(uid, nextAdmin
      ? { role: "admin", isAdmin: true, admin: true }
      : { role: "user", isAdmin: false, admin: false });
  } else if (action === "profile") {
    $("moderationSearch").value = profileName(user);
    renderUserList(state.users);
  }
});

show("loginView");
