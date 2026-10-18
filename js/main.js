/* ===== ちいさな迷宮 ダイス版：メイン =====
   ゲームの進行（戦闘・お店・イベント・報酬・セーブ・表示）。
   ほかのファイル：enemies.js（敵） / dice.js（ダイス） / equipment.js・equipment_fx.js（装備） /
   skills.js・skills_fx.js（スキル） / codex.js（図鑑） / data.js・xlsx-reader.js（Excelデータの読み込み） */
const $=s=>document.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=n=>Math.floor(Math.random()*n);
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};

/* ===== 調整用の数値 ===== */
const CFG={hp:80,mp:10,floorHp:6,floorMp:1,winHeal:0.2,winMp:4,dice:4,actions:3,rerolls:3,hp0:55,hpGrow:1.24,atk0:7,atkGrow:1.21,hpGrow2:1.16,atkGrow2:1.12,hpJump:1.35,atkJump:1.18};

/* ===== 状態 ===== */
let p,e,stage,busy,logLines=[],curShop=null,fullLog=[],turnNo=0;
const rec=(t,k)=>{fullLog.push({t,k:k||'s'});if(fullLog.length>700)fullLog.splice(0,fullLog.length-700)};
const has=id=>p.passives.includes(id);
const pm=()=>has('power')?1.2:1;
const R=x=>Math.round(x);
const UNITS=[[1e12,'兆'],[1e8,'億'],[1e4,'万']];
const BIG=1e300;                                   // 数値が無限大にならないための技術的な上限（ゲームの上限ではない）
const cl=x=>Number.isFinite(x)?Math.min(x,BIG):BIG;
function fmt(n){
  if(!Number.isFinite(n))return n>0?'∞':String(n);
  n=Math.round(n);const a=Math.abs(n);
  if(a<10000)return String(n);
  if(a>=1e16){const [m,x]=n.toExponential(2).split('e');return m.replace(/\.?0+$/,'')+'e'+x.replace('+','')}
  for(const [u,sx] of UNITS){if(a>=u){const v=n/u;return (v>=100?String(Math.round(v)):v.toFixed(1).replace(/\.0$/,''))+sx}}
  return String(n);
}
const fmtM=x=>x>=10000?fmt(x):String(+(+x).toFixed(2));
let bestCache={floor:0,maxHit:0};
function loadBest(){try{const d=JSON.parse(localStorage.getItem(BEST_KEY)||'null');if(d&&Number.isFinite(d.floor)&&Number.isFinite(d.maxHit))return d}catch(_){}return {floor:0,maxHit:0}}
function saveBest(){
  if(!p)return bestCache;
  const b=loadBest();let ch=false;
  if(stage+1>b.floor){b.floor=stage+1;ch=true}
  if((p.maxHit||0)>b.maxHit){b.maxHit=p.maxHit;ch=true}
  bestCache=b;
  if(ch){try{localStorage.setItem(BEST_KEY,JSON.stringify(b))}catch(_){}}
  return b;
}
const dmgOf=x=>Math.max(1,R(x));
const layerOf=i=>LAYERS[Math.floor((i%FLOORS)/5)];
const pr=x=>Math.round(x*(1+0.6*tierOf(stage)));   // インフレで値段も上がる

/* ===== セーブ（この端末のブラウザに、プロフィールごとに保存。保存先のキーは profiles.js） ===== */
let canSave=true;
try{localStorage.setItem(SAVE_KEY+'-t','1');localStorage.removeItem(SAVE_KEY+'-t')}catch(_){canSave=false}
function loadSave(){
  try{
    const t=localStorage.getItem(SAVE_KEY);if(!t)return null;
    const d=JSON.parse(t);
    if(!d||d.v!==4||!d.p||!Number.isFinite(d.next))return null;
    return d;
  }catch(_){return null}
}
function clearSave(){try{localStorage.removeItem(SAVE_KEY)}catch(_){}}
function persist(next,shopPending,quiet){
  if(next>=FLOORS&&!p.endless)return;
  const q=p;
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify({v:4,next,shopPending:!!shopPending,
      p:{hp:q.hp,maxHp:q.maxHp,mp:q.mp,maxMp:q.maxMp,gold:q.gold,skills:q.skills,passives:q.passives,slots:q.slots,equip:q.equip,endless:!!q.endless,maxHit:q.maxHit||0,cds:q.cds||{}}}));
    if(!quiet)log('自動セーブしました。');
  }catch(_){canSave=false}
}
function restoreP(d){
  const n=(x,def)=>Number.isFinite(x)?x:def;
  const sk=(d.skills||[]).filter(id=>SKILL_BY[id]);
  const sl=(d.slots||[]).filter(t=>DICE_T[t]);
  return {hp:n(d.hp,CFG.hp),maxHp:n(d.maxHp,CFG.hp),mp:n(d.mp,CFG.mp),maxMp:n(d.maxMp,CFG.mp),gold:n(d.gold,0),
    skills:sk.length?sk:['smash','fire'],passives:(d.passives||[]).filter(id=>PASSIVE_BY[id]),
    slots:sl.length?sl:Array(CFG.dice).fill('normal'),
    equip:restoreEquip(d.equip),endless:!!d.endless,maxHit:n(d.maxHit,0),cds:restoreCds(d.cds),cdFresh:{},chain:0,revived:false,hot:null,rerollsUsed:0,bank:0,
    shield:0,barrier:0,used:{},dice:[],locked:new Set(),rerolls:0,actions:CFG.actions,actionsLeft:0,dbl:false,berserk:0,wrath:0,starPower:0,undyingCharges:0,currentSkill:null};
}
function restoreCds(q){
  const o={};
  if(q&&typeof q==='object')for(const k of Object.keys(q)){if(SKILL_BY[k]&&Number.isFinite(q[k])&&q[k]>0)o[k]=Math.min(9,Math.floor(q[k]))}
  return o;
}
function restoreEquip(q){
  if(!Array.isArray(q)||!q.length)return baseSlots();
  const out=[];
  for(const x of q){
    if(!x||!SLOT_ORDER.includes(x.t))continue;
    const it=x.id&&ITEM_BY[x.id];
    out.push({t:x.t,id:(it&&it.slot===x.t)?x.id:null});
  }
  return out.length?out:baseSlots();
}

