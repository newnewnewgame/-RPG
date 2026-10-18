/* ===== 装備のしくみ =====
   装備の名前・価格・説明・数値は data/equipment.xlsx、効果のプログラムは js/equipment_fx.js。
   ここには、枠・装着・発動順・ダメージ計算の流れ（装備が上から順に発動する処理）が入っている。 */
/* ===== 装備：出目に反応して、上から順に発動する ===== */
const SLOT_NAME={weapon:'武器',armor:'防具',acc:'アクセ'};
const SLOT_ORDER=['weapon','armor','acc'];
const SLOT_TYPE={weapon:'武器',armor:'防具',acc:'アクセ'};
const baseSlots=()=>[{t:'weapon',id:null},{t:'armor',id:null},{t:'acc',id:null},{t:'acc',id:null}];
const equipped=()=>p.equip.filter(x=>x.id).map(x=>ITEM_BY[x.id]);
const ownedItem=id=>p.equip.some(x=>x.id===id);
function growSlots(){
  for(const t of SLOT_ORDER)p.equip.push({t,id:null});   // 増えた枠は一番下に追加（並び替えは自由）
}
function moveSlot(code){
  const [i,dir]=String(code).split(':');const k=+i,j=dir==='up'?k-1:k+1;
  if(!(k>=0&&k<p.equip.length)||j<0||j>=p.equip.length)return false;
  const a=p.equip[k],b=p.equip[j];
  p.equip[k]=b;p.equip[j]=a;
  rec(`【装備の並び替え】${a.id?ITEM_BY[a.id].name:'空き枠'}を${dir==='up'?'上':'下'}へ移動`,'s');
  return true;
}
const itemOpt=it=>({id:'i_'+it.id,name:it.name,tag:`装備・${SLOT_TYPE[it.slot]}${it.leg?'・伝説':it.rare?'・レア':''}`,desc:it.desc,cls:it.leg?'legend':'',apply:()=>equipItem(it,false)});
const takeMul=()=>equipped().reduce((m,it)=>m*(it.take?it.take():1),1);

