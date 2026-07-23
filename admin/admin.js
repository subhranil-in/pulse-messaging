import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocs, collection, collectionGroup, query, orderBy, limit, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyAWPuECsVNQy0lACwG7OkNkkWD6ZXlSsPU",authDomain:"pulse-messaging-6d6ca.firebaseapp.com",projectId:"pulse-messaging-6d6ca",storageBucket:"pulse-messaging-6d6ca.firebasestorage.app",messagingSenderId:"89142546151",appId:"1:89142546151:web:3f90bbd29a2341377d5c42"};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const $=id=>document.getElementById(id);

let currentUser=null;
let cachedUsers=[];
let cachedMessages=[];
let cachedBroadcasts=[];

function setText(id,value){const el=$(id);if(el)el.textContent=value}
function fmtBytes(bytes){const n=Number(bytes)||0; if(n<1024) return `${n} B`; if(n<1048576) return `${(n/1024).toFixed(1)} KB`; if(n<1073741824) return `${(n/1048576).toFixed(1)} MB`; return `${(n/1073741824).toFixed(1)} GB`}
function fmtTime(ts){const d=ts?.toDate?.()||(ts?new Date(ts):null);return d && !isNaN(d) ? d.toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "Unknown"}
function isRecent(ts, hours=24){const d=ts?.toDate?.()||(ts?new Date(ts):null);return !!(d && !isNaN(d) && Date.now()-d.getTime() <= hours*3600*1000)}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}

async function loadAdminFlag(uid){
  const [profileSnap, adminSnap] = await Promise.all([
    getDoc(doc(db,"users",uid)),
    getDoc(doc(db,"admins",uid))
  ]);
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  return !!(profile.role==="admin" || profile.isAdmin===true || profile.admin===true || adminSnap.exists());
}

function show(view){
  ["loginView","loadingView","deniedView","dashboardView"].forEach(id=>$(id).classList.toggle("hidden", id!==view));
}

function clearNode(node){ while(node.firstChild) node.removeChild(node.firstChild) }

async function loadAll(){
  show("loadingView");
  setText("loadingText","Loading users, chats, broadcasts, and storage stats…");
  const [usersSnap, chatsSnap, messagesSnap, broadcastsSnap, logsSnap] = await Promise.all([
    getDocs(collection(db,"users")),
    getDocs(collection(db,"chats")),
    getDocs(collectionGroup(db,"messages")),
    getDocs(query(collection(db,"broadcasts"), orderBy("createdAt","desc"), limit(10))).catch(()=>({docs:[]})),
    getDocs(query(collection(db,"adminLogs"), orderBy("createdAt","desc"), limit(12))).catch(()=>({docs:[]}))
  ]);

  cachedUsers = usersSnap.docs.map(d=>({id:d.id,...d.data()}));
  cachedMessages = messagesSnap.docs.map(d=>({id:d.id,...d.data(),__path:d.ref.path}));
  cachedBroadcasts = broadcastsSnap.docs.map(d=>({id:d.id,...d.data()}));

  const totalUsers = cachedUsers.length;
  const onlineUsers = cachedUsers.filter(u=>u.online===true).length;
  const activeUsers = cachedUsers.filter(u=>u.online===true || isRecent(u.lastSeen,24)).length;
  const newUsers24h = cachedUsers.filter(u=>isRecent(u.createdAt,24)).length;
  const totalChats = chatsSnap.size;
  const totalMessages = cachedMessages.length;
  const mediaMessages = cachedMessages.filter(m=>m.filePath).length;
  const totalStorage = cachedMessages.reduce((sum,m)=>sum + (Number(m.fileSize)||0),0);

  setText("totalUsers", totalUsers);
  setText("activeUsers", activeUsers);
  setText("onlineUsers", `${onlineUsers} online now`);
  setText("newUsers24h", `${newUsers24h} new in 24h`);
  setText("totalChats", totalChats);
  setText("totalMessages", `${totalMessages.toLocaleString()} messages`);
  setText("storageUsage", fmtBytes(totalStorage));
  setText("mediaCount", `${mediaMessages.toLocaleString()} shared files`);

  renderAnalytics();
  renderActiveUsers();
  renderStorage();
  renderBroadcastHistory();
  renderLogs(logsSnap.docs.map(d=>({id:d.id,...d.data()})));
  show("dashboardView");
}

