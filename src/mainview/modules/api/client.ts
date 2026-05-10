import { createApiClient } from '../../../shared/api'

export const API_BASE_URL = 'http://127.0.0.1:4575'

export const api = createApiClient(API_BASE_URL)
