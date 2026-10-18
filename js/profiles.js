/* ===== プロフィール（アカウントの代わり） =====
   この端末のブラウザの中で、名前ごとに「セーブ・自己ベスト・図鑑」を分けて保存する。
   パスワードやサーバーは使わない。別の端末へは「引き継ぎコード」（書き出し／取り込み）で移す。
   ※ ブラウザのデータを消すとプロフィールも消えるので、大事なものは引き継ぎコードで控えておく。 */
const PROFILES_KEY='chiisana-meikyu-profiles-v1';
const LEGACY_KEYS={save:'chiisana-meikyu-dice-save-v4',best:'chiisana-meikyu-dice-best-v1',codex:'chiisana-meikyu-dice-codex-v1'};
const PROFILE_MAX=8,PROFILE_NAME_MAX=12,CODE_PREFIX='MEIKYU1';
let profiles={cur:'',list:[]};          // list: [{id,name,created}]
let SAVE_KEY='',BEST_KEY='',CODEX_KEY='';   // 使用中のプロフィールの保存先（切り替えると変わる）

const profileKey=(kind,id)=>`chiisana-meikyu-${kind}:${id}`;
const lsGet=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(_){return false}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(_){}};
const parseJSON=t=>{try{return t==null?null:JSON.parse(t)}catch(_){return null}};
const escHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- 保存と初期化 ---------- */
function profilesSave(){lsSet(PROFILES_KEY,JSON.stringify(profiles))}
function profilesLoad(){
  const d=parseJSON(lsGet(PROFILES_KEY));
  profiles={cur:'',list:[]};
  if(d&&Array.isArray(d.list)){
    for(const x of d.list){
      if(x&&typeof x.id==='string'&&/^[a-z0-9]{3,32}$/.test(x.id)&&typeof x.name==='string'&&!profiles.list.some(p=>p.id===x.id))
        profiles.list.push({id:x.id,name:profileName(x.name)||'プレイヤー',created:Number(x.created)||0});
    }
    if(typeof d.cur==='string')profiles.cur=d.cur;
  }
}
const profileName=raw=>String(raw||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,PROFILE_NAME_MAX);
function uniqueName(name){let n=name,k=2;while(profiles.list.some(p=>p.name===n)){n=name.slice(0,PROFILE_NAME_MAX-4)+'('+k+')';k++}return n}
function createProfile(name){
  const id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  profiles.list.push({id,name:uniqueName(profileName(name)||'プレイヤー'),created:Date.now()});
  profilesSave();
  return id;
}
function setProfileKeys(){SAVE_KEY=profileKey('save',profiles.cur);BEST_KEY=profileKey('best',profiles.cur);CODEX_KEY=profileKey('codex',profiles.cur)}
function initProfiles(){
  profilesLoad();
  if(!profiles.list.length){
    // 初めて：プロフィール機能の前に遊んでいた分（あれば）を「プレイヤー1」に引き継ぐ
    const id=createProfile('プレイヤー1');
    for(const [kind,legacy] of Object.entries(LEGACY_KEYS)){const v=lsGet(legacy);if(v!==null)lsSet(profileKey(kind,id),v)}
    profiles.cur=id;
  }
  if(!profiles.list.some(p=>p.id===profiles.cur))profiles.cur=profiles.list[0].id;
  profilesSave();setProfileKeys();
}
initProfiles();

const curProfile=()=>profiles.list.find(p=>p.id===profiles.cur);
// 切り替えたあと、ゲーム側に残っている「前のプロフィールの状態」を捨てて読み直す
function reloadRuntimeState(){
  p=null;bestCache=loadBest();
  codex=loadCodex();codexRebuild();
}
function switchProfile(id){
  if(!profiles.list.some(x=>x.id===id))return;
  profiles.cur=id;profilesSave();setProfileKeys();reloadRuntimeState();
}
function deleteProfile(id){
  if(profiles.list.length<=1)return;
  for(const kind of ['save','best','codex'])lsDel(profileKey(kind,id));
  profiles.list=profiles.list.filter(x=>x.id!==id);
  if(profiles.cur===id){profiles.cur=profiles.list[0].id;setProfileKeys();reloadRuntimeState()}
  profilesSave();
}
function profileSummary(id){
  const best=parseJSON(lsGet(profileKey('best',id)));
  const cx=parseJSON(lsGet(profileKey('codex',id)));
  const items=cx&&cx.own&&Array.isArray(cx.own.items)?cx.own.items.filter(k=>ITEM_BY[k]).length:0;
  const sv=parseJSON(lsGet(profileKey('save',id)));
  const hasSave=!!(sv&&sv.v===4&&sv.p&&Number.isFinite(sv.next));
  return `${best&&Number.isFinite(best.floor)&&best.floor?`最高 地下${best.floor}階`:'まだ冒険していない'} ／ 装備 ${items}/${ITEMS.length}${hasSave?` ／ セーブ：地下${Math.max(1,Math.floor(sv.next))+1}階`:''}`;
}

