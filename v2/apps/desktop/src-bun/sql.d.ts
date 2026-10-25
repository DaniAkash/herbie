/**
 * Generated migrations, imported as text so they travel inside the compiled
 * binary. Declared here rather than relied on from bun-types, because the
 * isolated linker keeps that package outside the project and tsc will not
 * follow the reference chain to it.
 */
declare module '*.sql' {
  const content: string
  export default content
}
