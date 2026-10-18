/* ===== データ表（Excel）の読み込みと組み立て =====
   data/equipment.xlsx（装備・スキル・ダイス）を読み、効果のプログラム（ITEM_FX・SKILL_FX）とくっつけて
   ゲームで使う ITEMS / SKILLS / DICE_T を作る。列は「1行目の見出しの名前」で判別するので、列の順番は変えてもよい。 */
const DATA_FILE='data/equipment.xlsx';
let ITEMS=[],ITEM_BY={},SKILLS=[],SKILL_BY={},ALL={},DICE_T={};
const DATA_WARNINGS=[];

const ITEM_PARAM_COLS={   // Excelの見出し → ゲーム内の項目名
  '出目の合計×':'sumMul','揃いボーナス2乗':'matchPow','行動回数+':'actions','勝利時MP+':'onWinMp','勝利ゴールド×':'goldMul',
  '致死耐え回数':'undying','待機ターン短縮':'cooldownReduce','戦闘中ダイス+':'battleDice','MP消費軽減':'mpDiscount',
  'シールド×':'shieldMul','回避率(0〜1)':'dodge','毒ダメージ×':'poisonMul','反射ダメージ×':'refMul','スキル威力×(例 meteor:2)':'skillMul',
  '攻撃時の状態異常':'statusOnHit','状態異常の強さ(与ダメ×)':'statusPower','付与確率(0〜1)':'statusChance',
};
const STATUS_FROM_JP={'毒':'poison','火傷':'burn','出血':'bleed','スタン':'stun','凍結':'freeze','弱体':'weaken','弱点看破':'vulnerable'};
const SLOT_FROM_JP={'武器':'weapon','防具':'armor','アクセ':'acc','アクセサリー':'acc','weapon':'weapon','armor':'armor','acc':'acc'};
const TYPE_FROM_JP={'スキル':'atk','攻撃':'atk','atk':'atk','魔法':'mag','まほう':'mag','mag':'mag'};

const warn=msg=>{DATA_WARNINGS.push(msg);console.warn('[データ表] '+msg)};
const blank=v=>v===undefined||v===null||(typeof v==='string'&&v.trim()==='');
const str=v=>blank(v)?'':String(v).trim();
const num=v=>{if(blank(v))return undefined;const n=Number(v);return Number.isFinite(n)?n:undefined};
const truthy=v=>v===true||(!blank(v)&&/^(○|〇|◯|1|true|yes|y|はい)$/i.test(String(v).trim()));

// シートを「見出し名→値」の行リストにする（IDが空の行は無視）
function sheetRows(T,name){
  const rows=T[name];
  if(!rows||!rows.length)throw new Error(`シート「${name}」が見つかりません`);
  const head=(rows[0]||[]).map(h=>blank(h)?'':String(h).trim());
  const out=[];
  rows.slice(1).forEach((r,i)=>{
    const o={_row:i+2};
    head.forEach((h,c)=>{if(h&&!blank(r[c]))o[h]=r[c]});
    if(!blank(o['ID']))out.push(o);
  });
  return out;
}
function parseFaces(v,where){
  const out=[];
  for(const tok of String(v==null?'':v).split(/[,\s、，]+/).filter(Boolean)){
    const m=tok.match(/^(\d+)[-〜~](\d+)$/);
    if(m){for(let n=+m[1];n<=+m[2];n++)out.push(n)}
    else if(/^\d+$/.test(tok))out.push(+tok);
    else warn(`${where}：出る目「${tok}」は数字ではありません`);
  }
  return out;
}
function parseSkillMul(v,where){
  const o={};
  for(const tok of String(v).split(/[,\s、，]+/).filter(Boolean)){
    const m=tok.match(/^([A-Za-z0-9_]+)[:：]([0-9.]+)$/);
    if(m)o[m[1]]=+m[2];else warn(`${where}：スキル威力「${tok}」は「スキルID:倍率」の形で書いてください`);
  }
  return Object.keys(o).length?o:undefined;
}

