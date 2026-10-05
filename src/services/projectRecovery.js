import localforage from 'localforage'
const store = localforage.createInstance({name:'harmonigrid',storeName:'account_recovery_v1'})
const key = (owner,id,checkpoint) => `${owner}:${id}:${checkpoint}`
export function createProjectRecovery(storage) {
  return {
    async put(owner,id,value) {
      const prefix=`${owner}:${id}:`
      await storage.setItem(key(owner,id,value.checkpoint),{...value,owner_id:owner,id,recovered_at:new Date().toISOString()})
      // Bound storage for offline editing; never prune another account/project.
      const entries=[]
      await storage.iterate((row,k)=>{if(k.startsWith(prefix)&&row.owner_id===owner&&row.id===id)entries.push({k,row,order:entries.length})})
      entries.sort((a,b)=>b.row.recovered_at.localeCompare(a.row.recovered_at)||b.order-a.order)
      for(const entry of entries.slice(3))await storage.removeItem(entry.k)
    },
    // Separate checkpoint keys prevent a late response deleting a newer draft.
    async remove(owner,id,checkpoint) {await storage.removeItem(key(owner,id,checkpoint))},
    async list(owner) {
      const entries=[]
      await storage.iterate((value,k)=>{if(k.startsWith(owner+':')&&value.owner_id===owner)entries.push(value)})
      return entries.sort((a,b)=>b.recovered_at.localeCompare(a.recovered_at))
    },
  }
}
export const projectRecovery=createProjectRecovery(store)
