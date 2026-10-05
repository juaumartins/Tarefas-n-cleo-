'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data;try{data=event.data.json();}catch{return;}
  if(!/^[0-9a-f-]{36}$/i.test(data.taskId||''))return;
  event.waitUntil(self.registration.showNotification('Nova tarefa na equipe',{
    body:String(data.body||'Uma tarefa foi adicionada.').slice(0,300),icon:'/icon-192.png',
    tag:'task-'+data.taskId,data:{taskId:data.taskId}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const id=event.notification.data?.taskId;
  if(!/^[0-9a-f-]{36}$/i.test(id||''))return;
  const url=new URL('/?task='+encodeURIComponent(id),self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(existing){await existing.navigate(url);return existing.focus();}
    return self.clients.openWindow(url);
  })());
});
