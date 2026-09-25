Promise.all([fetch('./results.json').then(r=>r.json()),fetch('./geometry.json').then(r=>r.json())]).then(([data,geo])=>{
 const $=id=>document.getElementById(id),a=geo.assembly;
 function update(){
  const mass=+$('mass').value,E=+$('modulus').value,factor=+$('imbalance').value,drift=+$('drift').value;
  if(![mass,E,factor,drift].every(Number.isFinite)||mass<=0||E<=0||factor<=0||drift<1){$('load-warning').textContent='Enter positive mass, modulus and load multiplier; drift must be at least 1.';return;}
  const u=$('eccentric').checked?data.unit_offset_response:data.unit_center_response;
  const force=mass*9.80665/4,scale=force*factor*data.reference_modulus_MPa/E;
  const sag=u.center_sag_mm*scale;
  const stop=a.stop_gap_mm-u.stop_sag_mm*scale*drift-data.compression_allowance_mm;
  const rim=a.paver_to_rim_gap_mm-u.rim_sag_mm*scale*drift-data.compression_allowance_mm;
  $('sag').textContent=sag.toFixed(2);$('force').textContent=(force*factor).toFixed(1)+' N';$('stop-clearance').textContent=stop.toFixed(2)+' mm';$('rim-clearance').textContent=rim.toFixed(2)+' mm';
  $('load-warning').textContent=Math.min(stop,rim)<=0?'CONTACT IN THIS LINEAR SCENARIO. The floating suspension would be bypassed; change geometry or load.':Math.min(stop,rim)<3?'Below the provisional 3 mm reserve target. Do not treat this combination as passing the clearance screen.':'Both vertical gaps pass the 3 mm linear screening target. Confirm with one printed foot under load; large strain, creep and real contact are not solved.';
 }
 ['mass','modulus','imbalance','drift','eccentric'].forEach(id=>$(id).addEventListener('input',update));update();
}).catch(e=>{document.getElementById('load-warning').textContent='Calculation data did not load. Open the downloadable results or reload.';console.error(e)});
