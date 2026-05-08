import { api } from '../api/client'
import { parseResponse } from '../api/parseResponse'

const $post = api['open-external'].$post

export async function openExternal(url: string): Promise<boolean> {
  const res = await $post({ json: { url } }).then(
    parseResponse<{ ok: boolean }>,
  )
  return res.ok
}
