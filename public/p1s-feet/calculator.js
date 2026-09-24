fetch('./analysis.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{
 const $=id=>document.getElementById(id),fmt=(n,d=2)=>n.toFixed(d);
 function update(){
  const mass=+$('mass').value,E=+$('modulus').value,mult=+$('imbalance').value;
  if(![mass,E,mult].every(Number.isFinite)||mass<=0||E<=0||mult<=0){$('load-warning').textContent='Enter positive numbers for all three inputs.';return;}
  const k=data.k_reference_N_mm*E/data.E_reference_MPa,F=mass*9.80665/4*mult,sag=F/k,gap=data.unloaded_stop_gap_mm-sag,f=Math.sqrt(4*k*1000/mass)/(2*Math.PI);
  $('sag').textContent=fmt(sag);$('force').textContent=fmt(F)+' N';$('stiffness').textContent=fmt(k)+' N/mm';$('clearance').textContent=fmt(gap)+' mm';$('frequency').textContent=fmt(f,1)+' Hz';
  $('load-warning').textContent=gap<=0?'STOP CONTACT PREDICTED. The free-suspension equation no longer applies after contact. This combination needs a stiffer cradle.':gap<3?'Less than the provisional 3 mm clearance target. Creep and unequal loading could bring the cup onto its stop.':'Positive clearance in the linear estimate. Confirm it with a printed load test; material nonlinearity and creep are not included.';
 }
 ['mass','modulus','imbalance'].forEach(id=>$(id).addEventListener('input',update));update();
 for(const c of data.cases.filter(c=>(c.load_factor===1&&[7.4,9.8,26].includes(c.E_MPa))||(c.mass_kg===20&&c.E_MPa===7.4&&c.load_factor===1.3))){
  const tr=document.createElement('tr');[`${c.mass_kg} kg`,`${c.E_MPa} MPa`,`${c.load_factor.toFixed(2)}×`,`${fmt(c.sag_mm)} mm`,`${fmt(c.stop_clearance_mm)} mm`].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.append(td)});$('cases').append(tr);
 }
}).catch(e=>{document.getElementById('load-warning').textContent='Calculation file could not load. Reload or open the downloadable analysis.';console.error(e)});
