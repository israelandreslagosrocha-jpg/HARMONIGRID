# Correos de acceso y lanzamiento FREE

Actualización: 10 de octubre de 2026. Rama codex/security-performance; main sin cambios.

## Preparado en desarrollo

- Reenviar confirmación desde el diálogo de cuenta, sin exigir contraseña.
- Recuperación conserva su comportamiento y mensajes que no revelan si una dirección tiene cuenta.
- Plantillas HTML de confirmación y recuperación con la paleta HarmoniGrid, sin publicidad PRO ni pagos.
- Los enlaces usan {{ .ConfirmationURL }} generado por Supabase; no se construyen tokens en la aplicación.

## Configuración y pendientes de lanzamiento

El propietario confirmó la cuenta oficial community@harmonigrid.com en Zoho Mail y la configuración del dominio harmonigrid.com. Nombre visible: HarmoniGrid. harmonigrid.com es la landing y el dominio administrativo; harmonigrid.app es la aplicación. Los tres MX, SPF y DKIM se guardaron en Hostinger; el propietario confirmó que todo está configurado. SMTP personalizado quedó guardado en Supabase con smtppro.zoho.com, puerto 465 SSL, usuario community@harmonigrid.com y credencial ingresada directamente por el propietario. El host y puerto se comprobaron en los ajustes de la cuenta Zoho. La entrega y recuperación se probaron con Gmail; no equivalen a una validación de capacidad para grandes volúmenes.

1. Verificar el dominio con el TXT exacto que entregue Zoho.
2. Configurar MX para recibir correo y SPF/DKIM con los valores de la consola. Si ya existe SPF, integrar los emisores en un único registro, no duplicarlo. Revisar DMARC después de verificar los emisores autorizados. No sustituir los registros web de Vercel por los de correo.
3. Confirmar acceso SMTP y que el uso para confirmación/recuperación automática esté admitido por el servicio y sus límites. Zoho Mail es el buzón oficial; la capacidad real de envío transaccional debe validarse antes de abrir el registro público.
4. Supabase → Authentication → SMTP: usar host y puerto indicados en Zoho para esta cuenta/región, usuario completo y credencial apropiada (contraseña de aplicación si corresponde). Ingresar el secreto directamente en Supabase, nunca en variables VITE_, Git ni chat.
5. Supabase → Email Templates: Confirm signup, asunto «Confirma tu cuenta de HarmoniGrid», contenido supabase/templates/confirmation.html. Reset password, asunto «Recupera tu acceso a HarmoniGrid», contenido supabase/templates/recovery.html. Desactivar el seguimiento de enlaces del proveedor para estos mensajes.
6. No cambiar Site URL al dominio oficial hasta que el dominio abra la app real con HTTPS. Mantener la URL exacta del preview en Redirect URLs. Cuando esté activo, agregar https://harmonigrid.app/ y establecer el Site URL de producción decidido (si la app vive en un subdominio, usar ese origen real). No introducir comodines amplios.
7. Google: el callback de Supabase no cambia: https://wvkldhkgznersewjmhzo.supabase.co/auth/v1/callback. Revisar los orígenes/dominos autorizados y el estado de publicación del cliente Google antes del lanzamiento.

## Aceptación antes de lanzar

- Enviar registro a una dirección externa al equipo y confirmar entrega en bandeja o spam.
- Confirmar enlace en el navegador que inició la solicitud (el flujo actual usa PKCE); comprobar después el acceso desde otro dispositivo con cuenta ya confirmada.
- Solicitar reenvío y probar enlace caducado/usado sin perder una composición abierta.
- Recuperar acceso; el propietario ingresa la nueva contraseña directamente. Confirmar que se abre el formulario de contraseña y que el nuevo acceso funciona.
- Probar Gmail y otro proveedor de destinatario. Revisar SPF/DKIM/DMARC del mensaje recibido.
- Probar límites de correo sin generar envíos masivos. Ajustarlos según capacidad aprobada del proveedor, no según la cuota de guardado de composiciones.
- No considerar la configuración SMTP terminada sin estas pruebas reales.

## Evidencia acumulada

El propietario confirmó recuperación de una composición desde Supabase, ausencia de la canción de otra cuenta en la UI y audio en iPhone SE. Además, el propietario confirmó entrega del correo de registro a teomusicrecords@gmail.com. Supabase mostró correo confirmado e inicio de sesión. La recuperación llegó a Gmail, abrió el formulario con dos campos de contraseña y mostró «Contraseña actualizada»; el propietario confirmó un nuevo inicio de sesión con ella.

Las plantillas de confirmación y recuperación en español se guardaron en Supabase y sus vistas previas se revisaron conservando {{ .ConfirmationURL }}. Falta comprobar la entrega y apariencia de estas nuevas plantillas en Gmail y otro proveedor, así como los encabezados de autenticación y la capacidad de envío.

Se aplicó, con autorización explícita, una excepción de protección Vercel sólo para harmonigrid-git-codex-security-performance-lagosrocha.vercel.app; el propietario confirmó acceso desde otra cuenta sin sesión Vercel. No se publicó main ni se conectó harmonigrid.app.

La API real rechaza lectura anónima. Pasaron 58 comprobaciones PostgreSQL aisladas de RLS, límites y recursos. La prueba API A/B sigue pendiente de dos credenciales locales. iPhone 15 y Android siguen pendientes.

Fuentes: https://supabase.com/docs/guides/auth/auth-smtp ; https://supabase.com/docs/guides/auth/auth-email-templates ; https://www.zoho.com/mail/help/zoho-smtp.html ; https://www.zoho.com/mail/help/adminconsole/domain-verification.html
