import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const firebaseConfig={apiKey:"AIzaSyAyzAV68m4BRtwmn0iu2vDplZaJ9r_uQVk",authDomain:"rekapinyu.firebaseapp.com",projectId:"rekapinyu",storageBucket:"rekapinyu.firebasestorage.app",messagingSenderId:"835450919713",appId:"1:835450919713:web:818f9f48c5b05330d67c60",measurementId:"G-4KSJC9ENH8"};
const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app), storage=getStorage(app);
window.RekapinyuFirebase={app,auth,db,storage,ready:false,uid:null,unsubscribe:null};
const USERS="rekapinyu_users", DATA="rekapinyu_data", MAX=850000;
const phoneOf=v=>String(v||"").replace(/\D/g,"");
const emailOf=p=>`${phoneOf(p)}@rekapinyu.app`;
const uref=uid=>doc(db,USERS,uid), dref=uid=>doc(db,DATA,uid);
const nativeSet=Storage.prototype.setItem, nativeRemove=Storage.prototype.removeItem;
const safe=(v,d)=>{try{return JSON.parse(v)}catch{return d}};
function cloudUid(){return auth.currentUser?.uid||null;}
function notify(t,m,i){if(typeof showModal==="function")showModal(t,m,i);else alert(t+"\n"+m);}
function openDashboardAfterLogin(){
 const tab=window.matchMedia("(max-width:767px)").matches?"home":"input";
 if(typeof window.switchTab==="function")window.switchTab(tab);
}

/* PATCH FOKUS DATA PERSISTEN: lindungi input terbaru dari snapshot Firestore yang masih lama/kosong. */
function dataPendingKey(phone,key){return `finance_pending_${key}_${phone}`;}
function markDataPending(key,items){
 try{
  const phone=phoneOf(currentSessionUser?.phone); if(!phone)return;
  const arr=Array.isArray(items)?items:[];
  const ids=arr.map(x=>String(x?.id)).filter(Boolean);
  if(!ids.length)return;
  nativeSet.call(localStorage,dataPendingKey(phone,key),JSON.stringify(ids));
 }catch(e){}
}
function clearDataPending(key,items){
 try{
  const phone=phoneOf(currentSessionUser?.phone); if(!phone)return;
  const pending=safe(localStorage.getItem(`finance_pending_${key}_${phone}`),[]);
  if(!Array.isArray(pending)||!pending.length)return;
  const ids=new Set((Array.isArray(items)?items:[]).map(x=>String(x?.id)));
  const left=pending.filter(id=>!ids.has(String(id)));
  if(left.length)nativeSet.call(localStorage,dataPendingKey(phone,key),JSON.stringify(left));
  else nativeRemove.call(localStorage,dataPendingKey(phone,key));
 }catch(e){}
}
function mergePendingData(phone,key,cloudValue){
 const local=safe(localStorage.getItem(`finance_${key}_desktop_${phone}`),[]);
 const cloud=Array.isArray(cloudValue)?cloudValue:null;
 if(!cloud)return {data:Array.isArray(local)?local:[],pending:false};
 const pending=safe(localStorage.getItem(`finance_pending_${key}_${phone}`),[]);
 const pendingIds=new Set(Array.isArray(pending)?pending.map(String):[]);
 const missing=[...pendingIds].some(id=>!cloud.some(x=>String(x?.id)===id));
 if(!missing)return {data:cloud,pending:false};
 const byId=new Map(cloud.map(x=>[String(x?.id),x]));
 (Array.isArray(local)?local:[]).forEach(x=>{if(pendingIds.has(String(x?.id)))byId.set(String(x?.id),x);});
 return {data:Array.from(byId.values()),pending:true};
}
function persistAllDataLocally(){
 const phone=phoneOf(currentSessionUser?.phone); if(!phone)return;
 nativeSet.call(localStorage,`finance_history_desktop_${phone}`,JSON.stringify(Array.isArray(historyData)?historyData:[]));
 nativeSet.call(localStorage,`finance_pengeluaran_desktop_${phone}`,JSON.stringify(Array.isArray(pengeluaranData)?pengeluaranData:[]));
 nativeSet.call(localStorage,`finance_kasbon_desktop_${phone}`,JSON.stringify(Array.isArray(kasbonData)?kasbonData:[]));
 nativeSet.call(localStorage,`finance_backup_desktop_${phone}`,JSON.stringify(Array.isArray(backupOtomatisData)?backupOtomatisData:[]));
}
function requestDataCloudSync(){try{window.__rekapinyuSaveCloudData?.();}catch(e){}}
// Bridge untuk script klasik: helper di dalam module tidak terlihat oleh script biasa.
window.__markDataPending=(key,items)=>markDataPending(key,items);
window.__requestDataCloudSync=()=>requestDataCloudSync();

