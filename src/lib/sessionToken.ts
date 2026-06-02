import sessionTokenFile from '../../session-token.txt?raw'

const tokenMatch = sessionTokenFile.match(/"session_token"\s*:\s*"([^"]+)"/i)

export const sessionTokenFromFile = tokenMatch?.[1]?.trim() ?? ''
