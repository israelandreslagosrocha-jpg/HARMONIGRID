export function richSong(count) {
 return Array.from({length:count},(_,i)=>({id:`m${i}`,originalMeasureIndex:i,showObligado:true,showSubdivisions:true,
  beats:Array.from({length:4},(_,b)=>({id:`b${i}_${b}`,root:['C','G','A','F'][b],type:b===2?'min':'maj',harmonicRhythm:b===0?'eighth':'quarter',subdivisions:b===0?[{id:`sub${i}_0`,root:'C',type:'maj',isSilence:false},{id:`sub${i}_1`,root:'G',type:'maj',isSilence:false}]:[]})),
  lyrics:{rawText:'Can-ción co-ra-zón',mode:['free','rhythm','synced'][i%3],anchors:[{chordId:`b${i}_0`,start:0,end:7}],lastText:'Can-ción co-ra-zón',lastMode:['free','rhythm','synced'][i%3],lastTextForSuggestion:'Can-ción co-ra-zón',syllableSuggestion:null,
   beats:Array.from({length:4},(_,b)=>({id:`lb${i}_${b}`,harmonicRhythm:'quarter',subdivisions:[]})),
   syllables:Array.from({length:5},(_,j)=>({id:`sy${i}_${j}`,text:['Can','ción','co','ra','zón'][j],wordId:j<2?'w_0':'w_1',rhythmEventId:j<4?`lyrics_${i}_${j}`:null,startTick:j<4?j*480:null,durationTicks:j<4?480:null,tied:false,linkedEvents:[]}))}
 }));
}
