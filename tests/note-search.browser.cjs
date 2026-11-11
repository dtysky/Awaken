// Real DOM / EPUB CFI regression tests; no user library or remote service is used.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ts = require('typescript');
const JSZip = require('jszip');
const playwright = require(process.env.AWAKEN_PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/frontend/utils.tsx'), 'utf8');
const search = ts.transpileModule(source.slice(source.indexOf('export async function searchFirstInBook')).replace('export async function', 'async function'), {compilerOptions: {target: ts.ScriptTarget.ES2020}}).outputText;
const chapters = [
  '<h2>标题里的唯一引文</h2><p>为艺术而艺术的理论在这里。</p><p>为艺术而艺术，这种作品值得讨论。</p><p>前面有  空格。\u00a0目标🙂词句 在这里。</p><p>跨<span>越节点</span><a href="#n">[12]</a><em>的标注</em>结束。</p><p>甲乙丙丁戊己庚。</p><p>abcdef错误内容uvwxyz</p><pre>const  answer =  42;</pre><p>重复引文。</p><p>重复引文。</p><aside id="n">脚注说明。</aside>',
  '<p>第二章的独特句子。</p>'
];
async function fixture() {
  const z = new JSZip(); z.file('mimetype', 'application/epub+zip');
  z.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  z.file('book.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">note-search-fixture</dc:identifier><dc:title>笔记定位回归</dc:title><dc:language>zh</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'+chapters.map((_,i)=>`<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')+'</manifest><spine>'+chapters.map((_,i)=>`<itemref idref="c${i}"/>`).join('')+'</spine></package>');
  z.file('nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol><li><a href="c0.xhtml">第一章</a></li></ol></nav></body></html>');
  chapters.forEach((body,i)=>z.file(`c${i}.xhtml`, `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>章${i}</title><style>.ignored{color:red}</style></head><body>${body}</body></html>`));
  return z.generateAsync({type:'nodebuffer'});
}
(async()=>{
  const bytes=await fixture(); let browser;
  const server=http.createServer((req,res)=>{
    if(req.url==='/book'){res.end(bytes);return;}
    const scripts={'/epub.js':'node_modules/epubjs/dist/epub.min.js','/jszip.js':'node_modules/jszip/dist/jszip.min.js'};
    if(scripts[req.url]){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(root,scripts[req.url])));return;}
    res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!DOCTYPE html><script src="/jszip.js"></script><script src="/epub.js"></script><script>'+search+'</script>');
  });
  try {
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=process.env.AWAKEN_CHROMIUM_PATH ? await playwright.chromium.launch({headless:true,executablePath:process.env.AWAKEN_CHROMIUM_PATH}) : await playwright.webkit.launch({headless:true});
    const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
    const result=await page.evaluate(async()=>{
      const book=ePub(await (await fetch('/book')).arrayBuffer());await book.ready;
      const norm=s=>s.replace(/\s+/g,'');const results=[];
      async function check(query,section=0,node,hint){const r=await searchFirstInBook(query,book,section,node,hint);if(!r.cfi)throw Error('No match: '+query);const range=await book.getRange(r.cfi);if(norm(range.toString())!==norm(query))throw Error('Wrong full range: '+query);results.push(query);return r;}
      await check('为艺术而艺术，这种作品值得讨论。');
      await check('目标🙂词句在这里。');
      await check('跨越节点[12]的标注结束。');
      await check('标题里的唯一引文');
      await check('const answer = 42;');
      const first=await check('甲乙丙丁戊');await check('丙丁戊己庚',first.section,first.endNode);
      const later=await check('第二章的独特句子。');await check('标题里的唯一引文',later.section,later.endNode);
      if((await searchFirstInBook('abcdef不存在uvwxyz',book,0)).cfi)throw Error('Accepted prefix/suffix without full text');
      if((await searchFirstInBook('   ',book,0)).cfi)throw Error('Accepted empty normalized query');
      const section=book.spine.spineItems[0];await section.load(book.load.bind(book));
      const repeated=[...section.document.querySelectorAll('p')].filter(p=>p.textContent==='重复引文。');const range=section.document.createRange();range.setStart(repeated[1].firstChild,0);range.setEnd(repeated[1].firstChild,repeated[1].textContent.length);const hint=section.cfiFromRange(range);
      const pinned=await check('重复引文。',0,undefined,{cfi:hint});if(pinned.cfi!==hint)throw Error('Ignored validated occurrence hint');
      await check('为艺术而艺术，这种作品值得讨论。',0,undefined,{cfi:hint});
      await check('目标🙂词句在这里。',0,undefined,{cfi:'broken-cfi'});
      const absent=await searchFirstInBook('完全不存在的引文',book,0,undefined,{cfi:hint});if(absent.cfi)throw Error('Trusted mismatched hint');
      book.destroy();return {positiveChecks:results.length,negativeChecks:3};
    });
    assert.equal(result.positiveChecks,12);assert.equal(result.negativeChecks,3);console.log('PASS real EPUB note search:',result);
    const compiled = file => ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
    const imports = await page.evaluate(async ({webdav, sync}) => {
      const content=await (await fetch('/book')).arrayBuffer(), hash='a'.repeat(32);
      const locator=ePub(content);await locator.ready;const section=locator.spine.spineItems[0];await section.load(locator.load.bind(locator));
      const repeated=[...section.document.querySelectorAll('p')].filter(p=>p.textContent==='重复引文。');
      const range=section.document.createRange();range.setStart(repeated[1].firstChild,0);range.setEnd(repeated[1].firstChild,repeated[1].textContent.length);const hint=section.cfiFromRange(range);locator.destroy();
      let input='', saved, initial={notes:[],bookmarks:[],removedTs:{}};
      const opened=new Set();let disposed=0;
      const openBook=()=>{const book=ePub();opened.add(book);const destroy=book.destroy.bind(book);book.destroy=()=>{opened.delete(book);disposed++;destroy();};return book;};
      const worker={showMessage:async()=>{},fs:{exists:async()=>false,readFile:async fp=>fp==='notes.html'?input:JSON.stringify(initial)}};
      const splitCFI=cfi=>{const a=new ePub.CFI(cfi),b=new ePub.CFI(cfi);a.collapse(true);b.collapse(false);return[a.toString(),b.toString()]};
      const deps={'epubjs':{default:openBook,EpubCFI:ePub.CFI},'../backend':{default:{worker}},'./utils':{searchFirstInBook},'./reader/common':{splitCFI},'js-md5':{},'webdav/web':{createClient(){throw Error('No network allowed')}}};
      function module(code){const exports={};new Function('exports','require',code)(exports,name=>{if(!(name in deps))throw Error('Unexpected dependency '+name);return deps[name]});return exports;}
      deps['./sync']=module(sync);const {WebDAV}=module(webdav);const dav=new WebDAV();
      dav.checkAndDownloadBook=async()=>content;dav.savePages=async()=>{};dav.saveConfig=async(book,config)=>{saved=config};
      for(const correctHash of [true,false]) {
        input='<div class="bookTitle" data-awaken-book-md5="'+(correctHash?hash:'b'.repeat(32))+'">《笔记定位回归》</div><h3 class="noteHeading" data-awaken-cfi="'+hint+'">标注</h3><div class="noteText">重复引文。</div><h3 class="noteHeading">备注</h3><div class="noteText">保留的备注</div>';
        const failed=await dav.importNotes({hash,name:'笔记定位回归'},'notes.html',()=>{});
        if(failed.length||saved.notes.length!==1||saved.notes[0].annotation!=='保留的备注')throw Error('Production import lost a note');
        if((saved.notes[0].cfi===hint)!==correctHash)throw Error('Production import did not enforce book hash');
        if(opened.size)throw Error('Offline import did not dispose the EPUB');
      }
      initial=saved;initial.notes[0].annotation='读者自己的备注';
      const commentHtml='<h3 class="noteHeading">备注</h3><div class="noteText">保留的备注</div>';
      input=input.replace(commentHtml,'');
      await dav.importNotes({hash,name:'笔记定位回归'},'notes.html',()=>{});
      if(saved.notes.length!==1||saved.notes[0].annotation!=='读者自己的备注')throw Error('Reimport erased a personal comment');
      input+=commentHtml;
      for(let i=0;i<2;i++) {
        initial=saved;await dav.importNotes({hash,name:'笔记定位回归'},'notes.html',()=>{});
        if(saved.notes.length!==1||saved.notes[0].annotation!=='读者自己的备注\n\n保留的备注')throw Error('Reimport duplicated or erased comments');
      }
      dav.saveConfig=async()=>{throw Error('Expected write failure');};
      let failure;
      try{await dav.importNotes({hash,name:'笔记定位回归'},'notes.html',()=>{});}catch(error){failure=error.message;}
      if(failure!=='Expected write failure'||opened.size||disposed!==6)throw Error('Failed import did not dispose the EPUB');
      return 6;
    }, {webdav:compiled('src/frontend/webdav.ts'),sync:compiled('src/frontend/sync.ts')});
    assert.equal(imports,6);console.log('PASS production importNotes: verified hints, book hash binding, preserved comments and cleanup');
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