async function saveCloudData(){
 const uid=cloudUid(), phone=phoneOf(currentSessionUser?.phone); if(!uid||!phone)return;
 let shop=localStorage.getItem(`finance_shop_cover_${phone}`)||"";
 if(shop.length>MAX)shop="";
 /*
  * Firestore menjadi sumber data permanen.
  * Semua array selalu dikirim, termasuk [].
  * Jangan hanya menyimpan jika length > 0, karena ketika pengguna
  * menghapus data sampai kosong, Firebase juga harus menerima [] agar
  * data lama di cloud ikut terhapus dan tidak muncul lagi saat login
  * dari perangkat/browser lain.
  */
 const payload={
   namaPengguna:currentSessionUser?.name||"",
   nomorHp:currentSessionUser?.phone||"",
   historyData:Array.isArray(historyData)?historyData:[],
   pengeluaranData:Array.isArray(pengeluaranData)?pengeluaranData:[],
   kasbonData:Array.isArray(kasbonData)?kasbonData:[],
   backupOtomatisData:Array.isArray(backupOtomatisData)?backupOtomatisData:[],
   kasirTransactions:safe(localStorage.getItem(`finance_kasir_transactions_${phone}`),[]),
   activityData:Array.isArray(window.__rekapinyuActivityData)?window.__rekapinyuActivityData:[],
   updatedAt:serverTimestamp()
 };
 if(shop)payload.shopCover=shop;
 await setDoc(dref(uid),payload,{merge:true});
}
async function saveCloudUser(extra={}){
 const u=auth.currentUser;if(!u)return;
 const old=(await getDoc(uref(u.uid))).data()||{};
 await setDoc(uref(u.uid),{...old,uid:u.uid,name:extra.name??currentSessionUser?.name??u.displayName??old.name??"",phone:phoneOf(extra.phone??currentSessionUser?.phone??old.phone??""),photo:extra.photo??currentSessionUser?.photo??old.photo??"",email:u.email||old.email||emailOf(currentSessionUser?.phone),updatedAt:serverTimestamp()},{merge:true});
}
function localSession(u){
 currentSessionUser={uid:u.uid,name:u.name||"",phone:phoneOf(u.phone),photo:u.photo||"",email:u.email||auth.currentUser?.email||""};
 nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));
 const users=safe(localStorage.getItem("finance_registered_users"),[]);
 const list=Array.isArray(users)?users:[];
 const index=list.findIndex(item=>phoneOf(item.phone)===currentSessionUser.phone);
 if(index>=0)list[index]={...list[index],...currentSessionUser};
 else list.push(currentSessionUser);
 nativeSet.call(localStorage,"finance_registered_users",JSON.stringify(list));
}
function syncCloudArrayToCache(phone,key,cloudValue){
 const localKey=`finance_${key}_desktop_${phone}`;
 const result=mergePendingData(phone,key,cloudValue);
 if(result.pending){
  nativeSet.call(localStorage,localKey,JSON.stringify(result.data));
  return result.data;
 }
 if(Array.isArray(cloudValue)){
  nativeSet.call(localStorage,localKey,JSON.stringify(cloudValue));
  clearDataPending(key,cloudValue);
  return cloudValue;
 }
 const localValue=safe(localStorage.getItem(localKey),[]);
 return Array.isArray(localValue)?localValue:[];
}
async function hydrate(uid){
 const us=await getDoc(uref(uid)), ds=await getDoc(dref(uid)); const u=us.exists()?us.data():{}, d=ds.exists()?ds.data():{}, phone=phoneOf(u.phone||currentSessionUser?.phone);
 if(!phone)return;
 localSession({...u,uid});
 const preservedHistory=syncCloudArrayToCache(phone,"history",d.historyData);
 const preservedPengeluaran=syncCloudArrayToCache(phone,"pengeluaran",d.pengeluaranData);
 const preservedKasbon=syncCloudArrayToCache(phone,"kasbon",d.kasbonData);
 const preservedBackup=syncCloudArrayToCache(phone,"backup",d.backupOtomatisData);
 if(Array.isArray(d.kasirTransactions))nativeSet.call(localStorage,`finance_kasir_transactions_${phone}`,JSON.stringify(d.kasirTransactions));
 const pendingHistory=mergePendingData(phone,"history",d.historyData).pending;
 const pendingPengeluaran=mergePendingData(phone,"pengeluaran",d.pengeluaranData).pending;
 const pendingKasbon=mergePendingData(phone,"kasbon",d.kasbonData).pending;
 const pendingBackup=mergePendingData(phone,"backup",d.backupOtomatisData).pending;
 if(pendingHistory||pendingPengeluaran||pendingKasbon||pendingBackup)saveCloudData().catch(console.warn);
 if(typeof d.shopCover==="string"&&d.shopCover)nativeSet.call(localStorage,`finance_shop_cover_${phone}`,d.shopCover);
 loadUserData();
 if((preservedHistory.length||preservedPengeluaran.length||preservedKasbon.length||preservedBackup.length) && (!Array.isArray(d.historyData)||!d.historyData.length) && (!Array.isArray(d.pengeluaranData)||!d.pengeluaranData.length) && (!Array.isArray(d.kasbonData)||!d.kasbonData.length) && (!Array.isArray(d.backupOtomatisData)||!d.backupOtomatisData.length)){
  saveCloudData().catch(console.warn);
 }
 if(typeof refreshShopCoverPhoto==="function")refreshShopCoverPhoto(); if(typeof updateUserAvatarUI==="function")updateUserAvatarUI();
}
function redraw(){try{loadUserData()}catch{} try{populateHistoryFilters?.();renderHistory?.();renderReport?.()}catch{} try{populatePengeluaranFilters?.();renderPengeluaranGrid?.()}catch{} try{renderKasbonGrid?.()}catch{} try{populateBackupFilters?.();renderBackupGrid?.()}catch{} try{window.__initKasirViews?.()}catch{} try{window.__renderLaporanKasir?.()}catch{} try{renderMobileAdminSummary?.()}catch{} try{refreshShopCoverPhoto?.();updateUserAvatarUI?.()}catch{}}
/*
 * Sinkronisasi eksplisit untuk perubahan data.
 * Handler lama tetap bekerja seperti semula melalui localStorage; helper ini
 * hanya memastikan perubahan terakhir juga dikirim ke Firestore dan tidak
 * bergantung pada timer 200 ms saat pengguna berpindah halaman/perangkat.
 */
