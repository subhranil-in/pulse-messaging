import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWPuECsVNQy0lACwG7OkNkkWD6ZXlSsPU",
  authDomain: "pulse-messaging-6d6ca.firebaseapp.com",
  projectId: "pulse-messaging-6d6ca",
  storageBucket: "pulse-messaging-6d6ca.firebasestorage.app",
  messagingSenderId: "89142546151",
  appId: "1:89142546151:web:3f90bbd29a2341377d5c42"
};

const VERSION = "9.0.0";
const $ = id => document.getElementById(id);
const bind = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
const show = viewId => {
  const views = ["authView", "verifyEmailView", "profileView", "homeView", "chatView", "settingsView", "newChatView", "messageActionsView", "updatePopupView"];
  for (const id of views) {
    const el = $(id);
    if (el) el.classList.toggle("hidden", id !== viewId);
  }
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user = null;
let me = null;
let peer = null;
let cid = null;
let selectedAvatarKey = "male_01";
let profileEditMode = false;
let currentMessages = [];
let chatItems = [];
let unsubscribeChats = null;
let unsubscribeMessages = null;
let activeMessage = null;
let reply = null;
let lastRenderSignature = "";
let splashResolved = false;
let updateCheckTimer = null;
let appVersion = VERSION;

const avatarIds = [...Array(8)].map((_, i) => `male_${String(i + 1).padStart(2, "0")}`)
  .concat([...Array(8)].map((_, i) => `female_${String(i + 1).padStart(2, "0")}`));

const avatarCatalog = Object.fromEntries(avatarIds.map((key, i) => {
  const male = key.startsWith("male");
  const malePalette = ["#0f172a", "#1d4ed8", "#0ea5e9", "#2563eb", "#4338ca", "#14b8a6", "#0f766e", "#1e40af"];
  const femalePalette = ["#4c1d95", "#db2777", "#be185d", "#7c3aed", "#d946ef", "#ec4899", "#8b5cf6", "#f43f5e"];
  const bg = male ? malePalette[i % malePalette.length] : femalePalette[i % femalePalette.length];
  const accent = male ? "#dbeafe" : "#ffe4f1";
  const mark = male ? "M" : "F";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${bg}"/>
        <stop offset="1" stop-color="${male ? "#111827" : "#2a0f3a"}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="60" fill="url(#g${i})"/>
    <circle cx="60" cy="46" r="16" fill="${accent}" opacity=".96"/>
    <path d="M28 104c6-18 20-28 32-28s26 10 32 28" fill="${accent}" opacity=".96"/>
    <circle cx="48" cy="44" r="3" fill="${bg}" opacity=".35"/>
    <circle cx="72" cy="44" r="3" fill="${bg}" opacity=".35"/>
    <path d="M49 52c5 4 17 4 22 0" stroke="${bg}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".28"/>
    <text x="60" y="93" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" fill="rgba(255,255,255,.28)">${mark}</text>
  </svg>`;
  return [key, `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`];
}));

function avatarUrl(key) {
  return avatarCatalog[key] || avatarCatalog.male_01;
}

function defaultAvatarKey(name) {
  const n = (name || "").trim().toLowerCase();
  return n && /[aeiou]$/.test(n) ? "female_01" : "male_01";
}

function setAvatar(el, profile) {
  if (!el) return;
  el.replaceChildren();
  const src = profile?.avatarKey ? avatarUrl(profile.avatarKey) : null;
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    el.append(img);
  } else {
    el.textContent = initial(profile?.displayName);
  }
}

function initial(name) {
  return (name || "U")[0].toUpperCase();
}

function setAvatarPreview(el, key, label) {
  if (!el) return;
  el.replaceChildren();
  const img = document.createElement("img");
  img.src = avatarUrl(key);
  img.alt = label || "";
  el.append(img);
}


function toggleAvatarPicker(id){
 const el=$(id);
 if(!el) return;
 el.style.display=(el.style.display==="none"||!el.style.display)?"grid":"none";
}

function renderAvatarPicker(containerId, selectedKey, onPick) {
  const el = $(containerId);
  if (!el) return;
  el.replaceChildren();

  const groups = [
    ["Male avatars", avatarIds.filter(x => x.startsWith("male"))],
    ["Female avatars", avatarIds.filter(x => x.startsWith("female"))]
  ];

  for (const [label, ids] of groups) {
    const groupLabel = document.createElement("div");
    groupLabel.className = "groupLabel";
    groupLabel.textContent = label;
    el.append(groupLabel);

    const grid = document.createElement("div");
    grid.className = "avatarPickerGrid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill,minmax(64px,1fr))";
    grid.style.gap = "8px";

    ids.forEach(id => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "avatarChoice" + (id === selectedKey ? " selected" : "");
      const img = document.createElement("img");
      img.src = avatarUrl(id);
      img.alt = id;
      button.append(img);
      button.onclick = () => onPick(id);
      grid.append(button);
    });

    el.append(grid);
  }
}

function authStatus(text) {
  const el = $("authStatus");
  if (el) el.textContent = text;
}

function verifyStatus(text) {
  const el = $("verifyStatus");
  if (el) el.textContent = text;
}

function profileStatus(text) {
  const el = $("profileStatus");
  if (el) el.textContent = text;
}

function profileEditStatus(text) {
  const el = $("profileEditStatus");
  if (el) el.textContent = text;
}

function updateStatus(text) {
  const el = $("updateStatus");
  if (el) el.textContent = text;
}

function localPrefs() {
  const p = JSON.parse(localStorage.getItem("pulsePrefs:" + (user?.uid || "anon")) || "{}");
  return {
    readReceipts: p.readReceipts ?? true,
    showOnline: p.showOnline ?? true,
    pinned: p.pinned || [],
    blocked: p.blocked || [],
    deletedChats: p.deletedChats || [],
    deletedMessages: p.deletedMessages || [],
    stars: p.stars || []
  };
}

function savePrefs(p) {
  localStorage.setItem("pulsePrefs:" + user.uid, JSON.stringify(p));
}

function resolveSplash() {
  if (splashResolved) return;
  splashResolved = true;
  document.documentElement.classList.remove("pulse-auth-pending");
  $("authSplash")?.classList.add("hidden");
}

function chatId(a, b) {
  return [a, b].sort().join("_");
}

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function phoneMatch(saved, countryCode, raw) {
  const local = digits(raw).replace(/^0+/, "");
  if (!local || local.length < 7) return false;
  const savedDigits = digits(saved).replace(/^0+/, "");
  const countryDigits = digits(countryCode);
  const wanted = countryDigits + local;
  return savedDigits === wanted || savedDigits === local || savedDigits.endsWith(local) || wanted.endsWith(savedDigits);
}

async function loadVersion() {
  try {
    const res = await fetch("version.json", { cache: "no-store" });
    const data = await res.json();
    return String(data.version || VERSION);
  } catch {
    return VERSION;
  }
}

async function checkForUpdates(manual = false) {
  try {
    const latest = await loadVersion();
    appVersion = latest;
    if (latest !== VERSION) {
      const popup = $("updatePopupView");
      if (popup) {
        popup.dataset.version = latest;
        popup.classList.remove("hidden");
      }
      updateStatus(`Update available · v${latest}`);
    } else {
      if (manual) updateStatus(`Pulse is up to date · v${VERSION}`);
    }
  } catch (err) {
    console.error(err);
    if (manual) updateStatus("Could not check for updates. Try again.");
  }
}

async function installUpdate() {
  const popup = $("updatePopupView");
  const bar = $("updateProgressBar");
  const btn = $("installUpdateBtn");
  if (!popup || !bar || !btn) return;
  btn.disabled = true;
  bar.style.width = "12%";
  try {
    bar.style.width = "40%";
    await checkForUpdates(false);
    bar.style.width = "80%";
    if (popup.dataset.version) {
      localStorage.setItem("pulseSeenUpdate:" + popup.dataset.version, "seen");
    }
    bar.style.width = "100%";
    setTimeout(() => window.location.reload(), 350);
  } catch (err) {
    console.error(err);
    bar.style.width = "0%";
  } finally {
    btn.disabled = false;
  }
}

function openSettings() {
  const prefs = localPrefs();
  if ($("readReceiptsToggle")) $("readReceiptsToggle").checked = prefs.readReceipts;
  if ($("showOnlineToggle")) $("showOnlineToggle").checked = prefs.showOnline;
  try { syncProfileFields(); } catch (err) { console.error(err); }
  show("settingsView");
  renderBlockedUsers();
  const q = chatItems.length ? chatItems.length : 0;
  const m = currentMessages.length ? currentMessages.length : 0;
  const ls = $("localStats");
  if (ls) ls.textContent = `${m} local messages · ${q} chats`;
}

function setProfileEditMode(on) {
  profileEditMode = !!on;
  const view = $("profileCardView");
  const panel = $("profileEditPanel");
  const actions = $("profileEditActions");
  const btn = $("editProfileBtn");
  if (view) view.classList.toggle("hidden", profileEditMode);
  if (panel) panel.classList.toggle("hidden", !profileEditMode);
  if (actions) actions.classList.toggle("hidden", !profileEditMode);
  if (btn) btn.textContent = profileEditMode ? "Done" : "Edit";
  if (profileEditMode) {
    $("editDisplayName")?.focus();
  }
}

function syncAvatarUI() {
  setAvatarPreview($("profileSelectedAvatarPreview"), selectedAvatarKey, me?.displayName);
  setAvatarPreview($("settingsSelectedAvatarPreview"), selectedAvatarKey, me?.displayName);
  setAvatar($("homeAvatar"), { avatarKey: selectedAvatarKey, displayName: me?.displayName });
  setAvatar($("settingsAvatar"), { avatarKey: selectedAvatarKey, displayName: me?.displayName });
  renderAvatarPicker("profileAvatarPicker", selectedAvatarKey, key => {
    selectedAvatarKey = key;
    syncAvatarUI();
  });
  renderAvatarPicker("settingsAvatarPicker", selectedAvatarKey, key => {
    selectedAvatarKey = key;
    syncAvatarUI();
  });
}

function syncProfileFields() {
  if (!me) return;
  selectedAvatarKey = me.avatarKey || selectedAvatarKey || defaultAvatarKey(me.displayName);
  if ($("editDisplayName")) $("editDisplayName").value = me.displayName || "";
  if ($("editAbout")) $("editAbout").value = me.about || "";
  if ($("settingsName")) $("settingsName").textContent = me.displayName || "Profile";
  if ($("settingsAbout")) $("settingsAbout").textContent = me.about || "Hey there! I am using Pulse.";
  syncAvatarUI();
  if (!profileEditMode) setProfileEditMode(false);
}

async function saveProfileEdits() {
  const displayName = ($("editDisplayName")?.value || "").trim();
  const about = ($("editAbout")?.value || "").trim();
  if (displayName.length < 2) throw Error("Enter your name.");
  if (about.length > 120) throw Error("About is too long.");
  await updateDoc(doc(db, "users", user.uid), {
    displayName,
    about,
    avatarKey: selectedAvatarKey,
    updatedAt: serverTimestamp()
  });
  me = { ...me, displayName, about, avatarKey: selectedAvatarKey };
  await setDoc(doc(db, "users", user.uid), me, { merge: true });
  await syncChatList();
  syncProfileFields();
  renderChatList();
}

function setView(viewId) {
  const views = ["authView", "verifyEmailView", "profileView", "homeView", "chatView", "settingsView", "newChatView", "messageActionsView", "updatePopupView"];
  for (const id of views) {
    const el = $(id);
    if (el) el.classList.toggle("hidden", id !== viewId);
  }
}

function openAuth() { setView("authView"); }
function openVerify() { setView("verifyEmailView"); }
function openProfile() { setView("profileView"); }
function openHome() { showHomeView(); }
function openChatView() { setView("chatView"); }
function openSettingsView() { setView("settingsView"); }
function openNewChatView() { setView("newChatView"); }

async function ensureLocalChatCache() {
  // simple, no-op placeholder for future use
}

async function renderBlockedUsers() {
  const box = $("blockedUsers");
  if (!box) return;
  const prefs = localPrefs();
  box.replaceChildren();
  if (!prefs.blocked.length) {
    const s = document.createElement("small");
    s.textContent = "No blocked users.";
    box.append(s);
    return;
  }
  for (const uid of prefs.blocked) {
    const u = await getDoc(doc(db, "users", uid));
    const p = u.exists() ? u.data() : { displayName: "Unknown", avatarKey: "male_01" };
    const row = document.createElement("div");
    row.className = "row";
    const av = document.createElement("div");
    av.className = "avatar textAvatar";
    setAvatar(av, p);
    const copy = document.createElement("div");
    copy.className = "copy";
    const b = document.createElement("b");
    b.textContent = p.displayName || "Unknown";
    const sm = document.createElement("small");
    sm.textContent = "Blocked";
    copy.append(b, sm);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "miniAction";
    btn.textContent = "Unblock";
    btn.onclick = () => {
      const np = localPrefs();
      np.blocked = np.blocked.filter(x => x !== uid);
      savePrefs(np);
      renderBlockedUsers();
    };
    row.append(av, copy, btn);
    box.append(row);
  }
}

function renderChatList() {
  const box = $("chatList");
  if (!box) return;
  const prefs = localPrefs();
  const visible = chatItems.filter(x => !prefs.deletedChats.includes(x.p.uid));
  box.replaceChildren();
  visible.sort((a, b) => {
    const ap = prefs.pinned.includes(a.p.uid);
    const bp = prefs.pinned.includes(b.p.uid);
    if (ap !== bp) return Number(bp) - Number(ap);
    return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
  });
  for (const item of visible) {
    const row = document.createElement("div");
    row.className = "row" + (prefs.pinned.includes(item.p.uid) ? " pinned" : "");
    const av = document.createElement("div");
    av.className = "avatar textAvatar";
    setAvatar(av, item.p);
    const copy = document.createElement("div");
    copy.className = "copy";
    const top = document.createElement("div");
    top.className = "rowTop";
    const b = document.createElement("b");
    b.textContent = (prefs.pinned.includes(item.p.uid) ? "📌 " : "") + (item.p.displayName || "Unknown");
    const tm = document.createElement("small");
    tm.textContent = item.time || "";
    top.append(b, tm);
    const desc = document.createElement("small");
    desc.textContent = item.last || item.p.phone || "";
    copy.append(top, desc);
    row.append(av, copy);
    if (item.unread) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = item.unread > 99 ? "99+" : String(item.unread);
      row.append(badge);
    }
    row.onclick = () => openChat(item.p);
    box.append(row);
  }
}

async function syncChatList() {
  const q = query(collection(db, "chats"), where("members", "array-contains", user.uid));
  if (unsubscribeChats) unsubscribeChats();
  unsubscribeChats = onSnapshot(q, async snapshot => {
    const items = [];
    for (const d of snapshot.docs) {
      const chat = d.data();
      const otherId = (chat.members || []).find(x => x !== user.uid);
      if (!otherId) continue;
      const otherSnap = await getDoc(doc(db, "users", otherId));
      if (!otherSnap.exists()) continue;
      const other = otherSnap.data();
      const readSnap = await getDoc(doc(db, "chats", d.id, "readState", user.uid));
      const unread = readSnap.exists() ? (readSnap.data().unread || 0) : 0;
      items.push({
        p: other,
        unread,
        last: chat.lastMessage || "Start chatting",
        updatedAtMs: chat.updatedAt?.toMillis?.() || 0,
        time: chat.updatedAt?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || ""
      });
    }
    chatItems = items;
    renderChatList();
  });
}

async function openChat(p) {
  peer = p;
  cid = chatId(user.uid, p.uid);
  lastRenderSignature = "";
  await setDoc(doc(db, "chats", cid), {
    members: [user.uid, p.uid],
    updatedAt: serverTimestamp()
  }, { merge: true });
  await setDoc(doc(db, "chats", cid, "readState", user.uid), { unread: 0 }, { merge: true });
  const av = $("peerAvatar");
  if (av) setAvatar(av, p);
  if ($("peerName")) $("peerName").textContent = p.displayName || "Chat";
  if ($("peerMeta")) $("peerMeta").textContent = p.phone || "";
  openChatView();
  $("messageActionsView")?.classList.add("hidden");
  $("newChatView")?.classList.add("hidden");
  listenMessages();
}

function messageSignature(items) {
  return items.map(m => `${m.id}:${m.text}:${m.status}:${m.editedAt?.seconds || ""}:${m.replyTo || ""}`).join("|");
}

function renderMessages(items) {
  const box = $("messages");
  if (!box) return;
  const prefs = localPrefs();
  const visibleItems = items.filter(m => !prefs.deletedMessages.includes(m.id));
  const filtered = visibleItems;
  const sig = messageSignature(filtered);
  if (sig === lastRenderSignature) return;
  lastRenderSignature = sig;
  const frag = document.createDocumentFragment();
  for (const m of filtered) {
    const article = document.createElement("article");
    article.className = "msg" + (m.senderId === user.uid ? " mine" : "");
    if (m.replyText) {
      const q = document.createElement("div");
      q.className = "quoted";
      q.textContent = m.replyText;
      article.append(q);
    }
    const body = document.createElement("div");
    body.className = "msgBody";
    body.textContent = m.text || "";
    article.append(body);
    if (m.reactions && Object.keys(m.reactions).length) {
      const reactionBar = document.createElement("div");
      reactionBar.className = "reactionBar";
      for (const [emoji, uids] of Object.entries(m.reactions)) {
        if (uids?.length) {
          const span = document.createElement("span");
          span.className = "reaction";
          span.textContent = `${emoji} ${uids.length}`;
          reactionBar.append(span);
        }
      }
      article.append(reactionBar);
    }
    const meta = document.createElement("div");
    meta.className = "meta";
    const created = m.createdAt?.toDate?.() || (m.createdMs ? new Date(m.createdMs) : null);
    meta.textContent = created && !Number.isNaN(created) ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Queued";
    if (m.senderId === user.uid && !m.queued) {
      const tick = document.createElement("span");
      tick.className = "ticks" + (m.status === "seen" ? " seen" : "");
      tick.textContent = m.status === "seen" ? "✓✓" : (m.status === "delivered" ? "✓✓" : "✓");
      meta.append(tick);
    }
    article.append(meta);

    let holdTimer = null;
    article.onpointerdown = () => {
      holdTimer = setTimeout(() => openMessageActions(m), 500);
    };
    article.onpointerup = article.onpointercancel = article.onpointermove = () => {
      if (holdTimer) clearTimeout(holdTimer);
    };
    article.oncontextmenu = ev => {
      ev.preventDefault();
      openMessageActions(m);
    };

    frag.append(article);
  }
  box.replaceChildren(frag);
  requestAnimationFrame(() => {
    box.scrollTop = box.scrollHeight;
  });
}

function openMessageActions(m) {
  activeMessage = m;
  const reactions = $("quickReactions");
  if (reactions) {
    reactions.replaceChildren();
    ["👍", "❤️", "😂", "😮", "😢", "🙏"].forEach(emoji => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = emoji;
      btn.onclick = () => reactMessage(m, emoji);
      reactions.append(btn);
    });
  }
  const deleteEveryoneBtn = $("deleteEveryoneBtn");
  if (deleteEveryoneBtn) deleteEveryoneBtn.classList.toggle("hidden", m.senderId !== user.uid);
  const popup = $("messageActionsView");
  if (popup) popup.classList.remove("hidden");
}

async function reactMessage(m, emoji) {
  const reactions = structuredClone(m.reactions || {});
  const uids = reactions[emoji] || [];
  const idx = uids.indexOf(user.uid);
  if (idx >= 0) uids.splice(idx, 1);
  else uids.push(user.uid);
  reactions[emoji] = uids;
  await updateDoc(doc(db, "chats", cid, "messages", m.id), { reactions });
  $("messageActionsView")?.classList.add("hidden");
}

function replyToMessage(m) {
  reply = { id: m.id, text: m.text || "", senderId: m.senderId };
  if ($("replyName")) $("replyName").textContent = m.senderId === user.uid ? "You" : (peer?.displayName || "User");
  if ($("replyText")) $("replyText").textContent = m.text || "Message";
  $("replyBar")?.classList.remove("hidden");
}

async function deleteForEveryone(m) {
  if (!confirm("Delete this message for everyone?")) return;
  await deleteDoc(doc(db, "chats", cid, "messages", m.id));
}

function deleteForMe(m) {
  const prefs = localPrefs();
  if (!prefs.deletedMessages.includes(m.id)) prefs.deletedMessages.push(m.id);
  savePrefs(prefs);
  lastRenderSignature = "";
  renderMessages(currentMessages);
}

async function copyMessage(m) {
  try {
    await navigator.clipboard.writeText(m.text || "");
  } catch {}
  $("messageActionsView")?.classList.add("hidden");
}

async function sendMessage(text) {
  const payload = {
    text,
    senderId: user.uid,
    createdAt: serverTimestamp(),
    status: "sent"
  };
  if (reply) {
    payload.replyTo = reply.id;
    payload.replyText = reply.text;
  }
  const ref = await addDoc(collection(db, "chats", cid, "messages"), payload);
  await updateDoc(doc(db, "chats", cid), {
    lastMessage: text,
    updatedAt: serverTimestamp()
  });
  await setDoc(doc(db, "chats", cid, "readState", peer.uid), { unread: increment(1) }, { merge: true });
  setTimeout(() => updateDoc(ref, { status: "delivered" }).catch(() => {}), 300);
  if ($("replyBar")) $("replyBar").classList.add("hidden");
  reply = null;
}

function listenMessages() {
  if (unsubscribeMessages) unsubscribeMessages();
  const q = query(collection(db, "chats", cid, "messages"), orderBy("createdAt", "asc"), limit(300));
  unsubscribeMessages = onSnapshot(q, async snapshot => {
    currentMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMessages(currentMessages);

    const prefs = localPrefs();
    if (prefs.readReceipts && document.visibilityState === "visible" && !$("chatView").classList.contains("hidden")) {
      for (const d of snapshot.docs) {
        const m = d.data();
        if (m.senderId !== user.uid && m.status !== "seen") {
          updateDoc(d.ref, { status: "seen", seenAt: serverTimestamp() }).catch(() => {});
        }
      }
    }
    await setDoc(doc(db, "chats", cid, "readState", user.uid), { unread: 0 }, { merge: true });
  });
}

async function searchUsersByPhone(countryCode, raw) {
  const local = digits(raw);
  if (local.length < 7) return [];
  const snap = await getDocs(collection(db, "users"));
  const out = [];
  for (const d of snap.docs) {
    const p = { uid: d.id, ...d.data() };
    if (phoneMatch(p.phone, countryCode, raw)) out.push(p);
  }
  return out;
}

async function openNewChat() {
  $("searchPhoneInput") && ($("searchPhoneInput").value = "");
  $("searchResults")?.replaceChildren();
  openNewChatView();
}

function renderSearchResults(results) {
  const box = $("searchResults");
  if (!box) return;
  box.replaceChildren();
  if (!results.length) {
    const s = document.createElement("small");
    s.textContent = "No Pulse user found.";
    box.append(s);
    return;
  }
  for (const p of results) {
    if (p.uid === user.uid) continue;
    const row = document.createElement("div");
    row.className = "row";
    const av = document.createElement("div");
    av.className = "avatar textAvatar";
    setAvatar(av, p);
    const copy = document.createElement("div");
    copy.className = "copy";
    const b = document.createElement("b");
    b.textContent = p.displayName || "User";
    const sm = document.createElement("small");
    sm.textContent = p.about || p.phone || "";
    copy.append(b, sm);
    row.append(av, copy);
    row.onclick = async () => {
      $("newChatView")?.classList.add("hidden");
      await openChat(p);
    };
    box.append(row);
  }
}

async function saveProfileSetup() {
  const displayName = ($("displayName")?.value || "").trim();
  const phone = (($("countryCode")?.value || "") + digits($("phone")?.value || "")).trim();
  const about = ($("about")?.value || "").trim();
  if (displayName.length < 2) throw Error("Enter your name.");
  if (digits(phone).length < 8) throw Error("Enter a valid mobile number.");
  const existing = await getDocs(collection(db, "users"));
  for (const d of existing.docs) {
    if (d.id !== user.uid) {
      const p = d.data();
      if (String(p.phone || "") === phone) throw Error("Mobile number already registered.");
    }
  }
  selectedAvatarKey = selectedAvatarKey || defaultAvatarKey(displayName);
  const profile = {
    uid: user.uid,
    email: user.email,
    displayName,
    phone,
    about,
    avatarKey: selectedAvatarKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  me = profile;
  await setDoc(doc(db, "users", user.uid), profile, { merge: true });
  syncProfileFields();
  showHomeView();
  await syncChatList();
}

async function loadProfile() {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    selectedAvatarKey = defaultAvatarKey(user.email?.split("@")[0]);
    syncAvatarUI();
    openProfile();
    return;
  }
  me = snap.data();
  selectedAvatarKey = me.avatarKey || defaultAvatarKey(me.displayName);
  syncProfileFields();
  showHomeView();
  await syncChatList();
}

function startVerifyMode() {
  if ($("verifyMessage")) {
    $("verifyMessage").textContent = `We sent a verification link to ${user.email}. Open the email, tap the verification link, then return to Pulse. Please check your spam folder for the verification link.`;
  }
  openVerify();
}

async function setupAuthState() {
  onAuthStateChanged(auth, async u => {
    user = u;
    try {
      if (!u) {
        openAuth();
        resolveSplash();
        return;
      }
      await u.getIdToken(true);
      if (!u.emailVerified) {
        startVerifyMode();
        resolveSplash();
        return;
      }
      await loadProfile();
      resolveSplash();
    } catch (err) {
      console.error("Startup failed", err);
      if (u) showHomeView(); else openAuth();
      resolveSplash();
    }
  });
}

bind("signinBtn", "click", async () => {
  try {
    authStatus("Signing in…");
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    authStatus("");
  } catch (err) {
    authStatus(err.message || "Could not sign in.");
  }
});

bind("signupBtn", "click", async () => {
  try {
    authStatus("Creating account…");
    const cred = await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    await sendEmailVerification(cred.user);
    authStatus("");
  } catch (err) {
    authStatus(err.message || "Could not create account.");
  }
});

bind("forgotPasswordBtn", "click", async () => {
  const email = ($("email")?.value || auth.currentUser?.email || "").trim();
  if (!email) return authStatus("Enter your email address first.");
  try {
    authStatus("Sending password reset email…");
    await sendPasswordResetEmail(auth, email);
    authStatus("Password reset email sent. Check your inbox and spam folder.");
  } catch (err) {
    const code = err?.code || "";
    const messages = {
      "auth/invalid-email": "Enter a valid email address.",
      "auth/user-not-found": "No account found with this email.",
      "auth/unauthorized-domain": "This site is not authorized in Firebase.",
      "auth/network-request-failed": "Check your internet connection and try again.",
      "auth/too-many-requests": "Too many attempts. Try again later."
    };
    authStatus(messages[code] || err.message || "Could not send reset email.");
  }
});

bind("verifiedBtn", "click", async () => {
  try {
    verifyStatus("Checking verification…");
    await reload(auth.currentUser);
    user = auth.currentUser;
    if (!user.emailVerified) {
      verifyStatus("Email is not verified yet. Open the verification link first.");
      return;
    }
    verifyStatus("Email verified ✓");
    await loadProfile();
    showHomeView();
  } catch (err) {
    verifyStatus(err.message || "Could not check verification.");
  }
});

bind("resendVerificationBtn", "click", async () => {
  try {
    verifyStatus("Sending verification email…");
    await sendEmailVerification(auth.currentUser);
    verifyStatus("Verification email sent. Check Inbox and Spam.");
  } catch (err) {
    verifyStatus(err.message || "Could not resend verification email.");
  }
});

bind("verifyLogoutBtn", "click", async () => {
  await signOut(auth);
});

bind("saveProfileBtn", "click", async () => {
  try {
    profileStatus("Saving…");
    await saveProfileSetup();
    profileStatus("Saved ✓");
  } catch (err) {
    profileStatus(err.message || "Could not save profile.");
  }
});

bind("newChatBtn", "click", openNewChat);
bind("closeNewChatBtn", "click", () => setView("homeView"));
bind("searchPhoneBtn", "click", async () => {
  const country = $("searchCountryCode")?.value || "+91";
  const raw = $("searchPhoneInput")?.value || "";
  const box = $("searchResults");
  if (box) box.textContent = "Searching Pulse users…";
  const results = await searchUsersByPhone(country, raw);
  renderSearchResults(results);
});
bind("backBtn", "click", () => openHome());
bind("closeSettingsBtn", "click", () => openHome());
bind("settingsBtn", "click", openSettings);
bind("editProfileBtn", "click", () => { setProfileEditMode(!profileEditMode); syncProfileFields(); });
bind("cancelProfileEditBtn", "click", () => { setProfileEditMode(false); syncProfileFields(); });
bind("saveProfileEditBtn", "click", async () => {
  try {
    profileEditStatus("Saving…");
    await saveProfileEdits();
    setProfileEditMode(false);
    profileEditStatus("Saved ✓");
  } catch (err) {
    profileEditStatus(err.message || "Could not save profile.");
  }
});
bind("settingsSelectedAvatarBtn", "click", () => setProfileEditMode(true));
bind("profileSelectedAvatarBtn", "click", () => {});
bind("cancelReplyBtn", "click", () => {
  reply = null;
  $("replyBar")?.classList.add("hidden");
});
bind("messageForm", "submit", async ev => {
  ev.preventDefault();
  const text = ($("messageInput")?.value || "").trim();
  if (!text || !user || !cid) return;
  $("messageInput").value = "";
  try {
    await sendMessage(text);
  } catch (err) {
    console.error(err);
    alert(err.message || "Could not send message.");
  }
});
bind("chatSearchBtn", "click", async () => {
  const term = prompt("Search in this chat");
  if (!term) return;
  const items = currentMessages.filter(m => String(m.text || "").toLowerCase().includes(term.toLowerCase()));
  renderMessages(items);
});
bind("readReceiptsToggle", "change", () => {
  const prefs = localPrefs();
  prefs.readReceipts = $("readReceiptsToggle").checked;
  savePrefs(prefs);
});
bind("showOnlineToggle", "change", () => {
  const prefs = localPrefs();
  prefs.showOnline = $("showOnlineToggle").checked;
  savePrefs(prefs);
});
bind("refreshBlockedBtn", "click", renderBlockedUsers);
bind("checkUpdatesBtn", "click", () => checkForUpdates(true));
bind("installUpdateBtn", "click", installUpdate);
bind("laterUpdateBtn", "click", () => {
  const popup = $("updatePopupView");
  const v = popup?.dataset.version;
  if (v) localStorage.setItem("pulseSeenUpdate:" + v, "seen");
  popup?.classList.add("hidden");
});
bind("syncNowBtn", "click", async () => {
  await syncChatList();
  alert("Synced queued messages.");
});
bind("logoutBtn", "click", async () => {
  await signOut(auth);
});

bind("chatsTabBtn", "click", () => {
  $("chatsTabBtn")?.classList.add("active");
  $("updatesTabBtn")?.classList.remove("active");
  $("chatsPanel")?.classList.remove("hidden");
  $("updatesPanel")?.classList.add("hidden");
});
bind("updatesTabBtn", "click", () => {
  $("updatesTabBtn")?.classList.add("active");
  $("chatsTabBtn")?.classList.remove("active");
  $("chatsPanel")?.classList.add("hidden");
  $("updatesPanel")?.classList.remove("hidden");
});

bind("messageActionsView", "click", async ev => {
  const btn = ev.target.closest("[data-msg-action]");
  if (!btn || !activeMessage) return;
  const action = btn.dataset.msgAction;
  if (action === "reply") { replyToMessage(activeMessage); $("messageActionsView")?.classList.add("hidden"); }
  if (action === "copy") await copyMessage(activeMessage);
  if (action === "deleteMe") deleteForMe(activeMessage);
  if (action === "deleteEveryone") await deleteForEveryone(activeMessage);
  if (action === "cancel") $("messageActionsView")?.classList.add("hidden");
  if (action !== "cancel") $("messageActionsView")?.classList.add("hidden");
});

async function loadChatsAndMessages() {
  if (unsubscribeChats) unsubscribeChats();
  if (unsubscribeMessages) unsubscribeMessages();
  await syncChatList();
}

function showHomeView() {
  setView("homeView");
  if ($("chatsTabBtn")) $("chatsTabBtn").classList.add("active");
  if ($("updatesTabBtn")) $("updatesTabBtn").classList.remove("active");
  if (me && $("homeAvatar")) setAvatar($("homeAvatar"), me);
}

bind("profileSelectedAvatarBtn","click",()=>toggleAvatarPicker("profileAvatarPicker"));
bind("settingsSelectedAvatarBtn","click",()=>toggleAvatarPicker("settingsAvatarPicker"));

(async () => {
  await checkForUpdates(false);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }
  await setupAuthState();
})();
