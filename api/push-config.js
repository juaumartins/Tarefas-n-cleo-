'use strict';
module.exports = function(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const {PUSH_PUBLIC_KEY, PUSH_PRIVATE_KEY, PUSH_WEBHOOK_SECRET} = process.env;
  res.status(200).json({enabled: !!(PUSH_PUBLIC_KEY && PUSH_PRIVATE_KEY && PUSH_WEBHOOK_SECRET), publicKey:PUSH_PUBLIC_KEY || null});
};
