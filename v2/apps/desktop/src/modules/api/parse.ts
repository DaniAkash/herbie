/**
 * Reads a response, or throws something a toast can show.
 *
 * Every fetcher goes through here rather than calling `.json()` directly, so a
 * 401 from a stale token and a 500 from a broken route do not both surface as
 * "unexpected end of JSON input".
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `${response.status} ${response.statusText}${body ? `: ${body.trim()}` : ''}`,
    )
  }
  return (await response.json()) as T
}
