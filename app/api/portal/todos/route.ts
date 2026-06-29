import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_todos", { p_token: token });
  return NextResponse.json(data ?? { todos: [] });
}

export async function POST(request: Request) {
  const { token, title, notes, dueDate, category } =
    await request.json() as { token: string; title: string; notes?: string; dueDate?: string; category?: string };
  if (!token || !title) return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("add_couple_todo", {
    p_token: token, p_title: title, p_notes: notes ?? "",
    p_due_date: dueDate ?? null, p_category: category ?? "",
  });
  return NextResponse.json(data ?? { ok: false });
}

export async function PATCH(request: Request) {
  const { token, todoId, completed, title, dueDate } =
    await request.json() as { token: string; todoId: string; completed?: boolean; title?: string; dueDate?: string };
  if (!token || !todoId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("update_couple_todo", {
    p_token: token, p_todo_id: todoId,
    p_completed: completed ?? null, p_title: title ?? "", p_due_date: dueDate ?? null,
  });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const { token, todoId } = await request.json() as { token: string; todoId: string };
  if (!token || !todoId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("delete_couple_todo", { p_token: token, p_todo_id: todoId });
  return NextResponse.json(data ?? { ok: false });
}