let cloudSaveChain=Promise.resolve();
window.__rekapinyuSaveCloudData=()=>{
 cloudSaveChain=cloudSaveChain.then(async()=>{
   await saveCloudData();
   const phone=phoneOf(currentSessionUser?.phone);
   if(phone){
     clearDataPending('history',safe(localStorage.getItem(`finance_history_desktop_${phone}`),[]));
     clearDataPending('pengeluaran',safe(localStorage.getItem(`finance_pengeluaran_desktop_${phone}`),[]));
     clearDataPending('kasbon',safe(localStorage.getItem(`finance_kasbon_desktop_${phone}`),[]));
     clearDataPending('backup',safe(localStorage.getItem(`finance_backup_desktop_${phone}`),[]));
   }
 }).catch(err=>{
   console.warn("Rekapinyu: sinkronisasi Firestore gagal, cache lokal tetap dipertahankan.",err);
 });
 return cloudSaveChain;
};

// Data tertentu tetap disinkronkan ke Firebase; Produk Kasir dikelola sepenuhnya di localStorage.
if(!Storage.prototype.__rekapinyuFirebaseFull){
 Storage.prototype.setItem=function(k,v){const r=nativeSet.call(this,k,v);if(this===localStorage&&window.RekapinyuFirebase.ready&&cloudUid()){
   const p=phoneOf(currentSessionUser?.phone);const watched=[`finance_history_desktop_${p}`,`finance_pengeluaran_desktop_${p}`,`finance_kasbon_desktop_${p}`,`finance_backup_desktop_${p}`,`finance_shop_cover_${p}`,`finance_kasir_transactions_${p}`];
   if(watched.includes(k)){clearTimeout(window.__rfSaveTimer);window.__rfSaveTimer=setTimeout(()=>window.__rekapinyuSaveCloudData?.(),200)}
 }return r};
 Storage.prototype.removeItem=function(k){const r=nativeRemove.call(this,k);if(this===localStorage&&window.RekapinyuFirebase.ready&&cloudUid()){clearTimeout(window.__rfSaveTimer);window.__rfSaveTimer=setTimeout(()=>window.__rekapinyuSaveCloudData?.(),100)}return r};
 Storage.prototype.__rekapinyuFirebaseFull=true;
}

// REKAPINYU AUTH RELOAD — SATU IMPLEMENTASI FIREBASE
// Persistensi sesi diaktifkan sebelum observer auth dipasang.
const authReadyPromise = setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Rekapinyu: persistensi sesi Firebase tidak dapat diaktifkan.", err);
});
window.__rekapinyuAuthReady = authReadyPromise;

