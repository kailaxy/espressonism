import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type CallbackAction = "prep" | "ready";
type DatabaseOrderStatus = "brewing" | "ready";
type FriendlyOrderStatus = "preparing" | "ready";

type TelegramApiResult = {
  ok?: boolean;
  description?: string;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCallbackData(data: unknown): { action: CallbackAction; orderId: string } | null {
  if (typeof data !== "string") {
    return null;
  }

  const trimmed = data.trim();
  const separatorIndex = trimmed.indexOf("_");

  if (separatorIndex <= 0 || separatorIndex >= trimmed.length - 1) {
    return null;
  }

  const action = trimmed.slice(0, separatorIndex);
  const orderId = trimmed.slice(separatorIndex + 1).trim();

  if ((action !== "prep" && action !== "ready") || orderId.length === 0) {
    return null;
  }

  return { action, orderId };
}

function mapActionToDatabaseStatus(action: CallbackAction): DatabaseOrderStatus {
  if (action === "prep") {
    return "brewing";
  }

  return "ready";
}

function mapActionToFriendlyStatus(action: CallbackAction): FriendlyOrderStatus {
  if (action === "prep") {
    return "preparing";
  }

  return "ready";
}

function buildEditedMessage(orderId: string, status: FriendlyOrderStatus): string {
  if (status === "preparing") {
    return `Order ${orderId} is now being prepared.`;
  }

  return `Order ${orderId} is now ready.`;
}

async function callTelegramMethod<TPayload extends Record<string, unknown>>(
  botToken: string,
  method: string,
  payload: TPayload
): Promise<TelegramApiResult | null> {
  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error("[telegram-webhook] Telegram API non-OK", {
        method,
        status: response.status
      });
      return null;
    }

    const result = (await response.json()) as TelegramApiResult;

    if (!result.ok) {
      console.error("[telegram-webhook] Telegram API ok:false", {
        method,
        description: result.description ?? null
      });
    }

    return result;
  } catch {
    console.error("[telegram-webhook] Telegram API non-OK", {
      method,
      reason: "fetch_failed"
    });
    return null;
  }
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string): Promise<void> {
  await callTelegramMethod(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false
  });
}

async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  await callTelegramMethod(botToken, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] }
  });
}

export async function POST(request: Request) {
  console.info("[telegram-webhook] receive", { method: request.method });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!supabaseUrl || !serviceRoleKey || !botToken) {
    console.error("[telegram-webhook] env missing", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasBotToken: Boolean(botToken)
    });

    return NextResponse.json(
      {
        success: false,
        error: "Webhook configuration is incomplete."
      },
      { status: 500 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    console.warn("[telegram-webhook] malformed JSON");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!isRecord(body) || !isRecord(body.callback_query)) {
    console.warn("[telegram-webhook] webhook callback parse invalid", {
      hasBodyRecord: isRecord(body),
      hasCallbackQuery: isRecord(body) ? isRecord(body.callback_query) : false
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const callbackQuery = body.callback_query;
  const callbackQueryId = typeof callbackQuery.id === "string" ? callbackQuery.id : null;
  const callbackData = callbackQuery.data;

  const message = isRecord(callbackQuery.message) ? callbackQuery.message : null;
  const messageId = message && typeof message.message_id === "number" ? message.message_id : null;
  const chat = message && isRecord(message.chat) ? message.chat : null;
  const chatId = chat && typeof chat.id === "number" ? chat.id : null;

  if (!callbackQueryId) {
    console.warn("[telegram-webhook] webhook callback parse invalid", {
      reason: "missing_callback_query_id"
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const parsed = parseCallbackData(callbackData);

  if (!parsed) {
    console.warn("[telegram-webhook] webhook callback parse invalid", {
      reason: "invalid_callback_data"
    });
    await answerCallbackQuery(botToken, callbackQueryId, "Sorry, that action is invalid.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const dbStatus = mapActionToDatabaseStatus(parsed.action);
  const friendlyStatus = mapActionToFriendlyStatus(parsed.action);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: updatedOrders, error } = await supabaseAdmin
    .from("orders")
    .update({ status: dbStatus })
    .eq("id", parsed.orderId)
    .select("id");

  if (error) {
    console.error("[telegram-webhook] Supabase update error", {
      code: error.code ?? null,
      message: error.message
    });
    await answerCallbackQuery(botToken, callbackQueryId, "Could not update order right now. Please try again.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!updatedOrders || updatedOrders.length === 0) {
    console.warn("[telegram-webhook] Supabase update zero rows");
    await answerCallbackQuery(botToken, callbackQueryId, "That order was not found.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await answerCallbackQuery(botToken, callbackQueryId, `Order marked as ${friendlyStatus}.`);

  if (chatId !== null && messageId !== null) {
    const text = buildEditedMessage(parsed.orderId, friendlyStatus);
    await editMessageText(botToken, chatId, messageId, text);
  } else {
    console.warn("[telegram-webhook] editMessageText skipped due to missing ids", {
      hasChatId: chatId !== null,
      hasMessageId: messageId !== null
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
