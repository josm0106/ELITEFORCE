const fs = require('fs');
const vm = require('vm');
const {JSDOM} = require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const data=vm.runInNewContext(html.slice(html.indexOf('const CHAPTERS_DATA'),html.indexOf('let currentChapter'))+';({CHAPTERS_DATA,SECTIONS})');
const code=html.slice(html.indexOf('function quizSymIndex'),html.indexOf('function processHeadings'));
const dom=new JSDOM('<div id="chapterContent"></div>',{runScripts:'outside-only'});
dom.window.eval(code);
const root=dom.window.document.getElementById('chapterContent');
const result=[];
for(const ch of Object.values(data.CHAPTERS_DATA)){
 root.innerHTML=ch.content;
 dom.window.processQuizzes();
 for(const pill of root.querySelectorAll('.quiz-reveal')){
  const id=pill.dataset.q, cont=root.querySelector('.q-cont[data-qc="'+id+'"]');
  const answer=root.querySelector('.quiz-answer[data-q="'+id+'"]');
  let p=cont?.previousElementSibling||pill.previousElementSibling, context=[];
  for(let k=0;p&&k<3;k++,p=p.previousElementSibling)context.unshift(p.textContent);
  result.push({chapter:ch.num,id,title:ch.title,context:context.join('\n'),options:cont?[...cont.querySelectorAll('.q-opt,.q-table-opt')].map(o=>({i:o.dataset.i,q:o.dataset.q,text:o.textContent})):[],correct:pill.dataset.correct,answer:answer?.textContent,explanation:[...root.querySelectorAll('.quiz-answer[data-q="'+id+'"]')].map(x=>x.textContent).join('\n')});
 }
}
fs.writeFileSync('.verify/quiz-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({chapters:Object.keys(data.CHAPTERS_DATA).length,answers:result.length,interactive:result.filter(x=>x.options.length).length,multiple:result.filter(x=>x.correct.includes(',')).length,unparsed:result.filter(x=>x.options.length&&!x.correct).length,duplicate:result.filter(x=>new Set(x.options.map(o=>o.i)).size!==x.options.length).length},null,2));
