# Restablecimiento de contraseña por administrador

1. El administrador llama a POST /api/v1/auth/password-reset/:userId con Authorization: Bearer <JWT del administrador>. El rol se consulta en la base de datos (idRol = 1).
2. La respuesta data contiene token y expiresIn (900 segundos). El administrador entrega el token al usuario por el medio que utilicen. No se envía correo.
3. Sin iniciar sesión, el usuario llama a POST /api/v1/auth/password-reset con este JSON:

```json
{
  "token": "<token entregado por el administrador>",
  "newPassword": "miNuevaClave123"
}
```

La nueva clave debe tener al menos 8 caracteres y como máximo 72 bytes UTF-8. Después del cambio el usuario inicia sesión normalmente.

El token vence a los 15 minutos, es de un solo uso y no sirve para autenticar otras rutas. Generar otro token invalida el anterior. Al generar un token se reemplaza la clave anterior por una aleatoria desconocida, bloqueando el login con la clave anterior. Si vence, el administrador debe generar otro. No requiere cambios de esquema: la firma depende del hash de contraseña actual y el guardado es condicional para evitar consumo simultáneo.

Las sesiones JWT previamente emitidas conservan su vencimiento habitual: este flujo no revoca sesiones existentes. El endpoint PATCH /api/v1/auth/password continúa disponible para usuarios con sesión iniciada.

El backend entrega el token; la pantalla para ingresarlo y elegir la nueva clave debe integrarse en el frontend. No publicar ni registrar el token en logs.
