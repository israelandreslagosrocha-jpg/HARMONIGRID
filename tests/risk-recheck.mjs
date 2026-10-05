// Diagnostic evidence of open defects; does not turn known bad behavior into a
// regression contract and does not overwrite the initial audit evidence.
import fs from 'node:fs'
import {nextTick} from 'vue'
import {createEditor,clone} from './component-harness.mjs'
import {getRootPositionMidi} from '../src/core/audio.js'
import {transposeNote} from '../src/core/notes.js'
import {getChordDegree,applySuggestion} from '../src/core/suggestions.js'
const h=await createEditor(),s=h.editor
const report={checked_at:new Date().toISOString(),environment:'Actual Vue setup in Node; no browser, audio-device or cloud load measurement',open_defects:{}}
try {
 const d=report.open_defects
 d.HG05={midi_Esharp:getRootPositionMidi({root:'E#',type:'dim'}),transpose_Esharp_up_two:transposeNote('E#',2,'G#')}
 d.HG07={D_major_in_C:getChordDegree('D','maj','C','major'),D_minor_in_C:getChordDegree('D','min','C','major')}
 d.HG09={C7_b5_midi:getRootPositionMidi({root:'C',type:'7',tensions:['b5']})}
 d.HG10={C7sus4_midi:getRootPositionMidi({root:'C',type:'7sus4'})}
 s.setPlan('PRO');s.configMeasuresCount.value=4;s.startProject();await nextTick()
 s.measures.value[0].beats[0]={id:'original',root:'C',type:'maj',bass:'E',subdivisions:[{id:'sub',root:'G',type:'7'}]};await nextTick()
 s.transposeTargetKey.value='D';s.transposeTargetScale.value='major';s.transposeMode.value='tonal';s.transposeScope.value='all';s.applyTranspose();await nextTick()
 d.HG06=clone(s.measures.value[0].beats[0])
 s.configMeasuresCount.value=4;s.startProject();await nextTick()
 s.measures.value[0].beats[0]={id:'original',root:'C',type:'maj'};await nextTick()
 s.selectedRangeStart.value=0;s.selectedRangeEnd.value=0;s.copySelectedMeasures();s.selectedRangeStart.value=1;s.selectedRangeEnd.value=1;s.pasteCopiedMeasures();await nextTick()
 d.HG11={copied_beat_ids:s.measures.value.slice(0,2).map(m=>m.beats[0].id)}
 d.HG12=applySuggestion([{beats:[{id:'anchored',root:'C',type:'maj',harmonicRhythm:'double',subdivisions:[{root:'G'}],mutedNotes:['E']}]}],[{measureIndex:0,beatIndex:0,chord:{root:'F',type:'maj'}}])
 d.HG13={dotted_quarter:s.getRhythmFigureDuration('dotted-quarter',false),rest_whole:s.getRhythmFigureDuration('rest-whole',false)}
 d.HG17=s.splitChordDisplay({root:'C',type:'69',bass:'E'})
 fs.mkdirSync('docs/security',{recursive:true});fs.writeFileSync('docs/security/musical-risk-recheck.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}finally{h.stop()}
