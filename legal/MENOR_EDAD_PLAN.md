# Plan de acceso infantil supervisado

Estado: propuesta de implementación, sin cambios en producción ni garantía de cumplimiento legal.

## Decisión de producto

El público incluye niños de 8 años o menos. Mantener creación, reproducción y exportación sin exigir cuenta. Para guardar datos infantiles en la nube, preparar un proceso supervisado por adulto con autorización verificable, antes de recolectar datos del niño para ese propósito. No sustituirlo por una casilla, Google OAuth ni por usar simplemente el correo de un adulto.

## Secuencia propuesta

1. Auditar tráfico de visitante y proveedores: datos técnicos, retención y fines. No llamar al modo sin cuenta «sin datos»; los registros de alojamiento también importan.
2. Definir países iniciales, edades y reglas con revisión jurídica. Chile: reforma con vigencia el 1 de diciembre de 2026; artículo 16 quáter para datos de menores de 14 años. Estados Unidos: evaluar COPPA para menores de 13 cuando corresponda. No extrapolar una regla a todos los países.
3. Diseñar registro de público mixto, incluyendo la ruta de adulto supervisor antes de registrar una cuenta infantil. Recoger únicamente la información necesaria para establecer elegibilidad y autorización; no cargar previamente datos infantiles mediante Google.
4. Adulto recibe información comprensible sobre datos, fines, proveedores, conservación y derechos. Elegir y validar un método de consentimiento verificable y proporcional a los datos y países; verificar un email sólo acredita control de ese email, no identidad ni relación parental.
5. Backend registra autorización, versión del aviso, alcance, adulto responsable y fecha, con acceso restringido y evidencia mínima. No aceptar que el navegador se autoasigne autorización o edad mediante metadatos editables.
6. Autorizar almacenamiento sólo si la autorización válida corresponde al perfil infantil. Aplicar el requisito en servidor, en todas las rutas de guardado, no únicamente en la interfaz. Mantener aisladas las cuentas existentes; migrar mediante un plan revisado que no borre canciones.
7. Supervisor puede revisar, revocar y solicitar eliminación. Diseñar eliminación administrativa segura de proyectos y cuenta, copias locales y tratamiento de respaldos; no afirmar eliminación instantánea de respaldos. Verificar la facultad del solicitante antes de entregar datos infantiles.
8. Mensajes claros para el niño: no introducir nombres completos, escuela, dirección ni otros datos personales en títulos o letras; revisar los datos mínimos del perfil Google. Sin perfiles públicos, mensajería ni colaboración abierta.

## Pruebas de aceptación antes de habilitar

- Un perfil infantil sin autorización no puede guardar por API, correo ni Google.
- Una autorización de otro perfil/adulto no concede acceso.
- La revocación se aplica al siguiente guardado y a sesiones ya abiertas, sin perder trabajo local silenciosamente.
- Reintentos y concurrencia no eluden permisos; modificación directa de metadatos no los cambia.
- Solicitudes de acceso y eliminación verifican identidad y autoridad; el registro de evidencia no expone datos a terceros.
- Adultos existentes mantienen sus composiciones y funcionamiento durante la migración.
- Uso musical sin cuenta sigue funcionando en PC y teléfono.

## Trabajo que aún falta

No se han implementado perfiles infantiles, permisos parentales, pantalla de edad, verificación de tutores ni eliminación de cuenta. No publicar la política como si estuvieran disponibles. Publicar las páginas legales de Google sólo después de aprobar un texto fiel al estado efectivo del MVP.

Fuentes primarias de referencia:
- https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2026-12-01
- https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13
- https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