function renderAnalytics(){
  const box = $("analyticsBars");
  clearNode(box);
  const total = cachedUsers.length || 1;
  const online = cachedUsers.filter(u=>u.online===true).length;
  const active = cachedUsers.filter(u=>u.online===true || isRecent(u.lastSeen,24)).length;
  const registered7d = cachedUsers.filter(u=>isRecent(u.createdAt,168)).length;
  const items = [
    ["Online", online, total],
    ["Active 24h", active, total],
    ["Registered 7d", registered7d, total],
    ["Verified", cachedUsers.filter(u=>u.verified===true || u.emailVerified===true).length, total],
    ["Muted", cachedUsers.filter(u=>u.muted===true).length, total],
  ];
  items.forEach(([label,value,max])=>{
    const row=document.createElement("div"); row.className="barRow";
    const lab=document.createElement("label");
    lab.innerHTML = `<span>${escapeHtml(label)}</span><b>${value}</b>`;
    const track=document.createElement("div"); track.className="track";
    const fill=document.createElement("i"); fill.style.width=`${Math.max(4, Math.round((Number(value)||0)/(Number(max)||1)*100))}%`;
    track.append(fill); row.append(lab,track); box.append(row);
  });
}

function userStatus(u){
  if(u.banned || u.status==="banned") return "Banned";
  if(u.muted) return "Muted";
  if(u.admin || u.role==="admin" || u.isAdmin) return "Admin";
  if(u.online===true) return "Online";
  if(isRecent(u.lastSeen,24)) return "Active";
  return "Offline";
}

function renderActiveUsers(){
  const q = normalize($("userSearch").value);
  const box = $("activeUsersList");
  clearNode(box);
  const items = cachedUsers
    .filter(u=>{
      if(!q) return true;
      return normalize(u.displayName).includes(q) || normalize(u.phone).includes(q) || normalize(u.email).includes(q) || normalize(u.id).includes(q);
    })
    .sort((a,b)=>(Number(b.online===true)-Number(a.online===true)) || (Number(b.lastSeen?.seconds||0)-Number(a.lastSeen?.seconds||0)));

  if(!items.length){
    const empty=document.createElement("div");
    empty.className="userRow";
    empty.innerHTML='<div class="userMeta"><b>No matching users</b><small>Try a different search term.</small></div>';
    box.append(empty);
    return;
  }

  items.slice(0,40).forEach(u=>{
    const row=document.createElement("div"); row.className="userRow";
    const meta=document.createElement("div"); meta.className="userMeta";
    meta.innerHTML = `<b>${escapeHtml(u.displayName || "Unnamed user")}</b><small>${escapeHtml(u.phone || "No phone")} · ${escapeHtml(u.email || "No email")}</small><div class="badge">${escapeHtml(userStatus(u))}</div><small>Last seen: ${escapeHtml(fmtTime(u.lastSeen))}</small>`;
    const actions=document.createElement("div"); actions.className="userActions";
    const mk=(label,cls,fn)=>{ const b=document.createElement("button"); b.textContent=label; if(cls) b.className=cls; b.onclick=fn; return b; };
    actions.append(
      mk(u.banned || u.status==="banned" ? "Unban" : "Ban","danger",()=>moderateUser(u.id, u.banned || u.status==="banned" ? {banned:false,status:"active",online:false} : {banned:true,status:"banned",online:false})),
      mk(u.muted ? "Unmute" : "Mute","",()=>moderateUser(u.id, {muted:!u.muted})),
      mk((u.role==="admin" || u.isAdmin) ? "Remove admin" : "Make admin","accent",()=>moderateUser(u.id, (u.role==="admin" || u.isAdmin) ? {role:"user",isAdmin:false,admin:false} : {role:"admin",isAdmin:true,admin:true}))
    );
    row.append(meta,actions);
    box.append(row);
  });
}

function renderStorage(){
  const box = $("storageBreakdown");
  clearNode(box);
  const groups = {Images:0,Videos:0,Audio:0,Documents:0,Other:0};
  cachedMessages.forEach(m=>{
    const size = Number(m.fileSize)||0;
    const type = String(m.fileType||"").toLowerCase();
    if(type.startsWith("image/")) groups.Images += size;
    else if(type.startsWith("video/")) groups.Videos += size;
    else if(type.startsWith("audio/")) groups.Audio += size;
    else if(type.includes("pdf") || type.includes("text") || type.includes("document") || type.includes("msword") || type.includes("sheet")) groups.Documents += size;
    else if(m.filePath) groups.Other += size;
  });
  const total = Object.values(groups).reduce((a,b)=>a+b,0) || 1;
  Object.entries(groups).sort((a,b)=>b[1]-a[1]).forEach(([label,value])=>{
    const row=document.createElement("div"); row.className="storageRow";
    const lab=document.createElement("label");
    lab.innerHTML=`<span>${escapeHtml(label)}</span><b>${fmtBytes(value)}</b>`;
    const track=document.createElement("div"); track.className="track";
    const fill=document.createElement("i"); fill.style.width=`${Math.max(3, Math.round(value/total*100))}%`;
    track.append(fill); row.append(lab,track); box.append(row);
  });
}

