import { NextResponse } from "next/server";

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  error_code?: number;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_MESSAGE_MAX = 4096;
const TELEGRAM_MESSAGE_SAFE_MAX = 4000;
const TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64;
const PREP_CALLBACK_PREFIX = "prep_";
const READY_CALLBACK_PREFIX = "ready_";
const UTF8_ENCODER = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseRequiredString(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function parseOptionalString(value: unknown): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function parseTotalPrice(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (!isNonEmptyString(value)) {
    return null;
  }

  const trimmed = value.trim();
  const numericValue = Number(trimmed);

  if (Number.isFinite(numericValue)) {
    return numericValue.toFixed(2);
  }

  return trimmed;
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

function formatTotalForDisplay(totalPrice: string): string {
  const trimmed = totalPrice.trim();
  const withoutPeso = trimmed.replace(/^₱\s*/, "");
  const numericValue = Number(withoutPeso);

  if (Number.isFinite(numericValue)) {
    return `₱${numericValue.toFixed(2)}`;
  }

  if (trimmed.startsWith("₱")) {
    return trimmed;
  }

  return `₱${trimmed}`;
}

function getStringFromKeys(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }

  return null;
}

function getPositiveNumberFromKeys(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function formatItemLine(item: unknown, index: number): string | null {
  if (isNonEmptyString(item)) {
    return `- ${item.trim()}`;
  }

  if (!isRecord(item)) {
    return null;
  }

  const name = getStringFromKeys(item, ["name", "itemName", "title"]);
  const quantity = getPositiveNumberFromKeys(item, ["quantity", "qty"]);
  const size = getStringFromKeys(item, ["size"]);
  const notes = getStringFromKeys(item, ["notes", "specialInstructions"]);

  let line = "- ";

  if (quantity !== null) {
    line += `${quantity}x `;
  }

  line += name ?? `Item ${index + 1}`;

  if (size) {
    line += ` (${size})`;
  }

  if (notes) {
    line += ` - Notes: ${notes}`;
  }

  return line;
}

function parseItems(items: unknown): string[] | null {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const lines = items.map((item, index) => formatItemLine(item, index));

  if (lines.some((line) => line === null)) {
    return null;
  }

  return lines as string[];
}

function buildMessage(
  customerName: string,
  orderType: string,
  pickupTime: string | null,
  totalPrice: string,
  itemLines: string[],
  specialInstructions: string | null
): string {
  const displayType = normalizeOrderTypeLabel(orderType);
  const normalizedOrderType = orderType.trim().toLowerCase();
  const displayTotal = formatTotalForDisplay(totalPrice);
  const displayPickupTime = pickupTime?.trim() || "As soon as possible";

  const lines = [
    "🚨 NEW ORDER! 🚨",
    `Name: ${customerName}`,
    `Type: ${displayType}`,
    ...(normalizedOrderType === "pickup" || normalizedOrderType === "pick-up" ? [`Pickup Time: ${displayPickupTime}`] : []),
    `Total: ${displayTotal}`,
    "Items:",
    ...itemLines
  ];

  if (specialInstructions) {
    lines.push("Special Instructions:", specialInstructions);
  }

  const message = lines.join("\n");

  if (message.length <= TELEGRAM_MESSAGE_MAX) {
    return message;
  }

  return `${message.slice(0, TELEGRAM_MESSAGE_SAFE_MAX)}...`;
}

function getUtf8ByteLength(value: string): number {
  return UTF8_ENCODER.encode(value).length;
}

function buildCallbackData(prefix: string, orderId: string): string {
  return `${prefix}${orderId}`;
}

function canUseOrderIdForCallbackData(orderId: string): boolean {
  const prepCallbackData = buildCallbackData(PREP_CALLBACK_PREFIX, orderId);
  const readyCallbackData = buildCallbackData(READY_CALLBACK_PREFIX, orderId);

  return (
    getUtf8ByteLength(prepCallbackData) <= TELEGRAM_CALLBACK_DATA_MAX_BYTES &&
    getUtf8ByteLength(readyCallbackData) <= TELEGRAM_CALLBACK_DATA_MAX_BYTES
  );
}

export async function POST(request: Request) {
  console.info("[telegram-api] receive", { method: request.method });

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.error("[telegram-api] env missing", {
      hasBotToken: Boolean(botToken),
      hasChatId: Boolean(chatId)
    });

    return NextResponse.json(
      {
        success: false,
        error: "Server is not configured for Telegram notifications."
      },
      { status: 500 }
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    console.warn("[telegram-api] malformed JSON");

    return NextResponse.json(
      {
        success: false,
        error: "Malformed JSON body."
      },
      { status: 400 }
    );
  }

  if (!isRecord(payload)) {
    console.warn("[telegram-api] payload invalid", { reason: "not_an_object" });

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload."
      },
      { status: 422 }
    );
  }

  const customerName = parseRequiredString(payload.customerName);
  const orderType = parseRequiredString(payload.orderType);
  const orderId = parseRequiredString(payload.orderId);
  const totalPrice = parseTotalPrice(payload.totalPrice);
  const itemLines = parseItems(payload.items);
  const specialInstructions = parseOptionalString(payload.specialInstructions);
  const pickupTime = parseOptionalString(payload.pickupTime) ?? parseOptionalString(payload.pickup_time);

  if (!customerName || !orderType || !orderId || !totalPrice || !itemLines) {
    console.warn("[telegram-api] payload invalid", {
      hasCustomerName: Boolean(customerName),
      hasOrderType: Boolean(orderType),
      hasOrderId: Boolean(orderId),
      hasTotalPrice: Boolean(totalPrice),
      hasItemLines: Boolean(itemLines)
    });

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload."
      },
      { status: 422 }
    );
  }

  if (!canUseOrderIdForCallbackData(orderId)) {
    console.warn("[telegram-api] payload invalid", { reason: "callback_data_too_long" });

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload."
      },
      { status: 422 }
    );
  }

  const text = buildMessage(customerName, orderType, pickupTime, totalPrice, itemLines, specialInstructions);

  let telegramResponse: Response;

  try {
    telegramResponse = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "☕️ Start Preparing",
                callback_data: buildCallbackData(PREP_CALLBACK_PREFIX, orderId)
              }
            ],
            [
              {
                text: "✅ Mark as Ready",
                callback_data: buildCallbackData(READY_CALLBACK_PREFIX, orderId)
              }
            ]
          ]
        }
      })
    });
  } catch {
    console.error("[telegram-api] Telegram API non-OK", { reason: "fetch_failed" });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to reach Telegram notification service."
      },
      { status: 502 }
    );
  }

  let telegramData: TelegramApiResponse | null = null;

  try {
    telegramData = (await telegramResponse.json()) as TelegramApiResponse;
  } catch {
    telegramData = null;
  }

  if (!telegramResponse.ok) {
    console.error("[telegram-api] Telegram API non-OK", {
      status: telegramResponse.status
    });

    return NextResponse.json(
      {
        success: false,
        error: "Telegram service returned an error response."
      },
      { status: 502 }
    );
  }

  if (!telegramData?.ok) {
    console.error("[telegram-api] Telegram API ok:false", {
      errorCode: telegramData?.error_code,
      description: telegramData?.description ?? null
    });

    return NextResponse.json(
      {
        success: false,
        error: "Telegram rejected the notification request."
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      success: true
    },
    { status: 200 }
  );
}
