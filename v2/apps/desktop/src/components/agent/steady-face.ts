/** Keep expression animations in the mask, but hold the face body still. */
export function steadyFace(svg: string): string {
  const end = svg.indexOf('</defs>')
  if (end < 0) return svg
  const bodyStart = end + '</defs>'.length
  return (
    svg.slice(0, bodyStart) +
    svg.slice(bodyStart).replace(/<animateTransform\b[^>]*\/>/g, '')
  )
}
