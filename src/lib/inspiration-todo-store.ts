import { apiGet, apiPut } from "./api";

const KEY = "tracker-inspiration-todo";

export interface InspirationTodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string | null;
}

export interface InspirationTodoData {
  items: InspirationTodoItem[];
}

export async function loadInspirationTodos(): Promise<InspirationTodoData> {
  return apiGet<InspirationTodoData>("inspiration-todo", KEY, { items: [] });
}

export async function saveInspirationTodos(data: InspirationTodoData): Promise<void> {
  await apiPut("inspiration-todo", KEY, data);
}