function authErrorMessage(err, mode){
  const code = err?.code || "";
  if(code === "auth/unauthorized-domain") return "Domain aplikasi belum diizinkan di Firebase Authentication. Tambahkan domain GitHub Pages aplikasi ini pada Firebase Console > Authentication > Settings > Authorized domains.";
  if(code === "auth/operation-not-allowed") return "Login Email/Password belum diaktifkan di Firebase Console > Authentication > Sign-in method.";
  if(code === "auth/email-already-in-use") return "Nomor HP tersebut sudah terdaftar. Silakan langsung masuk.";
  if(code === "auth/invalid-email") return "Nomor HP tidak valid.";
  if(code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Nomor HP atau Kata Sandi yang Anda masukkan salah.";
  if(code === "auth/weak-password") return "Kata sandi terlalu lemah. Gunakan minimal 6 karakter.";
  if(code === "auth/network-request-failed") return "Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.";
  if(code === "auth/too-many-requests") return "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.";
  if(mode === "register") return "Pendaftaran gagal. Periksa koneksi dan pengaturan Firebase Authentication.";
  return "Login gagal. Periksa nomor HP, kata sandi, dan koneksi Firebase.";
}

async function firebaseRegister(){
  const form=document.getElementById("register-form");
  if(!form)return;
  const name=document.getElementById("reg-name")?.value.trim()||"";
  const phone=phoneOf(document.getElementById("reg-phone")?.value||"");
  const password=document.getElementById("reg-password")?.value||"";
  if(!name){notify("Gagal Daftar","Nama wajib diisi.","fa-solid fa-circle-exclamation text-rose-600");return;}
  if(!phone){notify("Gagal Daftar","Nomor HP wajib diisi.","fa-solid fa-circle-exclamation text-rose-600");return;}
  if(password.length<6){notify("Gagal Daftar","Kata sandi minimal 6 karakter.","fa-solid fa-circle-exclamation text-rose-600");return;}
  const submit=form.querySelector('button[type="submit"]');
  if(submit?.dataset.busy==="1")return;
  if(submit)submit.dataset.busy="1";
  try{
    await authReadyPromise;
    const credential=await createUserWithEmailAndPassword(auth,emailOf(phone),password);
    await updateProfile(credential.user,{displayName:name});
    const userData={uid:credential.user.uid,name,phone,email:credential.user.email,photo:""};
    // Auth adalah sumber identitas. Firestore hanya menyimpan profil/data aplikasi.
    try{
      await setDoc(uref(credential.user.uid),{...userData,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      await setDoc(dref(credential.user.uid),{historyData:[],pengeluaranData:[],kasbonData:[],backupOtomatisData:[],kasirTransactions:[],activityData:[],shopCover:"",updatedAt:serverTimestamp()});
    }catch(dbErr){
      console.warn("Rekapinyu: akun Firebase berhasil dibuat tetapi profil/data Firestore belum tersimpan.",dbErr);
    }
    // Cache lokal hanya untuk kompatibilitas UI lama; bukan sumber autentikasi.
    nativeSet.call(localStorage,"finance_registered_users",JSON.stringify([{...userData,password}]));
    currentSessionUser=null;
    nativeRemove.call(localStorage,"finance_active_session");
    try{await signOut(auth)}catch(e){console.warn("Logout setelah pendaftaran:",e)}
    form.reset();
    toggleAuthView("login");
    notify("Pendaftaran Berhasil","Akun berhasil dibuat. Silakan masuk menggunakan Nomor HP dan Kata Sandi.");
  }catch(err){
    console.error("Rekapinyu Firebase registration:",err);
    notify("Gagal Daftar",authErrorMessage(err,"register"),"fa-solid fa-circle-xmark text-rose-600");
  }finally{
    if(submit)delete submit.dataset.busy;
  }
}

async function firebaseLogin(){
  const form=document.getElementById("login-form");
  if(!form)return;
  const phone=phoneOf(document.getElementById("login-phone")?.value||"");
  const password=document.getElementById("login-password")?.value||"";
  if(!phone||!password){notify("Gagal Masuk","Nomor HP dan Kata Sandi wajib diisi.","fa-solid fa-circle-exclamation text-rose-600");return;}
  const submit=form.querySelector('button[type="submit"]');
  if(submit?.dataset.busy==="1")return;
  if(submit)submit.dataset.busy="1";
  try{
    await authReadyPromise;
    const credential=await signInWithEmailAndPassword(auth,emailOf(phone),password);
    let user={uid:credential.user.uid,name:credential.user.displayName||"",phone,email:credential.user.email,photo:""};
    try{
      const snap=await getDoc(uref(credential.user.uid));
      if(snap.exists())user={...user,...snap.data()};
    }catch(dbErr){console.warn("Rekapinyu: profil Firestore belum dapat dibaca.",dbErr)}
    localSession({...user,uid:credential.user.uid,phone:phoneOf(user.phone||phone),email:credential.user.email});
    try{await hydrate(credential.user.uid)}catch(hydrateErr){console.warn("Rekapinyu: data Firestore belum dapat dimuat; cache lokal dipakai.",hydrateErr)}
    checkAuth();
    openDashboardAfterLogin();
    form.reset();
    notify("Masuk Berhasil",`Selamat datang kembali, ${currentSessionUser.name||nameFromPhone(phone)}!`);
  }catch(err){
    console.error("Rekapinyu Firebase login:",err);
    // Migrasi satu kali akun lama yang masih tersimpan di versi sebelum Firebase.
    const legacy=registeredUsers.find(x=>phoneOf(x.phone)===phone&&x.password===password);
    if(legacy && (err?.code==="auth/user-not-found" || err?.code==="auth/invalid-credential" || err?.code==="auth/invalid-login-credentials")){
      try{
        const credential=await createUserWithEmailAndPassword(auth,emailOf(phone),password);
        await updateProfile(credential.user,{displayName:legacy.name||""});
        try{
          await setDoc(uref(credential.user.uid),{uid:credential.user.uid,name:legacy.name||"",phone,email:credential.user.email,photo:legacy.photo||"",migratedFromLegacy:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
          let shop=localStorage.getItem(`finance_shop_cover_${phone}`)||"";if(shop.length>MAX)shop="";
          await setDoc(dref(credential.user.uid),{historyData:safe(localStorage.getItem(`finance_history_desktop_${phone}`),[]),pengeluaranData:safe(localStorage.getItem(`finance_pengeluaran_desktop_${phone}`),[]),kasbonData:safe(localStorage.getItem(`finance_kasbon_desktop_${phone}`),[]),backupOtomatisData:safe(localStorage.getItem(`finance_backup_desktop_${phone}`),[]),kasirTransactions:safe(localStorage.getItem(`finance_kasir_transactions_${phone}`),[]),shopCover:shop,migratedFromLegacy:true,updatedAt:serverTimestamp()});
        }catch(migrateCloudErr){console.warn("Rekapinyu: migrasi Firestore ditunda karena Rules.",migrateCloudErr)}
        localSession({uid:credential.user.uid,name:legacy.name||"",phone,photo:legacy.photo||"",email:credential.user.email});
        try{await hydrate(credential.user.uid)}catch{}
        checkAuth();openDashboardAfterLogin();form.reset();
        notify("Masuk Berhasil","Akun lama berhasil dipindahkan ke Firebase.");
        return;
      }catch(migrateErr){
        console.error("Rekapinyu legacy migration:",migrateErr);
      }
    }
    notify("Gagal Masuk",authErrorMessage(err,"login"),"fa-solid fa-circle-xmark text-rose-600");
  }finally{
    if(submit)delete submit.dataset.busy;
  }
}

const rf=document.getElementById("register-form");
const lf=document.getElementById("login-form");
if(rf)rf.addEventListener("submit",e=>{e.preventDefault();e.stopImmediatePropagation();firebaseRegister();});
if(lf)lf.addEventListener("submit",e=>{e.preventDefault();e.stopImmediatePropagation();firebaseLogin();});

window.handleLogout=async()=>{
  try{await saveCloudData()}catch{}
  try{await signOut(auth)}catch(e){console.warn("Firebase logout:",e)}
  currentSessionUser=null;
  nativeRemove.call(localStorage,"finance_active_session");
  checkAuth();
  toggleAuthView("login");
};

// Profile changes save to Firestore instead of only localStorage.
window.updateUserInStorage=async()=>{if(!auth.currentUser||!currentSessionUser)return;try{await updateProfile(auth.currentUser,{displayName:currentSessionUser.name||""});await saveCloudUser({name:currentSessionUser.name,phone:currentSessionUser.phone,photo:currentSessionUser.photo||""});nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));await saveCloudData()}catch(e){console.error(e);notify("Firebase","Perubahan profil gagal disimpan ke Firebase.","fa-solid fa-circle-xmark text-rose-600")}};

// Pengolah gambar: menerima JPG/PNG, portrait maupun landscape, dan membuat preview yang ringan.
function imageToDataURL(file,maxSide=1600,quality=0.88){return new Promise((resolve,reject)=>{
  if(!file||!/^image\/(jpeg|png)$/i.test(file.type))return reject(new Error("Format gambar harus JPG atau PNG."));
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("File gambar tidak dapat dibaca."));
  reader.onload=()=>{const img=new Image();img.onload=()=>{
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,scale=Math.min(1,maxSide/Math.max(w,h));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext("2d");if(!ctx)return reject(new Error("Browser tidak mendukung pemrosesan gambar."));
    ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",quality));
  };img.onerror=()=>reject(new Error("Format gambar tidak dapat diproses."));img.src=reader.result};reader.readAsDataURL(file);
})}

// Profile photo: JPG/PNG portrait maupun landscape. Storage adalah sinkronisasi cloud,
// sedangkan cache lokal dipakai agar pergantian foto tetap langsung berfungsi bila Rules belum siap.
const profileSave=document.getElementById("save-profile-btn");
if(profileSave)profileSave.addEventListener("click",async e=>{
  const inp=document.getElementById("input-new-photo"),file=inp?.files?.[0];
  if(!file||!auth.currentUser){e.preventDefault();e.stopImmediatePropagation();notify("Gagal","Silakan pilih foto terlebih dahulu.","fa-solid fa-circle-exclamation text-rose-600");return;}
  e.preventDefault();e.stopImmediatePropagation();
  if(!/^image\/(jpeg|png)$/i.test(file.type)){notify("Gagal","Format yang didukung hanya JPG dan PNG.","fa-solid fa-circle-exclamation text-rose-600");return;}
  try{
    const localUrl=await imageToDataURL(file,900,0.88);
    const phone=phoneOf(currentSessionUser.phone);
    currentSessionUser.photo=localUrl;
    nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));
    nativeSet.call(localStorage,`finance_profile_photo_${phone}`,localUrl);
    const idx=registeredUsers.findIndex(u=>phoneOf(u.phone)===phone);
    if(idx!==-1){registeredUsers[idx]={...registeredUsers[idx],photo:localUrl};nativeSet.call(localStorage,"finance_registered_users",JSON.stringify(registeredUsers));}
    updateUserAvatarUI();
    // Simpan profil lokal/Firestore tanpa menjadikan kegagalan Rules sebagai kegagalan UI.
    try{await saveCloudUser({photo:localUrl})}catch(err){console.warn("Foto profil lokal tersimpan; Firestore belum menerima foto.",err)}
    // Sinkronkan ke Storage bila Rules mengizinkan.
    try{
      const r=ref(storage,`users/${auth.currentUser.uid}/profile`);
      await uploadBytes(r,file,{contentType:file.type,cacheControl:"public,max-age=31536000"});
      const url=await getDownloadURL(r);
      currentSessionUser.photo=url;
      nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));
      nativeSet.call(localStorage,`finance_profile_photo_${phone}`,url);
      await saveCloudUser({photo:url});
      updateUserAvatarUI();
    }catch(storageErr){console.warn("Storage profil belum mengizinkan upload; cache lokal tetap digunakan.",storageErr)}
    closeProfileModal();
    notify("Berhasil","Foto profil berhasil diganti.");
  }catch(x){console.error(x);notify("Gagal","Foto profil tidak dapat diproses. Gunakan JPG atau PNG.","fa-solid fa-circle-xmark text-rose-600")}
},true);

