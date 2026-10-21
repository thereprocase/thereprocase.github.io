/** Stable recipe names, with independent UI choices. Legacy names retain their geometry. */
export const baseChoices = {
 frame:{closed:false,magnets:false,screws:false,weighted:false},
 plain:{closed:true,magnets:false,screws:false,weighted:false},
 magnets:{closed:true,magnets:true,screws:false,weighted:false},
 screws:{closed:true,magnets:false,screws:true,weighted:false},
 both:{closed:true,magnets:true,screws:true,weighted:false},
 weighted:{closed:true,magnets:true,screws:true,weighted:true},
 'open-magnets':{closed:false,magnets:true,screws:false,weighted:false},
 'open-screws':{closed:false,magnets:false,screws:true,weighted:false},
 'open-both':{closed:false,magnets:true,screws:true,weighted:false},
 'weighted-plain':{closed:true,magnets:false,screws:false,weighted:true},
 'weighted-magnets':{closed:true,magnets:true,screws:false,weighted:true},
 'weighted-screws':{closed:true,magnets:false,screws:true,weighted:true},
};
export const baseTypes=Object.fromEntries(Object.entries(baseChoices).map(([key,p])=>[key,[p.closed?'Closed floor':'Open floor',p.magnets?'magnets':'',p.screws?'M3 holes':'',p.weighted?'ballast':''].filter(Boolean).join(' + ')]));
export function baseTypeFor(choices){
 const entry=Object.entries(baseChoices).find(([,p])=>Object.keys(p).every(k=>p[k]===choices[k]));
 if(!entry)throw Error('Ballast requires a closed floor.');return entry[0];
}

/** Nominal pockets for 6 × 2 mm magnets; depth is shared between fit presets. */
export const magnetFits={glue:{label:'Glue fit',diameter:6.5},press:{label:'Press fit',diameter:5.9}};
