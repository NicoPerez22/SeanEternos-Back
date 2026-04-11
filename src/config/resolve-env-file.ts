/**
 * Archivo de variables de entorno a cargar:
 * - Si existe CONFIG_ENV_FILE, se usa ese path (p. ej. desde npm scripts).
 * - Si NODE_ENV es "production", se usa .env.
 * - En cualquier otro caso, .env-dev (desarrollo local).
 */
export function resolveEnvFilePath(): string {
  const explicit = process.env.CONFIG_ENV_FILE?.trim();
  if (explicit) return explicit;
  return process.env.NODE_ENV === 'production' ? '.env' : '.env-dev';
}
