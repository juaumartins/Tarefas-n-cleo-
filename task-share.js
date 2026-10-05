'use strict';
const TASK_SHARE_COLORS={low:{fill:'#dcfce7',edge:'#15803d',label:'Baixa — verde'},medium:{fill:'#fef3c7',edge:'#b77909',label:'Média — amarelo'},high:{fill:'#fee2e2',edge:'#dc2626',label:'Alta — vermelho'}};
let taskShareFiles=[],taskShareUrls=[],taskShareSequence=0;
function shareFileName(name,fallback='tarefa'){
 return String(name||fallback).normalize('NFC').replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g,'-').trim().slice(0,100)||fallback;
}
function shareLines(ctx,text,width){
 const result=[];
 for(const paragraph of String(text||'').replace(/\r\n?/g,'\n').replace(/\n{3,}/g,'\n\n').split('\n')){
  if(!paragraph.trim()){result.push('');continue;}
  let line='';
  for(const word of paragraph.trim().split(/\s+/)){
   if(ctx.measureText(word).width>width){
    if(line){result.push(line);line='';}
    for(const character of word){if(line&&ctx.measureText(line+character).width>width){result.push(line);line='';}line+=character;}
   }else if(line&&ctx.measureText(line+' '+word).width>width){result.push(line);line=word;}
   else line+=(line?' ':'')+word;
  }
  if(line)result.push(line);
 }
 return result;
}
function shareRoundRect(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
async function makeTaskShareCards(task,photoCount){
 const width=1200,measure=document.createElement('canvas');measure.width=width;
 const m=measure.getContext('2d');if(!m)throw Error('canvas');
 m.font='600 32px system-ui, sans-serif';const titleLines=shareLines(m,task.title,720);
 m.font='24px system-ui, sans-serif';const description=String(task.description||'').trim();
 const notes=description?shareLines(m,description,1080):[];
 const rowHeight=Math.max(160,72+titleLines.length*42),fixedHeight=350+rowHeight;
 const linesPerPage=Math.max(10,Math.floor((1800-fixedHeight)/34));
 const pages=Math.max(1,Math.ceil(notes.length/linesPerPage)),files=[];
 const palette=TASK_SHARE_COLORS[task.priority]||{fill:'#ffffff',edge:'#b3bfd3',label:'Não definida'};
 for(let page=0;page<pages;page++){
  const chunk=notes.slice(page*linesPerPage,(page+1)*linesPerPage),canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=Math.max(540,fixedHeight+chunk.length*34);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f4f6fb';ctx.fillRect(0,0,width,canvas.height);
  shareRoundRect(ctx,40,34,54,54,14,'#183bdb');ctx.strokeStyle='white';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(54,60);ctx.lineTo(64,71);ctx.lineTo(80,49);ctx.stroke();
  ctx.fillStyle='#16233d';ctx.font='700 34px system-ui, sans-serif';ctx.fillText('Tarefas',112,73);
  ctx.font='20px system-ui, sans-serif';ctx.fillStyle='#64718a';ctx.fillText('CHECKLIST COMPARTILHADO',40,124);
  const y=150;shareRoundRect(ctx,40,y,1120,rowHeight,16,palette.fill);ctx.fillStyle=palette.edge;ctx.fillRect(40,y+14,5,rowHeight-28);
  ctx.strokeStyle=task.done?'#183bdb':'#52617a';ctx.lineWidth=3;ctx.strokeRect(70,y+38,32,32);
  if(task.done){ctx.fillStyle='#183bdb';ctx.fillRect(70,y+38,32,32);ctx.strokeStyle='white';ctx.beginPath();ctx.moveTo(77,y+54);ctx.lineTo(84,y+62);ctx.lineTo(96,y+46);ctx.stroke();}
  ctx.fillStyle='#16233d';ctx.font='600 32px system-ui, sans-serif';
  titleLines.forEach((line,i)=>{const ty=y+56+i*42;ctx.fillText(line,130,ty);if(task.done){ctx.strokeStyle='#52617a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(130,ty-10);ctx.lineTo(130+ctx.measureText(line).width,ty-10);ctx.stroke();}});
  ctx.font='20px system-ui, sans-serif';ctx.fillStyle='#35445c';ctx.fillText('Prioridade '+palette.label.toLowerCase(),130,y+rowHeight-25);
  shareRoundRect(ctx,916,y+30,210,48,8,task.done?'#e8f5ee':'#edf1ff');ctx.fillStyle=task.done?'#217352':'#3152b6';ctx.font='500 24px system-ui, sans-serif';ctx.fillText(task.done?'Realizada':'A fazer',936,y+63);
  let cursor=y+rowHeight+46;
  ctx.fillStyle='#16233d';ctx.font='600 26px system-ui, sans-serif';ctx.fillText(page?'Informações — continuação':'Informações da tarefa',40,cursor);cursor+=40;
  ctx.font='24px system-ui, sans-serif';ctx.fillStyle='#43526c';
  if(chunk.length){for(const line of chunk){ctx.fillText(line,40,cursor);cursor+=34;}}
  else{ctx.fillText('Sem informações adicionais.',40,cursor);cursor+=34;}
  ctx.font='20px system-ui, sans-serif';ctx.fillStyle='#52617a';ctx.fillText(photoCount+' foto(s) original(is) anexada(s) separadamente',40,canvas.height-86);
  const created=new Date(task.created_at);ctx.fillText(Number.isNaN(created.getTime())?'':('Criada em '+created.toLocaleDateString('pt-BR')),40,canvas.height-52);
  ctx.font='16px system-ui, sans-serif';ctx.fillStyle='#64718a';ctx.fillText('tarefas-nucleo.vercel.app · Imagem do momento do compartilhamento'+(pages>1?' · '+(page+1)+'/'+pages:''),40,canvas.height-23);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('canvas')),'image/png'));
  files.push(new File([blob],'Tarefa-'+shareFileName(task.title)+(pages>1?'-'+(page+1):'')+'.png',{type:'image/png'}));
  // Libera o buffer de pixels antes de preparar a pagina seguinte.
  canvas.width=1;canvas.height=1;
 }
 return files;
}
function clearTaskShare(){
 taskShareSequence++;taskShareFiles=[];for(const url of taskShareUrls)URL.revokeObjectURL(url);taskShareUrls=[];
 $('share-preview').replaceChildren();$('share-zip-link').replaceChildren();$('share-send').disabled=true;$('share-download-all').disabled=true;
}
function taskShareIsCurrent(sequence,owner,expected){return sequence===taskShareSequence&&user?.id===owner&&epoch===expected&&$('share-dialog').open;}
async function prepareTaskShare(){
 if(!detailTask||!user)return;
 if(detailDirty){toast('Salve as informações da tarefa antes de compartilhar.');return;}
 if(photoBusy||busy){toast('Aguarde terminar de salvar a tarefa ou as fotos.');return;}
 const task={...(tasks.find(t=>t.id===detailTask.id)||detailTask)},owner=user.id,expected=epoch;
 clearTaskShare();const sequence=taskShareSequence;
 $('share-heading').textContent='Compartilhar tarefa';$('share-result').textContent='Preparando a imagem e as fotos originais…';$('share-retry').hidden=true;open('share-dialog');
 try{
  const metadata=await client.from('checklist_task_photos').select('*').eq('task_id',task.id).order('created_at');
  if(metadata.error&&!requiresPhotoSetup(metadata.error))throw metadata.error;
  const photos=metadata.data||[],originalFiles=[];
  for(let i=0;i<photos.length;i++){
   if(!taskShareIsCurrent(sequence,owner,expected))return;
   $('share-result').textContent='Carregando foto '+(i+1)+' de '+photos.length+'…';
   const {data,error}=await client.storage.from('checklist-photos').download(photos[i].path);
   if(error||!data)throw error||Error('photo');
   if(!['image/jpeg','image/png','image/webp'].includes(data.type))throw Error('photo_type');
   const ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[data.type];
   const name=shareFileName(photos[i].name,'foto').replace(/\.(jpe?g|png|webp)$/i,'').slice(0,80);
   originalFiles.push(new File([data],String(i+1).padStart(2,'0')+'-'+name+ext,{type:data.type}));
  }
  const cards=await makeTaskShareCards(task,photos.length);
  if(!taskShareIsCurrent(sequence,owner,expected))return;
  taskShareFiles=[...cards,...originalFiles];
  for(let i=0;i<taskShareFiles.length;i++){
   const file=taskShareFiles[i],url=URL.createObjectURL(file);taskShareUrls.push(url);
   const figure=document.createElement('figure');figure.className='share-file';
   const img=document.createElement('img');img.src=url;img.alt=i<cards.length?'Imagem da tarefa '+(i+1):file.name;img.loading='lazy';
   const caption=document.createElement('figcaption');caption.textContent=i<cards.length?'Imagem da tarefa'+(cards.length>1?' '+(i+1):''):'Foto original: '+file.name;
   const download=document.createElement('a');download.href=url;download.download=file.name;download.textContent='Baixar este arquivo';figure.append(img,caption,download);$('share-preview').append(figure);
  }
  const supported=typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:taskShareFiles});
  $('share-send').disabled=!supported;$('share-download-all').disabled=false;
  $('share-result').textContent=cards.length+' imagem(ns) da tarefa + '+photos.length+' foto(s) original(is). '+(supported?'Toque em Compartilhar e escolha WhatsApp.':'Este navegador não compartilha este conjunto de arquivos. Baixe os arquivos e anexe no WhatsApp.');
  $('share-heading').textContent=task.title;
 }catch(error){
  if(!taskShareIsCurrent(sequence,owner,expected))return;
  $('share-result').textContent='Não foi possível preparar todos os arquivos. Nenhum compartilhamento foi iniciado. Confira a conexão e tente novamente.';
  $('share-retry').hidden=false;
 }
}
$('share-task').onclick=prepareTaskShare;$('share-retry').onclick=prepareTaskShare;
$('share-dialog').addEventListener('close',clearTaskShare);
$('share-send').onclick=async()=>{
 if(!taskShareFiles.length||!user)return;
 const files=taskShareFiles.slice(),sequence=taskShareSequence;$('share-send').disabled=true;
 try{
  // Os arquivos ja estao prontos: share() e chamado no toque, preservando a autorizacao do navegador.
  await navigator.share({files,title:'Tarefa da equipe'});
  if(sequence===taskShareSequence)$('share-result').textContent='Arquivos encaminhados ao aplicativo escolhido. Confirme o envio dentro do WhatsApp.';
 }catch(error){if(sequence===taskShareSequence)$('share-result').textContent=error.name==='AbortError'?'Compartilhamento cancelado.':'Não foi possível abrir o compartilhamento. Use Baixar todos e anexe os arquivos no WhatsApp.';}
 finally{if(sequence===taskShareSequence)$('share-send').disabled=false;}
};
// ZIP sem compressao: os bytes das fotos originais sao preservados.
const TASK_SHARE_CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{let crc=n;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);return crc>>>0;});
function shareCrc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=TASK_SHARE_CRC_TABLE[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
async function makeTaskShareZip(files){
 const local=[],central=[];let offset=0,centralSize=0;
 for(const file of files){
  const name=new TextEncoder().encode(file.name),bytes=new Uint8Array(await file.arrayBuffer()),crc=shareCrc32(bytes);
  if(offset+file.size>0xffffffff)throw Error('zip_size');
  const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);local.push(h,file);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);centralSize+=c.length;offset+=h.length+file.size;
 }
 if(files.length>65535||offset+centralSize>0xffffffff)throw Error('zip_size');
 const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 return new Blob([...local,...central,end],{type:'application/zip'});
}
$('share-download-all').onclick=async()=>{
 if(!taskShareFiles.length)return;const sequence=taskShareSequence,files=taskShareFiles.slice();$('share-download-all').disabled=true;
 try{
  const zip=await makeTaskShareZip(files);if(sequence!==taskShareSequence)return;
  const url=URL.createObjectURL(zip);taskShareUrls.push(url);const link=document.createElement('a');link.href=url;link.download='Tarefa-e-fotos.zip';link.textContent='Baixar Tarefa-e-fotos.zip';
  $('share-zip-link').replaceChildren(link);link.click();$('share-result').textContent='ZIP preparado. Extraia os arquivos para anexar as imagens no WhatsApp. O link abaixo permite baixar novamente.';
 }catch{$('share-result').textContent='Não foi possível baixar o conjunto. Use os links de cada arquivo.';}
 finally{if(sequence===taskShareSequence)$('share-download-all').disabled=false;}
};
// Fecha a previa e descarta arquivos privados quando a sessao termina ou muda de conta.
const taskShareSessionChanged=sessionChanged;
sessionChanged=async function(session,expected){if(session?.user?.id!==user?.id){if($('share-dialog').open)$('share-dialog').close();clearTaskShare();}return taskShareSessionChanged(session,expected);};
