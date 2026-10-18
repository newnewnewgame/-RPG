/* ===== 図鑑（見つけた装備・ダイス・スキルをこの端末に記録。やられても消えない） ===== */
const CODEX_KINDS=['items','dice','skills','status'];
const codexEmpty=()=>({own:{items:[],dice:[],skills:[],status:[]},seen:{items:[],dice:[],skills:[],status:[]}});
function loadCodex(){
  const c=codexEmpty();
  try{
    const d=JSON.parse(localStorage.getItem(CODEX_KEY)||'null');
    if(d&&d.own&&d.seen)for(const k of CODEX_KINDS)for(const w of ['own','seen']){
      if(Array.isArray(d[w][k]))c[w][k]=d[w][k].filter(x=>typeof x==='string');
    }
  }catch(_){}
  return c;
}
let codex=loadCodex();
const codexSets={own:{},seen:{}};
function codexRebuild(){for(const w of ['own','seen']){codexSets[w]={};for(const k of CODEX_KINDS)codexSets[w][k]=new Set(codex[w][k])}}
codexRebuild();
function codexSave(){try{localStorage.setItem(CODEX_KEY,JSON.stringify(codex))}catch(_){}}
// which: 'own'（手に入れた）/ 'seen'（見かけた）。手に入れたものは見かけたことにもなる
function codexAdd(which,kind,ids){
  let ch=false;
  for(const id of ids){
    if(!id||typeof id!=='string')continue;
    if(!codexSets[which][kind].has(id)){codexSets[which][kind].add(id);codex[which][kind].push(id);ch=true}
    if(which==='own'&&!codexSets.seen[kind].has(id)){codexSets.seen[kind].add(id);codex.seen[kind].push(id);ch=true}
  }
  if(ch)codexSave();
  return ch;
}
function codexStatus(k){codexAdd('own','status',[k])}
function codexSync(){
  if(!p)return;
  codexAdd('own','items',p.equip.map(x=>x.id));
  codexAdd('own','dice',p.slots);
  codexAdd('own','skills',p.skills);
}
// 選択肢に付けるしるし。'new'＝図鑑にまだ載っていない初登場／'un'＝見たことはあるが一度も手に入れていない。記録する前に判定する
function codexMark(list){
  for(const o of list||[]){
    const id=o&&typeof o.id==='string'?o.id:'';
    let kind='',key='';
    if(id.startsWith('i_')&&ITEM_BY[id.slice(2)]){kind='items';key=id.slice(2)}
    else if(id.startsWith('d_')&&DICE_T[id.slice(2)]){kind='dice';key=id.slice(2)}
    else if(id.startsWith('s_')&&SKILLS.some(s=>s.id===id.slice(2))){kind='skills';key=id.slice(2)}
    if(!kind)continue;
    o.mark=!codexSets.seen[kind].has(key)?'new':!codexSets.own[kind].has(key)?'un':'';
  }
}
const markHTML=o=>o&&o.mark==='new'?'<span class="nw">NEW</span>':o&&o.mark==='un'?'<span class="nw un">未入手</span>':'';
function codexSee(list){
  codexMark(list);
  const add={items:[],dice:[],skills:[],status:[]};
  for(const o of list||[]){
    const id=o&&typeof o.id==='string'?o.id:'';
    if(id.startsWith('i_')&&ITEM_BY[id.slice(2)])add.items.push(id.slice(2));
    else if(id.startsWith('d_')&&DICE_T[id.slice(2)])add.dice.push(id.slice(2));
    else if(id.startsWith('s_')&&SKILLS.some(s=>s.id===id.slice(2)))add.skills.push(id.slice(2));
  }
  for(const k of CODEX_KINDS)if(add[k]&&add[k].length)codexAdd('seen',k,add[k]);
}
const STATUS_FX=[
 {id:'poison',name:'毒',desc:'3ターンの間、敵のターンの初めに固定ダメージ。「猛毒の牙」を装備すると毒ダメージが2倍。',via:['venom','venomburst']},
 {id:'burn',name:'火傷',desc:'3ターンの間、敵のターンの初めに追加ダメージ。',via:['flare']},
 {id:'bleed',name:'出血',desc:'3ターンの間、敵のターンの初めに追加ダメージ。',via:['rupture']},
 {id:'stun',name:'スタン',desc:'通常の敵の次の行動を1回止める。ボスには効かず、代わりに次の攻撃が弱体化する。',via:['stunstrike']},
 {id:'freeze',name:'凍結',desc:'敵の次の行動を飛ばす（1戦闘に1回まで）。ボスは凍らず、次の攻撃が弱体化する。「氷牙」で凍結中の敵へのダメージが2倍。',via:['ice','timebreak']},
 {id:'weak',name:'弱体',desc:'敵の次の攻撃のダメージが半分になる。',via:['weakness']},
 {id:'vulnerable',name:'弱点看破',desc:'次に受けるダメージが1.5倍になる（1回）。',via:['expose']},
];
function codexRows(kind){
  if(kind==='status')return STATUS_FX.map(f=>({id:f.id,name:f.name,tag:'状態異常',slotTag:'',desc:f.desc+'　付与：'+f.via.map(id=>(SKILLS.find(s=>s.id===id)||{name:id}).name).concat(ITEMS.filter(it=>it.statusOnHit===(f.id==='weak'?'weaken':f.id)).map(it=>it.name+'（装備）')).join('・'),cls:''}));
  if(kind==='items')return ITEMS.slice().sort((a,b)=>(a.leg?1:0)-(b.leg?1:0)||a.price-b.price).map(it=>({id:it.id,name:it.name,tag:SLOT_TYPE[it.slot]+(it.leg?'・伝説':it.rare?'・レア':''),slotTag:SLOT_TYPE[it.slot],desc:it.desc,cls:it.leg?'legend':'',slot:it.slot}));
  if(kind==='dice')return Object.keys(DICE_T).map(k=>({id:k,name:DICE_T[k].name,tag:'ダイス',slotTag:'',desc:DICE_T[k].desc,cls:''}));
  return SKILLS.map(s=>({id:s.id,name:s.name,tag:s.type==='atk'?'スキル':`魔法・MP${s.mp}`,slotTag:'',desc:skDesc(s),cls:''}));
}
const codexCount=k=>codexRows(k).filter(r=>codexSets.own[k].has(r.id)).length;
let codexTab='items',codexArmed=false;
function codexCard(r,kind){
  const st=codexSets.own[kind].has(r.id)?'own':codexSets.seen[kind].has(r.id)?'seen':'unk';
  if(st==='unk')return `<div class="card cdx unk"><span class="ct"><b>？？？</b><em>${r.slotTag}</em></span><span class="cd">まだ見つけていない</span></div>`;
  return `<div class="card cdx ${st} ${r.cls}"><span class="ct"><b>${r.name}</b><em>${r.tag}・${st==='own'?(kind==='status'?'確認済み':'入手済み'):'見かけた'}</em></span><span class="cd">${r.desc}</span></div>`;
}
function showCodex(){
  const kind=codexTab,rows=codexRows(kind);
  const tabs=[['items','装備'],['dice','ダイス'],['skills','スキル'],['status','状態異常']].map(([k,n])=>
    `<button class="cdtab ${k===kind?'on':''}" data-t="${k}">${n}<br><small>${codexCount(k)}/${codexRows(k).length}</small></button>`).join('');
  let list='';
  if(kind==='items'){
    for(const sl of ['weapon','armor','acc']){
      const rs=rows.filter(r=>r.slot===sl);
      list+=`<div class="cdh">${SLOT_TYPE[sl]}　${rs.filter(r=>codexSets.own.items.has(r.id)).length}/${rs.length}</div>`+rs.map(r=>codexCard(r,kind)).join('');
    }
  }else list=rows.map(r=>codexCard(r,kind)).join('');
  showOv('図鑑','<span class="cdnote">見つけたもの・体験した状態異常がこの端末に記録されます。やられても消えません。</span>',
    `<div class="cdtabs">${tabs}</div>${list}`+
    `<button class="card go" id="cdBack"><span class="ct" style="justify-content:center"><b>戻る</b></span></button>`+
    `<button class="card" id="cdReset"><span class="ct" style="justify-content:center"><b id="cdResetT">${codexArmed?'本当に消す？（もう一度押すと消えます）':'図鑑をリセット'}</b></span></button>`);
  $('#ovB').onclick=ev=>{
    const t=ev.target.closest('button[data-t]');
    if(t){codexTab=t.dataset.t;codexArmed=false;showCodex();$('#ov').scrollTop=0;return}
    if(ev.target.closest('#cdBack')){$('#ovB').onclick=null;codexArmed=false;titleScreen();return}
    if(ev.target.closest('#cdReset')){
      if(!codexArmed){codexArmed=true;showCodex();return}
      codexArmed=false;codex=codexEmpty();codexRebuild();codexSave();showCodex();
    }
  };
}
