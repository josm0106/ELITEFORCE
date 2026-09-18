const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const data=vm.runInNewContext(html.slice(html.indexOf('const CHAPTERS_DATA'),html.indexOf('let currentChapter'))+';({CHAPTERS_DATA,SECTIONS})');
const code=html.slice(html.indexOf('function quizSymIndex'),html.indexOf('function processHeadings'));
const dom=new JSDOM('<div id="chapterContent"></div>',{runScripts:'outside-only'}),w=dom.window;
w.eval(code+';function removeMemoMarkerPop(){} function updateReadingProgress(){}');
const root=w.document.getElementById('chapterContent');
let count=0,combinations=0;
for(const ch of Object.values(data.CHAPTERS_DATA)){
 root.innerHTML=ch.content;w.currentChapter=ch;w.processQuizzes();
 const containers=[...root.querySelectorAll('.q-cont')];
 assert.equal(root.querySelectorAll('[role="checkbox"],[data-multiple="true"]').length,0);
 const ids=containers.map(c=>c.dataset.qc);assert.equal(ids.length,new Set(ids).size,'unique question IDs');
 for(const [i,cont] of containers.entries()){
  const id=cont.dataset.qc,pill=root.querySelector('.quiz-reveal[data-q="'+id+'"]');
  const opts=[...cont.querySelectorAll('.q-opt,.q-table-opt')],key=Number(pill.dataset.correct);
  const tag=`chapter ${ch.num} ${id}`;
  assert.equal(pill.dataset.correct.split(',').length,1,tag+' one answer');
  assert.equal(opts.filter(o=>+o.dataset.i===key).length,1,tag+' valid key');
  assert.equal(new Set(opts.map(o=>o.dataset.i)).size,opts.length,tag+' labels');
  assert(opts.every(o=>o.dataset.q===id&&o.getAttribute('role')==='radio'),tag+' scoped radios');
  assert(opts.every(o=>!/(←\s*정답|\(정답\)|\(→.*오답\))\s*$/.test(o.textContent)),tag+' no answer leaks');
  const next=containers[i+1];
  const incorrect=opts.find(o=>+o.dataset.i!==key);incorrect.click();
  assert(incorrect.classList.contains('q-wrong'),tag+' incorrect');
  assert.equal(incorrect.getAttribute('aria-checked'),'true',tag+' selection');
  assert(cont.classList.contains('answered'),tag+' answered');
  if(next)assert(!next.classList.contains('answered'),tag+' next independent');
  w.resetQuiz(id);assert(!cont.classList.contains('answered'),tag+' retry');
  assert(opts.every(o=>!o.classList.contains('q-selected')&&!o.classList.contains('q-wrong')),tag+' retry clear');
  const correct=opts.find(o=>+o.dataset.i===key);
  correct.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert(cont.classList.contains('answered'),tag+' keyboard');
  assert.equal(cont.querySelectorAll('.q-selected').length,1,tag+' one selected');
  assert(correct.classList.contains('q-correct'),tag+' correct');
  incorrect.click();assert.equal(cont.querySelectorAll('.q-selected').length,1,tag+' locked');
  if(i>0)assert(containers[i-1].classList.contains('answered'),tag+' previous preserved');
  count++;if(cont.dataset.combination)combinations++;
 }
 // Reprocessing is idempotent and cannot steal another question's options.
 w.processQuizzes();assert.equal(root.querySelectorAll('.q-cont').length,count?containers.length:0);
}
const progressCode=html.slice(html.indexOf('function sectionProgressValue'),html.indexOf('function updateReadingProgress'));
const ctx={CHAPTERS_DATA:data.CHAPTERS_DATA,SECTIONS:data.SECTIONS,viewData:{}};vm.createContext(ctx);vm.runInContext(progressCode,ctx);
for(const sec of data.SECTIONS){
 assert.equal(ctx.sectionProgressValue(sec).percent,0);
 for(let i=sec.range[0];i<=sec.range[1];i++)ctx.viewData[i]={scrollProgress:1};
 assert.equal(ctx.sectionProgressValue(sec).percent,100);
 assert.equal(ctx.sectionProgressValue(sec).complete,ctx.sectionProgressValue(sec).total);
 for(let i=sec.range[0];i<=sec.range[1];i++)ctx.viewData[i]={scrollProgress:0.5};
 assert.equal(ctx.sectionProgressValue(sec).percent,50);
}
for(const script of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)])new vm.Script(script[1]);
console.log(JSON.stringify({chapters:Object.keys(data.CHAPTERS_DATA).length,interactive:count,combinations,sections:data.SECTIONS.length,result:'PASS'},null,2));
