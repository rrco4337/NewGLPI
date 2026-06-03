export const sessionTokenFromFile: string = (
  (import.meta.env.VITE_GLPI_SESSION_TOKEN as string | undefined) ?? ''
).trim()

