// Rendering is independent of export precision. Draw only while visible and dirty.
export function demandRenderer({renderer, controls, scene, camera, host, afterRender=()=>{}}) {
  let frame=0, visible=true, stopped=false;
  const request=()=>{if(!frame&&!stopped&&!document.hidden&&visible)frame=requestAnimationFrame(draw);};
  function draw(){frame=0;if(stopped||document.hidden||!visible)return;controls.update();renderer.render(scene,camera);afterRender();host.dataset.renderFrames=String(Number(host.dataset.renderFrames||0)+1);}
  controls.addEventListener('change',request);
  const resize=new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();request();});resize.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();});intersection.observe(host);
  document.addEventListener('visibilitychange',request);
  // Capture schedules the frame after the page's view-control handlers finish.
  document.addEventListener('input',request,true);document.addEventListener('click',request,true);
  addEventListener('pageshow',request);
  addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);frame=0;});
  request();return {request,dispose(){stopped=true;if(frame)cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();controls.removeEventListener('change',request);document.removeEventListener('visibilitychange',request);document.removeEventListener('input',request,true);document.removeEventListener('click',request,true);removeEventListener('pageshow',request);}};
}

// A terminated job cannot publish queued results or downloads. Each retry owns
// a fresh kernel; retained main-thread meshes remain available after export cancel.
let nextJob=0;
const active=new Set();
export function taskWorker(url,status) {
  const worker=new Worker(url,{type:'module'}),id=++nextJob,start=performance.now();
  let stopped=false,settled=false,phase=status.textContent,timer;
  let progress=document.getElementById('task-progress');
  if(!progress){progress=document.createElement('progress');progress.id='task-progress';progress.setAttribute('aria-label','Current operation');status.after(progress);}
  document.documentElement.dataset.lastTaskOutcome='running';progress.hidden=false;progress.removeAttribute('value');status.dataset.job=String(id);
  const tick=()=>{if(!stopped&&status.dataset.job===String(id))status.textContent=`${phase} · ${((performance.now()-start)/1000).toFixed(1)} s`;};
  timer=setInterval(tick,500);active.add(worker);
  const terminate=worker.terminate.bind(worker);
  worker.terminate=()=>{if(stopped)return;if(!settled){document.documentElement.dataset.lastTaskOutcome='cancelled';document.documentElement.dataset.lastTaskMS=String(performance.now()-start);}stopped=true;clearInterval(timer);active.delete(worker);worker.onmessage=null;worker.onerror=null;terminate();if(status.dataset.job===String(id))progress.hidden=true;};
  worker.addEventListener('message',event=>{
    if(stopped){event.stopImmediatePropagation();return;}
    const data=event.data;
    if(data.progress){event.stopImmediatePropagation();phase=data.progress.label;const {completed,total}=data.progress;if(Number.isFinite(completed)&&total>0){progress.max=total;progress.value=completed;}else progress.removeAttribute('value');tick();return;}
    settled=true;clearInterval(timer);data.wallMS=performance.now()-start;
    document.documentElement.dataset.lastTaskMS=String(data.wallMS);
    document.documentElement.dataset.lastTaskOutcome=data.error?'error':'success';
    setTimeout(()=>{if(status.dataset.job===String(id)&&!data.error)status.textContent+=` · ${(data.wallMS/1000).toFixed(2)} s`;});
  });
  worker.addEventListener('error',event=>{if(stopped){event.stopImmediatePropagation();return;}settled=true;document.documentElement.dataset.lastTaskOutcome='error';document.documentElement.dataset.lastTaskMS=String(performance.now()-start);clearInterval(timer);});
  return worker;
}
addEventListener('pagehide',()=>{for(const worker of [...active])worker.terminate();});
