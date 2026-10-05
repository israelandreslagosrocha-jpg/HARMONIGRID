import {validateProjectDocument,canonicalDocument} from '../core/projectDocument.js'

export function createProjectRepository(client) {
  const table = () => client.from('harmonigrid_projects')
  const result = ({data,error}) => {if(error) throw new Error(error.message);return data}
  const authorization = async ownerId => {
    const {data,error}=await client.auth.getSession()
    if(error||!data.session||data.session.user.id!==ownerId||data.session.user.is_anonymous) throw new Error('La sesión cambió o expiró. Inicia sesión para guardar.')
    return `Bearer ${data.session.access_token}`
  }
  return {
    async list(ownerId,offset=0) {
      const token=await authorization(ownerId)
      return result(await table().select('id,title,revision,updated_at').eq('owner_id',ownerId).order('updated_at',{ascending:false}).order('id').range(offset,offset+49).setHeader('Authorization',token))
    },
    async load(id,ownerId) {
      const token=await authorization(ownerId)
      const row = result(await table().select('*').eq('id',id).eq('owner_id',ownerId).setHeader('Authorization',token).single())
      if (row.owner_id !== ownerId) throw new Error('No tienes acceso a esta composición.')
      row.document = validateProjectDocument(row.document)
      return row
    },
    async save({id,revision,ownerId,document}) {
      const clean = validateProjectDocument(document)
      const token=await authorization(ownerId)
      const payload = {title:clean.title,schema_version:1,document:clean}
      const query = revision === null
        ? table().insert({id,...payload})
        : table().update(payload).eq('id',id).eq('owner_id',ownerId).eq('revision',revision)
      const response=await query.select('id,owner_id,title,revision,updated_at').setHeader('Authorization',token).maybeSingle()
      // A first INSERT may commit even if its response was lost. Retry with the
      // same UUID; accept the existing row only when its document is identical.
      if(revision===null && response.error?.code==='23505') {
        const existing=await this.load(id,ownerId)
        if(canonicalDocument(existing.document)===canonicalDocument(clean))return existing
        const error=new Error('La composición ya existe con otros cambios. Guarda una copia.');error.code='PROJECT_CONFLICT';throw error
      }
      const row = result(response)
      if (!row) {
        const error = new Error('La composición cambió en otro dispositivo o ya no tienes acceso. Guarda una copia para conservar tus cambios antes de abrir la versión de la nube.')
        error.code = 'PROJECT_CONFLICT'
        throw error
      }
      if (row.owner_id !== ownerId) throw new Error('La sesión cambió. No se confirmó el guardado.')
      return row
    },
  }
}
