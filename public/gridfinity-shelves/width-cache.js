import {bestPlacement} from './bed-placement.js?v=rectangle-fit-1';
export const widthRevision='base-controls-1';
const storageKey='gridfinity-width-results-'+widthRevision;
export function widthCacheKey(parameters,bed){
 return JSON.stringify([widthRevision,Object.entries(parameters).filter(([k])=>k!=='columns').sort(([a],[b])=>a.localeCompare(b)),bed.width,bed.depth]);
}
export function readWidthCache(key){try{const entry=JSON.parse(localStorage.getItem(storageKey)||'{}')[key];return entry&&Number.isInteger(entry.columns)&&entry.columns>=0&&entry.columns<=32&&Number.isInteger(entry.rows)&&(entry.columns===0||['angle','width','depth'].every(k=>Number.isFinite(entry.placement?.[k])))?{...entry,source:'cache'}:null;}catch{return null;}}
export function saveWidthCache(key,result){try{const entries=JSON.parse(localStorage.getItem(storageKey)||'{}');delete entries[key];entries[key]=result;const recent=Object.entries(entries).slice(-32);localStorage.setItem(storageKey,JSON.stringify(Object.fromEntries(recent)));}catch{}}
export function precomputedWidth(data,p,bed,upper){
 if(data?.revision!==widthRevision||upper>data.maxColumns||Object.entries(data.configuration).some(([key,value])=>p[key]!==value))return null;
 // At zero tilt, floor depth lies entirely along print Z. All hardware pads,
 // windows and ballast features stay inside the unchanged outer frame in XY.
 for(let columns=upper;columns>=1;columns--){
  if(!data.hulls[columns])return null;
  const placement=bestPlacement(data.hulls[columns],bed.width,bed.depth);
  if(placement.fits)return {columns,rows:p.rows,placement,tested:0,source:'precomputed'};
 }
 return {columns:0,rows:p.rows,tested:0,source:'precomputed'};
}
