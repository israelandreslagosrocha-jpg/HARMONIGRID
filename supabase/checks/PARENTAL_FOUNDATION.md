# Base de autorización parental — no aplicar todavía

La migración 202610120005 prepara un registro de decisiones, no un proceso de verificación parental. No cambia harmonigrid_projects ni afecta permisos vigentes. El lanzamiento infantil requiere completar el plan legal/MENOR_EDAD_PLAN.md.

Para pruebas locales:

```sh
npm install --prefix /private/tmp/hg-supabase-sql-tests --no-save --ignore-scripts @electric-sql/pglite
node tests/parental-authorization.mjs
```

La migración presupone las migraciones 001 y 002 y los roles Supabase anon/authenticated/service_role. La prueba crea estos elementos en una base aislada, sin credenciales reales. No requiere migrar producción.

Decisiones pendientes: método proporcional y jurídicamente válido de verificación del adulto y de su representación; países/edades; recogida previa mínima; evidencia y retención; clasificación y autorización de nuevas cuentas desde servidor; tratamiento de cuentas existentes; revocación; eliminación administrativa. Evitar permisos basados en user_metadata editable y no usar verificación de email como prueba de parentesco.

Las referencias opacas de evidencia no deben contener RUT, fotografías de documentos ni contraseñas. Si el método elegido requiere información identificatoria, revisar almacenamiento, accesos y conservación antes de integrar un proveedor. La aprobación del servidor debe comprobar el método real; la tabla no certifica su validez.
