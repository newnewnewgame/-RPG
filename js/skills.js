/* ===== スキル・魔法・パッシブ =====
   スキル/魔法の名前・MP・待機ターン・説明は data/equipment.xlsx、効果のプログラムは js/skills_fx.js。
   ここには、基本行動（こうげき・ぼうぎょ）とパッシブ、行動ボタンの表示用の処理が入っている。 */
/* ===== 行動：1ターンに「行動回数」ぶん、各スキル1回まで ===== */
const BASE=[
 {id:'attack',type:'base',name:'こうげき',desc:'合計×倍率のダメージ。',
  calc:P=>({ok:true,dmg:dmgOf(P.S*P.mult),note:`合計${fmt(P.S)} × 揃い${fmtM(P.mult)}`})},
 {id:'guard',type:'base',name:'ぼうぎょ',desc:'合計×倍率×0.6のシールド。',
  calc:P=>({ok:true,shield:Math.max(1,R(P.S*P.mult*.6)),isGuard:true,note:`合計${fmt(P.S)} × 揃い${fmtM(P.mult)} × 0.6`})},
];
const skDesc=s=>s.cd?`${s.desc}（使うと${s.cd}ターン使えない。次の階にも持ち越し）`:s.desc;

const PASSIVES=[
 {id:'mpstart',name:'魔力の泉',desc:'戦闘開始時にMPが4回復する。'},
 {id:'regen',name:'自然治癒',desc:'毎ターン終了時に、最大HPの3%回復する。'},
 {id:'dice',name:'ダイスの加護',desc:'ふつうのダイスが2個増える。'},
 {id:'power',name:'闘志',desc:'与えるダメージが20%増える。'},
 {id:'armor',name:'鉄の覚悟',desc:'受けるダメージが15%減る。'},
 {id:'reroll',name:'強運',desc:'1ターンの振り直し回数が1回増える。'},
 {id:'actions',name:'神速',desc:'1ターンの行動回数が1回増える。'},
 {id:'haste',name:'加速',desc:'スキルと魔法の待機ターンが1短くなる。'},
];
const PASSIVE_BY=Object.fromEntries(PASSIVES.map(s=>[s.id,s]));

function labelOf(r,P){
  const t=[];
  if(r.dmg)t.push(`ダメージ約${fmt(previewFinal(r.dmg,P))}`);
  if(r.poison)t.push(`毒${r.poison}×3`);
  if(r.freeze)t.push(e.boss?'攻撃半減':'凍結');
  if(r.drain)t.push('吸収');
  if(r.heal)t.push(`HP+${fmt(r.heal)}`);
  if(r.shield)t.push(`シールド${fmt(r.isGuard?guardFinal(r.shield,P).final:r.shield)}`);
  if(r.barrier)t.push(`バリア${fmt(r.barrier)}`);
  if(r.hpCost)t.push(`HP-${r.hpCost}`);
  if(r.dbl)t.push('次のダメージ×2');
  return t.join('・');
}
