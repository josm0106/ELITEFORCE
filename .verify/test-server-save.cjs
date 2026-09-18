const fs = require('fs'), assert = require('node:assert/strict'), { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM('<span id="syncIndicator"></span><button id="serverSaveBtn"></button>', { url: 'https://study.example', runScripts: 'outside-only' });
const w = dom.window;
let writes = [], failImage = false, hold = null;
let failLoad = false;
const images = new Map();
w.db = { collection: () => ({ doc: () => ({
  get: async () => { if (failLoad) throw Error('offline'); return { exists: true, data: () => ({ memos: [{ id: 0, text: 'older cloud copy' }], freeMemos: [], viewData: {}, highlights: {} }) }; },
  collection: () => ({ doc: id => ({
    set: async value => { writes.push('image:' + id); if (failImage) throw Error('upload failed'); images.set(id, value); },
    get: async opts => { assert.equal(opts.source, 'server'); return { exists: images.has(id), data: () => images.get(id) }; }
  }) }),
  set: async value => { writes.push(JSON.parse(JSON.stringify(value))); if (hold) { const wait = hold; hold = null; await wait; } }
}) }) };
w.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER' } } };
w.console.error = () => {};
w.eval(`var currentUser={uid:'test'}, firestoreReady=true, syncDebounceTimer=null;
var serverSavePromise=null,serverSaveRequested=false,serverRetryTimer=null;
var confirmedMemoImages=new Set(),memoImgCache=new Map(),memos=[],freeMemos=[],viewData={},highlights={};
function idbGetImg(){return Promise.resolve(null)}
` + html.slice(html.indexOf('function showSync('), html.indexOf('// ===== ALLOWED EMAILS')) +
html.slice(html.indexOf('function pendingSaveKey()'), html.indexOf('// ===== APP INIT')));
w.eval(html.slice(html.indexOf('async function loadFromFirestore()'), html.indexOf('// ===== FIRESTORE: SAVE ALL DATA')));
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  w.memos = [{ id: 1, text: 'first', imgId: 'photo' }];
  w.memoImgCache.set('photo', 'data:image/png;base64,test');
  failImage = true;
  assert.equal(await w.syncToCloud(true), false);
  assert.match(w.document.getElementById('syncIndicator').textContent, /실패/);
  assert(w.localStorage.getItem(w.pendingSaveKey()), 'failed saves remain recoverable');
  assert.equal(writes.filter(x => typeof x === 'object').length, 0, 'no successful memo acknowledgement before photo upload');
  assert.equal(w.document.getElementById('serverSaveBtn').disabled, false, 'manual retry enabled');
  await w.loadFromFirestore();
  assert.equal(w.memos[0].text, 'first', 'pending snapshot survives reload over older server data');
  failLoad = true;
  await w.loadFromFirestore();
  assert.equal(w.memos[0].text, 'first', 'pending snapshot also survives failed server read');
  failLoad = false;
  failImage = false; writes = [];
  assert.equal(await w.manualServerSave(), true);
  assert.equal(writes[0], 'image:photo');
  assert.equal(writes[1].memos[0].text, 'first');
  assert.equal(w.localStorage.getItem(w.pendingSaveKey()), null);
  assert.match(w.document.getElementById('syncIndicator').textContent, /서버 저장 완료/);

  let release;
  hold = new Promise(resolve => { release = resolve; });
  writes = [];
  const saving = w.syncToCloud(true);
  await tick();
  assert.equal(w.document.getElementById('serverSaveBtn').disabled, true);
  w.memos.push({ id: 2, text: 'during upload' });
  const queued = w.syncToCloud(true);
  assert.equal(saving, queued, 'one serialized save queue');
  release();
  await saving;
  assert.equal(writes.length, 2);
  assert.equal(writes[0].memos.length, 1);
  assert.equal(writes[1].memos.length, 2, 'latest edit reaches server before completed status');

  w.memos.push({ id: 3, imgId: 'missing' });
  assert.equal(await w.manualServerSave(), false, 'missing local and remote images cannot report completion');
  images.set('missing', { data: 'remote image' });
  assert.equal(await w.manualServerSave(), true, 'existing server photo works without local copy');
  w.currentUser = null;
  assert.equal(await w.manualServerSave(), false, 'signed-out save does not claim success');
  for (const name of ['saveMemos', 'saveFreeMemos']) {
    assert.match(html.slice(html.indexOf('function ' + name + '('), html.indexOf('\n}', html.indexOf('function ' + name + '('))), /syncToCloud\(true\)/);
  }
  console.log('PASS: immediate memo saves; photo failure and retry; serialized edits; server-only photos; missing photos; manual save; pending recovery data; truthful completion status');
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => w.close());