// Shop cover: file baru hanya menjadi preview/editor. Upload cloud dilakukan setelah tombol Simpan ditekan,
// sehingga foto dapat digeser bebas ke atas/bawah/kiri/kanan sebelum disimpan.
const ci=document.getElementById("shop-cover-input");
if(ci)ci.addEventListener("change",async e=>{
  e.preventDefault();e.stopImmediatePropagation();
  const file=ci.files?.[0];ci.value="";
  if(!file||!auth.currentUser)return;
  if(!/^image\/(jpeg|png)$/i.test(file.type)){notify("Gagal","Format yang didukung hanya JPG dan PNG.","fa-solid fa-circle-exclamation text-rose-600");return;}
  try{
    const preview=await imageToDataURL(file,1800,0.88);
    if(typeof window.__setShopCoverPreview==="function")window.__setShopCoverPreview(preview,file);
  }catch(x){console.error(x);notify("Gagal","Foto sampul tidak dapat diproses. Gunakan JPG atau PNG.","fa-solid fa-circle-xmark text-rose-600")}
},true);

// Password update uses Firebase Auth. Recent login may be required by Firebase.
window.__rekapinyuFirebaseChangePassword=async p=>{if(!auth.currentUser)throw new Error("Belum login Firebase.");await updatePassword(auth.currentUser,p)};