function renderBroadcastHistory(){
  const box = $("broadcastHistory");
  clearNode(box);
  if(!cachedBroadcasts.length){
    const empty=document.createElement("div");
    empty.className="historyRow";
    empty.innerHTML='<b>No broadcasts yet</b><small>Send a message to create the first app-wide notice.</small>';
    box.append(empty);
    return;
  }
  cachedBroadcasts.slice(0,5).forEach(b=>{
    const row=document.createElement("div"); row.className="historyRow";
    row.innerHTML = `<b>${escapeHtml(b.title || "Untitled broadcast")}</b><small>${escapeHtml(b.body || "")}</small><small>${escapeHtml(String(b.target || "everyone"))} · ${escapeHtml(fmtTime(b.createdAt))}</small>`;
    box.append(row);
  });
}

function renderLogs(logs){
  const box = $("adminLogs");
  clearNode(box);
  if(!logs.length){
    const empty=document.createElement("div");
    empty.className="logRow";
    empty.innerHTML='<b>No admin logs</b><small>Actions you take here will appear in this feed.</small>';
    box.append(empty);
    return;
  }
  logs.forEach(l=>{
    const row=document.createElement("div"); row.className="logRow";
    row.innerHTML = `<b>${escapeHtml(l.action || "Action")}</b><small>${escapeHtml(l.target || l.userId || "—")} · ${escapeHtml(fmtTime(l.createdAt))}</small><small>${escapeHtml(l.details || "")}</small>`;
    box.append(row);
  });
}

async function moderateUser(uid, patch){
  await updateDoc(doc(db,"users",uid), {...patch, updatedAt: serverTimestamp()});
  await addDoc(collection(db,"adminLogs"), {
    action: Object.keys(patch).includes("banned") ? (patch.banned ? "Banned user" : "Unbanned user") :
            Object.keys(patch).includes("muted") ? (patch.muted ? "Muted user" : "Unmuted user") :
            "Updated permissions",
    target: uid,
    details: JSON.stringify(patch),
    adminId: currentUser.uid,
    createdAt: serverTimestamp()
  }).catch(()=>{});
  await loadAll();
}

async function sendBroadcast(){
  const title=$("broadcastTitle").value.trim();
  const body=$("broadcastBody").value.trim();
  const target=$("broadcastTarget").value;
  if(!title || !body){ alert("Add a title and message."); return; }
  await addDoc(collection(db,"broadcasts"), {
    title, body, target, status:"active",
    createdAt: serverTimestamp(),
    createdBy: currentUser.uid
  });
  await addDoc(collection(db,"adminLogs"), {
    action:"Broadcast sent",
    target,
    details:title,
    adminId:currentUser.uid,
    createdAt:serverTimestamp()
  }).catch(()=>{});
  $("broadcastBody").value = "";
  $("broadcastTitle").value = "";
  await loadAll();
}

function normalize(s){return String(s||"").toLowerCase().trim()}

async function signIn(){
  try{
    setText("authStatus","Signing in…");
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  }catch(e){
    setText("authStatus", e.message || "Sign-in failed");
  }
}

onAuthStateChanged(auth, async (user)=>{
  currentUser = user || null;
  if(!user){
    show("loginView");
    return;
  }
  show("loadingView");
  try{
    const allowed = await loadAdminFlag(user.uid);
    if(!allowed){
      setText("deniedText", "This account is signed in, but it does not have admin access.");
      show("deniedView");
      return;
    }
    await loadAll();
  }catch(e){
    setText("loadingText", e.message || "Could not load the dashboard.");
    show("deniedView");
  }
});

$("signInBtn").onclick = signIn;
$("signOutBtn").onclick = ()=>signOut(auth);
$("logoutBtn").onclick = ()=>signOut(auth);
$("refreshBtn").onclick = loadAll;
$("analyticsRefresh").onclick = loadAll;
$("storageRefresh").onclick = loadAll;
$("logsRefresh").onclick = loadAll;
$("searchModeration").onclick = renderActiveUsers;
$("userSearch").addEventListener("input", renderActiveUsers);
$("sendBroadcast").onclick = sendBroadcast;

document.addEventListener("keydown", (e)=>{
  if(e.key === "Enter" && (document.activeElement?.id === "email" || document.activeElement?.id === "password")){
    signIn();
  }
});