/* ---------- 引き継ぎコード ---------- */
function toB64(str){
  const bytes=new TextEncoder().encode(str);let bin='';
  for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  return btoa(bin);
}
function fromB64(b64){
  const bin=atob(b64);
  return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));
}
function hash32(str){let h=0x811c9dc5;for(const b of new TextEncoder().encode(str)){h^=b;h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
function exportProfile(id){
  const pr=profiles.list.find(x=>x.id===id);
  const json=JSON.stringify({app:'chiisana-meikyu-dice',v:1,name:pr.name,
    save:parseJSON(lsGet(profileKey('save',id))),best:parseJSON(lsGet(profileKey('best',id))),codex:parseJSON(lsGet(profileKey('codex',id)))});
  return `${CODE_PREFIX}.${toB64(json)}.${hash32(json)}`;
}
function cleanCodex(c){
  const out=codexEmpty();
  if(!c||!c.own||!c.seen)return out;
  for(const k of CODEX_KINDS)for(const w of ['own','seen']){
    const a=c[w]&&c[w][k];
    if(Array.isArray(a))out[w][k]=[...new Set(a.filter(x=>typeof x==='string'&&x.length<=64))].slice(0,1000);
  }
  return out;
}
// 取り込むと「新しいプロフィール」ができる（いまのプロフィールは上書きしない）
function importProfile(text){
  const t=String(text||'').replace(/\s+/g,'');
  if(t.length>300000)return {error:'コードが長すぎます。'};
  const m=t.match(new RegExp(`^${CODE_PREFIX}\\.([A-Za-z0-9+/=]+)\\.([0-9a-f]{8})$`));
  if(!m)return {error:`コードの形式が違います。「${CODE_PREFIX}.」で始まるコード全体を貼り付けてください。`};
  let json;try{json=fromB64(m[1])}catch(_){return {error:'コードを読み取れませんでした。'}}
  if(hash32(json)!==m[2])return {error:'コードが途中で切れているか、書き換えられています。'};
  const d=parseJSON(json);
  if(!d||d.app!=='chiisana-meikyu-dice'||d.v!==1)return {error:'このゲームのコードではありません。'};
  if(profiles.list.length>=PROFILE_MAX)return {error:`プロフィールは${PROFILE_MAX}個までです。いらないものを削除してから取り込んでください。`};
  const id=createProfile(profileName(d.name)||'ひきつぎ');
  const sv=d.save,bs=d.best;
  if(sv&&sv.v===4&&sv.p&&typeof sv.p==='object'&&Number.isFinite(sv.next))lsSet(profileKey('save',id),JSON.stringify(sv));
  if(bs&&Number.isFinite(bs.floor)&&Number.isFinite(bs.maxHit))lsSet(profileKey('best',id),JSON.stringify({floor:bs.floor,maxHit:bs.maxHit}));
  lsSet(profileKey('codex',id),JSON.stringify(cleanCodex(d.codex)));
  return {id,name:profiles.list.find(x=>x.id===id).name};
}

/* ---------- 画面 ---------- */
let pfArmed='';   // 削除の確認中のプロフィールID
const pfBtn=(act,label,id,extra='')=>`<button class="sbtn" data-act="${act}"${id?` data-id="${id}"`:''} ${extra}>${label}</button>`;
const pfWide=(act,label,go)=>`<button class="card${go?' go':''}" data-act="${act}"><span class="ct" style="justify-content:center"><b>${label}</b></span></button>`;
function pfLeave(){$('#ovB').onclick=null;pfArmed='';titleScreen()}

function showProfiles(msg){
  const rows=profiles.list.map(x=>{
    const cur=x.id===profiles.cur,armed=pfArmed===x.id;
    return `<div class="card cdx ${cur?'own':''}"><span class="ct"><b>${escHtml(x.name)}</b><em>${cur?'使用中':''}</em></span><span class="cd">${escHtml(profileSummary(x.id))}</span>`+
      `<span class="pfbtns">${cur?'':pfBtn('use','このプロフィールで遊ぶ',x.id)}${pfBtn('rename','名前を変える',x.id)}${pfBtn('export','引き継ぎコード',x.id)}`+
      `${profiles.list.length>1?pfBtn('del',armed?'本当に削除する？':'削除',x.id):''}</span></div>`;
  }).join('');
  showOv('プロフィール',(msg?`<span class="pfmsg">${escHtml(msg)}</span><br>`:'')+'<span class="cdnote">セーブ・自己ベスト・図鑑は、プロフィールごとに別々に保存されます。パスワードはなく、このブラウザの中だけに保存されます。</span>',
    rows+(profiles.list.length<PROFILE_MAX?pfWide('new','＋ 新しいプロフィール'):'')+pfWide('import','引き継ぎコードを取り込む')+pfWide('back','戻る',true));
  $('#ovB').onclick=ev=>{
    const b=ev.target.closest('button[data-act]');if(!b)return;
    const act=b.dataset.act,id=b.dataset.id;
    if(act!=='del')pfArmed='';
    if(act==='back')return pfLeave();
    if(act==='use'){switchProfile(id);return pfLeave()}
    if(act==='new')return showProfileForm('new');
    if(act==='rename')return showProfileForm('rename',id);
    if(act==='export')return showExport(id);
    if(act==='import')return showImport();
    if(act==='del'){
      if(pfArmed!==id){pfArmed=id;return showProfiles()}
      const name=profiles.list.find(x=>x.id===id).name;pfArmed='';deleteProfile(id);return showProfiles(`「${name}」を削除しました。`);
    }
  };
}
function showProfileForm(mode,id){
  const pr=id&&profiles.list.find(x=>x.id===id);
  showOv(mode==='new'?'新しいプロフィール':'名前を変える',`<span class="cdnote">名前は${PROFILE_NAME_MAX}文字までです。</span>`,
    `<input class="pfin" id="pfName" maxlength="${PROFILE_NAME_MAX}" placeholder="名前" value="${pr?escHtml(pr.name):''}" autocomplete="off"><span class="pfmsg" id="pfErr"></span>`+
    pfWide('ok',mode==='new'?'作る':'変更する',true)+pfWide('cancel','やめる'));
  const input=$('#pfName');input.focus();input.select();
  const submit=()=>{
    const name=profileName(input.value);
    if(!name){$('#pfErr').textContent='名前を入力してください。';return}
    if(profiles.list.some(x=>x.name===name&&x.id!==id)){$('#pfErr').textContent='同じ名前のプロフィールがあります。';return}
    if(mode==='new'){
      if(profiles.list.length>=PROFILE_MAX)return showProfiles(`プロフィールは${PROFILE_MAX}個までです。`);
      const nid=createProfile(name);switchProfile(nid);return pfLeave();   // 作ったらそのまま使う
    }
    pr.name=name;profilesSave();showProfiles('名前を変更しました。');
  };
  input.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();submit()}};
  $('#ovB').onclick=ev=>{
    const b=ev.target.closest('button[data-act]');if(!b)return;
    if(b.dataset.act==='ok')submit();else showProfiles();
  };
}
function showExport(id){
  const pr=profiles.list.find(x=>x.id===id),code=exportProfile(id);
  showOv('引き継ぎコード',`<span class="cdnote">「${escHtml(pr.name)}」のセーブ・自己ベスト・図鑑が入っています。別の端末の「引き継ぎコードを取り込む」に貼り付けると、新しいプロフィールとして復元されます。パスワードはないので、コードは人に見せないでください。</span>`,
    `<textarea class="pfin" id="pfCode" rows="6" readonly>${code}</textarea><span class="pfmsg" id="pfErr"></span>`+
    pfWide('copy','コピーする')+pfWide('file','ファイルに保存する')+pfWide('cancel','戻る',true));
  const area=$('#pfCode');area.onclick=()=>area.select();
  $('#ovB').onclick=async ev=>{
    const b=ev.target.closest('button[data-act]');if(!b)return;
    const act=b.dataset.act;
    if(act==='cancel')return showProfiles();
    if(act==='copy'){
      try{await navigator.clipboard.writeText(code);$('#pfErr').textContent='コピーしました。'}
      catch(_){area.select();$('#pfErr').textContent='自動でコピーできませんでした。選択されたコードを、手動でコピーしてください。'}
    }
    if(act==='file'){
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([code],{type:'text/plain'}));a.download='chiisana-meikyu-save.txt';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      $('#pfErr').textContent='保存しました（ダウンロードフォルダを確認してください）。';
    }
  };
}
function showImport(){
  showOv('引き継ぎコードを取り込む','<span class="cdnote">書き出したコードを貼り付けるか、保存したファイルを選んでください。新しいプロフィールとして取り込まれ、いまのプロフィールは変わりません。</span>',
    `<textarea class="pfin" id="pfCode" rows="6" placeholder="${CODE_PREFIX}.…"></textarea><input type="file" id="pfFile" accept=".txt,text/plain" class="pfin"><span class="pfmsg" id="pfErr"></span>`+
    pfWide('ok','取り込む',true)+pfWide('cancel','やめる'));
  const area=$('#pfCode');
  $('#pfFile').onchange=async ev=>{const f=ev.target.files[0];if(f)area.value=(await f.text()).slice(0,300000)};
  $('#ovB').onclick=ev=>{
    const b=ev.target.closest('button[data-act]');if(!b)return;
    if(b.dataset.act==='cancel')return showProfiles();
    if(b.dataset.act==='ok'){
      const r=importProfile(area.value);
      if(r.error){$('#pfErr').textContent=r.error;return}
      showProfiles(`「${r.name}」を取り込みました。使うには「このプロフィールで遊ぶ」を押してください。`);
    }
  };
}
