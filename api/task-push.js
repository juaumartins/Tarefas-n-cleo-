'use strict';
const crypto = require('node:crypto');
const webPush = require('web-push');
function validEndpoint(endpoint) {
  try { const u=new URL(endpoint); return u.protocol==='https:' && !u.username && !u.password && !u.port &&
    ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(host=>u.hostname===host || u.hostname.endsWith('.'+host)); }
  catch { return false; }
}
module.exports = async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const secret=process.env.PUSH_WEBHOOK_SECRET;
  if(!secret || !process.env.PUSH_PUBLIC_KEY || !process.env.PUSH_PRIVATE_KEY)return res.status(503).json({error:'Push not configured'});
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(Buffer.byteLength(token)!==Buffer.byteLength(secret) || !crypto.timingSafeEqual(Buffer.from(token),Buffer.from(secret)))return res.status(401).json({error:'Unauthorized'});
  const body=req.body;
  if(!body || !/^[0-9a-f-]{36}$/i.test(body.taskId||'') || typeof body.title!=='string' || body.title.length>300 || !Array.isArray(body.subscriptions) || body.subscriptions.length>100)return res.status(400).json({error:'Invalid payload'});
  webPush.setVapidDetails('https://tarefas-nucleo.vercel.app',process.env.PUSH_PUBLIC_KEY,process.env.PUSH_PRIVATE_KEY);
  const payload=JSON.stringify({title:'Tarefa da equipe',body:body.title,taskId:body.taskId});
  const queue=body.subscriptions.slice();let sent=0,expired=0,failed=0;
  await Promise.all(Array.from({length:Math.min(queue.length,10)},async()=>{
    while(queue.length){const sub=queue.shift();
      if(!validEndpoint(sub?.endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(sub?.keys?.p256dh||'') || !/^[A-Za-z0-9_-]{20,30}$/.test(sub?.keys?.auth||'')){failed++;continue;}
      try{await webPush.sendNotification(sub,payload,{TTL:3600,urgency:'normal',timeout:10000});sent++;}
      catch(e){if([404,410].includes(e.statusCode))expired++;else failed++;}
    }
  }));
  // Diagnostics contain counts only; endpoints and task text are never logged.
  if(failed)console.error('Push delivery failed', {failed,expired});
  return res.status(failed?502:200).json({sent,expired,failed});
};
