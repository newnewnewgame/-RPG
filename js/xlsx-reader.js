/* ===== 軽量 xlsx リーダー（外部ライブラリ不要）=====
   .xlsx は zip の中に XML が入ったファイル。ブラウザ標準の DecompressionStream と DOMParser だけで読む。
   readXlsx(ArrayBuffer) → { シート名: [ [セル,セル,...], ... ] }  （空のセルは undefined） */
async function inflateRaw(bytes){
  if(typeof DecompressionStream==='undefined')throw new Error('このブラウザは DecompressionStream に未対応です（新しいブラウザで開いてください）');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf);
  let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('xlsx（zip）として読めません');
  const count=dv.getUint16(eocd+10,true);let ptr=dv.getUint32(eocd+16,true);
  const dec=new TextDecoder('utf-8'),files={};
  for(let n=0;n<count;n++){
    if(dv.getUint32(ptr,true)!==0x02014b50)throw new Error('zipの構造が不正です');
    const method=dv.getUint16(ptr+10,true),csize=dv.getUint32(ptr+20,true);
    const nl=dv.getUint16(ptr+28,true),el=dv.getUint16(ptr+30,true),cl=dv.getUint16(ptr+32,true),off=dv.getUint32(ptr+42,true);
    const name=dec.decode(u8.subarray(ptr+46,ptr+46+nl));
    ptr+=46+nl+el+cl;
    const start=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true);
    const data=u8.subarray(start,start+csize);
    files[name]={method,data};
  }
  const read=async name=>{
    const f=files[name];if(!f)return null;
    const bytes=f.method===0?f.data:f.method===8?await inflateRaw(f.data):null;
    if(!bytes)throw new Error('未対応の圧縮方式です: '+name);
    return dec.decode(bytes);
  };
  return {read,has:n=>!!files[n]};
}
const parseXml=s=>new DOMParser().parseFromString(s,'application/xml');
const colIndex=ref=>{let n=0;for(const ch of ref.replace(/[0-9]/g,''))n=n*26+ch.charCodeAt(0)-64;return n-1};
async function readXlsx(buf){
  const z=await unzip(buf);
  // 共有文字列（ふりがな<rPh>は除く）
  const shared=[];
  const ssXml=await z.read('xl/sharedStrings.xml');
  if(ssXml){
    for(const si of parseXml(ssXml).getElementsByTagName('si')){
      let t='';
      for(const x of si.getElementsByTagName('t')){if(x.parentNode.nodeName!=='rPh')t+=x.textContent}
      shared.push(t);
    }
  }
  // シート名 → ファイル
  const wb=parseXml(await z.read('xl/workbook.xml'));
  const rels=parseXml(await z.read('xl/_rels/workbook.xml.rels'));
  const target={};
  for(const r of rels.getElementsByTagName('Relationship')){
    let t=r.getAttribute('Target');t=t.startsWith('/')?t.slice(1):'xl/'+t;
    target[r.getAttribute('Id')]=t;
  }
  const out={};
  for(const sh of wb.getElementsByTagName('sheet')){
    const path=target[sh.getAttribute('r:id')];
    const xml=path&&await z.read(path);
    if(!xml)continue;
    const rows=[];
    for(const row of parseXml(xml).getElementsByTagName('row')){
      const ri=(+row.getAttribute('r'))-1,arr=[];
      for(const c of row.getElementsByTagName('c')){
        const t=c.getAttribute('t'),vEl=c.getElementsByTagName('v')[0];
        let v;
        if(t==='inlineStr'){v='';for(const x of c.getElementsByTagName('t')){if(x.parentNode.nodeName!=='rPh')v+=x.textContent}}
        else if(!vEl||vEl.textContent==='')continue;
        else if(t==='s')v=shared[+vEl.textContent];
        else if(t==='b')v=vEl.textContent==='1';
        else if(t==='str'||t==='e')v=vEl.textContent;
        else v=Number(vEl.textContent);
        arr[colIndex(c.getAttribute('r'))]=v;
      }
      rows[ri]=arr;
    }
    out[sh.getAttribute('name')]=Array.from(rows,r=>r||[]);
  }
  return out;
}
