const { formatTimer, tickTimer } = require('../src/renderer/timer-utils')

describe('timer-utils', () => {
  test('formata minutos e segundos com dois dígitos', () => {
    expect(formatTimer(25 * 60)).toBe('25:00')
    expect(formatTimer(65)).toBe('01:05')
  })

  test('não permite tempo negativo ou inválido', () => {
    expect(formatTimer(-1)).toBe('00:00')
    expect(formatTimer('invalido')).toBe('00:00')
  })

  test('reduz um segundo sem ficar negativo', () => {
    expect(tickTimer(10)).toBe(9)
    expect(tickTimer(0)).toBe(0)
  })
})
