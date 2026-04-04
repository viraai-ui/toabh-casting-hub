import { api } from '@/lib/api'

export interface AssistantCard {
  kind: 'casting' | 'assignment' | 'metric'
  id?: number
  title: string
  subtitle: string
  meta: string[]
  chips: string[]
}

export interface AssistantResponse {
  intent: string
  answer: string
  cards: AssistantCard[]
  suggestions: string[]
  totals: Record<string, string | number>
  context: Record<string, string | number>
  generated_at: string
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  response?: AssistantResponse
  createdAt: string
}

export const ASSISTANT_SUGGESTIONS = [
  'How many castings are pending today?',
  'Show delayed castings',
  "What are this week's assignments?",
  'Find casting details for project Nike',
] as const

export async function queryAssistant(query: string): Promise<AssistantResponse> {
  return api.post('/assistant/query', { query }) as Promise<AssistantResponse>
}