/* ===== 表示まわり ===== */
function log(t,noRec){
  if(!noRec)rec(t,'s');
  logLines.push(t);if(logLines.length>40)logLines.shift();
  $('#log').innerHTML=logLines.slice(-4).map((l,i,a)=>`<div class="${i===a.length-1?'new':''}">${l}</div>`).join('');
}
function popup(where,text,cls){
  const host=where==='pl'?$('#pl'):$('#scene');
  const s=document.createElement('span');s.className='pop '+cls;s.textContent=text;
  host.appendChild(s);setTimeout(()=>s.remove(),900);
}
function retrigger(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
const shake=big=>{const a=$('#eart');a.classList.remove('shake','shakebig');void a.offsetWidth;a.classList.add(big?'shakebig':'shake')};
const flash=()=>retrigger($('#pl'),'flash');

function enemyNextDmg(){
  const a=e.pat[e.idx%e.pat.length];
  let d=Math.round(e.atk*a.m);
  if(d>0&&has('armor'))d=Math.max(1,R(d*.85));
  if(d>0)d=Math.max(1,R(d*takeMul()));
  if(d>0&&e.weak)d=Math.ceil(d/2);
  return d;
}
function intentText(){
  if(e.hp<=0)return '';
  if(e.frozen)return '凍りついて動けない…';
  if(e.stun>0)return 'スタンして動けない…';
  const a=e.pat[e.idx%e.pat.length];
  return a.m===0?`次の行動：<b>${a.n}</b>（攻撃してこない）`:`次の行動：<b>${a.n}</b>（約${fmt(enemyNextDmg())}ダメージ）`;
}
function face(v){
  const on={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[v];
  if(!on)return `<span class="big">${v}</span>`;
  return `<span class="face">${Array.from({length:9},(_,i)=>`<i class="${on.includes(i)?'on':''}"></i>`).join('')}</span>`;
}
function diceHTML(){
  const P=pool(),maxF=Math.max(6,...p.slots.map(t=>Math.max(...DICE_T[t].faces))),colN=maxF>8?Math.ceil(maxF/2):maxF;   // 出る目の最大値ぶん集計欄を作る（9以上は2段に折り返す）
  const cols=[];
  for(let f=1;f<=maxF;f++){
    const c=P.cnt[f]||0,lock=p.locked.has(f),top=P.M>=2&&c===P.M;
    cols.push(`<button class="tcol ${c?'':'zero'} ${lock?'lock':''} ${top?'top':''} ${p.rolling?'roll':''}" data-f="${f}" aria-label="${f}の目 ${c}個${lock?' キープ中':''}"><span class="mini">${face(f)}</span><span class="cnt">×${c}</span><span class="keep">${lock?'キープ':top?'最多':'　'}</span></button>`);
  }
  const sp={};p.slots.forEach(t=>{if(t!=='normal')sp[t]=(sp[t]||0)+1});
  const chips=Object.keys(sp).map(t=>`<span class="chip">${DICE_T[t].name}×${sp[t]}</span>`).join('');
  const un=p.rerolls>0&&p.dice.some(d=>!p.locked.has(d.v));
  const dbl=p.dbl?'<span class="chip">ダブルアップ待機</span>':'';
  return `<div class="dhead"><span>ダイス ${p.dice.length||p.slots.length}個 ／ 行動 <b>${p.actionsLeft}</b>/${p.actions}</span><span class="dbtns"><button class="sbtn" data-x="reroll" ${un?'':'disabled'}>振り直し ${p.rerolls}</button><button class="sbtn" data-x="end">ターン終了</button><button class="sbtn" data-x="log">ログ</button><button class="sbtn" data-x="home">ホーム</button></span></div>
  <div class="tally" style="--cols:${colN}">${cols.join('')}</div>
  <div class="score"><span>合計 <b>${fmt(P.S)}</b></span><span>×</span><span>揃い <b>${fmtM(P.mult)}</b>${P.jack?' <i class="jp">JACKPOT!</i>':''}</span><span>＝</span><b class="tot">${fmt(R(P.S*P.mult))}</b></div>
  <div class="sub" style="text-align:center">装備込みで、こうげきは約<b style="font-weight:normal;color:var(--exp)">${fmt(previewFinal(P.S*P.mult,P))}</b>ダメージ</div>
  <div class="hint">${chips||''}${dbl}${chips||dbl?'<br>':''}キープできる目は1種類だけ。タップでキープ → 振り直しで残りを振る。</div>`;
}
function actBtn(a){
  const P=pool(),r=a.calc(P);
  const usedA=!!p.used[a.id],cost=Math.max(0,(a.mp||0)-equipped().reduce((n,it)=>n+(it.mpDiscount||0),0)),okM=!cost||p.mp>=cost,noAct=p.actionsLeft<=0;
  const cdn=(p.cds&&p.cds[a.id])||0;
  const dis=noAct||usedA||cdn>0||!r.ok||!okM;
  const top=[a.mp?`MP${Math.max(0,a.mp-equipped().reduce((n,it)=>n+(it.mpDiscount||0),0))}`:'',a.cd?`待機${a.cd}`:''].filter(Boolean).join(' ／ ');
  const res=usedA?'使用済み':cdn>0?`あと${cdn}ターン使えない`:!r.ok?(a.need||'使えない'):!okM?'MPが足りない':labelOf(r,P);
  return `<button class="cb" data-a="${a.id}" ${dis?'disabled':''}><span class="nm">${a.name}</span>${top?`<span class="in">${top}</span>`:''}<span class="in res">${res}</span></button>`;
}
function cmdHTML(){
  const atk=p.skills.map(id=>SKILL_BY[id]).filter(s=>s.type==='atk');
  const mag=p.skills.map(id=>SKILL_BY[id]).filter(s=>s.type==='mag');
  let h=`<div class="grp">たたかう（各行動は1ターンに1回）</div><div class="grid">${BASE.map(actBtn).join('')}</div>`;
  if(atk.length)h+=`<div class="grp">スキル</div><div class="grid">${atk.map(actBtn).join('')}</div>`;
  if(mag.length)h+=`<div class="grp">まほう（MPを使う）</div><div class="grid">${mag.map(actBtn).join('')}</div>`;
  return h;
}
function render(){
  codexSync();
  const L=layerOf(stage);
  $('#depth').textContent=`地下${stage+1}階`;
  $('#layer').textContent=L.name+(tierOf(stage)?`・インフレ${tierOf(stage)}`:'');
  $('#stg').className='stage '+L.cls;
  $('#pips').innerHTML=ENEMIES.map((x,i)=>`<i class="pip ${x.boss?'boss':''} ${i<stage%FLOORS?'done':i===stage%FLOORS?'now':''}"></i>`).join('');
  $('#ename').textContent=(e.boss?'【ボス】':'')+e.name;
  const eh=Math.max(0,e.hp);
  $('#ehp').style.width=(eh/e.maxHp*100)+'%';
  $('#ebar').classList.toggle('low',eh/e.maxHp<=.3);
  $('#ehpTxt').textContent=`HP ${fmt(eh)}/${fmt(e.maxHp)}`;
  $('#estatus').innerHTML=(e.poison?`<span class="chip">毒 ${e.poison.d}×${e.poison.t}</span>`:'')+(e.burn?`<span class="chip">🔥火傷 ${e.burn.d}×${e.burn.t}</span>`:'')+(e.bleed?`<span class="chip">🩸出血 ${e.bleed.d}×${e.bleed.t}</span>`:'')+(e.frozen?`<span class="chip">凍結</span>`:'')+(e.stun?`<span class="chip">スタン</span>`:'')+(e.weak?`<span class="chip">弱体</span>`:'')+(e.vulnerable?`<span class="chip">被ダメ増加</span>`:'');
  $('#intent').innerHTML=intentText();

  $('#lv').textContent=`ダイス${p.slots.length}個`;
  $('#gold').textContent=`${fmt(p.gold)}G`;
  $('#rec').textContent=`最大ダメージ ${fmt(p.maxHit||0)}（自己ベスト ${fmt(Math.max(bestCache.maxHit,p.maxHit||0))}）`;
  $('#hp').style.width=(p.hp/p.maxHp*100)+'%';
  $('#hpbar').classList.toggle('low',p.hp/p.maxHp<=.3);
  $('#hpTxt').textContent=`${fmt(p.hp)}/${fmt(p.maxHp)}`;
  $('#mp').style.width=(p.mp/p.maxMp*100)+'%';
  $('#mpTxt').textContent=`${p.mp}/${p.maxMp}`;
  $('#chips').innerHTML=p.passives.map(id=>`<span class="chip" title="${PASSIVE_BY[id].desc}">${PASSIVE_BY[id].name}</span>`).join('')
    +(p.shield>0?`<span class="chip">シールド ${p.shield}</span>`:'')+(p.barrier>0?`<span class="chip">バリア ${p.barrier}</span>`:'');
  $('#equip').innerHTML=equipHTML();
  $('#dice').innerHTML=diceHTML();
  $('#cmd').innerHTML=cmdHTML();
}

/* ===== オーバーレイ ===== */
function showOv(title,sub,body){
  $('#ovT').textContent=title;$('#ovS').innerHTML=sub;$('#ovB').innerHTML=body;
  $('#ov').hidden=false;const b=$('#ovB button:not([disabled])');if(b)b.focus();
}
const hideOv=()=>{$('#ov').hidden=true};
function pickRaw(title,sub,html){
  return new Promise(res=>{
    showOv(title,sub,html);
    $('#ovB').onclick=ev=>{
      const b=ev.target.closest('button[data-i]');if(!b||b.disabled)return;
      $('#ovB').onclick=null;hideOv();res(b.dataset.i);
    };
  });
}
async function pick(title,sub,opts){
  codexSee(opts);
  const i=await pickRaw(title,sub,opts.map((o,i)=>`<button class="card ${o.cls||''}" data-i="${i}"><span class="ct"><b>${o.name}${markHTML(o)}</b><em>${o.tag}</em></span><span class="cd">${o.desc}</span></button>`).join(''));
  return opts[+i];
}
function screen(title,sub,extra,btn,fn){
  showOv(title,sub,`${extra}<button class="card go" id="go"><span class="ct" style="justify-content:center"><b>${btn}</b></span></button>`);
  $('#go').onclick=()=>{hideOv();fn()};
}

/* ===== ダイスを振る ===== */
const rollFace=t=>{const f=DICE_T[t].faces;return f[rnd(f.length)]};
async function rollAnim(idx){
  p.rolling=true;
  for(let f=0;f<6;f++){idx.forEach(i=>{p.dice[i].v=rollFace(p.dice[i].t)});render();await sleep(80)}
  p.rolling=false;
}
async function startTurn(){
  p.used={};p.actions=CFG.actions+(has('actions')?1:0)+equipped().reduce((a,it)=>a+(it.actions||0),0);p.actionsLeft=p.actions;
  p.rerolls=CFG.rerolls+(has('reroll')?1:0);p.locked=new Set();p.rerollsUsed=0;
  p.dice=[...p.slots,...Array(p.battleDiceBonus||0).fill('normal')].map(t=>({t,v:1}));
  await rollAnim(p.dice.map((_,i)=>i));
  const g=p.dice.filter(d=>d.t==='gold').reduce((a,d)=>a+d.v,0);
  if(g){p.gold+=g;log(`金のダイスが${g}Gを生んだ！`);popup('pl','+'+g+'G','gold')}
  const lucky=p.dice.filter(d=>d.t==='lucky').reduce((a,d)=>a+(d.v===8?2:0),0);
  if(lucky){p.gold+=lucky;log(`幸運ダイスの8がボーナス${lucky}Gを生んだ！`)}
  turnNo++;rec(`── ターン${turnNo} ──`,'turn');
  rec(`【ダイス】${p.slots.length}個を振った → ${tallyText()}`,'roll');
  const spc={};p.slots.forEach(t=>{if(t!=='normal')spc[t]=(spc[t]||0)+1});
  if(Object.keys(spc).length)rec(`　特殊ダイス：${Object.keys(spc).map(t=>DICE_T[t].name+'×'+spc[t]).join('、')}`,'roll');
  const P0=pool();rec(`　合計${P0.S}／最多${P0.M}個／揃い×${P0.mult}${P0.jack?'（ジャックポット）':''}／ペア${P0.pairs}組／最長連続${P0.run}`,'roll');
  log(`出目：${tallyText()}`,true);
  render();
  await turnStartItems();
}
async function reroll(){
  const idx=p.dice.map((d,i)=>p.locked.has(d.v)?-1:i).filter(i=>i>=0);
  if(p.rerolls<=0||!idx.length)return;
  busy=true;p.rerolls--;p.rerollsUsed++;
  const before=tallyText(),lf=[...p.locked][0];
  await rollAnim(idx);
  rec(`【振り直し】${lf?lf+'の目をキープして、':'キープなしで、'}${idx.length}個を振り直した（残り${p.rerolls}回）`,'roll');
  rec(`　前：${before}`,'roll');rec(`　後：${tallyText()}`,'roll');
  log(`振り直し：${tallyText()}`,true);
  busy=false;render();
}

/* ===== 戦闘 ===== */
async function hit(amount){
  let d=Math.max(1,R(cl(amount)));
  if(e.vulnerable){d=R(d*1.5);e.vulnerable=false;log(`${e.name}の隙を突いた！ダメージ1.5倍！`)}
  const big=d>=e.maxHp*.25;
  e.hp=Math.max(0,e.hp-d);
  if(d>(p.maxHit||0)){p.maxHit=d}
  log(`${e.name}に${fmt(d)}のダメージ！`);popup('scene',fmt(d),big?'dmg big':'dmg');shake(big);render();
  await sleep(big?520:380);
  return d;
}
function healP(n){
  const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+n);
  const g=p.hp-before;log(`HPが${g}回復した。`);popup('pl','+'+g,'heal');render();
}
// 敵に状態異常を付ける（スキルの結果 r と、装備の「攻撃時の状態異常」の両方から使う）。keep=true なら、すでにある毒・火傷・出血より弱くならない
function applyStatuses(r,keep){
  const dot=(key,d)=>{const cur=e[key];e[key]={t:3,d:keep&&cur?Math.max(cur.d,d):d}};
  if(r.poison){const pmul=equipped().reduce((m,it)=>m*(it.poisonMul||1),1);dot('poison',R(r.poison*pmul));log(`${e.name}は毒に侵された！`);codexStatus('poison');render()}
  if(r.burn){dot('burn',Math.max(1,R(r.burn)));log(`${e.name}は火傷した！`);codexStatus('burn');render()}
  if(r.bleed){dot('bleed',Math.max(1,R(r.bleed)));log(`${e.name}は出血した！`);codexStatus('bleed');render()}
  if(r.stun){if(e.boss){e.weak=true;codexStatus('weak');log('ボスにはスタンが効かない！次の攻撃を弱体化！')}else{e.stun=1;codexStatus('stun');log(`${e.name}はスタンした！`)}render()}
  if(r.vulnerable){e.vulnerable=true;log(`${e.name}の防御の隙を作った！次の攻撃の被ダメージ1.5倍！`);codexStatus('vulnerable');render()}
  if(r.weaken){e.weak=true;log(`${e.name}の次の攻撃が弱まった！`);codexStatus('weak');render()}
  if(r.freeze){
    if(e.boss){e.weak=true;codexStatus('weak');log(`${e.name}の次の攻撃が弱まった！`)}
    else if(!e.frozenUsed){e.frozen=true;e.frozenUsed=true;codexStatus('freeze');log(`${e.name}は凍りついた！`)}
    else log(`${e.name}はもう凍らない！`);
    render();
  }
}
async function apply(r,P){
  if(r.gold){p.gold+=r.gold;log(`ゴールドレイン：${fmt(r.gold)}Gを得た！`);popup('pl','+'+fmt(r.gold)+'G','gold');render();}
  if(r.hpCost){p.hp=Math.max(1,p.hp-r.hpCost);log(`HPを${r.hpCost}支払った。`);popup('pl','-'+r.hpCost,'hurt');render();await sleep(250)}
  if(r.dbl){p.dbl=true;log('次のダメージが2倍になる！');render();await sleep(300)}
  let dealt=0;
  if(r.dmg){const res=runPipeline(r.dmg,P,false);await cascade(res,r.note);const d=await hit(res.final);dealt=d;p.dbl=false;p.bank=0;if(equipped().some(it=>it.id==='chainorb'))p.chain=(p.chain||0)+1;if(r.drain&&d>0)healP(d);for(const it of equipped()){if(it.hit){const h=it.hit(d);if(h&&h.heal){p.hot=it.id;healP(h.heal)}}}p.hot=null}
  if(e.hp<=0)return;
  applyStatuses(r);
  if(dealt>0)itemStatusOnHit(dealt);
  if(r.heal){healP(r.heal);await sleep(300)}
  if(r.shield){
    let sh=r.shield;
    if(r.isGuard){const g=guardFinal(r.shield,P);if(g.steps.length)await cascade(g,r.note);sh=g.final}
    p.shield+=sh;log(`シールドを${sh}張った。`);render();await sleep(300);
  }
  if(r.barrier){p.barrier+=r.barrier;log(`バリアを${r.barrier}張った。`);render();await sleep(300)}
}
async function startBattle(){
  const t=tpl(stage),f=stage+1,tier=tierOf(stage);
  e={...t,name:tierPrefix(stage)+t.name,hp:enemyHp(stage,t),atk:enemyAtk(stage,t),idx:0,frozen:false,frozenUsed:false,weak:false,poison:null,burn:null,bleed:null,stun:0,vulnerable:false};
  e.maxHp=e.hp;
  e.gold=Math.round((8+f*2)*(t.boss?3:1)*(t.goldx||1)*(1+0.6*tier)*(0.85+Math.random()*0.3));
  p.cdFresh={};p.shield=0;p.barrier=0;p.bank=0;p.chain=0;p.revived=false;p.used={};p.dice=[];p.locked=new Set();p.dbl=false;p.actionsLeft=0;
  turnNo=0;rec(`━━ 地下${stage+1}階：${e.name}（HP${fmt(e.hp)} 攻撃力${fmt(e.atk)}）━━`,'battle');
  saveBest();
  if(stage>0&&stage%5===0)log(`${layerOf(stage).name}${tier?'（インフレ'+tier+'）':''}に足を踏み入れた…`);
  if(t.boss){p.hp=p.maxHp;p.mp=p.maxMp;log('ボスの部屋の前で休息した。HPとMPが全回復！')}
  log(`${t.boss?'ボス ':''}${e.name}が現れた！`);
  if(has('mpstart'))p.mp=Math.min(p.maxMp,p.mp+4);
  p.berserk=0;p.wrath=0;p.starPower=0;p.battleDiceBonus=equipped().reduce((n,it)=>n+(it.battleDice||0),0);p.undyingCharges=equipped().reduce((n,it)=>n+(it.undying===true?1:(Number(it.undying)||0)),0);
  for(const it of equipped()){if(it.battleStart){const z=it.battleStart();if(z.shield)p.shield+=z.shield;if(z.barrier)p.barrier+=z.barrier;}}
  $('#eart').innerHTML=e.art();retrigger($('#eart'),'enter');
  render();
  await startTurn();
}
function endTurnCd(){
  // そのターンに使ったスキルは数えない。使っていないスキルは、このターンを1ターンぶん進める。
  for(const k of Object.keys(p.cds)){
    if(!p.cdFresh[k]&&p.cds[k]>0)p.cds[k]--;
    if(p.cds[k]<=0)delete p.cds[k];
  }
  p.cdFresh={};
}
async function playerAct(a){
  const P=pool(),r=a.calc(P);
  busy=true;
  p.actionsLeft--;p.used[a.id]=true;if(a.mp)p.mp-=Math.max(0,a.mp-equipped().reduce((n,it)=>n+(it.mpDiscount||0),0));
  if(a.cd){const w=Math.max(0,a.cd-(has('haste')?1:0)-equipped().reduce((n,it)=>n+(it.cooldownReduce||0),0));if(w>0){p.cds[a.id]=w;p.cdFresh[a.id]=true;rec(`　${a.name}は${w}ターン使えなくなる`,'act')}}
  p.currentSkill=a.id;
  rec(`【行動${p.actions-p.actionsLeft}/${p.actions}】${a.name}${a.mp?`（MP${a.mp}消費）`:''}`,'act');
  rec(`　出目の状況：合計${fmt(P.S)}／最多${P.M}個／揃い×${fmtM(P.mult)}／ペア${P.pairs}組`,'act');
  log(`${a.name}！`,true);render();await sleep(220);
  await apply(r,P);
  if(e.hp<=0){endTurnCd();await win();return}
  p.currentSkill=null;
  if(p.actionsLeft<=0){await enemyPhase();return}
  busy=false;render();
}
async function enemyPhase(){
  busy=true;p.actionsLeft=0;render();await sleep(300);
  for(const [key,label] of [['poison','毒'],['burn','火傷'],['bleed','出血']]){
    const st=e[key];if(!st)continue;const d=st.d;e.hp=Math.max(0,e.hp-d);st.t--;if(st.t<=0)e[key]=null;
    rec(`【${label}】${e.name}に${label}ダメージ${d}`,'take');log(`${label}で${e.name}に${d}のダメージ！`,true);popup('scene',d,'dmg');render();await sleep(350);
    if(e.hp<=0){endTurnCd();await win();return}
  }
  await enemyAct();
  if(p.hp<=0){await lose();return}
  if(e.hp<=0){endTurnCd();await win();return}
  if(has('regen')&&p.hp<p.maxHp){const h=Math.max(1,R(p.maxHp*.03));p.hp=Math.min(p.maxHp,p.hp+h);popup('pl','+'+h,'heal')}
  p.shield=0;
  endTurnCd();
  await startTurn();
  busy=false;render();
}
async function enemyAct(){
  if(e.stun>0){e.stun--;log(`${e.name}はスタンして動けない！`);render();await sleep(500);return}
  if(e.frozen){e.frozen=false;log(`${e.name}は凍りついて動けない！`);render();await sleep(500);return}
  const a=e.pat[e.idx%e.pat.length];e.idx++;
  if(a.m===0){log(`${e.name}は${a.n}。`);render();await sleep(500);return}
  log(`${e.name}の${a.n}！`,true);await sleep(320);
  let d=Math.round(e.atk*a.m);
  const dodger=equipped().find(it=>it.dodge&&Math.random()<it.dodge);if(dodger){log(`${dodger.name}で攻撃を回避した！`);render();await sleep(350);return}
  rec(`【${e.name}の攻撃】${a.n}：攻撃力${fmt(e.atk)}×${a.m}＝${fmt(d)}`,'take');
  if(has('armor')){d=Math.max(1,R(d*.85));rec(`　鉄の覚悟 ×0.85 → ${d}`,'take')}
  for(const it of equipped()){if(it.take){const f=it.take();if(f!==1){d=Math.max(1,R(d*f));rec(`　${it.name} ×${f} → ${d}`,'take')}}}
  if(e.weak){d=Math.ceil(d/2);e.weak=false;rec(`　弱体化で半減 → ${d}`,'take')}
  let blocked=0;
  if(p.shield>0){const x=Math.min(p.shield,d);p.shield-=x;d-=x;blocked+=x;rec(`　シールドが${x}防いだ → 残り${d}`,'take');log(`シールドが${x}防いだ！`,true)}
  if(d>0&&p.barrier>0){const x=Math.min(p.barrier,d);p.barrier-=x;d-=x;blocked+=x;rec(`　バリアが${x}防いだ → 残り${d}`,'take');log(`バリアが${x}防いだ！`,true)}
  if(blocked>0&&equipped().some(it=>it.id==='bulwark')){p.bank+=blocked*0.3;log(`要塞の鎧：防いだ分を力に変えた。`)}
  if(d>0){
    p.hp=Math.max(0,p.hp-d);
    if(p.hp<=0&&(p.undyingCharges||0)>0){p.undyingCharges--;p.hp=1;log('不死の加護でHP1で踏みとどまった！');popup('pl','耐えた','heal')}
    for(const it of equipped()){if(it.onTaken){const h=it.onTaken(d);if(h>0&&p.hp>0){p.hp=Math.min(p.maxHp,p.hp+h);log(`${it.name}：HPが${h}回復！`)}}}
    rec(`　▶ 勇者は${fmt(d)}のダメージ（HP ${fmt(p.hp)}/${fmt(p.maxHp)}）`,'take');
    log(`勇者は${fmt(d)}のダメージを受けた！`,true);popup('pl','-'+fmt(d),'hurt');flash();
    if(p.hp<=0&&!p.revived&&equipped().some(it=>it.id==='phoenix')){
      p.revived=true;p.hp=Math.max(1,R(p.maxHp*.6));
      rec(`　不死鳥の羽が輝いた！ HP ${fmt(p.hp)}で復活`,'take');log('不死鳥の羽が輝き、勇者は蘇った！');popup('pl','復活','heal');
    }
    if(p.hp>0){
      for(const it of equipped()){
        if(!it.reflect)continue;
        const rf=R(it.reflect(d)*equipped().reduce((m,x)=>m*(x.refMul||1),1));
        if(rf>0&&e.hp>0){e.hp=Math.max(0,e.hp-rf);p.hot=it.id;log(`${it.name}：${e.name}に${fmt(rf)}の反射ダメージ！`);popup('scene',fmt(rf),'dmg');render();await sleep(300);p.hot=null}
      }
    }
  }else{rec('　▶ ダメージなし','take');popup('pl','0','miss')}
  render();await sleep(450);
}

/* ===== お店 ===== */
function makeStock(){
  const items=[];
  const add=o=>items.push({sold:false,...o});
  add({id:'potion',name:'回復薬',price:pr(25),desc:'HPを最大HPの40%回復する。',ok:()=>p.hp<p.maxHp,buy:async()=>{healP(Math.round(p.maxHp*.4))}});
  const extra=[
   {id:'mpot',name:'魔力の薬',price:pr(25),desc:'MPを12回復する。',ok:()=>p.mp<p.maxMp,buy:async()=>{p.mp=Math.min(p.maxMp,p.mp+12)}},
   {id:'hpup',name:'命の実',price:pr(60),desc:'最大HPが20増え、20回復する。',ok:()=>true,buy:async()=>{p.maxHp+=20;p.hp+=20}},
   {id:'mpup',name:'魔力の実',price:pr(55),desc:'最大MPが5増え、5回復する。',ok:()=>true,buy:async()=>{p.maxMp+=5;p.mp+=5}},
  ];
  add(shuffle(extra)[0]);
  add({id:'dice',name:'ダイス追加',price:pr(16+2*p.slots.length),desc:'ふつうのダイスを1個増やす。',ok:()=>true,buy:async()=>{p.slots.push('normal');log('ダイスが1個増えた！')}});
  shuffle(Object.keys(DICE_T).filter(k=>k!=='normal'&&p.slots.length<18)).slice(0,2).forEach(k=>{
    const t=DICE_T[k];
    add({id:'d_'+k,name:t.name,price:pr(t.price),tag:'ダイス',desc:`${t.desc}ダイスが1個増える。`,ok:()=>true,buy:async()=>{p.slots.push(k);log(`${t.name}を手に入れた！`)}});
  });
  const eqs=shuffle(ITEMS.filter(it=>!it.leg&&!ownedItem(it.id)));
  const rare=eqs.find(it=>it.rare),com=eqs.filter(it=>!it.rare);
  [com[0],Math.random()<.5&&rare?rare:com[1]].filter(Boolean).forEach(it=>{
    add({id:'i_'+it.id,name:it.name,price:pr(it.price),tag:`装備・${SLOT_TYPE[it.slot]}${it.rare?'・レア':''}`,desc:it.desc,ok:()=>true,buy:async()=>equipItem(it,true)});
  });
  if(Math.random()<0.06){
    const lg=shuffle(ITEMS.filter(it=>it.leg&&!ownedItem(it.id)))[0];
    if(lg)add({id:'i_'+lg.id,name:lg.name,price:pr(lg.price),leg:true,tag:`装備・${SLOT_TYPE[lg.slot]}・伝説`,desc:lg.desc,ok:()=>true,buy:async()=>equipItem(lg,true)});
  }
  const pool0=SKILLS.filter(s=>!p.skills.includes(s.id));
  if(pool0.length){
    const s=shuffle(pool0)[0];
    add({id:'s_'+s.id,name:s.name,price:pr(70),tag:s.type==='atk'?'スキル':`魔法・MP${s.mp}`,desc:skDesc(s),ok:()=>true,buy:async()=>{p.skills.push(s.id)}});
  }
  return items;
}
function buildHTML(){
  const eq=slotRows().map(r=>`<div class="eqrow"><span class="es">${r.nm}</span>${r.it?`<span><b style="font-weight:normal">${r.it.name}</b><br><span class="sub">${r.it.desc}</span></span>`:'<span class="sub">（空き）</span>'}${mvBtns(r.i,'shop')}</div>`).join('');
  const sp={};p.slots.forEach(t=>{sp[t]=(sp[t]||0)+1});
  const dice=Object.keys(sp).map(t=>`${DICE_T[t].name}×${sp[t]}`).join('、');
  const sk=p.skills.map(id=>SKILL_BY[id].name).join('、')||'なし';
  const ps=p.passives.map(id=>PASSIVE_BY[id].name).join('、')||'なし';
  return `<div class="eqpanel">${eq}<div class="eqrow"><span class="es">ダイス</span><span>${dice}</span></div><div class="eqrow"><span class="es">スキル</span><span>${sk}</span></div><div class="eqrow"><span class="es">パッシブ</span><span>${ps}</span></div></div>`;
}
async function shop(){
  log('旅の商人に出会った。');
  const items=makeStock();curShop=items;codexSee(items);
  let showBuild=false;
  while(true){
    const html=`<button class="card go" data-i="eq"><span class="ct" style="justify-content:center"><b>いまの装備・ビルドを見る ${showBuild?'▲':'▼'}</b></span></button>${showBuild?buildHTML():''}`+items.map((it,i)=>{
      const dis=it.sold||p.gold<it.price||!it.ok();
      return `<button class="card ${it.leg?'legend':''}" data-i="${i}" ${dis?'disabled':''}><span class="ct"><b>${it.name}${markHTML(it)}</b><em>${it.sold?'売り切れ':it.price+'G'}</em></span><span class="cd">${it.tag?it.tag+'：':''}${it.desc}</span></button>`;
    }).join('')+`<button class="card go" data-i="leave"><span class="ct" style="justify-content:center"><b>店を出る</b></span></button>`;
    const r=await pickRaw('旅の商人',`所持金 ${fmt(p.gold)}G ／ HP ${fmt(p.hp)}/${fmt(p.maxHp)} ／ MP ${p.mp}/${p.maxMp} ／ ダイス${p.slots.length}個`,html);
    if(r==='leave')break;
    if(r==='eq'){showBuild=!showBuild;continue}
    if(String(r).startsWith('mv:')){moveSlot(String(r).slice(3));continue}
    const it=items[+r];
    if(!it||it.sold||p.gold<it.price||!it.ok())continue;
    p.gold-=it.price;it.sold=true;
    const res=await it.buy();
    if(res===false){p.gold+=it.price;it.sold=false}
    render();
  }
  curShop=null;
}

/* ===== ランダムイベント（ショップ以外の寄り道） ===== */
async function randomEvent(){
  const events=[
    {title:'忘れられた宝箱',sub:'通路の隅に、古びた宝箱が置かれている。',opts:[
      {name:'慎重に開ける',tag:'安全',desc:'少しだけゴールドを手に入れる。',apply:()=>{const g=pr(18+rnd(24));p.gold+=g;log(`宝箱から${fmt(g)}Gを見つけた。`)}},
      {name:'力ずくでこじ開ける',tag:'危険',desc:'大金の可能性。ただし罠でHPを失うかも。',apply:()=>{const g=pr(35+rnd(55));p.gold+=g;log(`宝箱から${fmt(g)}Gを手に入れた！`);if(Math.random()<.4){const d=Math.max(1,R(p.maxHp*(.08+Math.random()*.12)));p.hp=Math.max(1,p.hp-d);log(`罠が作動！ HPを${fmt(d)}失った。`)}else log('罠は作動しなかった！')}},
      {name:'立ち去る',tag:'やめる',desc:'何もせず先へ進む。',apply:()=>log('宝箱には手を出さず、先へ進んだ。')}
    ]},
    {title:'不思議な泉',sub:'青白く光る泉から、澄んだ水が湧いている。',opts:[
      {name:'水を飲む',tag:'回復',desc:'HPを最大HPの35%、MPを4回復する。',apply:()=>{const h=Math.max(1,R(p.maxHp*.35));p.hp=Math.min(p.maxHp,p.hp+h);p.mp=Math.min(p.maxMp,p.mp+4);log(`泉の水でHPが${fmt(h)}、MPが回復した。`)}},
      {name:'水を汲んで売る',tag:'お金',desc:'水を売ってゴールドを得る。',apply:()=>{const g=pr(28+rnd(22));p.gold+=g;log(`不思議な水を${fmt(g)}Gで売った。`)}},
      {name:'泉に祈る',tag:'幸運',desc:'運が良ければ最大HPが少し増える。',apply:()=>{if(Math.random()<.7){p.maxHp+=12;p.hp=Math.min(p.maxHp,p.hp+12);log('泉の祝福！ 最大HPが12増えた。')}else{const d=Math.max(1,R(p.maxHp*.06));p.hp=Math.max(1,p.hp-d);log(`泉が泡立った……HPを${fmt(d)}失った。`)}}}
    ]},
    {title:'崩れかけた通路',sub:'天井から小石が落ちている。急いで通る？',opts:[
      {name:'慎重に進む',tag:'安全',desc:'時間はかかるが、少量のゴールドを拾える。',apply:()=>{const g=pr(10+rnd(16));p.gold+=g;log(`慎重に進み、落ちていた${fmt(g)}Gを拾った。`)}},
      {name:'走り抜ける',tag:'危険',desc:'成功すれば大きな報酬。失敗するとダメージ。',apply:()=>{if(Math.random()<.55){const g=pr(45+rnd(40));p.gold+=g;log(`素早く通り抜け、${fmt(g)}Gを見つけた！`)}else{const d=Math.max(1,R(p.maxHp*(.1+Math.random()*.1)));p.hp=Math.max(1,p.hp-d);log(`落石に当たった！ HPを${fmt(d)}失った。`)}}},
      {name:'別の道を探す',tag:'回復',desc:'少し遠回りしてHPを10%回復する。',apply:()=>{const h=Math.max(1,R(p.maxHp*.1));p.hp=Math.min(p.maxHp,p.hp+h);log(`別の道を見つけ、HPが${fmt(h)}回復した。`)}}
    ]},
    {title:'旅する妖精',sub:'小さな妖精がくるくると飛び回っている。',opts:[
      {name:'妖精に挨拶する',tag:'祝福',desc:'HPを回復し、少しだけMPも戻る。',apply:()=>{const h=Math.max(1,R(p.maxHp*.22));p.hp=Math.min(p.maxHp,p.hp+h);p.mp=Math.min(p.maxMp,p.mp+2);log(`妖精の祝福でHPが${fmt(h)}、MPが2回復した。`)}},
      {name:'一緒に遊ぶ',tag:'ダイス',desc:'ふつうのダイスを1個もらう（最大18個）。',apply:()=>{if(p.slots.length<18){p.slots.push('normal');log('妖精からふつうのダイスを1個もらった！')}else{const g=pr(35);p.gold+=g;log(`ダイス袋がいっぱい！ お礼に${fmt(g)}Gをもらった。`)}}},
      {name:'お礼を渡す',tag:'寄付',desc:'15Gを渡すと、最大MPが2増える。',apply:()=>{const cost=pr(15);if(p.gold>=cost){p.gold-=cost;p.maxMp+=2;p.mp=Math.min(p.maxMp,p.mp+2);log(`妖精に${fmt(cost)}Gを渡し、最大MPが2増えた。`)}else{const h=Math.max(1,R(p.maxHp*.08));p.hp=Math.min(p.maxHp,p.hp+h);log('お金が足りないので、妖精が少しだけHPを回復してくれた。')}}}
    ]},
    {title:'謎めいた祭壇',sub:'祭壇には「力を求める者は、何かを差し出せ」と刻まれている。',opts:[
      {name:'体力を捧げる',tag:'強化',desc:'HPを最大HPの12%失う代わりに、最大HPが20増える。',apply:()=>{const d=Math.max(1,R(p.maxHp*.12));p.hp=Math.max(1,p.hp-d);p.maxHp+=20;log(`祭壇に体力を捧げ、最大HPが20増えた。HPを${fmt(d)}失った。`)}},
      {name:'ゴールドを捧げる',tag:'強化',desc:'ゴールドを使い、最大MPを3増やす。',apply:()=>{const cost=pr(30);if(p.gold>=cost){p.gold-=cost;p.maxMp+=3;p.mp=Math.min(p.maxMp,p.mp+3);log(`祭壇に${fmt(cost)}Gを捧げ、最大MPが3増えた。`)}else{const g=pr(12);p.gold+=g;log('捧げ物が足りない。祭壇の隙間から少額のコインが出てきた。')}}},
      {name:'祈って立ち去る',tag:'安全',desc:'少量のHPを回復する。',apply:()=>{const h=Math.max(1,R(p.maxHp*.12));p.hp=Math.min(p.maxHp,p.hp+h);log(`祈りが届き、HPが${fmt(h)}回復した。`)}}
    ]},
    {title:'迷子の冒険者',sub:'傷ついた冒険者が道に座り込んでいる。',opts:[
      {name:'回復薬を分ける',tag:'親切',desc:'ゴールドを少し渡すと、お礼に装備資金をくれる。',apply:()=>{const cost=pr(12);if(p.gold>=cost){p.gold-=cost;const g=pr(38);p.gold+=g;log(`冒険者を助けた。お礼に${fmt(g)}Gを受け取った。`)}else{const h=Math.max(1,R(p.maxHp*.12));p.hp=Math.min(p.maxHp,p.hp+h);log('持ち合わせがなくても、冒険者は感謝してHPを回復してくれた。')}}},
      {name:'情報を聞く',tag:'情報',desc:'次の戦いに備えてHPを少し回復する。',apply:()=>{const h=Math.max(1,R(p.maxHp*.15));p.hp=Math.min(p.maxHp,p.hp+h);log(`冒険者の助言を聞き、HPが${fmt(h)}回復した。`)}},
      {name:'先を急ぐ',tag:'通過',desc:'何も消費せず先へ進む。',apply:()=>log('冒険者に別れを告げ、先へ進んだ。')}
    ]},
    {title:'怪しい魔法陣',sub:'床の魔法陣が、ダイスのような光を放っている。',opts:[
      {name:'魔法陣に触れる',tag:'運試し',desc:'成功すると特殊ダイスを得る。失敗するとHPを失う。',apply:()=>{if(Math.random()<.65&&p.slots.length<18){const k=shuffle(Object.keys(DICE_T).filter(x=>x!=='normal'))[0];p.slots.push(k);log(`魔法陣が反応！ ${DICE_T[k].name}を手に入れた！`)}else if(Math.random()<.5){const d=Math.max(1,R(p.maxHp*.12));p.hp=Math.max(1,p.hp-d);log(`魔力が暴発！ HPを${fmt(d)}失った。`)}else{const g=pr(25);p.gold+=g;log(`魔法陣から${fmt(g)}Gがこぼれ落ちた。`)}}},
      {name:'魔法陣を調べる',tag:'安全',desc:'少額のゴールドを見つける。',apply:()=>{const g=pr(15+rnd(18));p.gold+=g;log(`魔法陣のそばで${fmt(g)}Gを見つけた。`)}},
      {name:'無視する',tag:'通過',desc:'危険を避けて先へ進む。',apply:()=>log('魔法陣には触れずに通り過ぎた。')}
    ]}
  ];
  const ev=events[rnd(events.length)];
  const o=await pick(ev.title,ev.sub,ev.opts);
  await o.apply();render();
}

/* ===== 階クリア報酬（1階ごとに3択で1つ） ===== */
function rewardOptions(boss){
  const cands=[];
  if(boss){
    const rares=shuffle(ITEMS.filter(it=>it.rare&&!ownedItem(it.id))).slice(0,3);
    if(rares.length>=2){
      const out=rares.map(itemOpt);
      if(Math.random()<0.15){const lg=shuffle(ITEMS.filter(it=>it.leg&&!ownedItem(it.id)))[0];if(lg)out[rnd(out.length)]=itemOpt(lg)}
      return out;
    }
  }
  SKILLS.filter(s=>!p.skills.includes(s.id)).forEach(s=>cands.push({w:3,id:'s_'+s.id,name:s.name,tag:s.type==='atk'?'スキル':`魔法・MP${s.mp}`,desc:skDesc(s),apply:()=>{p.skills.push(s.id);log(`${s.name}を覚えた！`)}}));
  ITEMS.filter(it=>!it.leg&&!ownedItem(it.id)).forEach(it=>cands.push({w:it.rare?1:3,...itemOpt(it)}));
  cands.push({w:8,id:'dice1',name:'ダイス+1',tag:'ダイス',desc:'ふつうのダイスが1個増える。',apply:()=>{p.slots.push('normal');log('ダイスが1個増えた！')}});
  cands.push({w:4,id:'dice2',name:'ダイス+2',tag:'ダイス',desc:'ふつうのダイスが2個増える。',apply:()=>{p.slots.push('normal','normal');log('ダイスが2個増えた！')}});
  Object.keys(DICE_T).filter(k=>k!=='normal').forEach(k=>cands.push({w:3,id:'d_'+k,name:DICE_T[k].name,tag:'特殊ダイス',desc:`${DICE_T[k].desc}ダイスが1個増える。`,apply:()=>{p.slots.push(k);log(`${DICE_T[k].name}を手に入れた！`)}}));
  cands.push({w:3,id:'hp',name:'命の実',tag:'強化',desc:'最大HPが20増え、20回復する。',apply:()=>{p.maxHp+=20;p.hp+=20;log('最大HPが20増えた！')}});
  cands.push({w:2,id:'mp',name:'魔力の実',tag:'強化',desc:'最大MPが5増え、5回復する。',apply:()=>{p.maxMp+=5;p.mp+=5;log('最大MPが5増えた！')}});
  const out=[];
  while(out.length<3&&cands.length){
    const tot=cands.reduce((a,c)=>a+c.w,0);let r=Math.random()*tot,i=0;
    for(;i<cands.length;i++){r-=cands[i].w;if(r<=0)break}
    out.push(cands.splice(Math.min(i,cands.length-1),1)[0]);
  }
  if(Math.random()<0.06){const lg=shuffle(ITEMS.filter(it=>it.leg&&!ownedItem(it.id)))[0];if(lg&&out.length)out[rnd(out.length)]=itemOpt(lg)}
  return out;
}
async function rewardPick(){
  const o=await pick(`地下${stage+1}階クリア！`,e.boss?'ボス報酬！レアな装備から1つ選ぼう。':'報酬を1つ選ぼう。',rewardOptions(e.boss));
  await o.apply();render();
}
async function passivePick(){
  const pl=PASSIVES.filter(s=>!p.passives.includes(s.id));
  if(!pl.length)return;
  const opts=shuffle(pl).slice(0,3).map(s=>({id:s.id,name:s.name,desc:s.desc,tag:'パッシブ'}));
  const o=await pick('ボスを倒した！','特別な力を1つ選ぼう。ずっと効果が続く。',opts);
  p.passives.push(o.id);
  if(o.id==='dice'){p.slots.push('normal','normal')}
  log(`${o.name}を身につけた！`);render();
}

/* ===== 勝利・次の階へ ===== */
async function win(){
  log(`${e.name}を倒した！`);render();await sleep(500);
  const goldMul=equipped().reduce((m,it)=>m*(it.goldMul||1),1);
  const earned=R(e.gold*goldMul);log(`${fmt(earned)}Gを獲得。`);popup('scene','+'+fmt(earned)+'G','gold');p.gold+=earned;
  for(const it of equipped()){if(it.onWin){const g=it.onWin();if(g>0){p.gold+=g;log(`${it.name}：${fmt(g)}G増えた！`)}}if(it.onWinHeal){const h=it.onWinHeal();if(h>0){p.hp=Math.min(p.maxHp,p.hp+h);log(`${it.name}：HPが${fmt(h)}回復！`)}}if(it.onWinMp){p.mp=Math.min(p.maxMp,p.mp+it.onWinMp);log(`${it.name}：MPが${it.onWinMp}回復！`)}}
  p.maxHp+=CFG.floorHp;p.maxMp+=CFG.floorMp;
  const h=Math.round(p.maxHp*CFG.winHeal)+CFG.floorHp;
  p.hp=Math.min(p.maxHp,p.hp+h);p.mp=Math.min(p.maxMp,p.mp+CFG.winMp);
  render();saveBest();
  const finalBoss=stage===FLOORS-1&&!p.endless;
  if(!finalBoss)await rewardPick();
  if(e.boss&&!finalBoss)await passivePick();
  const due=!finalBoss&&shopAfter(stage+1);
  if(!finalBoss)persist(stage+1,due,due);
  if(due){await shop();persist(stage+1,false,false)}
  // ショップだけでなく、階層の合間にランダムイベントも発生する。
  const eventChance=due ? .18 : (e.boss ? .22 : .42);
  if(!finalBoss&&Math.random()<eventChance){await randomEvent();persist(stage+1,false,true)}
  await nextFloor();
}
async function nextFloor(){
  stage++;
  if(stage>=FLOORS&&!p.endless){stage=FLOORS-1;clearSave();showEnd(true);return}
  if(p.endless&&stage%FLOORS===0)await inflate();
  await startBattle();busy=false;render();
}
async function inflate(){
  const tier=tierOf(stage);
  growSlots();
  log(`インフレ突入！（段階${tier}）全ての装備枠が1つ増えた。`);render();
  const pl=ITEMS.filter(it=>(it.rare||it.leg)&&!ownedItem(it.id));
  const out=[];
  while(out.length<3&&pl.length){
    const tot=pl.reduce((a,it)=>a+(it.leg?1:2),0);let r=Math.random()*tot,i=0;
    for(;i<pl.length;i++){r-=(pl[i].leg?1:2);if(r<=0)break}
    out.push(pl.splice(Math.min(i,pl.length-1),1)[0]);
  }
  if(out.length){
    const o=await pick(`インフレ突入！ 地下${stage+1}階へ`,'全ての装備枠が1つ増えた！ 強力な装備を1つ選ぼう。',out.map(itemOpt));
    await o.apply();render();
  }
}
async function enterEndless(){
  p.endless=true;busy=true;
  persist(stage+1,false,true);
  await nextFloor();
}
async function resume(sv0){
  p=restoreP(sv0.p);logLines=[];fullLog=[];turnNo=0;busy=true;
  const next=Math.max(1,Math.floor(sv0.next));
  stage=next-1;
  const t=tpl(stage);
  e={...t,name:tierPrefix(stage)+t.name,hp:0,maxHp:enemyHp(stage,t),atk:enemyAtk(stage,t),idx:0,frozen:false,frozenUsed:false,weak:false,poison:null,burn:null,bleed:null,stun:0,vulnerable:false,gold:0};
  $('#eart').innerHTML=e.art();
  log('セーブデータを読み込んだ。');render();
  if(sv0.shopPending&&shopAfter(next)){await shop();persist(next,false,false)}
  await nextFloor();
}
async function lose(){
  clearSave();
  log('勇者はたおれた…');render();await sleep(800);showEnd(false);
}
function showEnd(clear){
  const b=saveBest();
  const learned=p.skills.map(id=>SKILL_BY[id].name).join('、');
  const recTxt=`最大ダメージ ${fmt(p.maxHit||0)}／自己ベスト：地下${b.floor}階・最大ダメージ${fmt(b.maxHit)}`;
  if(clear){
    showOv('迷宮を制覇した！',`${e.name}を倒した。ダイス${p.slots.length}個、所持金は${fmt(p.gold)}G。`,
      `<p>覚えた技と魔法：${learned}<br>${recTxt}</p><button class="card go legend" id="endless"><span class="ct" style="justify-content:center"><b>エンドレスに挑む（インフレ突入）</b></span><span class="cd" style="text-align:center;width:100%">全ての装備枠が+1。敵は加速度的に強くなる。</span></button><button class="card go" id="go"><span class="ct" style="justify-content:center"><b>もう一度あそぶ</b></span></button>`);
    $('#endless').onclick=()=>{hideOv();enterEndless()};
    $('#go').onclick=()=>{hideOv();newGame()};
  }else screen('やられてしまった…',`地下${stage+1}階（${layerOf(stage).name}）、${e.name}との戦いで力尽きた。（ダイス${p.slots.length}個）`,`<p>覚えた技と魔法：${learned}<br>${recTxt}<br>所持金${fmt(p.gold)}Gは迷宮に消えた。</p>`,'はじめからやり直す',newGame);
}

/* ===== ログ画面 ===== */
function logRows(mode){
  let from=0;
  if(mode==='turn'){for(let i=fullLog.length-1;i>=0;i--){if(fullLog[i].k==='turn'){from=i;break}}}
  else if(mode==='battle'){for(let i=fullLog.length-1;i>=0;i--){if(fullLog[i].k==='battle'){from=i;break}}}
  return fullLog.slice(from).map(x=>`<div class="lg ${x.k}">${x.t}</div>`).join('')||'<div class="lg">まだログがありません。</div>';
}
function openLog(mode){
  const m=mode||'turn';
  const label={turn:'このターン',battle:'この戦闘',all:'すべて'};
  showOv('ログ','ダイスを振ってから攻撃・被ダメージまでの流れを確認できます。',
    `<div class="lgbtns">${['turn','battle','all'].map(k=>`<button class="sbtn" data-i="${k}" ${k===m?'disabled':''}>${label[k]}</button>`).join('')}<button class="sbtn" data-i="close">閉じる</button></div><div class="lgbox" id="lgbox">${logRows(m)}</div>`);
  const box=$('#lgbox');if(box)box.scrollTop=box.scrollHeight;
  $('#ovB').onclick=ev=>{
    const b=ev.target.closest('button[data-i]');if(!b||b.disabled)return;
    $('#ovB').onclick=null;
    if(b.dataset.i==='close'){hideOv();return}
    openLog(b.dataset.i);
  };
}

/* ===== 入力 ===== */
$('#dice').addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.x==='log'){openLog('turn');return}
  if(b.dataset.x==='home'){confirmHome();return}
  if(busy)return;
  if(b.dataset.f!==undefined){
    const f=+b.dataset.f;
    if(p.locked.has(f))p.locked=new Set();else if(p.dice.some(d=>d.v===f))p.locked=new Set([f]);
    render();return;
  }
  if(b.dataset.x==='reroll')return reroll();
  if(b.dataset.x==='end')return enemyPhase();
});
$('#equip').addEventListener('click',ev=>{
  const b=ev.target.closest('button[data-mv]');if(!b||busy)return;
  if(moveSlot(b.dataset.mv))render();
});
$('#cmd').addEventListener('click',ev=>{
  const b=ev.target.closest('button[data-a]');if(!b||busy)return;
  const a=ALL[b.dataset.a];
  if(!a||p.actionsLeft<=0||p.used[a.id]||(p.cds[a.id]||0)>0)return;
  if(!a.calc(pool()).ok)return;
  if(a.mp&&p.mp<a.mp)return;
  playerAct(a);
});

