'use strict';
let pushRegistration=null,pushConfiguration=null,pushBusy=false,pushOwner=null,pushSchemaReady=false;
const pushSupported=window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function updatePushButton(){
 const b=$('push-toggle');b.hidden=!user;b.disabled=pushBusy||!pushConfiguration?.enabled||!pushSchemaReady||!pushSupported;
 b.textContent=pushBusy?'Aguarde…':pushOwner===user?.id?'Desativar notificações':'Ativar notificações';
 if(!user)return;
 $('push-help').hidden=false;
 $('push-status').textContent=!pushSupported?'Este navegador não oferece notificações. No iPhone, adicione o app à tela de início e abra por lá.':!pushConfiguration?.enabled?'As notificações aguardam a configuração do servidor.':!pushSchemaReady?'As notificações aguardam a configuração do Supabase.':pushOwner===user.id?'Notificações ativadas neste aparelho.':'Ative neste aparelho para receber avisos de novas tarefas da equipe.';
}
async function savePushSubscription(subscription,owner){
 const data=subscription.toJSON();
 const {error}=await client.from('checklist_push_subscriptions').upsert({endpoint:data.endpoint,p256dh:data.keys.p256dh,auth:data.keys.auth,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
 if(error)throw error;
 if(user?.id!==owner){await subscription.unsubscribe();return;}
 pushOwner=owner;
}
async function refreshPush(){
 pushSchemaReady=false;
 if(!user||!pushRegistration||!pushConfiguration?.enabled){updatePushButton();return;}
 const owner=user.id;
 const {error}=await client.from('checklist_push_subscriptions').select('id').limit(1);
 if(user?.id!==owner)return;
 pushSchemaReady=!error;
 if(!error){
  const subscription=await pushRegistration.pushManager.getSubscription();
  if(subscription){try{await savePushSubscription(subscription,owner);}catch{await subscription.unsubscribe();pushOwner=null;}}
 }
 updatePushButton();
}
async function deactivatePush(){
 const subscription=await pushRegistration?.pushManager.getSubscription();
 if(subscription){
  if(client&&user){const {error}=await client.from('checklist_push_subscriptions').delete().eq('endpoint',subscription.endpoint);if(error)throw error;}
  await subscription.unsubscribe();
 }
 pushOwner=null;updatePushButton();
}
$('push-toggle').onclick=async()=>{
 if(pushBusy||!user||!pushSchemaReady||!pushConfiguration?.enabled)return;
 const owner=user.id;
 // A solicitacao parte do toque do usuario, nunca de uma atualizacao automatica.
 const permissionPromise=pushOwner===owner?null:Notification.requestPermission();
 pushBusy=true;updatePushButton();
 try{
  if(pushOwner===owner){await deactivatePush();toast('Notificações desativadas neste aparelho.');return;}
  const permission=await permissionPromise;
  if(permission!=='granted'){toast('Notificações não autorizadas. Confira a permissão deste site nas configurações do navegador.');return;}
  if(user?.id!==owner)return;
  const raw=pushConfiguration.publicKey.replace(/-/g,'+').replace(/_/g,'/');
  const key=Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));
  const subscription=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  try{await savePushSubscription(subscription,owner);}catch(e){await subscription.unsubscribe();throw e;}
  toast('Notificações ativadas neste aparelho.');
 }catch{toast('Não foi possível ativar as notificações. Confira a configuração do Supabase e tente novamente.');}
 finally{pushBusy=false;updatePushButton();}
};
async function initializePush(){
 if(!pushSupported){updatePushButton();return;}
 try{
  const response=await fetch('/api/push-config',{cache:'no-store'});
  if(!response.ok)throw new Error('config');pushConfiguration=await response.json();
  await navigator.serviceWorker.register('/sw.js');pushRegistration=await navigator.serviceWorker.ready;
  await refreshPush();
 }catch{updatePushButton();}
}
initializePush();
// Atualiza a inscricao depois do login, sem pedir permissao novamente.
const pushSessionChanged=sessionChanged;
sessionChanged=async function(session,expected){await pushSessionChanged(session,expected);if(expected===epoch){if(!user){pushOwner=null;$('push-help').hidden=true;}await refreshPush();}};
const pushLogout=$('logout').onclick;
$('logout').onclick=async()=>{
 try{await deactivatePush();}catch{
  const subscription=await pushRegistration?.pushManager.getSubscription();await subscription?.unsubscribe();pushOwner=null;
 }
 await pushLogout();
};
let pendingTaskId=new URLSearchParams(location.search).get('task');
const pushLoadTasks=loadTasks;
loadTasks=async function(expected=epoch){
 await pushLoadTasks(expected);
 if(pendingTaskId&&user&&taskLoadState==='ready'){
  const id=pendingTaskId;pendingTaskId=null;const task=tasks.find(t=>t.id===id);
  if(task)await openTaskDetails(task);else toast('Esta tarefa não está disponível para sua conta.');
 }
};
