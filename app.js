'use strict';
const $=id=>document.getElementById(id);
let detailTask=null,detailDirty=false,photoBusy=false,photosReady=false,photoRows=[],photoChannel=null,photoRefresh=null,photoLoadSeq=0;
let client=null,channel=null,user=null,tasks=[],filter='all',editing=null,deleting=null,busy=false,epoch=0,loadSeq=0,config=null,demo=true,toastTimer,refreshTimer;
const DEFAULT_CONNECTION = {"url": "https://sjpgicdhcvbnylgylzug.supabase.co", "key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcGdpY2RoY3ZibnlsZ3lsenVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MTkxOTgsImV4cCI6MjEwNjQ5NTE5OH0.phZvMGvH1LDW9dLNSHjnMWU2sCLNMQWYADI8004mb6k"};
config={...DEFAULT_CONNECTION};
try{const saved=JSON.parse(localStorage.getItem('checklist-connection'));if(saved?.url===DEFAULT_CONNECTION.url && saved.key===DEFAULT_CONNECTION.key)config=saved;}catch{}
const samples=[{id:'demo-1',title:'Definir as tarefas da semana',done:false},{id:'demo-2',title:'Conferir os materiais da equipe',done:false},{id:'demo-3',title:'Organizar a lista de prioridades',done:true}].map(t=>({...t,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}));
function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function setConnection(msg,live=false){$('connection').textContent=msg;$('connection').classList.toggle('live',live);}
function open(id){$(id).showModal();}
function readable(error){if(!navigator.onLine)return 'Sem internet. Reconecte para salvar.';if(error?.message?.includes('Invalid login'))return 'E-mail ou senha incorretos.';if(error?.code==='42501')return 'Sua conta não está autorizada. Adicione-a à equipe no Supabase.';if(error?.code==='42P01'||error?.code==='PGRST205')return 'Execute o script de configuração no Supabase antes de continuar.';return 'Não foi possível concluir. Verifique a conexão e a configuração do Supabase.';}
function render(){const done=tasks.filter(t=>t.done).length;$('todo-count').textContent=tasks.length-done;$('done-count').textContent=done;$('total-count').textContent=tasks.length;const shown=tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));$('row-count').textContent=shown.length+' tarefa'+(shown.length===1?'':'s');$('rows').replaceChildren();shown.forEach(t=>{const row=document.createElement('tr');row.className=t.done?'done':'';const c=document.createElement('td'),check=document.createElement('input');check.type='checkbox';check.checked=t.done;check.disabled=busy||(!demo&&!user);check.setAttribute('aria-label',(t.done?'Reabrir: ':'Concluir: ')+t.title);check.addEventListener('change',()=>changeTask(t,{done:check.checked}).catch(e=>toast(readable(e))));c.append(check);const title=document.createElement('td');title.className='task-name';const taskLink=document.createElement('button');taskLink.type='button';taskLink.className='task-open';taskLink.textContent=t.title;taskLink.setAttribute('aria-label','Abrir detalhes: '+t.title);taskLink.onclick=()=>openTaskDetails(t);title.append(taskLink);const status=document.createElement('td'),badge=document.createElement('span');badge.className='badge';badge.textContent=t.done?'Realizada':'A fazer';status.append(badge);const date=document.createElement('td');date.className='date';date.textContent=new Date(t.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});const actions=document.createElement('td'),wrap=document.createElement('div');wrap.className='row-actions';for(const [name,cls,fn] of [['Editar','quiet',()=>{editing=t;$('title').value=t.title;$('task-heading').textContent='Editar tarefa';$('save').textContent='Salvar alterações';$('task-error').textContent='';open('task-dialog');}],['Excluir','quiet remove',()=>{deleting=t;$('delete-title').textContent=t.title;$('delete-error').textContent='';open('delete-dialog');}]]){const b=document.createElement('button');b.textContent=name;b.className=cls;b.disabled=busy;b.setAttribute('aria-label',name+': '+t.title);b.addEventListener('click',fn);wrap.append(b);}actions.append(wrap);row.append(c,title,status,date,actions);$('rows').append(row);});$('empty').hidden=shown.length!==0;$('empty-text').textContent=!demo&&!user?'Entre na sua conta para ver as tarefas da equipe.':filter==='all'?'Adicione a primeira tarefa da equipe.':filter==='todo'?'Tudo concluído. Novas tarefas aparecerão aqui.':'As tarefas concluídas aparecerão aqui.';$('new').disabled=busy;$('logout').hidden=!user;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));syncDetails();}
function uiSession(){if(demo){$('notice').hidden=false;$('notice').firstChild.textContent='Você está na demonstração. As tarefas de teste somem ao recarregar. ';$('connect').textContent='Conectar ao Supabase';$('session-label').textContent='Modo de demonstração · nenhuma tarefa salva';setConnection('Demonstração');}else if(!user){$('notice').hidden=false;$('notice').firstChild.textContent='Conexão configurada. Entre para acessar a lista da equipe. ';$('connect').textContent='Entrar';$('session-label').textContent='Aguardando login';setConnection('Não conectado');}else{$('notice').hidden=true;$('session-label').textContent='Conectado como '+user.email;}render();}
async function loadTasks(expected=epoch){if(!client||!user)return;const seq=++loadSeq;const {data,error}=await client.from('checklist_tasks').select('*').order('created_at',{ascending:false}).order('id');if(expected!==epoch||seq!==loadSeq)return;if(error){toast(readable(error));return;}tasks=data;render();}
async function sessionChanged(session,expected){if(expected!==epoch)return;user=session?.user||null;if(!user&&$('details-dialog').open)$('details-dialog').close();if(channel){client.removeChannel(channel);channel=null;}tasks=[];uiSession();if(!user){if(!$('login-dialog').open)open('login-dialog');return;}setConnection('Conectando…');const {data,error}=await client.from('checklist_members').select('user_id').eq('user_id',user.id).maybeSingle();if(expected!==epoch)return;if(error||!data){setConnection('Acesso pendente');$('notice').hidden=false;$('notice').firstChild.textContent=error?readable(error)+' ':'Sua conta precisa ser autorizada na equipe. Consulte a configuração. ';$('connect').textContent='Ver configuração';return;}channel=client.channel('checklist-shared').on('postgres_changes',{event:'*',schema:'public',table:'checklist_tasks'},()=>loadTasks(expected)).subscribe(status=>{if(expected!==epoch)return;if(status==='SUBSCRIBED'){setConnection('Ao vivo',true);loadTasks(expected);}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){setConnection(navigator.onLine?'Reconectando…':'Sem internet');}});await loadTasks(expected);}
let authListener=null;
async function connectClient(){epoch++;const expected=epoch;if(authListener){authListener.unsubscribe();authListener=null;}if(client){await client.removeAllChannels();client.auth.stopAutoRefresh();}client=window.supabase.createClient(config.url,config.key);demo=false;user=null;tasks=[];uiSession();authListener=client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{if(expected===epoch)sessionChanged(session,expected).catch(e=>toast(readable(e)));},0);}).data.subscription;clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(navigator.onLine&&user)loadTasks(expected);},30000);}
function mustBeReady(){if(!demo&&!user){open('login-dialog');throw new Error('login');}if(!demo&&!navigator.onLine)throw new Error('offline');}
async function changeTask(t,patch){mustBeReady();if(busy)return;busy=true;render();try{if(demo){tasks=tasks.map(item=>item.id===t.id?{...item,...patch,updated_at:new Date().toISOString()}:item);}else{const {data,error}=await client.from('checklist_tasks').update(patch).eq('id',t.id).eq('updated_at',t.updated_at).select();if(error)throw error;if(!data.length){await loadTasks();throw new Error('conflict');}await loadTasks();}}catch(e){if(e.message==='conflict'){toast('Outra pessoa alterou esta tarefa. A lista foi atualizada; tente novamente.');throw e;}throw e;}finally{busy=false;render();}}
$('new').onclick=()=>{if(!demo&&!user){open('login-dialog');return;}editing=null;$('title').value='';$('task-heading').textContent='Nova tarefa';$('save').textContent='Adicionar tarefa';$('task-error').textContent='';open('task-dialog');};
$('task-form').onsubmit=async e=>{e.preventDefault();const title=$('title').value.trim();if(!title){$('task-error').textContent='Escreva uma tarefa.';return;}if(busy)return;$('save').disabled=true;$('task-error').textContent='';try{mustBeReady();if(editing){await changeTask(editing,{title});}else{busy=true;render();if(demo){tasks.unshift({id:crypto.randomUUID(),title,done:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});}else{const {error}=await client.from('checklist_tasks').insert({title});if(error)throw error;await loadTasks();}}$('task-dialog').close();toast(editing?'Tarefa atualizada.':'Tarefa adicionada.');}catch(err){$('task-error').textContent=err.message==='conflict'?'A tarefa mudou. Feche e abra a edição novamente.':readable(err);}finally{busy=false;$('save').disabled=false;render();}};
$('delete-form').onsubmit=async e=>{e.preventDefault();if(busy)return;$('delete-submit').disabled=true;$('delete-error').textContent='';try{mustBeReady();busy=true;render();if(demo){tasks=tasks.filter(t=>t.id!==deleting.id);}else{const photoQuery=await client.from('checklist_task_photos').select('path').eq('task_id',deleting.id);const paths=(photoQuery.data||[]).map(p=>p.path);const {data,error}=await client.from('checklist_tasks').delete().eq('id',deleting.id).eq('updated_at',deleting.updated_at).select();if(error)throw error;if(!data.length){await loadTasks();throw new Error('conflict');}if(paths.length){const cleanup=await client.storage.from('checklist-photos').remove(paths);if(cleanup.error)toast('Tarefa excluída. A limpeza das fotos no armazenamento ficou pendente.');}await loadTasks();}$('delete-dialog').close();toast('Tarefa excluída.');}catch(err){$('delete-error').textContent=err.message==='conflict'?'A tarefa mudou ou já foi excluída. Feche e confira a lista.':readable(err);}finally{busy=false;$('delete-submit').disabled=false;render();}};
function showConfig(){$('project-url').value=config?.url||'';$('project-key').value=config?.key||'';$('config-error').textContent='';open('config-dialog');}
$('settings').onclick=showConfig;$('connect').onclick=()=>{if(user||!config)showConfig();else open('login-dialog');};$('login-config').onclick=()=>{$('login-dialog').close();showConfig();};
$('config-form').onsubmit=async e=>{e.preventDefault();const url=$('project-url').value.trim().replace(/\/$/,''),key=$('project-key').value.trim();try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')||parsed.pathname!=='/')throw new Error('url');if(key.startsWith('sb_secret_'))throw new Error('secret');if(key.split('.').length===3){const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw new Error('secret');}else if(!key.startsWith('sb_publishable_'))throw new Error('key');config={url,key};localStorage.setItem('checklist-connection',JSON.stringify(config));await connectClient();$('config-dialog').close();open('login-dialog');}catch(err){$('config-error').textContent=err.message==='secret'?'Use uma chave pública publishable ou anon.':err.message==='url'?'Informe a URL HTTPS do seu projeto Supabase.':'Confira a chave pública e tente novamente.';}};
$('login-form').onsubmit=async e=>{e.preventDefault();$('login-error').textContent='';$('login-submit').disabled=true;try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;$('password').value='';$('login-dialog').close();}catch(err){$('login-error').textContent=readable(err);}finally{$('login-submit').disabled=false;}};
$('logout').onclick=async()=>{const {error}=await client.auth.signOut();if(error)toast(readable(error));};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>{if(!busy&&!photoBusy)b.closest('dialog').close();});document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{if(busy||photoBusy)e.preventDefault();}));document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
window.addEventListener('offline',()=>{if(!demo)setConnection('Sem internet');});window.addEventListener('online',()=>{if(user){setConnection('Reconectando…');loadTasks();}});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)loadTasks();});
function syncDetails(){
 if(!detailTask||!$('details-dialog').open)return;
 const current=tasks.find(t=>t.id===detailTask.id);
 if(!current){$('details-dialog').close();toast('Esta tarefa foi excluída.');return;}
 $('details-title').textContent=current.title;
 $('details-status').textContent=current.done?'Realizada':'A fazer';
 $('details-created').textContent='Criada em '+new Date(current.created_at).toLocaleString('pt-BR');
 if(!detailDirty){detailTask=current;$('details-description').value=current.description||'';}
}
async function openTaskDetails(task){
 detailTask=task;detailDirty=false;$('details-error').textContent='';$('details-description').value=task.description||'';
 $('photos-setup').hidden=true;$('description-save').disabled=!('description' in task);
 $('photo-input').disabled=true;$('photo-label').classList.add('disabled');$('photo-grid').replaceChildren();
 open('details-dialog');syncDetails();await loadPhotos();
 if(!photoChannel&&photosReady&&user){
  photoChannel=client.channel('checklist-photo-events-'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'checklist_task_photos'},()=>{if($('details-dialog').open)loadPhotos();})
   .subscribe();
 }
 clearInterval(photoRefresh);photoRefresh=setInterval(()=>{if($('details-dialog').open&&!document.hidden&&!photoBusy)loadPhotos();},60000);
}
function requiresPhotoSetup(error){return ['42P01','PGRST205','PGRST204','42703'].includes(error?.code)||String(error?.message||'').includes('Bucket not found');}
function photoError(error){if(requiresPhotoSetup(error))return 'Ative as fotos no Supabase usando as instruções abaixo.';return readable(error);}
async function loadPhotos(){
 if(!detailTask||!user||!client||!$('details-dialog').open)return;
 const id=detailTask.id,seq=++photoLoadSeq,expected=epoch;
 $('photo-status').textContent=photoBusy?'Enviando fotos…':'Carregando fotos…';$('photo-status').classList.remove('photo-error');
 try{
  const {data,error}=await client.from('checklist_task_photos').select('*').eq('task_id',id).order('created_at');
  if(error)throw error;
  if(expected!==epoch||seq!==photoLoadSeq||detailTask?.id!==id||!$('details-dialog').open)return;
  photosReady=true;photoRows=data;$('photos-setup').hidden=('description' in detailTask);
  $('description-save').disabled=photoBusy||!('description' in detailTask);
  $('photo-input').disabled=photoBusy;$('photo-label').classList.toggle('disabled',photoBusy);
  const signed=data.length?await client.storage.from('checklist-photos').createSignedUrls(data.map(p=>p.path),900):{data:[],error:null};
  if(signed.error)throw signed.error;
  if(expected!==epoch||seq!==photoLoadSeq||detailTask?.id!==id||!$('details-dialog').open)return;
  const urls=new Map(signed.data.map(x=>[x.path,x]));$('photo-grid').replaceChildren();
  for(const photo of data){
   const entry=urls.get(photo.path),card=document.createElement('figure');card.className='photo-card';
   if(entry?.signedUrl){const b=document.createElement('button');b.className='photo-preview';b.type='button';b.setAttribute('aria-label','Ampliar foto: '+photo.name);const img=document.createElement('img');img.src=entry.signedUrl;img.alt=photo.name;img.loading='lazy';b.append(img);b.onclick=()=>{$('photo-caption').textContent=photo.name;$('photo-full').src=entry.signedUrl;$('photo-full').alt=photo.name;open('photo-viewer');};card.append(b);}else{const error=document.createElement('p');error.textContent='Não foi possível carregar esta foto.';card.append(error);}
   const caption=document.createElement('figcaption');caption.textContent=photo.name;const remove=document.createElement('button');remove.className='photo-remove';remove.type='button';remove.textContent='Remover foto';remove.disabled=photoBusy;remove.onclick=()=>removePhoto(photo);card.append(caption,remove);$('photo-grid').append(card);
  }
  $('photo-status').textContent=photoBusy?'Enviando fotos…':data.length?data.length+' foto'+(data.length===1?'':'s'):'Nenhuma foto adicionada.';
 }catch(error){
  if(expected!==epoch||seq!==photoLoadSeq||detailTask?.id!==id)return;
  photosReady=false;$('photo-status').classList.add('photo-error');$('photo-status').textContent=photoError(error);
  if(requiresPhotoSetup(error)){$('photos-setup').hidden=false;$('photo-input').disabled=true;$('photo-label').classList.add('disabled');}
 }
}
$('details-description').addEventListener('input',()=>{detailDirty=true;});
$('description-form').onsubmit=async e=>{
 e.preventDefault();if(!detailTask||busy||photoBusy)return;const task=detailTask;
 $('description-save').disabled=true;$('details-error').textContent='';
 try{await changeTask(task,{description:$('details-description').value.trim()});detailDirty=false;syncDetails();toast('Informações salvas.');}
 catch(error){$('details-error').textContent=error.message==='conflict'?'Outra pessoa alterou a tarefa. Copie seu texto, reabra a tarefa e tente novamente.':photoError(error);if(requiresPhotoSetup(error))$('photos-setup').hidden=false;}
 finally{$('description-save').disabled=!('description' in (detailTask||{}));}
};
$('photo-input').addEventListener('change',async()=>{
 const files=Array.from($('photo-input').files||[]);$('photo-input').value='';
 if(!files.length||!detailTask||photoBusy||busy||!photosReady)return;
 const taskId=detailTask.id,allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(files.some(f=>!allowed[f.type]||f.size>10485760)){$('details-error').textContent='Use fotos JPG, PNG ou WEBP de até 10 MB cada.';return;}
 photoBusy=true;$('photo-input').disabled=true;$('photo-label').classList.add('disabled');$('description-save').disabled=true;$('details-error').textContent='';let sent=0;
 try{
  mustBeReady();
  for(const file of files){
   $('photo-status').textContent='Enviando foto '+(sent+1)+' de '+files.length+'…';
   const path=taskId+'/'+crypto.randomUUID()+'.'+allowed[file.type];
   const {error:uploadError}=await client.storage.from('checklist-photos').upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   const {error:rowError}=await client.from('checklist_task_photos').insert({task_id:taskId,path,name:file.name.slice(0,250)||'Foto'});
   if(rowError){await client.storage.from('checklist-photos').remove([path]);throw rowError;}
   sent++;
  }
  toast(sent+' foto'+(sent===1?' adicionada.':'s adicionadas.'));
 }catch(error){$('details-error').textContent=(sent?sent+' foto(s) salva(s). ':'')+photoError(error);if(requiresPhotoSetup(error))$('photos-setup').hidden=false;}
 finally{photoBusy=false;await loadPhotos();}
});
async function removePhoto(photo){
 if(photoBusy||busy||!confirm('Remover esta foto para toda a equipe?'))return;
 photoBusy=true;$('details-error').textContent='';
 try{
  mustBeReady();const {data,error}=await client.from('checklist_task_photos').delete().eq('id',photo.id).select('id');if(error)throw error;
  const {error:storageError}=await client.storage.from('checklist-photos').remove([photo.path]);
  if(storageError)toast('Foto removida da tarefa. A limpeza do arquivo no armazenamento ficou pendente.');else toast(data.length?'Foto removida.':'A foto já foi removida.');
 }catch(error){$('details-error').textContent=photoError(error);}
 finally{photoBusy=false;await loadPhotos();}
}
$('details-dialog').addEventListener('close',()=>{
 clearInterval(photoRefresh);photoRefresh=null;detailTask=null;detailDirty=false;photoLoadSeq++;
 if(photoChannel){client?.removeChannel(photoChannel);photoChannel=null;}
 if($('photo-viewer').open)$('photo-viewer').close();
});
$('show-photo-setup').onclick=async()=>{
 open('photo-setup-dialog');$('photo-sql-status').textContent='';
 try{const response=await fetch('setup-fotos.sql');if(!response.ok)throw new Error('sql');$('photo-sql').textContent=await response.text();}
 catch{$('photo-sql').textContent='Não foi possível carregar o código. Use o link para baixar o script SQL.';}
};
$('copy-photo-sql').onclick=async()=>{
 try{if(!$('photo-sql').textContent.includes('begin;'))throw new Error('sql');await navigator.clipboard.writeText($('photo-sql').textContent);$('photo-sql-status').textContent='Código copiado. Cole no SQL Editor do Supabase e execute tudo.';}
 catch{$('photo-sql-status').textContent='Selecione e copie o código manualmente, ou baixe o script.';}
};

if(config){connectClient().catch(()=>{demo=false;user=null;tasks=[];uiSession();setConnection('Conexão indisponível');toast('Não foi possível conectar. Confira a internet e recarregue o app.');});}else{tasks=[...samples];uiSession();}

