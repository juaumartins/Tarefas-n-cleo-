'use strict';
const crypto=require('node:crypto');
const key=crypto.createECDH('prime256v1');key.generateKeys();
console.log('Copie somente para Vercel e Supabase Vault. Não publique esta saída.');
console.log('PUSH_PUBLIC_KEY='+key.getPublicKey().toString('base64url'));
console.log('PUSH_PRIVATE_KEY='+key.getPrivateKey().toString('base64url'));
console.log('PUSH_WEBHOOK_SECRET='+crypto.randomBytes(32).toString('base64url'));
