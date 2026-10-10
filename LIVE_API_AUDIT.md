# Auditoría de aislamiento de Supabase

Objetivo: `wvkldhkgznersewjmhzo`. Ejecutar `node tests/supabase-live-isolation.mjs`.

La prueba carga la clave pública de `.env.local`. Nunca utiliza `service_role`.
Sin credenciales, comprueba el rechazo de lectura anónima y termina con código 2
para señalar que la auditoría entre cuentas sigue pendiente.

Para completar la prueba, rellenar **localmente** `.env.audit.local` con dos
cuentas distintas, verificadas y con contraseña de HarmoniGrid. Una contraseña
de Google no sirve para el acceso por correo de Supabase. No enviar contraseñas
por chat ni agregar este archivo a Git: `.env.*.local` ya está excluido.
Para caracteres especiales, envolver el valor entre comillas según formato dotenv.

La cuenta A requiere un espacio libre dentro del límite de 20 composiciones.
Se crea una sola composición identificada como `AUDITORÍA API`; todas las
peticiones de modificación y eliminación apuntan exclusivamente a ese ID.
La prueba comprueba lectura y modificación cruzada, eliminación prohibida,
cambio de propietario prohibido y conservación de título, propietario y revisión.
La composición de prueba permanece para revisión porque la API no permite
eliminar composiciones. No se borra automáticamente con privilegios elevados.

Si falla una comprobación, detener el lanzamiento e investigar; no usar el
resultado parcial como aprobación de seguridad. Esta prueba no sustituye una
auditoría completa ni demuestra resistencia ante todos los tipos de ataque.

## Resultados del 10 de octubre de 2026

- API publicada: lectura anónima rechazada, comprobada.
- PostgreSQL aislado: 27 comprobaciones de propiedad, RLS y revisiones aprobadas.
- PostgreSQL aislado: 13 comprobaciones de límites FREE y diagnóstico aprobadas.
- PostgreSQL aislado: 18 comprobaciones de recursos, aislamiento y límites de frecuencia aprobadas.
- API publicada con dos cuentas: pendiente de credenciales locales.
