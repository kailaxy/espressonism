import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type CallbackAction = "prep" | "ready" | "complete";
type DatabaseOrderStatus = "brewing" | "ready" | "completed";
type FriendlyOrderStatus = "preparing" | "ready" | "completed";

type OrderDetails = {
  id: string;
  customer_name: string;
  order_type: string;
  total_price: number | string;
  items: unknown;
  special_instructions?: string | null;
};

type TelegramApiResult = {
  ok?: boolean;
  description?: string;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";
const ORDER_DETAILS_COLUMNS = "id, customer_name, order_type, total_price, items, special_instructions";

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

  if ((action !== "prep" && action !== "ready" && action !== "complete") || orderId.length === 0) {
    return null;
  }

  return { action, orderId };
}

function mapActionToDatabaseStatus(action: CallbackAction): DatabaseOrderStatus {
  if (action === "prep") {
    return "brewing";
  }

  if (action === "ready") {
    return "ready";
  }

  return "completed";
}

function mapActionToFriendlyStatus(action: CallbackAction): FriendlyOrderStatus {
  if (action === "prep") {
    return "preparing";
  }

  if (action === "ready") {
    return "ready";
  }

  return "completed";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeOrderTypeLabel(orderType: string): string {
  const normalized = orderType.trim().toLowerCase();

  if (normalized === "pickup" || normalized === "pick-up") {
    return "Pickup";
  }

  if (normalized === "delivery") {
    return "Delivery";
  }

  return orderType;
}

function formatTotalForDisplay(totalPrice: number | string | null | undefined): string {
  if (totalPrice === null || totalPrice === undefined) {
    return "-";
  }

  if (typeof totalPrice === "number" && Number.isFinite(totalPrice)) {
    return `₱${totalPrice.toFixed(2)}`;
  }

  const trimmed = String(totalPrice).trim();
  const withoutPeso = trimmed.replace(/^₱\s*/, "");
  const numericValue = Number(withoutPeso);

  if (Number.isFinite(numericValue)) {
    return `₱${numericValue.toFixed(2)}`;
  }

  if (trimmed.length === 0) {
    return "-";
  }

  if (trimmed.startsWith("₱")) {
    return trimmed;
  }

  return `₱${trimmed}`;
}

function formatItemsForDisplay(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) {
    return "-";
  }

  const lines = items.map((item, index) => {
    if (typeof item === "string") {
      return `- ${item.trim()}`;
    }

    if (!isRecord(item)) {
      return `- Item ${index + 1}`;
    }

    const nameValue = item.name;
    const quantityValue = item.quantity;

    const name = typeof nameValue === "string" && nameValue.trim().length > 0 ? nameValue.trim() : `Item ${index + 1}`;
    const quantity = typeof quantityValue === "number" && Number.isFinite(quantityValue) ? quantityValue : null;

    return quantity !== null && quantity > 0 ? `- ${quantity}x ${name}` : `- ${name}`;
  });

  return lines.join("\n");
}

function getStatusHeader(status: FriendlyOrderStatus): string {
  if (status === "preparing") {
    return "☕️ PREPARING ☕️";
  }

  if (status === "ready") {
    return "✅ READY FOR PICKUP ✅";
  }

  return "🏁 ORDER COMPLETED 🏁";
}

function buildEditedMessage(order: OrderDetails, status: FriendlyOrderStatus): string {
  const displayName = order.customer_name.trim().length > 0 ? order.customer_name : "-";
  const displayType =
    order.order_type.trim().length > 0 ? normalizeOrderTypeLabel(order.order_type) : "-";
  const displayTotal = formatTotalForDisplay(order.total_price);
  const items = formatItemsForDisplay(order.items);
  const specialInstructions =
    typeof order.special_instructions === "string" ? order.special_instructions.trim() : "";

  const lines = [
    `<b>${getStatusHeader(status)}</b>`,
    "",
    `<b>Name:</b> ${escapeHtml(displayName)}`,
    `<b>Type:</b> ${escapeHtml(displayType)}`,
    `<b>Total:</b> ${escapeHtml(displayTotal)}`,
    "<b>Items:</b>",
    escapeHtml(items),
    `<b>Order ID:</b> ${escapeHtml(order.id)}`
  ];

  if (specialInstructions.length > 0) {
    lines.push(`<b>Special Instructions:</b> ${escapeHtml(specialInstructions)}`);
  }

  return lines.join("\n");
}

