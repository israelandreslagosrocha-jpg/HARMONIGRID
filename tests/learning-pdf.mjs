import assert from 'node:assert/strict'
import { createLearningPdf, LEARNING_RESOURCES } from '../src/core/learningPdf.js'
let checks=0
for(const tonic of ['C','D','E','F','G','A','B','C#','D#','F#','G#','A#','Db','Eb','Gb','Ab','Bb']) {
  for(const scale of ['major','minor']) for(const {id} of LEARNING_RESOURCES) {
    const doc=createLearningPdf({tonic,scale,resource:id})
    assert.equal(doc.getNumberOfPages(),1)
    assert.ok(doc.output().startsWith('%PDF-'))
    checks++
  }
}
for(const invalid of [{tonic:'<script>',scale:'major',resource:'tonalidad'},{tonic:'C',scale:'dorian',resource:'tonalidad'},{tonic:'C',scale:'major',resource:'unknown'}]) assert.throws(()=>createLearningPdf(invalid))
console.log(`${checks} personalized FREE educational PDFs fit one page; unsupported inputs rejected`)
