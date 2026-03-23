import { spawn } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'

const primaryUrl =
  process.env.OPENAPI_PRIMARY_URL ??
  'https://bitloops.local:5667/api/openapi.json'
const fallbackUrl =
  process.env.OPENAPI_FALLBACK_URL ?? 'http://127.0.0.1:5667/api/openapi.json'
const outputPath =
  process.env.OPENAPI_TYPES_OUTPUT ?? 'src/types/openapi.generated.d.ts'
const parsedTimeout = Number(process.env.OPENAPI_FETCH_TIMEOUT_MS ?? 8000)
const fetchTimeoutMs =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 8000
const isVerbose = process.env.OPENAPI_TYPES_VERBOSE === '1'

/** Prefer fixing TLS with a trusted cert (e.g. `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`) over disabling verification. */
const allowInsecureTls =
  process.env.OPENAPI_ALLOW_INSECURE_TLS?.toLowerCase() === 'true'

const schemaUrls = [primaryUrl, fallbackUrl].filter(
  (value, index, list) => Boolean(value) && list.indexOf(value) === index,
)

const generatorBin = path.resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32'
    ? 'openapi-typescript.cmd'
    : 'openapi-typescript',
)

const fileExists = async (filePath) => {
  try {
    await access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

const runGenerator = async (schemaUrl) =>
  new Promise((resolve, reject) => {
    const env = { ...process.env }

    if (schemaUrl.startsWith('https://') && allowInsecureTls) {
      env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const child = spawn(generatorBin, [schemaUrl, '--output', outputPath], {
      stdio: isVerbose ? 'inherit' : 'pipe',
      env,
    })

    let output = ''
    if (!isVerbose) {
      child.stdout?.on('data', (chunk) => {
        output += chunk.toString()
      })
      child.stderr?.on('data', (chunk) => {
        output += chunk.toString()
      })
    }

    let isSettled = false
    const timeout = setTimeout(() => {
      if (isSettled) {
        return
      }

      isSettled = true
      child.kill('SIGTERM')
      reject(new Error(`Timed out after ${fetchTimeoutMs}ms`))
    }, fetchTimeoutMs)

    child.once('error', (error) => {
      if (isSettled) {
        return
      }

      isSettled = true
      clearTimeout(timeout)
      reject(error)
    })

    child.once('close', (code) => {
      if (isSettled) {
        return
      }

      isSettled = true
      clearTimeout(timeout)

      if (code === 0) {
        resolve()
        return
      }

      const details = output.trim()
      const summaryLine = details
        .split('\n')
        .map((line) => line.trim())
        .find(
          (line) =>
            line.includes('connect ') ||
            line.includes('fetch failed') ||
            line.includes('Request failed'),
        )

      reject(
        new Error(
          `openapi-typescript exited with code ${code ?? 'unknown'}${
            summaryLine ? ` (${summaryLine})` : ''
          }`,
        ),
      )
    })
  })

await mkdir(path.dirname(outputPath), { recursive: true })

const errors = []

for (const schemaUrl of schemaUrls) {
  try {
    console.log(`Generating OpenAPI types from ${schemaUrl}...`)
    await runGenerator(schemaUrl)
    console.log(`OpenAPI types written to ${outputPath}`)
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push(`${schemaUrl}: ${message}`)
    console.warn(`Could not generate from ${schemaUrl}: ${message}`)
  }
}

if (await fileExists(outputPath)) {
  console.warn(
    `OpenAPI is unreachable. Keeping existing generated types at ${outputPath}.`,
  )
  process.exit(0)
}

console.error('Failed to generate OpenAPI types from all configured URLs.')
for (const error of errors) {
  console.error(`- ${error}`)
}
process.exit(1)
