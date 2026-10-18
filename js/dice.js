/* ===== ダイスの集計 =====
   ダイスの種類そのもの（名前・目・価格・説明）は data/equipment.xlsx の「ダイス」シートで編集する。
   ここには、出目の集計（スキルや装備が見る P の中身）と、特殊ダイスの効果計算が入っている。 */
const R6=[1,2,3,4,5,6];
/* ===== ダイスの集計（スキルはこれを見て威力が決まる） ===== */
const matchBonus=(M,jack)=>{const b=M<=1?1:M===2?1.3:M===3?1.6:M===4?2:2+0.5*(M-4);return jack?Math.max(b*1.5,3):b};   // 揃いボーナスに上限なし（5個以上は1個ごとに+0.5）
function pool(){
  const cnt={};let S=0,sumHigh=0,sumOdd=0,odd=0,high=0,even=0;
  for(const d of p.dice){
    cnt[d.v]=(cnt[d.v]||0)+1;
    const w=d.v*(d.t==='fire'?2:d.t==='ice'&&d.v<=3?2:d.t==='thunder'&&d.v%2===0?2:d.t==='poison'&&d.v%2===1?2:1);
    S+=w;
    if(d.v>=4){sumHigh+=w;high++}
    if(d.v%2===1){sumOdd+=w;odd++}else even++;
  }
  const faces=Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  let M=0;faces.forEach(f=>{M=Math.max(M,cnt[f])});
  const N=p.dice.length,jack=N>=3&&faces.length===1;
  let run=0,best=0,prev=null;
  faces.forEach(f=>{run=(prev!==null&&f===prev+1)?run+1:1;best=Math.max(best,run);prev=f});
  const pairs=faces.filter(f=>cnt[f]>=2).length;
  const eqs=p.equip?equipped():[];
  const sm=eqs.reduce((m,it)=>m*(it.sumMul||1),1);
  let mult=matchBonus(M,jack);
  if(eqs.some(it=>it.matchPow))mult=+(mult*mult).toFixed(2);
  return {cnt,S:R(S*sm),N,M,mult,jack,run:best,pairs,high,sumHigh:R(sumHigh*sm),odd,sumOdd:R(sumOdd*sm),even};
}
const tallyText=()=>{const P=pool();return Object.keys(P.cnt).map(Number).sort((a,b)=>a-b).map(f=>`${f}×${P.cnt[f]}`).join(' ')};
