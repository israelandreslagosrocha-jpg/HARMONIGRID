// Supabase owns verification tokens, delivery and server-side rate limits.
export async function requestAccountEmail(client,kind,email,redirectTo) {
  const address=email.trim()
  const url=new URL(redirectTo)
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Retorno de acceso inválido.')
  if(!address)throw new Error('Introduce tu correo electrónico.')
  let result
  if(kind==='confirmation')result=await client.auth.resend({type:'signup',email:address,options:{emailRedirectTo:redirectTo}})
  else if(kind==='recovery')result=await client.auth.resetPasswordForEmail(address,{redirectTo})
  else throw new Error('Solicitud de correo desconocida.')
  if(result.error)throw result.error
  return kind==='confirmation'
    ? 'Si tu cuenta necesita confirmación, recibirás un nuevo enlace. Revisa también la carpeta de spam.'
    : 'Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.'
}