// Hook final: tombol Simpan profil dan sampul dibuat melalui event capture tingkat dokumen.
// Ini memastikan handler tetap aktif walaupun kode original mengisi ulang onclick tombol.
window.__rekapinyuSaveProfilePhoto=async function(){
  const inp=document.getElementById("input-new-photo"),file=inp?.files?.[0];
  if(!file){showModal("Gagal","Silakan pilih foto terlebih dahulu.","fa-solid fa-circle-exclamation text-rose-600");return false;}
  if(!/^image\/(jpeg|png)$/i.test(file.type)){showModal("Gagal","Format yang didukung hanya JPG dan PNG.","fa-solid fa-circle-exclamation text-rose-600");return false;}
  if(!auth.currentUser){showModal("Gagal","Sesi Firebase belum siap. Silakan coba lagi.","fa-solid fa-circle-exclamation text-rose-600");return false;}
  const btn=document.getElementById("save-profile-btn");
  if(btn){btn.disabled=true;btn.dataset.saving="1";btn.textContent="Simpan";}
  try{
    // Simpan ke tampilan/cache lokal terlebih dahulu agar hasil terasa instan.
    const localUrl=await imageToDataURL(file,900,0.88);
    const phone=phoneOf(currentSessionUser?.phone);
    currentSessionUser.photo=localUrl;
    nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));
    if(phone)nativeSet.call(localStorage,`finance_profile_photo_${phone}`,localUrl);
    const idx=registeredUsers.findIndex(u=>phoneOf(u.phone)===phone);
    if(idx!==-1){registeredUsers[idx]={...registeredUsers[idx],photo:localUrl};nativeSet.call(localStorage,"finance_registered_users",JSON.stringify(registeredUsers));}
    updateUserAvatarUI();
    closeProfileModal();

    // Popup sukses langsung setelah foto berhasil diproses/disimpan ke perangkat.
    showModal("Berhasil","Foto profil berhasil disimpan.","fa-solid fa-circle-check text-emerald-600");
    setTimeout(()=>{try{closeModal();}catch{}},1600);

    // Sinkronisasi Firebase berjalan di belakang layar dan tidak menahan popup/tombol.
    Promise.resolve().then(async()=>{
      try{await saveCloudUser({photo:localUrl});}catch(err){console.warn("Firestore foto profil:",err)}
      try{
        const r=ref(storage,`users/${auth.currentUser.uid}/profile`);
        await uploadBytes(r,file,{contentType:file.type,cacheControl:"public,max-age=31536000"});
        const url=await getDownloadURL(r);
        currentSessionUser.photo=url;
        nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));
        if(phone)nativeSet.call(localStorage,`finance_profile_photo_${phone}`,url);
        try{await saveCloudUser({photo:url});}catch(err){console.warn("Firestore URL foto profil:",err)}
        updateUserAvatarUI();
      }catch(err){console.warn("Storage foto profil:",err)}
    });
    return true;
  }catch(err){
    console.error("Simpan foto profil:",err);
    showModal("Gagal","Foto profil tidak dapat disimpan. Gunakan JPG atau PNG.","fa-solid fa-circle-xmark text-rose-600");
    return false;
  }finally{
    if(btn){btn.disabled=false;btn.dataset.saving="";btn.textContent="Simpan";}
  }
};

