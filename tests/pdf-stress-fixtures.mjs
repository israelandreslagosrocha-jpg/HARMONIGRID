export const formats=['chords-only','chords-only-expanded','chords-and-lyrics-free','chords-and-lyrics-rhythm','chords-and-lyrics-synced']
export const meters=[{beats:4,unit:4,grouping:[1,1,1,1]}, {beats:5,unit:8,grouping:[3,2]}, {beats:7,unit:8,grouping:[2,2,3]}, {beats:11,unit:8,grouping:[3,3,3,2]}, {beats:5,unit:4,grouping:[3,2]}, {beats:7,unit:4,grouping:[2,2,3]}, {beats:13,unit:8,grouping:[3,3,3,2,2]}]
const chords=[{root:'C',type:'maj7',tensions:['9','#11'],bass:'E'}, {root:'F#',type:'7',tensions:['b9','#9','b13'],bass:'A#'}, {root:'Bb',type:'m7b5',tensions:['11'],bass:'Db'}, {root:'Ab',type:'maj7#5',tensions:['9'],bass:'C'}, {root:'D',type:'mM7',tensions:['9','11']}, {root:'G',type:'69',bass:'B'}, {root:'Eb',type:'m69',bass:'Gb'}]
export function stressProject(format){
 const measures=[]
 for(const [caseIndex,sig] of meters.entries())for(let variant=0;variant<2;variant++){
  const i=measures.length,chord=chords[caseIndex],kind=variant===0?'CIFRADO Y SILABAS EN SEMICORCHEAS':'SUBDIVISIONES Y SILENCIOS'
  const beats=Array.from({length:sig.beats},(_,b)=>({...structuredClone(chord),id:`b${i}_${b}`,harmonicRhythm:'auto',subdivisions:[]}))
  const lyricBeats=Array.from({length:sig.beats},()=>({harmonicRhythm:'auto',subdivisions:[]})),syllables=[]
  if(variant===0){
    beats[0].harmonicRhythm=caseIndex===6?'dotted-quarter':'quarter'
    if(caseIndex===4){beats[0].harmonicRhythm='eighth';beats[0].subdivisions=[structuredClone(chord),structuredClone(chord)]}
    if(sig.unit===4){lyricBeats[0]={harmonicRhythm:'sixteenth',sixteenthPattern:'4_semi',subdivisions:Array.from({length:4},()=>({}))}
     for(let s=0;s<4;s++)syllables.push({text:['ma','ra','vi','lla'][s],wordId:`w${i}`,rhythmEventId:`lyrics_${i}_0_${s}`})}
    else for(let b=0;b<2;b++){lyricBeats[b]={harmonicRhythm:'eighth',eighthPattern:'2_notes',subdivisions:[{},{}]};for(let s=0;s<2;s++)syllables.push({text:['ma','ra','vi','lla'][b*2+s],wordId:`w${i}`,rhythmEventId:`lyrics_${i}_${b}_${s}`})}
    for(let b=2;b<sig.beats;b++)syllables.push({text:'son',wordId:`w${i}_${b}`,rhythmEventId:`lyrics_${i}_${b}`})
  }else{
    const rhythms=['eighth','sixteenth','triplet','quintuplet','offbeat','rest-quarter','dotted-quarter']
    for(let b=0;b<sig.beats;b++){
      let r=rhythms[b%rhythms.length]
      const span=sig.unit===8?(r==='dotted-quarter'?3:['sixteenth','triplet','rest-quarter'].includes(r)?2:1):(r==='dotted-quarter'?1.5:1)
      if(b+span>sig.beats)r='auto' // No accidental duration overflow in a valid stress fixture.
      const n=r==='eighth'?2:r==='sixteenth'?4:r==='triplet'?3:r==='quintuplet'?5:r==='offbeat'?2:0
      beats[b].harmonicRhythm=r
      if(n){beats[b].eighthPattern=r==='eighth'?'2_notes':undefined;beats[b].subdivisions=Array.from({length:n},(_,s)=>({...structuredClone(chord),isSilence:r==='offbeat'&&s===0}))}
      lyricBeats[b]={harmonicRhythm:r,eighthPattern:r==='eighth'?'2_notes':undefined,subdivisions:n?Array.from({length:n},(_,s)=>({isSilence:r==='offbeat'&&s===0})):[]}
      if(r.startsWith('rest-'))continue
      for(let s=0;s<(n||1);s++){if(r==='offbeat'&&s===0)continue;syllables.push({text:['so','na','mos','hoy','sí'][s],wordId:`w${i}_${b}`,rhythmEventId:`lyrics_${i}_${b}${n?'_'+s:''}`})}
    }
    // Mixed duration pattern: an eighth followed by two sixteenths in 4-based meter.
    if(sig.unit===4){beats[1].subdivisions[1].isMerged=true;lyricBeats[1].subdivisions[1].isMerged=true;syllables.splice(syllables.findIndex(s=>s.rhythmEventId===`lyrics_${i}_1_1`),1)}
  }
  const mode=format.endsWith('free')?'free':format.endsWith('synced')?'synced':'rhythm'
  measures.push({id:`m${i}`,originalMeasureIndex:i,displayedMeasureIndex:i,activeTimeSignature:{beats:sig.beats,unit:sig.unit},timeSignature:{beats:sig.beats,unit:sig.unit},grouping:sig.grouping,activeGrouping:sig.grouping,
   activeKey:'C',activeScale:'major',systemBreak:true,sectionLabel:`CASO ${i+1}: ${sig.beats}/${sig.unit} (${sig.grouping.join('+')}) - ${kind}`,
   showObligado:variant===1||caseIndex%2===0,showSubdivisions:true,beats,
   lyrics:{mode,rawText:'Ma-ra-vi-lla: sonamos hoy, sin perder el pulso.',beats:lyricBeats,syllables,anchors:[{chordId:beats[0].id,start:0,end:12}]}})
 }
 measures[1].lyrics.syllables=measures[1].lyrics.syllables.filter(s=>!['lyrics_1_0_0','lyrics_1_3_1'].includes(s.rhythmEventId))
 return {title:'Pruebas de exportación: acordes complejos y métricas irregulares',key:'C',scaleType:'major',timeSignature:4,timeSignatureUnit:4,globalGroove:'Ninguno',viewMode:format==='chords-only-expanded'?'expanded':'compact',measures,
 repeats:[{type:'simple',startMeasure:1,endMeasure:2,times:2},{type:'casilla',startMeasure:9,endMeasure:10,times:2,casilla1Start:10,casilla2Start:11,casilla2End:11}],tiedSlots:['1_0_0','1_3_1'],lyricsTiedSlots:['lyrics_1_0_0','lyrics_1_3_1']}
}
