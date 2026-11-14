import type { Client } from '@bun/server/client'
import type { InferResponseType } from 'hono/client'
import { createMutation, createQuery } from 'react-query-kit'
import { api } from '@/modules/api/client'
import { parseResponse } from '@/modules/api/parse'
import { queryClient } from '@/modules/api/queryClient'
import { hasDelivered } from '@/modules/notifications/shell'

export type NotificationsResponse = InferResponseType<
  Client['api']['notifications']['$get']
>
export type Notification = NotificationsResponse['notifications'][number]
export type SettingsResponse = InferResponseType<
  Client['api']['settings']['$get']
>

/**
 * The inbox, and the agents waiting in it.
 *
 * One query serves three surfaces: the overlay reads the rows, the rail reads
 * which agent each live row belongs to, and the dock badge counts them. They
 * cannot disagree because there is only one answer.
 */
export const useNotifications = createQuery<NotificationsResponse>({
  queryKey: ['notifications'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<NotificationsResponse>(
      await client.api.notifications.$get(),
    )
  },
})

export const useSettings = createQuery<SettingsResponse>({
  queryKey: ['settings'],
  fetcher: async () => {
    const client = await api()
    return parseResponse<SettingsResponse>(await client.api.settings.$get())
  },
})

/**
 * Whether a banner has ever reached the screen, asked of the shell.
 *
 * A query rather than a one-off read so that reopening the pane re-asks, and
 * so the answer has somewhere to live. The source is the window's own shell
 * rather than the sidecar, which is the only reason this looks out of place
 * next to the others.
 */
export const useDelivered = createQuery<boolean>({
  queryKey: ['notification-delivered'],
  fetcher: () => hasDelivered(),
})

const refreshInbox = () =>
  queryClient.invalidateQueries({ queryKey: useNotifications.getKey() })

export const useMarkSeen = createMutation({
  mutationFn: async ({ id }: { id: string }) => {
    const client = await api()
    return parseResponse<{ seen: true }>(
      await client.api.notifications[':id'].seen.$post({ param: { id } }),
    )
  },
  onSuccess: refreshInbox,
})

export const useDismiss = createMutation({
  mutationFn: async ({ id }: { id: string }) => {
    const client = await api()
    return parseResponse<{ dismissed: true }>(
      await client.api.notifications[':id'].dismissed.$post({ param: { id } }),
    )
  },
  onSuccess: refreshInbox,
})

/** Opening a thread settles every live row for that agent at once. */
export const useSeeAgent = createMutation({
  mutationFn: async ({ agentId }: { agentId: string }) => {
    const client = await api()
    return parseResponse<{ seen: true }>(
      await client.api.notifications.agents[':agentId'].seen.$post({
        param: { agentId },
      }),
    )
  },
  onSuccess: refreshInbox,
})

/**
 * One setting, optimistic.
 *
 * A switch that waits for a round trip before it moves reads as broken, and
 * the rollback is what keeps that honest.
 */
export const useSetSetting = createMutation({
  mutationFn: async ({ key, value }: { key: string; value: string }) => {
    const client = await api()
    return parseResponse<{ setting: { key: string; value: string } }>(
      await client.api.settings[':key'].$put({
        param: { key },
        json: { value },
      }),
    )
  },
  onMutate: async ({ key, value }) => {
    const queryKey = useSettings.getKey()
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData<SettingsResponse>(queryKey)
    queryClient.setQueryData<SettingsResponse>(queryKey, (old) =>
      old ? { ...old, settings: { ...old.settings, [key]: value } } : old,
    )
    return { previous }
  },
  onError: (_error, _variables, context) => {
    if (context?.previous) {
      queryClient.setQueryData(useSettings.getKey(), context.previous)
    }
  },
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: useSettings.getKey() }),
})
