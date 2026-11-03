import { type AgentProbeResult, probeAgent } from 'acp-probe'

export interface ProbedRuntime {
  readonly signedIn: boolean
  readonly supportsConfigOption: boolean
  /** What the agent advertises. For display only. */
  readonly models: readonly string[]
  /**
   * What `setConfigOption('model', x)` will accept.
   *
   * Empty is meaningful and is not the same as unknown: it is what makes the
   * model row disappear instead of offering a control the runtime rejects.
   * codex-acp advertises compound `<model>/<effort>` ids under `models` that
   * it then refuses silently, and the refusal only shows up as the next
   * prompt finishing with an error and no error frame.
   */
  readonly modelValues: readonly string[]
  readonly efforts: readonly string[]
  readonly error: string | null
}

/** Reads the three lists the picker needs out of a probe result. */
export function readProbe(result: AgentProbeResult): ProbedRuntime {
  return {
    // Auth is the one failure worth separating from the rest: it means the
    // runtime is there and working and simply has nobody signed in, which is
    // a thing the person can fix.
    signedIn: result.error?.code !== 'auth_required',
    supportsConfigOption: result.supportsConfigOption,
    models: result.models.map((m) => m.id),
    modelValues: result.modelConfig?.values ?? [],
    efforts: result.reasoning?.values ?? [],
    error: result.error ? `${result.error.code}` : null,
  }
}

/**
 * Asks a coding agent what it can do.
 *
 * No LLM tokens are spent: this is the initialize and session/new handshake,
 * never a prompt. It does spawn the agent, which is why the result is cached
 * rather than fetched whenever a picker opens.
 */
export async function probe(
  command: string,
  cwd?: string,
): Promise<ProbedRuntime> {
  try {
    const result = await probeAgent({ command, cwd, timeoutMs: 20_000 })
    return readProbe(result)
  } catch (cause) {
    return {
      signedIn: false,
      supportsConfigOption: false,
      models: [],
      modelValues: [],
      efforts: [],
      error: cause instanceof Error ? cause.message : 'probe failed',
    }
  }
}
