const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM('<div id="chapterContent"><p><mark class="hl-yellow" data-hl-id="one">Alpha </mark><strong><mark class="hl-yellow" data-hl-id="one">Beta</mark></strong> <mark class="hl-blue" data-hl-id="two">Gamma</mark></p></div>',{runScripts:'outside-only'});
const w=dom.window;
w.eval(`var currentChapter={num:1,title:'Test'};var saved=null;var saveCount=0;
function syncToCloud(){saveCount++;saved=JSON.parse(JSON.stringify(highlights));}
function renderFilterChips(){} function renderMemos(){}
`+html.slice(html.indexOf('function resolveMemoOffset'),html.indexOf('// --- Highlight memos ---'))+html.slice(html.indexOf('// ===== HIGHLIGHT (형광펜) SYSTEM'),html.indexOf('// ===== AUTO HEADING DETECTION')).replace('let highlights = {};','var highlights = {};'));
w.eval(`highlights={1:[{id:'one',color:'yellow',text:'Alpha Beta',startOffset:0,endOffset:10},{id:'two',color:'blue',text:'Gamma',startOffset:11,endOffset:16}],2:[{id:'other',color:'pink',text:'Elsewhere',startOffset:0,endOffset:9}]};`);
const record=()=>JSON.parse(w.eval('JSON.stringify(highlights)'));
const marks=[...w.document.querySelectorAll('[data-hl-id="one"]')];
w.showHighlightRemovePopup(marks[0]);
const popup=w.document.getElementById('hlRemovePopup');
assert.equal(popup.querySelectorAll('.hl-color-choice').length,5);
assert.equal(popup.querySelector('[aria-pressed="true"]').title,'노랑 형광펜으로 변경');
popup.querySelector('.purple').click();
assert(marks.every(mark=>mark.classList.contains('hl-purple')&&!mark.classList.contains('hl-yellow')));
assert.equal(record()[1][1].color,'blue','adjacent highlight unchanged');
assert.equal(record()[2][0].color,'pink','other chapter unchanged');
assert.equal(record()[1][0].id,'one');assert.equal(record()[1][0].startOffset,0);assert.equal(record()[1][0].endOffset,10);
assert.equal(w.eval('saved[1][0].color'),'purple','persist through existing save path');
assert(!w.document.getElementById('hlRemovePopup'));
for(const color of ['yellow','green','blue','pink','purple']){
 w.showHighlightRemovePopup(marks[1]);
 w.document.querySelector('.hl-color-choice.'+color).click();
 assert(marks.every(mark=>mark.classList.contains('hl-'+color)));
}
w.changeHighlightColor('two','purple');
const content=w.document.getElementById('chapterContent');
content.innerHTML='<p>Alpha <strong>Beta</strong> Gamma</p>';
w.restoreHighlightsForChapter(1);
assert.equal(record()[1].length,2,'reopening does not merge adjacent edited highlights');
assert.equal([...content.querySelectorAll('[data-hl-id="one"]')].map(m=>m.textContent).join(''),'Alpha Beta');
assert.equal(content.querySelector('[data-hl-id="two"]').textContent,'Gamma');
assert([...content.querySelectorAll('mark')].every(m=>m.classList.contains('hl-purple')));
w.eval('mergeHighlights(1)');
assert.equal(record()[1][0].text,'Alpha Beta Gamma','merged ranges retain complete quote');
const before=w.eval('saveCount');w.changeHighlightColor('one','invalid');w.changeHighlightColor('missing','blue');assert.equal(w.eval('saveCount'),before);
for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
console.log('PASS: 5 colors; multi-node recoloring; adjacent/chapter isolation; saved color; reload; full merged text; JS syntax');
