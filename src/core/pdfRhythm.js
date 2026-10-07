// PDF-only engraving. Positions are expressed in denominator beats, shared by
// harmony and lyrics; this module never mutates the project or playback state.
export function buildRhythmEvents(states, {unit, measureIndex, lyrics=false, rhythmFor, slotsFor, syllableFor}) {
  const events=[]
  for(let b=0;b<states.length;b++) {
    const state=states[b]
    if(state.isMerged)continue
    const beat=state.beat || state.source
    const rhythm=rhythmFor(beat,b)
    const slots=slotsFor(beat,b)
    const span=state.durationSlots || state.flexGrow || 1
    const source=slots.length?slots:[beat]
    for(let s=0;s<source.length;s++) {
      const slot=source[s] || {}
      if(slot.isMerged)continue
      let length=1
      while(source[s+length]?.isMerged)length++
      const sub=slots.length?s:null
      events.push({id:`${lyrics?'lyrics_':''}${measureIndex}_${b}${sub===null?'':'_'+sub}`,
        start:b+(slots.length?s/source.length*span:0), duration:span*length/source.length*4/unit,
        beatIndex:b,subIndex:sub,source:slot,rest:!!slot.isSilence || rhythm.startsWith('rest-'),
        tuplet:rhythm==='triplet'?3:rhythm==='quintuplet'?5:null,
        syllable:lyrics?syllableFor(b,sub):null})
    }
  }
  return events
}

export function positionRhythmEvents(events,x,width,beats) {
  // Equal onsets in either voice always map to the same x, including long notes.
  const inset=5,span=Math.max(1,width-2*inset)
  return events.map(event=>({...event,x:x+inset+event.start/beats*span}))
}

export function drawRhythmVoice(doc,events,y,{slash=false,grouping=[1],unit=4}={}) {
  const direction=slash?1:-1,stemEnd=y+direction*7
  const boundaries=[];let sum=0
  for(const size of grouping){sum+=size;boundaries.push(sum)}
  const groupOf=e=>boundaries.findIndex(end=>e.start<end-1e-8)
  const levels=e=>e.tuplet? (unit===8?2:1) : e.duration<0.249?3:e.duration<0.499?2:e.duration<0.999?1:0
  doc.setDrawColor(0,0,0);doc.setFillColor(0,0,0);doc.setLineWidth(.28)
  const stemX=e=>e.x+(slash?-1.1:1.1)
  const head=e=>{
    const open=e.duration>=2-1e-8
    if(slash){
      if(open){doc.lines([[1.2,-1.2],[1.2,1.2],[-1.2,1.2],[-1.2,-1.2]],e.x-1.2,y, [1,1],'S',true)}
      else {doc.setLineWidth(.65);doc.line(e.x-1.1,y+1.5,e.x+1.1,y-1.5);doc.setLineWidth(.28)}
    }else{doc.setFillColor(open?255:0,open?255:0,open?255:0);doc.ellipse(e.x,y,1.2,.8,open?'FD':'F');doc.setFillColor(0,0,0)}
    if(![.25,.5,1,2,4].some(v=>Math.abs(e.duration-v)<1e-7) && !e.tuplet)doc.circle(e.x+2,y-.2,.35,'F')
  }
  const groups=[];let run=[]
  const flush=()=>{if(run.length)groups.push(run);run=[]}
  events.forEach((e,i)=>{
    if(e.reference){flush();doc.setLineWidth(.3);doc.line(e.x-1.1,y+1.5,e.x+1.1,y-1.5);return}
    if(e.rest){
      flush()
      if(e.duration>=2){doc.rect(e.x-1,y-(e.duration>=4?0:1),2,1,'F');doc.line(e.x-1.7,y,e.x+1.7,y)}
      else if(e.duration>=1){doc.setLineWidth(.5);doc.line(e.x-.7,y-2,e.x+.7,y-.5);doc.line(e.x+.7,y-.5,e.x-.7,y+1);doc.circle(e.x-.4,y+1.5,.35,'F')}
      else {const n=levels(e);doc.line(e.x+.8,y-2,e.x-.4,y+1.7);for(let j=0;j<n;j++){doc.circle(e.x-.5,y-2+j*1.1,.4,'F');doc.line(e.x-.5,y-2+j*1.1,e.x+.8-j*.25,y-2+j*1.1)}}
      if(![.25,.5,1,2,4].some(v=>Math.abs(e.duration-v)<1e-7)&&!e.tuplet)doc.circle(e.x+2,y,.35,'F')
      doc.setLineWidth(.28);return
    }
    if(e.duration<4-1e-8)doc.line(stemX(e),y,stemX(e),stemEnd)
    head(e)
    if(levels(e)){
      if(run.length && (groupOf(run.at(-1))!==groupOf(e) || Math.abs(run.at(-1).start+run.at(-1).duration*unit/4-e.start)>1e-7))flush()
      run.push(e)
    }else flush()
    if(i===events.length-1)flush()
  });flush()
  for(const group of groups){
    const max=Math.max(...group.map(levels))
    for(let level=1;level<=max;level++){
      const beamY=stemEnd-direction*(level-1)*1.1
      let segment=[]
      const paint=()=>{if(!segment.length)return;doc.setLineWidth(.75);const first=segment[0],last=segment.at(-1)
        if(segment.length>1)doc.line(stemX(first),beamY,stemX(last),beamY)
        else if(group.length===1)doc.line(stemX(first),beamY,stemX(first)+1.8,beamY-direction*2)
        else doc.line(stemX(first),beamY,stemX(first)+(first===group.at(-1)?-1.8:1.8),beamY)
        segment=[]}
      for(const e of group){if(levels(e)>=level)segment.push(e);else paint()}paint()
    }
    const tuplet=group[0].tuplet
    if(tuplet){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(String(tuplet),(group[0].x+group.at(-1).x)/2,stemEnd+direction*3,{align:'center'})}
  }
  doc.setLineWidth(.3)
}

export function drawRhythmTie(doc,x1,x2,y,down=false) {
  if(x2<=x1)return
  const height=(down?1:-1)*2.2
  // Cubic Bézier rendered as vector segments, no external font or HTML.
  const points=[];let px=x1,py=y
  for(let i=1;i<=16;i++){const t=i/16,u=1-t;const x=x1+(x2-x1)*t;const yy=y+3*u*t*height;points.push([x-px,yy-py]);px=x;py=yy}
  doc.setDrawColor(0,0,0);doc.setLineWidth(.3);doc.lines(points,x1,y,[1,1],'S',false)
}
