import { describe, expect, it } from 'vitest'
import { applyQuickPlay } from '@main/services/game'

describe('applyQuickPlay', () => {
  it('maps singleplayer worlds to Minecraft quick play arguments', () => {
    const options = applyQuickPlay({ extraMCArgs: [] as string[] }, { type: 'singleplayer', value: 'My World' })
    expect(options.extraMCArgs).toEqual(['--quickPlaySingleplayer', 'My World'])
  })

  it('keeps existing game arguments when adding quick play', () => {
    const options = applyQuickPlay({ extraMCArgs: ['--demo'] }, { type: 'singleplayer', value: 'My World' })
    expect(options.extraMCArgs).toEqual(['--demo', '--quickPlaySingleplayer', 'My World'])
  })

  it('maps multiplayer servers to quickPlayMultiplayer', () => {
    expect(applyQuickPlay({}, { type: 'multiplayer', value: 'play.example.net' })).toMatchObject({
      quickPlayMultiplayer: 'play.example.net',
    })
  })

  it('leaves launch options untouched without a value', () => {
    expect(applyQuickPlay({ memory: 2048 }, { type: 'singleplayer' })).toEqual({ memory: 2048 })
  })
})