function buildData(T){
  DATA_WARNINGS.length=0;
  // --- ダイス
  const dice={},seen=new Set();
  for(const r of sheetRows(T,'ダイス')){
    const id=str(r['ID']),where=`ダイス ${r._row}行目(${id})`;
    if(seen.has(id)){warn(`${where}：IDが重複しています（無視）`);continue}
    seen.add(id);
    const faces=parseFaces(r['出る目(カンマ区切り)'],where);
    if(!faces.length){warn(`${where}：出る目が空のため無視します`);continue}
    dice[id]={name:str(r['名前'])||id,tag:str(r['表示']),faces,price:num(r['価格'])||0,desc:str(r['説明'])};
  }
  if(!dice.normal)throw new Error('ダイスシートに「normal」（ふつうのダイス）が必要です');
  // --- 装備
  const items=[];seen.clear();
  for(const r of sheetRows(T,'装備')){
    const id=str(r['ID']),where=`装備 ${r._row}行目(${id})`;
    if(seen.has(id)){warn(`${where}：IDが重複しています（無視）`);continue}
    seen.add(id);
    const slot=SLOT_FROM_JP[str(r['枠'])];
    if(!slot){warn(`${where}：枠「${str(r['枠'])}」は 武器／防具／アクセ のどれかにしてください（無視）`);continue}
    const it={id,slot,name:str(r['名前'])||id,price:num(r['価格'])||0,desc:str(r['説明'])};
    const rar=str(r['レア度']);
    if(rar==='レア')it.rare=true;else if(rar==='伝説')it.leg=true;else if(rar&&rar!=='通常')warn(`${where}：レア度「${rar}」は 通常／レア／伝説 のどれかにしてください`);
    for(const [col,key] of Object.entries(ITEM_PARAM_COLS)){
      const v=r[col];if(blank(v))continue;
      if(key==='matchPow'){if(truthy(v))it.matchPow=true}
      else if(key==='skillMul'){const m=parseSkillMul(v,where);if(m)it.skillMul=m}
      else if(key==='statusOnHit'){const k=STATUS_FROM_JP[str(v)];if(k)it.statusOnHit=k;else warn(`${where}：状態異常「${str(v)}」は 毒／火傷／出血／スタン／凍結／弱体／弱点看破 のどれかにしてください`)}
      else if(key==='statusChance'){const n=num(v);if(n===undefined||n<0)warn(`${where}：「${col}」は0〜1の数字にしてください`);else it.statusChance=n>1?n/100:n}
      else{const n=num(v);if(n===undefined)warn(`${where}：「${col}」は数字にしてください`);else it[key]=n}
    }
    items.push(Object.assign(it,ITEM_FX[id]||{}));
  }
  for(const id of Object.keys(ITEM_FX))if(!seen.has(id))warn(`装備の効果「${id}」に対応する行が、装備シートにありません`);
  if(!items.length)throw new Error('装備シートにデータがありません');
  // --- スキル
  const skills=[];seen.clear();
  for(const r of sheetRows(T,'スキル')){
    const id=str(r['ID']),where=`スキル ${r._row}行目(${id})`;
    if(seen.has(id)){warn(`${where}：IDが重複しています（無視）`);continue}
    seen.add(id);
    const type=TYPE_FROM_JP[str(r['種別'])];
    if(!type){warn(`${where}：種別「${str(r['種別'])}」は スキル／魔法 のどちらかにしてください（無視）`);continue}
    const calc=SKILL_FX[id];
    if(!calc){warn(`${where}：効果のプログラムがないため、このスキルは使えません（無視）`);continue}
    const s={id,type,name:str(r['名前'])||id,desc:str(r['説明'])};
    const mp=num(r['MP']);if(mp!==undefined)s.mp=mp;
    if(!blank(r['必要条件(使えない時の表示)']))s.need=str(r['必要条件(使えない時の表示)']);
    s.calc=calc;s.cd=num(r['待機ターン'])||0;
    skills.push(s);
  }
  for(const id of Object.keys(SKILL_FX))if(!seen.has(id))warn(`スキルの効果「${id}」に対応する行が、スキルシートにありません`);
  if(!skills.length)throw new Error('スキルシートにデータがありません');
  // --- 反映
  DICE_T=dice;ITEMS=items;SKILLS=skills;
  ITEM_BY=Object.fromEntries(ITEMS.map(i=>[i.id,i]));
  SKILL_BY=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
  ALL=Object.fromEntries([...BASE,...SKILLS].map(s=>[s.id,s]));
}

async function loadData(){
  let res;
  try{res=await fetch(DATA_FILE,{cache:'no-cache'})}
  catch(err){throw new Error('ファイルを読み込めませんでした。index.html を直接ダブルクリックで開いていませんか？ GitHub Pages か、ローカルサーバー（python -m http.server など）で開いてください。')}
  if(!res.ok)throw new Error(`${DATA_FILE} を読み込めません（HTTP ${res.status}）。ファイルの場所と名前を確認してください。`);
  buildData(await readXlsx(await res.arrayBuffer()));
}
async function bootGame(){
  showOv('ちいさな迷宮 ダイス版','データを読み込み中…','');
  try{await loadData()}
  catch(err){
    console.error(err);
    showOv('データを読み込めませんでした',String(err.message||err),'<button class="card go" id="reloadBtn"><span class="ct" style="justify-content:center"><b>再読み込み</b></span></button>');
    $('#reloadBtn').onclick=()=>location.reload();
    return;
  }
  titleScreen();
}
// タイトル画面の下に出す、データ表の警告（あれば）
const dataWarnNote=()=>DATA_WARNINGS.length?`<p class="sub" style="margin:10px 0 0;color:var(--exp)">データ表に注意が${DATA_WARNINGS.length}件あります：${DATA_WARNINGS.slice(0,3).join(' ／ ')}${DATA_WARNINGS.length>3?' ほか（詳しくはブラウザのコンソール）':''}</p>`:'';