window.__rekapinyuSaveCoverPhoto=async function(){
  const btn=document.getElementById("shop-cover-save");
  const img=document.getElementById("shop-cover-image");
  if(!btn||btn.classList.contains("hidden")||btn.dataset.saving==="1")return false;
  if(!img||img.classList.contains("hidden")||!img.src)return false;
  btn.disabled=true;btn.dataset.saving="1";btn.textContent="Menyimpan...";
  try{
    const src=img.getAttribute("src")||img.src;
    const pos=img.style.objectPosition||"50% 50%";
    const nums=pos.match(/([0-9.]+)%\s+([0-9.]+)%/);
    const x=nums?Math.max(0,Math.min(100,Number(nums[1]))):50;
    const y=nums?Math.max(0,Math.min(100,Number(nums[2]))):50;
    const data={src:src,x:x,y:y};
    const phone=(typeof currentSessionUser!=="undefined"&&currentSessionUser)?phoneOf(currentSessionUser.phone):"";
    const key=phone?`finance_shop_cover_${phone}`:"finance_shop_cover_guest";
    try{localStorage.setItem(key,JSON.stringify(data));}catch(localErr){
      console.warn("Cache foto sampul lokal gagal:",localErr);
    }
    window.__shopCoverEditingUnsaved=false;
    img.style.objectPosition=`${x}% ${y}%`;
    btn.classList.add("hidden");
    const hint=document.getElementById("shop-cover-edit-hint");
    if(hint)hint.classList.add("hidden");
    const frame=document.getElementById("shop-cover-frame");
    if(frame)frame.classList.remove("cursor-move");

    // Popup sukses ditampilkan segera; proses Firebase tidak menahan tombol.
    showModal("Berhasil","Foto sampul berhasil disimpan.","fa-solid fa-circle-check text-emerald-600");
    setTimeout(()=>{try{closeModal();}catch{}},1600);

    // Sinkronisasi Firebase dilakukan di belakang layar.
    const pending=window.__shopCoverPendingFile||null;
    window.__shopCoverPendingFile=null;
    if(pending&&typeof auth!=="undefined"&&auth.currentUser){
      Promise.resolve().then(async()=>{
        try{
          const r=ref(storage,`users/${auth.currentUser.uid}/shop-cover`);
          // Upload salinan yang SAMA dengan preview yang sudah diproses browser,
          // bukan File asli. Ini mencegah file sampul menjadi rusak setelah sinkronisasi Firebase.
          // Gunakan HASIL PREVIEW yang sedang tampil sebagai sumber upload.
          // Jangan pernah mengganti tampilan lokal dengan URL Firebase setelah klik Simpan,
          // karena itu dapat membuat gambar terlihat rusak/berubah sebelum URL siap.
          let uploadData=null;
          if(/^data:image\/[^;]+;base64,/i.test(src)){
            const parts=src.split(',');
            const mime=(parts[0].match(/^data:([^;]+);base64$/i)||[])[1]||'image/jpeg';
            const binary=atob(parts[1]||'');
            const bytes=new Uint8Array(binary.length);
            for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
            uploadData=new Blob([bytes],{type:mime});
          }
          if(!uploadData){
            uploadData=pending;
          }
          if(!uploadData)throw new Error('Data foto sampul tidak tersedia.');
          const uploadType=uploadData.type||'image/jpeg';
          await uploadBytes(r,uploadData,{contentType:uploadType,cacheControl:"public,max-age=31536000"});
          const url=await getDownloadURL(r);
          // Simpan URL cloud hanya untuk data Firebase. Tampilan yang sudah benar
          // tetap memakai preview lokal beserta posisi x/y yang dipilih pengguna.
          try{await setDoc(dref(auth.currentUser.uid),{shopCover:url,shopCoverX:x,shopCoverY:y,updatedAt:serverTimestamp()},{merge:true});}catch(err){console.warn("Firestore sampul:",err)}
        }catch(err){console.warn("Storage sampul:",err)}
      });
    }
    return true;
  }catch(err){
    console.error("Simpan foto sampul:",err);
    showModal("Gagal","Foto sampul tidak dapat disimpan.","fa-solid fa-circle-xmark text-rose-600");
    return false;
  }finally{
    btn.disabled=false;btn.dataset.saving="";btn.textContent="Simpan";
  }
};

// Satu pintu untuk klik tombol Simpan. Event capture menghentikan onclick lama sebelum berjalan,
// tetapi tidak mengganggu tombol Simpan Nama/Kata Sandi.
document.addEventListener("click",function(e){
  const target=e.target?.closest?.("#save-profile-btn, #shop-cover-save");
  if(!target)return;
  if(target.id==="save-profile-btn"){
    if(!document.getElementById("input-new-photo"))return;
    if(target.dataset.saving==="1")return;
    e.preventDefault();e.stopImmediatePropagation();
    window.__rekapinyuSaveProfilePhoto();
  }else if(target.id==="shop-cover-save"){
    if(target.classList.contains("hidden")||target.dataset.saving==="1")return;
    e.preventDefault();e.stopImmediatePropagation();
    window.__rekapinyuSaveCoverPhoto();
  }
},true);


let dataUnsub=null,userUnsub=null;
function realtime(u){if(dataUnsub)dataUnsub();if(userUnsub)userUnsub();dataUnsub=onSnapshot(dref(u.uid),s=>{if(!s.exists())return;const d=s.data(),p=phoneOf(currentSessionUser?.phone);if(!p)return;const preservedHistory=syncCloudArrayToCache(p,"history",d.historyData),preservedPengeluaran=syncCloudArrayToCache(p,"pengeluaran",d.pengeluaranData),preservedKasbon=syncCloudArrayToCache(p,"kasbon",d.kasbonData),preservedBackup=syncCloudArrayToCache(p,"backup",d.backupOtomatisData); if(Array.isArray(d.activityData)){window.__rekapinyuSetActivityData?.(d.activityData);try{nativeSet.call(localStorage,`finance_activity_desktop_${p}`,JSON.stringify(d.activityData));}catch(e){}}
if(Array.isArray(d.kasirTransactions))nativeSet.call(localStorage,`finance_kasir_transactions_${p}`,JSON.stringify(d.kasirTransactions));const pendingHistory=mergePendingData(p,"history",d.historyData).pending,pendingPengeluaran=mergePendingData(p,"pengeluaran",d.pengeluaranData).pending,pendingKasbon=mergePendingData(p,"kasbon",d.kasbonData).pending,pendingBackup=mergePendingData(p,"backup",d.backupOtomatisData).pending;if(d.shopCover&&!String(d.shopCover).startsWith("data:")){
  try{
    const existing=JSON.parse(localStorage.getItem(`finance_shop_cover_${p}`)||"null");
    if(!existing||!existing.src||String(existing.src).startsWith("http")){
      nativeSet.call(localStorage,`finance_shop_cover_${p}`,JSON.stringify({src:d.shopCover,x:Number.isFinite(Number(d.shopCoverX))?Number(d.shopCoverX):50,y:Number.isFinite(Number(d.shopCoverY))?Number(d.shopCoverY):50}));
    }
  }catch{}
}
if(pendingHistory||pendingPengeluaran||pendingKasbon||pendingBackup || ((preservedHistory.length||preservedPengeluaran.length||preservedKasbon.length||preservedBackup.length) && (!Array.isArray(d.historyData)||!d.historyData.length) && (!Array.isArray(d.pengeluaranData)||!d.pengeluaranData.length) && (!Array.isArray(d.kasbonData)||!d.kasbonData.length) && (!Array.isArray(d.backupOtomatisData)||!d.backupOtomatisData.length)))saveCloudData().catch(console.warn);redraw()},console.warn);userUnsub=onSnapshot(uref(u.uid),s=>{if(!s.exists()||!currentSessionUser)return;const d=s.data();currentSessionUser.name=d.name||currentSessionUser.name;currentSessionUser.photo=d.photo||currentSessionUser.photo||(()=>{try{return localStorage.getItem(`finance_profile_photo_${phoneOf(currentSessionUser.phone)}`)||"";}catch{return""}})();currentSessionUser.phone=phoneOf(d.phone||currentSessionUser.phone);nativeSet.call(localStorage,"finance_active_session",JSON.stringify(currentSessionUser));document.getElementById("sidebar-user-name")?.replaceChildren(document.createTextNode(currentSessionUser.name));updateUserAvatarUI()});}

