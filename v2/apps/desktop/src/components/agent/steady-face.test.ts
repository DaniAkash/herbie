import { describe, expect, test } from 'bun:test'
import { steadyFace } from './steady-face'

describe('steady face', () => {
  test('keeps eye and antenna animations while holding the body still', () => {
    const input =
      '<svg><defs><mask><animateTransform attributeName="transform" type="translate"/><animate attributeName="ry"/></mask></defs><g><animateTransform attributeName="transform" type="rotate"/><rect/></g></svg>'
    expect(steadyFace(input)).toBe(
      '<svg><defs><mask><animateTransform attributeName="transform" type="translate"/><animate attributeName="ry"/></mask></defs><g><rect/></g></svg>',
    )
  })

  test('leaves an SVG without definitions untouched', () => {
    expect(steadyFace('<svg/>')).toBe('<svg/>')
  })
})
