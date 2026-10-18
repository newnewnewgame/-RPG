/* ===== 敵・階層まわり =====
   敵のイラスト(SVG)、階層の名前、敵のステータスと行動パターン、HP・攻撃力の伸び方。
   敵を足したいときは ENEMIES に1行足す（1層ぶん＝FLOORS÷層の数、の並びで書く）。 */
/* ===== 敵のイラスト(SVG) ===== */
function crown(x,y,s){return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-24 0 L-20 -26 L-8 -12 L0 -32 L8 -12 L20 -26 L24 0 Z" fill="#ffd24a" stroke="#a87400" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-10" r="3.5" fill="#e23b4e"/></g>`}
function slimeSVG(c,d,o={}){const sc=o.scale||1,w=Math.round(150*sc);
  return `<svg viewBox="0 0 160 160" width="${w}" height="${w}" role="img" aria-label="スライム">
  <ellipse cx="80" cy="142" rx="58" ry="9" fill="rgba(0,0,0,.35)"/>
  <path d="M18 134 C10 88 42 38 80 38 C118 38 150 88 142 134 Q80 148 18 134Z" fill="${c}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="54" cy="68" rx="14" ry="8" fill="#fff" opacity=".55" transform="rotate(-35 54 68)"/>
  <ellipse cx="62" cy="98" rx="8" ry="11" fill="#14162b"/><ellipse cx="98" cy="98" rx="8" ry="11" fill="#14162b"/>
  <circle cx="65" cy="94" r="3" fill="#fff"/><circle cx="101" cy="94" r="3" fill="#fff"/>
  <path d="M68 118 Q80 128 92 118" stroke="#14162b" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  ${o.crown?crown(80,40,1.1):''}</svg>`}
function goblinSVG(skin,dark,o={}){const sc=o.scale||1,w=Math.round(150*sc);
  return `<svg viewBox="0 0 160 160" width="${w}" height="${w}" role="img" aria-label="ゴブリン">
  <ellipse cx="80" cy="150" rx="52" ry="8" fill="rgba(0,0,0,.35)"/>
  ${o.cape?'<path d="M20 154 L46 110 L114 110 L140 154 Z" fill="#a82832" stroke="#5a1118" stroke-width="3" stroke-linejoin="round"/>':''}
  <path d="M42 152 Q44 118 80 116 Q116 118 118 152 Z" fill="#7b5632" stroke="#46301b" stroke-width="3"/>
  <polygon points="44,84 6,62 40,110" fill="${skin}" stroke="${dark}" stroke-width="4" stroke-linejoin="round"/>
  <polygon points="116,84 154,62 120,110" fill="${skin}" stroke="${dark}" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="80" cy="84" rx="40" ry="42" fill="${skin}" stroke="${dark}" stroke-width="4"/>
  <ellipse cx="64" cy="80" rx="9" ry="7" fill="#fff6c8"/><ellipse cx="96" cy="80" rx="9" ry="7" fill="#fff6c8"/>
  <circle cx="66" cy="81" r="3.5" fill="#c1121f"/><circle cx="94" cy="81" r="3.5" fill="#c1121f"/>
  <path d="M52 67 L74 76" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><path d="M108 67 L86 76" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
  <path d="M80 86 L75 99 L85 99 Z" fill="${dark}" opacity=".6"/>
  <path d="M60 108 Q80 122 100 108 Z" fill="#3b1d14" stroke="#2b1a10" stroke-width="3" stroke-linejoin="round"/>
  <path d="M67 110 L72 120 L76 111Z" fill="#fff"/><path d="M93 110 L88 120 L84 111Z" fill="#fff"/>
  ${o.helmet?'<path d="M39 82 Q36 30 80 30 Q124 30 121 82 L108 70 Q80 58 52 70 Z" fill="#9aa4b6" stroke="#4a5365" stroke-width="4" stroke-linejoin="round"/><rect x="76" y="38" width="8" height="30" rx="2" fill="#7e889b"/>':''}
  ${o.crown?crown(80,50,1.15):''}</svg>`}

function skeletonSVG(bone,dark,o={}){const sc=o.scale||1,w=Math.round(150*sc),eye=o.eye||'#7cf5ff';
  return `<svg viewBox="0 0 160 160" width="${w}" height="${w}" role="img" aria-label="骸骨">
  <ellipse cx="80" cy="150" rx="52" ry="8" fill="rgba(0,0,0,.35)"/>
  ${o.cape?'<path d="M20 154 L46 110 L114 110 L140 154 Z" fill="#4b2a7a" stroke="#241040" stroke-width="3" stroke-linejoin="round"/>':''}
  <path d="M48 152 Q50 120 80 116 Q110 120 112 152 Z" fill="${bone}" stroke="${dark}" stroke-width="3"/>
  <path d="M60 130 H100 M58 141 H102" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="80" cy="76" rx="36" ry="38" fill="${bone}" stroke="${dark}" stroke-width="4"/>
  <rect x="58" y="98" width="44" height="20" rx="6" fill="${bone}" stroke="${dark}" stroke-width="4"/>
  <path d="M67 99 V117 M76 99 V117 M84 99 V117 M93 99 V117" stroke="${dark}" stroke-width="3"/>
  <ellipse cx="65" cy="76" rx="10" ry="12" fill="#14162b"/><ellipse cx="95" cy="76" rx="10" ry="12" fill="#14162b"/>
  <circle cx="65" cy="78" r="3.5" fill="${eye}"/><circle cx="95" cy="78" r="3.5" fill="${eye}"/>
  <path d="M80 88 L75 98 L85 98 Z" fill="#14162b"/>
  ${o.helmet?'<path d="M42 76 Q40 26 80 26 Q120 26 118 76 L106 64 Q80 52 54 64 Z" fill="#6b7385" stroke="#2f3544" stroke-width="4" stroke-linejoin="round"/><rect x="76" y="34" width="8" height="28" rx="2" fill="#4f576a"/>':''}
  ${o.crown?crown(80,44,1.15):''}</svg>`}
function ghostSVG(o={}){const sc=o.scale||1,w=Math.round(150*sc);
  return `<svg viewBox="0 0 160 160" width="${w}" height="${w}" role="img" aria-label="ゴースト">
  <ellipse cx="80" cy="150" rx="46" ry="7" fill="rgba(0,0,0,.25)"/>
  <path d="M28 142 C18 62 46 22 80 22 C114 22 142 62 132 142 L116 126 L100 144 L80 126 L60 144 L44 126 Z" fill="#e9f0ff" fill-opacity=".93" stroke="#8fa6d6" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="62" cy="76" rx="9" ry="13" fill="#1b2140"/><ellipse cx="98" cy="76" rx="9" ry="13" fill="#1b2140"/>
  <ellipse cx="80" cy="106" rx="9" ry="12" fill="#1b2140"/></svg>`}

/* ===== 階層 ===== */
const LAYERS=[
 {name:'スライムの洞窟',cls:''},
 {name:'ゴブリンの砦',cls:'l2'},
 {name:'亡者の墓所',cls:'l3'},
 {name:'雷鳴の遺跡',cls:'l4'},
];
const FLOORS=20;                      // 1段階ぶんの階数。ここを超えるとインフレ（エンドレス）
const SHOP_AFTER=[2,4,7,9,12,14,17,19];   // この階を突破したあとにお店が開く（20階ごとに繰り返す）
const shopAfter=f=>SHOP_AFTER.includes(((f-1)%FLOORS)+1);
const tierOf=i=>Math.floor(i/FLOORS);
const TIER_PREFIX=['','深層の','最深層の','狂乱の','無限の'];
const tierPrefix=i=>TIER_PREFIX[Math.min(tierOf(i),TIER_PREFIX.length-1)];

/* ===== 敵データ（HP・攻撃力は階数から自動計算。hm/amは個性の倍率） ===== */
const ENEMIES=[
 // 第1層：スライムの洞窟
 {name:'スライム',pat:[{n:'体当たり',m:1}],art:()=>slimeSVG('#5fd38d','#2c7a52')},
 {name:'ビッグスライム',hm:1.1,pat:[{n:'体当たり',m:1},{n:'体当たり',m:1},{n:'のしかかり',m:1.5}],art:()=>slimeSVG('#66b8f0','#2b6aa3',{scale:1.12})},
 {name:'ポイズンスライム',pat:[{n:'体当たり',m:1},{n:'毒液',m:1.4}],art:()=>slimeSVG('#b4d94c','#5a7a1a')},
 {name:'ゴールドスライム',am:.9,goldx:3,pat:[{n:'ぷるぷる震えている',m:0},{n:'体当たり',m:1.3}],art:()=>slimeSVG('#ffd24a','#a87400',{scale:1.05})},
 {name:'キングスライム',boss:true,hm:2.4,am:1.3,pat:[{n:'体当たり',m:1},{n:'体当たり',m:1},{n:'王の圧し潰し',m:1.8}],art:()=>slimeSVG('#b98cf0','#6a3ba8',{crown:true,scale:1.22})},
 // 第2層：ゴブリンの砦
 {name:'ゴブリン',pat:[{n:'こん棒',m:1}],art:()=>goblinSVG('#7fbf4d','#3d6b22')},
 {name:'ゴブリンアーチャー',pat:[{n:'矢を放つ',m:1.2},{n:'矢を放つ',m:1.2},{n:'狙いを定めている',m:0},{n:'必中の一矢',m:2}],art:()=>goblinSVG('#9ccf63','#4c7a2b')},
 {name:'ゴブリンソルジャー',pat:[{n:'斬りつけ',m:1},{n:'盾を構えている',m:0},{n:'渾身の一撃',m:1.6}],art:()=>goblinSVG('#6aa84a','#335c1f',{helmet:true,scale:1.08})},
 {name:'ゴブリンシャーマン',pat:[{n:'火の玉',m:1.3},{n:'火の玉',m:1.3},{n:'大火球',m:2}],art:()=>goblinSVG('#7aa7d9','#2d5a8f',{scale:1.05})},
 {name:'ゴブリンキング',boss:true,hm:2.4,am:1.3,pat:[{n:'こん棒',m:1},{n:'こん棒',m:1},{n:'大振り',m:2}],art:()=>goblinSVG('#4f8f3a','#2a5218',{crown:true,cape:true,scale:1.2})},
 // 第3層：亡者の墓所
 {name:'スケルトン',pat:[{n:'骨の斬撃',m:1}],art:()=>skeletonSVG('#e6e2d2','#6b6552')},
 {name:'ゴースト',pat:[{n:'呪いの手',m:1.2},{n:'すり抜けている',m:0},{n:'怨念',m:1.8}],art:()=>ghostSVG({scale:1.05})},
 {name:'ガイコツ戦士',pat:[{n:'斬撃',m:1},{n:'斬撃',m:1},{n:'大斬り',m:1.8}],art:()=>skeletonSVG('#d8d4c2','#5f5a48',{helmet:true,scale:1.08})},
 {name:'デスナイト',pat:[{n:'暗黒剣',m:1.2},{n:'構えている',m:0},{n:'処刑の一撃',m:2.2}],art:()=>skeletonSVG('#c9c5d8','#4b4668',{helmet:true,cape:true,scale:1.12,eye:'#ff6b6b'})},
 {name:'リッチ',boss:true,hm:2.4,am:1.3,pat:[{n:'死の光',m:1},{n:'死の光',m:1.2},{n:'滅びの呪文',m:2.2}],art:()=>skeletonSVG('#c9b8f0','#4b2a7a',{crown:true,cape:true,scale:1.2,eye:'#ff7ad9'})},
 // 第4層：雷鳴の遺跡
 {name:'ストーンゴーレム',hm:1.35,am:1.1,pat:[{n:'岩の拳',m:1.1},{n:'身を固めている',m:0},{n:'地砕き',m:1.7}],art:()=>skeletonSVG('#b4bdc9','#596575',{helmet:true,scale:1.15,eye:'#8be9ff'})},
 {name:'雷スライム',pat:[{n:'放電',m:1.2},{n:'放電',m:1.2},{n:'雷撃',m:1.8}],art:()=>slimeSVG('#7de7f5','#287d9b',{scale:1.08})},
 {name:'遺跡の番人',hm:1.2,am:1.2,pat:[{n:'槍突き',m:1.2},{n:'盾を構えている',m:0},{n:'雷槍',m:2}],art:()=>goblinSVG('#a9b8c8','#46566c',{helmet:true,cape:true,scale:1.1})},
 {name:'古代の魔術師',hm:1.1,pat:[{n:'雷弾',m:1.3},{n:'魔力を集めている',m:0},{n:'天雷',m:2.1}],art:()=>ghostSVG({scale:1.18})},
 {name:'雷竜ヴォルテクス',boss:true,hm:2.8,am:1.45,pat:[{n:'かみつき',m:1.2},{n:'雷の息吹',m:1.6},{n:'轟雷ブレス',m:2.4}],art:()=>slimeSVG('#ffe16b','#a45c16',{crown:true,cape:true,scale:1.28})},
];
const tpl=i=>ENEMIES[i%FLOORS];
const growAt=(i,g1,g2,jump)=>i<FLOORS?Math.pow(g1,i):Math.pow(g1,FLOORS-1)*Math.pow(g2,i-FLOORS+1)*Math.pow(jump,tierOf(i));
const enemyHp=(i,t)=>Math.round(CFG.hp0*growAt(i,CFG.hpGrow,CFG.hpGrow2,CFG.hpJump)*(t.hm||1));
const enemyAtk=(i,t)=>Math.max(1,Math.round(CFG.atk0*growAt(i,CFG.atkGrow,CFG.atkGrow2,CFG.atkJump)*(t.am||1)));
