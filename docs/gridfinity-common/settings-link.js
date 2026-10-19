/** Settings stay in the URL fragment; they are not sent to a geometry service. */
export function readSettingsLink(href,tool,defaults){
 const url=new URL(href);if(!url.hash.startsWith('#settings='))return null;
 const encoded=url.hash.slice(10);if(encoded.length>18000)throw Error('Settings link is too long.');
 let data;try{const bytes=Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('Settings link is unreadable.');}
 if(data?.v!==1||data.tool!==tool||!data.parameters||typeof data.parameters!=='object'||Array.isArray(data.parameters))throw Error('Settings link is for a different generator or version.');
 for(const [k,v] of Object.entries(data.parameters))if(!Object.hasOwn(defaults,k)||typeof v!==typeof defaults[k]||(typeof v==='number'&&!Number.isFinite(v)))throw Error('Invalid linked setting: '+k);
 if(data.view!==undefined&&(!data.view||typeof data.view!=='object'||Array.isArray(data.view)))throw Error('Invalid linked view.');
 return {parameters:{...defaults,...data.parameters},view:data.view??{}};
}
export function settingsURL(href,tool,parameters,view={}){
 const url=new URL(href);url.search='';const bytes=new TextEncoder().encode(JSON.stringify({v:1,tool,parameters,view}));let text='';for(const n of bytes)text+=String.fromCharCode(n);
 const encoded=btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(encoded.length>18000)throw Error('Too many settings for a link; save a parameter file instead.');url.hash='settings='+encoded;return url.href;
}
export async function copySettingsLink(url){let timer;try{await Promise.race([navigator.clipboard.writeText(url),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Clipboard unavailable')),1500);})]);return true;}catch{return false;}finally{clearTimeout(timer);}}
