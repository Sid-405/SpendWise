self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {});
/* ===== BILL REMINDERS — reads recurring data the app cached, fires system notifications ===== */
const MM_DATA_CACHE = 'mm-push-data';

async function mmReadJSON(key){
  try{ const c = await caches.open(MM_DATA_CACHE); const r = await c.match(key); return r ? await r.json() : null; }
  catch(e){ return null; }
}
async function mmWriteJSON(key, obj){
  try{ const c = await caches.open(MM_DATA_CACHE);
    await c.put(key, new Response(JSON.stringify(obj), {headers:{'Content-Type':'application/json'}})); }
  catch(e){}
}
function mmToday(){
  const d = new Date();
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}
async function mmCheckBills(){
  const data = await mmReadJSON('/recurring-data');
  if (!data || !data.rows) return;
  const today = mmToday();
  const done = (await mmReadJSON('/notified')) || {};
  const cur = data.currency || '$';
  for (const r of data.rows){
    if (r.active === false || !r.nextDate) continue;
    const days = Math.round((new Date(r.nextDate+'T00:00:00') - new Date(today+'T00:00:00'))/86400000);
    if (isNaN(days) || days < 0 || days > 1) continue;
    const key = r.id + ':' + r.nextDate;
    if (done[key]) continue;
    done[key] = 1;
    const when = days === 0 ? 'due today' : 'due tomorrow';
    self.registration.showNotification('💳 ' + (r.name || 'Payment'), {
      body: cur + Math.abs(Number(r.amount)||0).toFixed(2) + ' ' + when,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'mm-' + key
    });
  }
  await mmWriteJSON('/notified', done);
}
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'mm-bill-check') e.waitUntil(mmCheckBills());
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'mm-check-bills') mmCheckBills();
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const c of list){ if ('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
