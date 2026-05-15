import { act } from '@testing-library/react'

const FLUSH_ROUNDS = 4

export async function flushAct(rounds = FLUSH_ROUNDS): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    })
  }
}