function runPipeline(base,P,preview){
  let v=base;const steps=[];
  const skillId=p.currentSkill||'';
  const skillBoost=equipped().reduce((m,it)=>m*((it.skillMul&&it.skillMul[skillId])||1),1);
  if(skillBoost!==1){v=cl(v*skillBoost);steps.push({id:null,name:'スキル強化',msg:skillId,t:`×${skillBoost}`,v:R(v)})}
  for(const it of equipped()){
    if(!it.dmg)continue;
    const r=it.dmg(P);if(!r)continue;
    let t='';
    if(r.add){v=cl(v+r.add);t=`+${fmt(R(r.add))}`}
    if(r.mul){v=cl(v*r.mul);t=`×${fmtM(r.mul)}`}
    if(r.rand){
      const m=preview?(r.rand[0]+r.rand[1])/2:+(r.rand[0]+Math.random()*(r.rand[1]-r.rand[0])).toFixed(1);
      v=cl(v*m);t=`×${m}`;
    }
    steps.push({id:it.id,name:it.name,msg:r.msg,t,v:R(v)});
  }
  if(has('power')){v=cl(v*1.2);steps.push({id:null,name:'闘志',msg:'',t:'×1.2',v:R(v)})}
  if(p.dbl){v=cl(v*2);steps.push({id:null,name:'ダブルアップ',msg:'',t:'×2',v:R(v)})}
  return {base:R(base),steps,final:Math.max(1,R(cl(v)))};
}
const previewFinal=(base,P)=>runPipeline(base,P,true).final;
function guardFinal(base,P){
  let v=base;const steps=[];
  for(const it of equipped()){
    if(!it.sh)continue;
    const r=it.sh(P);if(!r)continue;
    v=cl(v+r.add);steps.push({id:it.id,name:it.name,msg:r.msg,t:`+${fmt(R(r.add))}`,v:R(v)});
  }
  return {base:R(base),steps,final:Math.max(1,R(v))};
}
async function cascade(res,note){
  const c=$('#casc'),bs=$('#bigscore');
  rec(`　${note||'基本'}＝${res.base}`,'act');
  c.innerHTML=`<div class="cl">${note||'基本'}<em>${fmt(res.base)}</em></div>`;
  bs.textContent=fmt(res.base);retrigger(bs,'pulse');
  await sleep(res.steps.length?240:120);
  for(const s of res.steps){
    p.hot=s.id;render();
    rec(`　${s.name}${s.msg?'（'+s.msg+'）':''} ${s.t} → ${s.v}`,'act');
    c.innerHTML+=`<div class="cl"><b>${s.name}</b> ${s.msg||''} ${s.t}<em>→ ${fmt(s.v)}</em></div>`;
    bs.textContent=fmt(s.v);retrigger(bs,'pulse');
    await sleep(260);
  }
  p.hot=null;render();
  rec(`　▶ 最終値 ${fmt(res.final)}`,'act');
  await sleep(res.steps.length?220:80);
  bs.textContent='';c.innerHTML='';
}
async function turnStartItems(){
  const P=pool();
  for(const it of equipped()){
    if(!it.turn)continue;
    const r=it.turn(P);if(!r)continue;
    p.hot=it.id;
    if(r.shield){const sh=R(r.shield*equipped().reduce((m,x)=>m*(x.shieldMul||1),1));p.shield+=sh;log(`${it.name}：${r.msg} → シールド+${sh}`);popup('pl','+'+sh,'heal')}
    if(r.heal){log(`${it.name}：${r.msg} → HP+${r.heal}`);healP(r.heal)}
    if(r.mp){p.mp=Math.min(p.maxMp,p.mp+r.mp);log(`${it.name}：${r.msg} → MP+${r.mp}`)}
    render();await sleep(320);
    p.hot=null;
  }
  render();
}
function slotRows(){
  return p.equip.map((x,i)=>({nm:`${i+1}. ${SLOT_NAME[x.t]}`,it:x.id?ITEM_BY[x.id]:null,x,i}));
}
const mvBtns=(i,mode)=>`<span class="mv"><button class="mvb" ${mode==='shop'?`data-i="mv:${i}:up"`:`data-mv="${i}:up"`} ${i===0?'disabled':''} aria-label="上へ">▲</button><button class="mvb" ${mode==='shop'?`data-i="mv:${i}:down"`:`data-mv="${i}:down"`} ${i===p.equip.length-1?'disabled':''} aria-label="下へ">▼</button></span>`;
function equipHTML(){
  const tot={weapon:0,armor:0,acc:0};p.equip.forEach(x=>{tot[x.t]++});
  return `<div class="eqh">装備（上から順に発動。▲▼で並び替え）　枠：武器${tot.weapon}／防具${tot.armor}／アクセ${tot.acc}</div>`+slotRows().map(r=>
    `<div class="eq ${r.it&&p.hot===r.it.id?'hot':''} ${r.it&&r.it.leg?'leg':''}"><span class="es">${r.nm}</span>${r.it?`<b>${r.it.name}</b>`:`<b class="none">（空き）</b>`}${mvBtns(r.i,'play')}${r.it?`<span class="ed">${r.it.desc}</span>`:''}</div>`).join('');
}
async function equipItem(it,paid){
  const mine=p.equip.filter(x=>x.t===it.slot);
  let slot=mine.find(x=>!x.id);
  const half=Math.round(it.price/2);
  if(!slot){
    const opts=mine.map((x,i)=>{const old=ITEM_BY[x.id];return {x,name:`${old.name}と入れ替える`,tag:SLOT_NAME[it.slot]+(mine.length>1?(i+1):''),desc:`${old.desc}（外した装備は${Math.round(old.price/2)}Gで売却）`,cls:old.leg?'legend':''}});
    opts.push({x:null,name:'見送る',tag:'',desc:paid?`${it.name}は買わない（代金は戻る）`:`${it.name}は受け取らない（${half}Gになる）`});
    const o=await pick(`${it.name}を装備する？`,`${it.desc}`,opts);
    if(!o.x){if(!paid){p.gold+=half;log(`${it.name}を見送り、${half}Gを得た。`)}return false}
    p.gold+=Math.round(ITEM_BY[o.x.id].price/2);
    slot=o.x;
  }
  slot.id=it.id;log(`${it.name}を装備した！`);
  return true;
}

/* ===== 攻撃時の状態異常 =====
   装備シートの「攻撃時の状態異常」に 毒・火傷・出血・スタン・凍結・弱体・弱点看破 のどれかを書くと、
   その装備を付けているあいだ、攻撃でダメージを与えるたびに敵へ付与する（プログラムの追加は不要）。
   毒・火傷・出血の強さ ＝ 与えたダメージ × 「状態異常の強さ」を、3ターンのあいだ毎ターン与える。
   付与確率が空なら100%。 */
const STATUS_LABEL={poison:'毒',burn:'火傷',bleed:'出血',stun:'スタン',freeze:'凍結',weaken:'弱体',vulnerable:'弱点看破'};
const STATUS_DOT={poison:1,burn:1,bleed:1};
function itemStatusOnHit(dealt){
  if(!(dealt>0)||!e||e.hp<=0)return;
  const rs={};
  for(const it of equipped()){
    const k=it.statusOnHit;if(!k)continue;
    const chance=it.statusChance===undefined?1:it.statusChance;
    if(!(Math.random()<chance))continue;
    if(STATUS_DOT[k]){const pow=it.statusPower===undefined?0.15:it.statusPower;rs[k]=Math.max(rs[k]||0,Math.max(1,R(dealt*pow)))}
    else rs[k]=true;
    rec(`　${it.name}：攻撃時に${STATUS_LABEL[k]}`,'act');
  }
  if(Object.keys(rs).length)applyStatuses(rs,true);
}
