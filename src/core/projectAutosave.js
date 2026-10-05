// Sequential writes; capture account/project identity before any asynchronous work.
// Responses from an old account/project never change the current save indicator.
export function createProjectAutosave({repository,recovery,onState,delay=2000,newId=()=>crypto.randomUUID()}) {
  let owner=null,active=null,pending=null,checkpoint=null,version=0,epoch=0,timer=null,flight=null,disposed=false
  let status='guest',message='',lastSaved=null,conflict=false
  const state=()=>({owner,id:active?.id??null,revision:active?.revision??null,dirty:!!pending,status,message,lastSaved})
  const notify=()=>{if(!disposed)onState(state())}
  const cancel=()=>{clearTimeout(timer);timer=null}
  const schedule=()=>{cancel();if(owner&&active&&pending&&!conflict)timer=setTimeout(()=>{flush(false).catch(()=>{})},delay)}
  async function flush(drain=true) {
    cancel()
    if(flight) {await flight;if(pending&&owner&&active&&!conflict){if(drain)return flush();schedule()}return state()}
    if(!pending||!owner||!active)return state()
    if(conflict)throw new Error(message)
    const task={owner,id:active.id,revision:active.revision,document:pending,checkpoint,version,epoch}
    status='saving';message='';notify()
    flight=(async()=>{
      // Recovery precedes network submission; it is always namespaced to owner.
      try{await recovery.put(task.owner,task.id,{document:task.document,revision:task.revision,checkpoint:task.checkpoint})}catch(error){
        // Cloud save can still succeed even when the browser's storage is full.
        if(task.epoch===epoch)message='No se pudo crear la copia local de recuperación.'
      }
      try {
        const row=await repository.save({ownerId:task.owner,id:task.id,revision:task.revision,document:task.document})
        await recovery.remove(task.owner,task.id,task.checkpoint).catch(()=>{})
        if(task.epoch===epoch) {
          active.revision=Number(row.revision);lastSaved=row.updated_at
          if(version===task.version)pending=null
          status=pending?'pending':'saved';message=''
          notify()
        }
      } catch(error) {
        if(task.epoch===epoch && version!==task.version && pending) await recovery.put(owner,active.id,{document:pending,revision:active.revision,checkpoint}).catch(()=>{})
        if(task.epoch===epoch) {conflict=error.code==='PROJECT_CONFLICT';status=conflict?'conflict':'error';message=error.message;notify()}
        throw error
      }
    })()
    try{await flight}finally{flight=null}
    if(pending&&task.epoch===epoch&&!conflict){if(drain)return flush();schedule()}
    return state()
  }
  const detach=()=>{
    cancel()
    // Preserve a pending snapshot when an external auth event closes the session.
    if(owner&&active&&pending)recovery.put(owner,active.id,{document:pending,revision:active.revision,checkpoint}).catch(()=>{})
    epoch++;active=null;pending=null;version++;conflict=false;lastSaved=null;message=''
  }
  return {
    state,
    setOwner(id) {if(owner===id)return;detach();owner=id;status=owner?'unsaved':'guest';notify()},
    async beginNew() {
      // Detach synchronously: a new composition must never enter the old row.
      const saving=flush().catch(()=>{})
      detach();status=owner?'unsaved':'guest';notify()
      await saving
    },
    attach(row) {detach();active={id:row.id,revision:Number(row.revision)};status='saved';lastSaved=row.updated_at;notify()},
    recover(row) {detach();active={id:row.id,revision:row.revision===null?null:Number(row.revision)};pending=row.document;checkpoint=row.checkpoint||crypto.randomUUID();version++;status='pending';notify();schedule()},
    changed(document) {
      if(!owner||!active||!document)return
      pending=document;checkpoint=crypto.randomUUID();version++;if(!conflict)status='pending';notify();schedule()
    },
    async saveNew(document) {
      if(!owner)throw new Error('Inicia sesión para guardar una composición.')
      const targetOwner=owner,starting=this.beginNew(),expectedEpoch=epoch
      await starting
      if(owner!==targetOwner||epoch!==expectedEpoch)throw new Error('La sesión o la composición cambió. Vuelve a guardar desde tu cuenta.')
      active={id:newId(),revision:null};pending=document;checkpoint=crypto.randomUUID();version++;status='pending';notify()
      return flush()
    },
    flush,
    dispose() {detach();disposed=true},
  }
}
