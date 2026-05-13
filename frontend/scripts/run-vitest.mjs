import { spawn } from 'node:child_process'
import { join } from 'node:path'

const forwardedArgs = process.argv.slice(2)
const isAutomationContext =
  process.env.CI === '1' ||
  process.env.CI === 'true' ||
  process.stdout.isTTY === false
const shouldRunOnce =
  isAutomationContext ||
  forwardedArgs.includes('--coverage') ||
  forwardedArgs.includes('--run')

const vitestArgs = shouldRunOnce
  ? ['run', ...forwardedArgs.filter((arg) => arg !== '--run')]
  : forwardedArgs

const vitestBin = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vitest.cmd' : 'vitest',
)

const child = spawn(vitestBin, vitestArgs, { stdio: 'inherit' })

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  }

  process.exit(code ?? 1)
})
