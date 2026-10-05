// Clone musical content, assign new identity, and remap internal lyric links.
export function cloneMeasuresForPaste(measures, sourceIndexes, targetStart, newId) {
  const copies=JSON.parse(JSON.stringify(measures))
  const positions=new Map(sourceIndexes.map((index,i)=>[index,targetStart+i]))
  const slot=value=>{
    if(typeof value!=='string')return value
    const match=/^(lyrics_)?(\d+)(_\d+(?:_\d+)?)$/.exec(value)
    return match&&positions.has(Number(match[2]))?`${match[1]||''}${positions.get(Number(match[2]))}${match[3]}`:null
  }
  copies.forEach(measure=>{
    delete measure.originalMeasureIndex
    const ids=new Map()
    const renew=item=>{const previous=item.id;item.id=newId();if(previous)ids.set(previous,item.id)}
    renew(measure)
    for(const beat of measure.beats||[]){renew(beat);for(const sub of beat.subdivisions||[])renew(sub)}
    for(const beat of measure.lyrics?.beats||[]){renew(beat);for(const sub of beat.subdivisions||[])renew(sub)}
    for(const syllable of measure.lyrics?.syllables||[])renew(syllable)
    for(const anchor of measure.lyrics?.anchors||[])if(ids.has(anchor.chordId))anchor.chordId=ids.get(anchor.chordId)
    for(const syllable of measure.lyrics?.syllables||[]){
      if(syllable.rhythmEventId)syllable.rhythmEventId=slot(syllable.rhythmEventId)
      if(syllable.linkedEvents)syllable.linkedEvents=syllable.linkedEvents.map(slot).filter(Boolean)
      // Timeline synchronization derives duration/tied from the pasted slots.
    }
  })
  return copies
}
export function pasteInternalTies(existing, copied, sourceIndexes, targetStart, count) {
  const positions=new Map(sourceIndexes.map((index,i)=>[index,targetStart+i]))
  const result=new Set([...existing].filter(id=>{
    const match=/^(?:lyrics_)?(\d+)_/.exec(id)
    return !match||Number(match[1])<targetStart||Number(match[1])>=targetStart+count
  }))
  for(const id of copied){
    const match=/^(lyrics_)?(\d+)(_\d+(?:_\d+)?)$/.exec(id)
    if(!match||!positions.has(Number(match[2])))continue
    // A tie into the first slot originates outside the copied range.
    if(Number(match[2])===sourceIndexes[0]&&/^_0(?:_0)?$/.test(match[3]))continue
    result.add(`${match[1]||''}${positions.get(Number(match[2]))}${match[3]}`)
  }
  return result
}
