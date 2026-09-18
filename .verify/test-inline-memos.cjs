const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM('<div id="memoTabHighlight"><section id="selectionMemoComposer" hidden></section></div><div id="chapterContent"><p>First source paragraph.</p><p class="quiz-answer">Answer explanation.</p></div>',{runScripts:'outside-only'});
const w=dom.window;
w.eval(`var currentChapter={num:1,title:'Test'},memos=[],freeMemos=[],addCall=null,deleted=null;
function timeAgo(){return '방금 전'} function escapeHtml(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function beginSelectionMemo(...args){addCall=args}
function deleteMemo(id){deleted=id;memos=memos.filter(m=>m.id!==id);renderMemoAnchors(1)}
function deleteFreeMemo(id){deleted=id;freeMemos=freeMemos.filter(m=>m.id!==id);renderMemoAnchors(1)}
function loadMemoImage(){return Promise.resolve('data:image/png;base64,test')} function openImgLightbox(){} function updateReadingProgress(){}
`+html.slice(html.indexOf('const selectionComposerElement'),html.indexOf('let selectionMemoDraft'))+
html.slice(html.indexOf('function resolveMemoOffset'),html.indexOf('// --- Highlight memos ---'))+
html.slice(html.indexOf('function offsetToRange'),html.indexOf('// ===== 본문 메모 마커'))+
html.slice(html.indexOf('function renderMemoAnchors'),html.indexOf('function removeMemoMarkerPop')));
const content=w.document.getElementById('chapterContent'),original=content.textContent;
w.memos=[{id:200,chapterNum:1,text:'First',anchorOffset:0,note:'Second note',imgId:'photo'},{id:100,chapterNum:1,text:'First',anchorOffset:0,note:'First note'}];
w.freeMemos=[{id:300,chapterNum:1,text:'Third note',anchorOffset:0}];
w.renderMemoAnchors(1);
const hosts=()=>[...content.querySelectorAll('.inline-memo-card')];
assert.deepEqual(hosts().map(h=>h.dataset.memoId),['100','200','300']);
assert.equal(content.querySelectorAll('.inline-memo-stack').length,1);
assert.equal(content.textContent,original,'shadow cards preserve source text offsets');
for(const host of hosts()){
 const shadow=host.shadowRoot;assert.equal(shadow.querySelectorAll('button').length,2);
 assert.equal(shadow.querySelector('[data-action="add"]').textContent,'+');
 assert.equal(shadow.querySelector('[data-action="delete"]').textContent,'×');
 assert(!shadow.querySelector('[data-action="photo"],[data-action="panel"],header'));
}
hosts()[0].shadowRoot.querySelector('[data-action="add"]').click();
assert.deepEqual(Array.from(w.addCall),['First',1,'Test',0,5]);
const editor=w.newInlineMemoHost('inline-memo-composer');w.insertAfterMemoBlock(editor,content.querySelector('p'));
assert.equal(editor.parentElement.lastElementChild,editor,'editor follows existing cards');
w.renderMemoAnchors(1);assert.equal(content.querySelectorAll('.inline-memo-stack').length,1);assert.equal(editor.parentElement.lastElementChild,editor);
hosts()[1].shadowRoot.querySelector('[data-action="delete"]').click();assert.equal(w.deleted,200);
assert.deepEqual(hosts().map(h=>h.dataset.memoId),['100','300']);
assert.equal(content.textContent,original);
const answerOffset='First source paragraph.'.length;
w.memos.push({id:400,chapterNum:1,text:'Answer',anchorOffset:answerOffset,note:'Answer memo'});w.renderMemoAnchors(1);
assert(content.querySelector('.quiz-answer .inline-memo-stack .inline-memo-card'),'answer memo stays within hidden answer');
assert.equal(content.textContent,original);
console.log('PASS: compact controls; chronological vertical stack; same-position add; isolated delete; editor last; answer scope; stable source offsets');
