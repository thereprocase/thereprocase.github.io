const work=document.getElementById('workbench');
const dock=document.getElementById('workspace-actions')||document.getElementById('workflow');
function measure(){if(!work)return;const top=work.getBoundingClientRect().top+scrollY;document.documentElement.style.setProperty('--work-height',`${Math.max(440,innerHeight-top-18)}px`);document.documentElement.style.setProperty('--action-height',`${dock?.getBoundingClientRect().height||0}px`);}
const observer=new ResizeObserver(measure);if(dock)observer.observe(dock);observer.observe(document.querySelector('header'));addEventListener('resize',measure);measure();
function reveal(target){for(let p=target;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}
document.addEventListener('invalid',event=>reveal(event.target),true);
document.addEventListener('click',event=>{const anchor=event.target.closest('a[href^="#"]');if(!anchor)return;const target=document.getElementById(anchor.hash.slice(1));if(target)reveal(target);});
// Mobile can jump directly between the same controls; no duplicated form state.
if(work){const nav=document.createElement('nav');nav.className='workspace-jumps';nav.setAttribute('aria-label','Workspace shortcuts');nav.innerHTML='<a href="#settings-panel">Settings</a><a href="#preview-panel">Viewer</a>';if(dock)dock.append(nav);else work.before(nav);}
document.addEventListener('change',event=>{if(event.target.name==='tiling'&&event.target.value==='manual')reveal(document.querySelector('[name=cutsX]'));if(event.target.id==='bed-preset'&&event.target.value==='custom')reveal(document.querySelector('[name=bedX]')||document.getElementById('bed-width'));});
// Conversion changes the status bar height. Align the mobile preview only after
// the final status and responsive toolbar have been laid out.
if(document.body.dataset.tool==='gridfinity-converter'){
 let wasBusy=document.body.dataset.busy==='true';
 new MutationObserver(()=>{const busy=document.body.dataset.busy==='true';if(wasBusy&&!busy&&document.body.dataset.view==='converted'&&matchMedia('(max-width:1000px)').matches)requestAnimationFrame(()=>requestAnimationFrame(()=>{measure();document.getElementById('preview-panel').scrollIntoView({block:'start'});}));wasBusy=busy;}).observe(document.body,{attributes:true,attributeFilter:['data-busy']});
}