// PATCH FOKUS DATA: saat aplikasi kembali aktif, kirim lagi input lokal yang belum terkonfirmasi cloud.
(function(){
  function resyncPendingData(){
    try{
      const phone=phoneOf(currentSessionUser?.phone); if(!phone)return;
      ['history','pengeluaran','kasbon','backup'].forEach(key=>{
        const pending=safe(localStorage.getItem(`finance_pending_${key}_${phone}`),[]);
        if(Array.isArray(pending)&&pending.length)window.__requestDataCloudSync?.();
      });
      if(typeof redraw==='function')redraw();
    }catch(e){}
  }
  window.addEventListener('focus',resyncPendingData);
  window.addEventListener('pageshow',resyncPendingData);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resyncPendingData();});
})();

// LOGIN HANDOFF DARI LANDING PAGE
// Landing Page dan aplikasi memakai origin berbeda, jadi localStorage tidak dapat dibagi.
async function consumeLandingLogin(){
  try{
    await authReadyPromise;
    const hash=window.location.hash||"";
    const m=hash.match(/^#rekapinyu_login=([^&]+)$/);
    if(!m)return false;
    const raw=m[1].replace(/-/g,"+").replace(/_/g,"/");
    const padded=raw+"=".repeat((4-raw.length%4)%4);
    let bin=atob(padded), bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const data=JSON.parse(new TextDecoder().decode(bytes));
    history.replaceState(null,document.title,window.location.pathname+window.location.search);
    if(!data?.phone||!data?.password)throw new Error("Data login dari Landing Page tidak lengkap.");
    const c=await signInWithEmailAndPassword(auth,emailOf(data.phone),data.password);
    let u={uid:c.user.uid,name:c.user.displayName||"",phone:phoneOf(data.phone),email:c.user.email,photo:""};
    try{
      const snap=await getDoc(uref(c.user.uid));
      if(snap.exists())u={...u,...snap.data()};
    }catch(e){console.warn("Rekapinyu handoff: profil Firestore belum dapat dibaca.",e)}
    localSession({...u,uid:c.user.uid,phone:phoneOf(u.phone||data.phone),email:c.user.email});
    window.__rekapinyuLandingHandoffActive=true;
    try{await hydrate(c.user.uid)}catch(e){console.warn("Rekapinyu handoff: data belum dapat dimuat.",e)}
    return true;
  }catch(e){
    console.error("Rekapinyu landing login handoff:",e);
    window.__rekapinyuLandingHandoffActive=false;
    try{history.replaceState(null,document.title,window.location.pathname+window.location.search)}catch{}
    notify("Login Gagal","Sesi dari Landing Page tidak dapat diproses. Silakan login kembali melalui aplikasi.","fa-solid fa-circle-xmark text-rose-600");
    return false;
  }
}

const landingHandoffPromise=consumeLandingLogin();

/* SATU titik penyelesaian auth saat reload.
   Tidak memanggil checkAuth sebelum Firebase menentukan user. */
onAuthStateChanged(auth,async u=>{
  await authReadyPromise;
  await landingHandoffPromise;

  window.RekapinyuFirebase.ready=true;
  window.RekapinyuFirebase.uid=u?.uid||null;

  if(!u){
    if(dataUnsub)dataUnsub();
    if(userUnsub)userUnsub();
    window.__rekapinyuLandingHandoffActive=false;
    window.__rekapinyuAuthBooting=false;
    currentSessionUser=null;
    nativeRemove.call(localStorage,"finance_active_session");
    checkAuth();
    return;
  }

  try{
    await hydrate(u.uid);
    realtime(u);
    window.__rekapinyuLandingHandoffActive=false;
    window.__rekapinyuAuthBooting=false;
    checkAuth();
    redraw();
  }catch(e){
    console.error("Firebase hydrate:",e);
    window.__rekapinyuLandingHandoffActive=false;
    window.__rekapinyuAuthBooting=false;
    checkAuth();
  }
});
