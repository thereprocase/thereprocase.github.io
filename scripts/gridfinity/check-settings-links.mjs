import assert from 'node:assert/strict';
import {readSettingsLink,settingsURL} from '../../public/gridfinity-common/settings-link.js';
import {defaults as shelf,parameters as shelfParameters} from '../../public/gridfinity-shelves/kernel.js';
import {defaults as drawer,parameters as drawerParameters} from '../../public/gridfinity-drawers/kernel.js';
for(const [tool,defaults,validate] of [['shelves',shelf,shelfParameters],['drawers',drawer,drawerParameters]]){
 const p={...defaults,...(tool==='shelves'?{board_system:'metric25',columns:3,rows:2,angle:-5}:{width:90,depth:90,columns:2,rows:2,tiling:'manual',cutsX:'45',cutsY:'45',bottom:'open'})},view=tool==='shelves'?{bed:{width:250.5,depth:210.25},fitToBed:true,installed:true,ghosts:true}:{print:true,selectedTile:3,explode:13,labelsVisible:false};validate(p);
 const link=settingsURL('https://example.com/'+tool+'/?discard=1#old',tool,p,view),read=readSettingsLink(link,tool,defaults);assert.deepEqual(read.parameters,p);assert.deepEqual(read.view,view);assert.equal(new URL(link).search,'');assert(link.includes('#settings='));
 assert.throws(()=>readSettingsLink(link,tool==='shelves'?'drawers':'shelves',defaults));
 const badType=settingsURL('https://example.com/',tool,{...p,columns:'2'});assert.throws(()=>readSettingsLink(badType,tool,defaults));
 const unknown=settingsURL('https://example.com/',tool,{...p,secret:'not-allowed'});assert.throws(()=>readSettingsLink(unknown,tool,defaults));
 assert.throws(()=>readSettingsLink('https://example.com/#settings=%%%bad',tool,defaults));
 assert.throws(()=>readSettingsLink('https://example.com/#settings='+'A'.repeat(18001),tool,defaults));
 assert.equal(readSettingsLink('https://example.com/#viewer',tool,defaults),null);
}
const unicode={...drawer,cutsX:'35; 70',cutsY:'',xMode:'center'};assert.deepEqual(readSettingsLink(settingsURL('https://example.com/','drawers',unicode,{label:'é · 日本語'}),'drawers',drawer).view,{label:'é · 日本語'});
const malicious=JSON.parse('{"__proto__":{}}');assert.throws(()=>readSettingsLink(settingsURL('https://example.com/','drawers',malicious),'drawers',drawer));
console.log('Both settings-link round trips, view state, UTF-8, wrong tool, unknown fields, malformed/oversized payloads and parameter types: PASS');