function confirmHome(){
  showOv('ホームに戻る？',canSave?'クリア済みの階までの自動セーブは残り、「つづきから」で再開できます。いま戦っている階の途中経過は保存されません。':'この環境ではセーブできないため、いまの進行は失われます。',
    `<button class="card go" id="hmYes"><span class="ct" style="justify-content:center"><b>ホームに戻る</b></span></button><button class="card go" id="hmNo"><span class="ct" style="justify-content:center"><b>ゲームを続ける</b></span></button>`);
  $('#hmYes').onclick=()=>{try{saveBest()}catch(_){}location.reload()};
  $('#hmNo').onclick=hideOv;
}
/* ===== 開始 ===== */
function newGame(){
  p={hp:CFG.hp,maxHp:CFG.hp,mp:CFG.mp,maxMp:CFG.mp,gold:0,
     skills:['smash','fire'],passives:[],slots:Array(CFG.dice).fill('normal'),
     equip:baseSlots(),endless:false,maxHit:0,cds:{},cdFresh:{},chain:0,revived:false,hot:null,rerollsUsed:0,bank:0,
     shield:0,barrier:0,used:{},dice:[],locked:new Set(),rerolls:0,actions:CFG.actions,actionsLeft:0,dbl:false};
  stage=0;logLines=[];fullLog=[];turnNo=0;busy=true;bestCache=loadBest();
  startBattle().then(()=>{busy=false;render()});
}
function titleScreen(){
  const sd=loadSave();
  let armed=false;
  const intro=`<ul><li>ダイスは何個でも増える。毎ターン全部振って、出目の集計を見る</li><li>ダメージの土台は出目の合計。同じ目が揃うとボーナス</li><li>キープできる目は1種類だけ。振り直しは1ターン3回</li><li>装備（武器・防具・アクセ2つ）は出目に反応して、上から順に発動する。▲▼で順番を入れ替えられる（＋と×で結果が変わる）</li><li>1ターンに動ける回数は3回。各行動は1回まで</li><li>スキルと魔法は、使うと数ターン使えなくなる。次の階にも持ち越しで、戦闘が終わったターンも1ターンに数える</li><li>1階クリアごとに報酬を1つ選ぶ。お店で装備やダイスを買える</li><li>20階をクリアすると、エンドレス（インフレ）に挑める。20階ごとに全ての装備枠が+1</li><li>階をクリアするたびに自動セーブ。やられたらセーブもお金も消える</li><li>見つけた装備・ダイス・スキルと、体験した状態異常は「図鑑」に記録される。図鑑はやられても消えない。選ぶ画面では、初めて見るものに「NEW」、見たことはあるが手に入れたことがないものに「未入手」が付く</li></ul>`;
  const cont=sd?`<button class="card go" id="cont"><span class="ct" style="justify-content:center"><b>つづきから</b></span><span class="cd" style="text-align:center;width:100%">地下${Math.max(1,Math.floor(sd.next))+1}階${sd.p.endless?'（エンドレス）':''} ／ ダイス${(sd.p.slots||[]).length}個 ／ ${fmt(Number(sd.p.gold)||0)}G${sd.shopPending?' ／ お店の前':''}</span></button>`:'';
  const start=`<button class="card go" id="go"><span class="ct" style="justify-content:center"><b id="goT">${sd?'はじめから':'冒険をはじめる'}</b></span></button>`;
  const cdx=`<button class="card" id="cdx"><span class="ct" style="justify-content:center"><b>📖 図鑑</b></span><span class="cd" style="text-align:center;width:100%">装備 ${codexCount('items')}/${ITEMS.length} ／ ダイス ${codexCount('dice')}/${Object.keys(DICE_T).length} ／ スキル ${codexCount('skills')}/${SKILLS.length} ／ 状態異常 ${codexCount('status')}/${STATUS_FX.length}</span></button>`;
  const prof=curProfile();
  const pfb=`<button class="card" id="pf"><span class="ct"><b>👤 ${escHtml(prof.name)}</b><em>プロフィール切り替え</em></span><span class="cd">${escHtml(profileSummary(prof.id))}</span></button>`;
  const bst=loadBest();
  const note=(canSave?'':'<p class="sub" style="margin:10px 0 0">この環境ではセーブできません。</p>')+(bst.floor?`<p class="sub" style="margin:10px 0 0">自己ベスト：地下${bst.floor}階／最大ダメージ ${fmt(bst.maxHit)}</p>`:'');
  showOv('ちいさな迷宮 ダイス版','全20階。スライムの洞窟、ゴブリンの砦、亡者の墓所、雷鳴の遺跡を抜けて、最深部を目指そう。',intro+pfb+cont+start+cdx+note+dataWarnNote());
  $('#pf').onclick=()=>{pfArmed='';showProfiles()};
  $('#cdx').onclick=()=>{codexTab='items';codexArmed=false;showCodex()};
  if(sd)$('#cont').onclick=()=>{hideOv();resume(sd)};
  $('#go').onclick=()=>{
    if(sd&&!armed){armed=true;$('#goT').textContent='本当にはじめから？（セーブは消えます）';return}
    hideOv();if(sd)clearSave();newGame();
  };
}

bootGame();