function buildCompletedFallbackMessage(orderId: string): string {
  return [
    `<b>${getStatusHeader("completed")}</b>`,
    "",
    `<b>Order ID:</b> ${escapeHtml(orderId)}`
  ].join("\n");
}

function buildInlineKeyboard(orderId: string, status: FriendlyOrderStatus): Array<Array<{ text: string; callback_data: string }>> {
  if (status === "preparing") {
    return [[{ text: "✅ Mark as Ready", callback_data: `ready_${orderId}` }]];
  }

  if (status === "ready") {
    return [[{ text: "🏁 Complete Order", callback_data: `complete_${orderId}` }]];
  }

  return [];
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
  text: string,
  replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
): Promise<void> {
  await callTelegramMethod(botToken, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup
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

  const { data: orderRows, error: orderDetailsError } = await supabaseAdmin
    .from("orders")
    .select(ORDER_DETAILS_COLUMNS)
    .eq("id", parsed.orderId)
    .limit(1);

  let orderDetails: OrderDetails | null =
    Array.isArray(orderRows) && orderRows.length > 0 ? (orderRows[0] as OrderDetails) : null;
  let orderDetailsSource: "orders" | "orders_archive" | null = orderDetails ? "orders" : null;
  let archiveOrderError: { code: string | null; message: string | null } | null = null;

  if (!orderDetails) {
    const { data: archivedOrderRows, error: archivedOrderError } = await supabaseAdmin
      .from("orders_archive")
      .select(ORDER_DETAILS_COLUMNS)
      .eq("id", parsed.orderId)
      .limit(1);

    if (archivedOrderError) {
      archiveOrderError = {
        code: archivedOrderError.code ?? null,
        message: archivedOrderError.message ?? null
      };
    }

    if (Array.isArray(archivedOrderRows) && archivedOrderRows.length > 0) {
      orderDetails = archivedOrderRows[0] as OrderDetails;
      orderDetailsSource = "orders_archive";
    }
  }

  if (orderDetailsError || archiveOrderError || !orderDetails) {
    console.error("[telegram-webhook] Supabase select error", {
      code: orderDetailsError?.code ?? null,
      message: orderDetailsError?.message ?? null,
      archiveCode: archiveOrderError?.code ?? null,
      archiveMessage: archiveOrderError?.message ?? null,
      hasOrderDetails: Boolean(orderDetails),
      detailsSource: orderDetailsSource,
      status: friendlyStatus
    });

    if (friendlyStatus === "completed") {
      await answerCallbackQuery(botToken, callbackQueryId, "Order marked as completed.");

      if (chatId !== null && messageId !== null) {
        const fallbackText = buildCompletedFallbackMessage(parsed.orderId);
        await editMessageText(botToken, chatId, messageId, fallbackText, {
          inline_keyboard: []
        });
      } else {
        console.warn("[telegram-webhook] completed editMessageText skipped due to missing ids", {
          hasChatId: chatId !== null,
          hasMessageId: messageId !== null
        });
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await answerCallbackQuery(botToken, callbackQueryId, "Order updated but details could not be refreshed.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await answerCallbackQuery(botToken, callbackQueryId, `Order marked as ${friendlyStatus}.`);

  if (chatId !== null && messageId !== null) {
    const text = buildEditedMessage(orderDetails, friendlyStatus);
    const inlineKeyboard = buildInlineKeyboard(orderDetails.id, friendlyStatus);
    await editMessageText(botToken, chatId, messageId, text, {
      inline_keyboard: inlineKeyboard
    });
  } else {
    console.warn("[telegram-webhook] editMessageText skipped due to missing ids", {
      hasChatId: chatId !== null,
      hasMessageId: messageId !== null
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
