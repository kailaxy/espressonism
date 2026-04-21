"use client";

import NextImage from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Skeleton,
  SkeletonFormBlock,
  SkeletonListRow,
  SkeletonModalBody,
  SkeletonPageSection,
  SkeletonTableRow
} from "../components/UI";
import InventoryManager from "./InventoryManager";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

type OrderStatus = "received" | "preparing" | "brewing" | "ready" | "completed" | "cancelled";
type AdminTab = "orders" | "menu" | "highlights" | "promotional" | "sales" | "inventory";
type MenuCategory = "espresso" | "signature" | "bites";

type DashboardOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string | null;
  pickup_time: string | null;
  delivery_address: string | null;
  special_instructions: string | null;
  payment_method: string | null;
  gcash_reference: string | null;
  items: unknown;
  total_price: number | null;
  status: OrderStatus | string | null;
  created_at: string | null;
};

type NormalizedOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  menuItemId: string | null;
  size: string;
  milk: string;
};

type ColumnKey = "received" | "preparing" | "ready";

type ColumnConfig = {
  key: ColumnKey;
  title: string;
  subtitle: string;
};

type ActionConfig = {
  label: string;
  nextStatus: "brewing" | "ready" | "completed";
};

type FilterMode = "daily" | "monthly";

type SalesMetrics = {
  gross: number;
  cogs: number;
  grossProfit: number;
  cash: number;
  gcash: number;
};

type SalesDateRange = {
  startIso: string;
  endIso: string;
};

type MenuManagerItem = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | string | null;
  image_url: string | null;
  category: MenuCategory | string | null;
};

type NewMenuItemForm = {
  name: string;
  description: string;
  basePrice: string;
  category: MenuCategory;
};

type TodayHighlightRow = {
  id: string;
  menu_item_id: string;
  created_at: string | null;
};

type TodayAtBarRow = {
  id: number;
  title: string | null;
  description: string | null;
  dose: string | null;
  extraction_time: string | null;
  brew_temp: string | null;
  guest_score: string | number | null;
  carousel_enabled: boolean | null;
  carousel_autoplay: boolean | null;
  carousel_interval_ms: number | null;
  carousel_slides: unknown;
};

type TodayAtBarCarouselSlideForm = {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
};

type PromoBucketImageOption = {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: string | null;
  sizeInBytes: number | null;
};

type TodayAtBarForm = {
  title: string;
  description: string;
  dose: string;
  extractionTime: string;
  brewTemp: string;
  guestScore: string;
  carouselEnabled: boolean;
  carouselAutoplay: boolean;
  carouselIntervalMs: string;
  carouselSlides: TodayAtBarCarouselSlideForm[];
};

type AdminNotice = {
  tone: "success" | "error";
  message: string;
};

type ConfirmationModalState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

const ORDER_SELECT_FIELDS =
  "id, customer_name, customer_phone, order_type, pickup_time, delivery_address, special_instructions, payment_method, gcash_reference, items, total_price, status, created_at";
const MENU_ITEM_SELECT_FIELDS = "*";
const TODAY_HIGHLIGHT_SELECT_FIELDS = "id, menu_item_id, created_at";
const TODAY_AT_BAR_SELECT_FIELDS =
  "id, title, description, dose, extraction_time, brew_temp, guest_score, carousel_enabled, carousel_autoplay, carousel_interval_ms, carousel_slides";
const ADMIN_AUTH_STORAGE_KEY = "espressonism-admin-auth-session-v1";
const TODAY_AT_BAR_CAROUSEL_INTERVAL_MIN = 2200;
const TODAY_AT_BAR_CAROUSEL_INTERVAL_MAX = 15000;
const TODAY_AT_BAR_CAROUSEL_INTERVAL_DEFAULT = 5500;
const PROMO_IMAGE_BUCKET_NAME = (process.env.NEXT_PUBLIC_PROMO_IMAGE_BUCKET_NAME ?? "").trim();
const PROMO_IMAGE_BUCKET_PREFIX = (process.env.NEXT_PUBLIC_PROMO_IMAGE_BUCKET_PREFIX ?? "")
  .trim()
  .replace(/^\/+|\/+$/g, "");
const SUPPORTED_PROMO_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "svg"
]);

const COLUMNS: ColumnConfig[] = [
  { key: "received", title: "New Orders", subtitle: "Just placed" },
  { key: "preparing", title: "Preparing", subtitle: "In progress" },
  { key: "ready", title: "Ready", subtitle: "Pickup / handoff" }
];

const ADMIN_TABS: Array<{ key: AdminTab; label: string }> = [
  { key: "orders", label: "Live Orders" },
  { key: "menu", label: "Menu Manager" },
  { key: "highlights", label: "Today Highlights" },
  { key: "promotional", label: "Promotional" },
  { key: "sales", label: "Sales Summary" },
  { key: "inventory", label: "Inventory" }
];

const EMPTY_MENU_FORM: NewMenuItemForm = {
  name: "",
  description: "",
  basePrice: "",
  category: "signature"
};

const MENU_CATEGORY_OPTIONS: Array<{ value: MenuCategory; label: string }> = [
  { value: "espresso", label: "Espresso" },
  { value: "signature", label: "Signature" },
  { value: "bites", label: "Bites" }
];

const EMPTY_TODAY_AT_BAR_FORM: TodayAtBarForm = {
  title: "",
  description: "",
  dose: "",
  extractionTime: "",
  brewTemp: "",
  guestScore: "",
  carouselEnabled: false,
  carouselAutoplay: true,
  carouselIntervalMs: String(TODAY_AT_BAR_CAROUSEL_INTERVAL_DEFAULT),
  carouselSlides: []
};

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2
});

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return pesoFormatter.format(0);
  return pesoFormatter.format(value);
}

function parseMoney(value: number | string | null | undefined): number {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) return 0;
  return numericValue;
}

function isMenuCategory(value: unknown): value is MenuCategory {
  return value === "espresso" || value === "signature" || value === "bites";
}

function normalizeMenuCategory(value: unknown): MenuCategory {
  return isMenuCategory(value) ? value : "signature";
}

function normalizeMenuManagerItem(item: MenuManagerItem): MenuManagerItem {
  return {
    ...item,
    category: normalizeMenuCategory(item.category)
  };
}

function formatMenuCategoryLabel(value: unknown): string {
  const category = normalizeMenuCategory(value);
  if (category === "espresso") return "Espresso";
  if (category === "bites") return "Bites";
  return "Signature";
}

function normalizeOrderItems(value: unknown): NormalizedOrderItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const item = typeof entry === "object" && entry ? (entry as Record<string, unknown>) : {};

    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Custom Drink";
    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
    const unitPrice = typeof item.unit_price === "number" && item.unit_price >= 0 ? item.unit_price : 0;
    const itemId =
      typeof item.item_id === "string"
        ? item.item_id.trim()
        : typeof item.menu_item_id === "string"
          ? item.menu_item_id.trim()
          : "";
    const size = typeof item.size === "string" ? item.size : "regular";
    const milk = typeof item.milk === "string" ? item.milk : "whole";

    return {
      name,
      quantity,
      unitPrice,
      menuItemId: itemId || null,
      size,
      milk
    };
  });
}

function normalizeStatus(value: unknown): ColumnKey | null {
  if (value === "ready") return "ready";
  if (value === "preparing" || value === "brewing") return "preparing";
  if (value === "received") return "received";
  return null;
}

function isBoardStatus(value: unknown): value is "received" | "preparing" | "brewing" | "ready" {
  return value === "received" || value === "preparing" || value === "brewing" || value === "ready";
}

function isCompletedStatus(value: unknown): value is "completed" {
  return value === "completed";
}

function sortByCreatedAt(orderList: DashboardOrder[]): DashboardOrder[] {
  return [...orderList].sort((firstOrder, secondOrder) => {
    const firstCreatedAt = firstOrder.created_at ?? "";
    const secondCreatedAt = secondOrder.created_at ?? "";
    return firstCreatedAt.localeCompare(secondCreatedAt);
  });
}

function upsertLiveOrder(orderList: DashboardOrder[], incomingOrder: DashboardOrder): DashboardOrder[] {
  const remainingOrders = orderList.filter((order) => order.id !== incomingOrder.id);
  if (!isBoardStatus(incomingOrder.status)) {
    return sortByCreatedAt(remainingOrders);
  }

  return sortByCreatedAt([...remainingOrders, incomingOrder]);
}

function upsertCompletedOrder(orderList: DashboardOrder[], incomingOrder: DashboardOrder): DashboardOrder[] {
  const remainingOrders = orderList.filter((order) => order.id !== incomingOrder.id);
  if (!isCompletedStatus(incomingOrder.status)) {
    return sortByCreatedAt(remainingOrders);
  }

  return sortByCreatedAt([...remainingOrders, incomingOrder]);
}

function mergeCompletedOrders(...orderLists: DashboardOrder[][]): DashboardOrder[] {
  const dedupedOrders = new Map<string, DashboardOrder>();

  for (const orderList of orderLists) {
    for (const order of orderList) {
      if (!isCompletedStatus(order.status)) continue;
      dedupedOrders.set(order.id, order);
    }
  }

  return sortByCreatedAt([...dedupedOrders.values()]);
}

function sortMenuItemsByName(menuItems: MenuManagerItem[]): MenuManagerItem[] {
  return [...menuItems].sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name));
}

function sortTodayHighlights(highlights: TodayHighlightRow[]): TodayHighlightRow[] {
  return [...highlights].sort((firstHighlight, secondHighlight) => {
    const firstCreatedAt = firstHighlight.created_at ?? "";
    const secondCreatedAt = secondHighlight.created_at ?? "";
    const byCreatedAt = firstCreatedAt.localeCompare(secondCreatedAt);
    if (byCreatedAt !== 0) return byCreatedAt;
    return firstHighlight.id.localeCompare(secondHighlight.id);
  });
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function clampCarouselInterval(value: number): number {
  return clampNumber(
    Math.round(value),
    TODAY_AT_BAR_CAROUSEL_INTERVAL_MIN,
    TODAY_AT_BAR_CAROUSEL_INTERVAL_MAX
  );
}

function parseTodayAtBarCarouselSlides(value: unknown): TodayAtBarCarouselSlideForm[] {
  let parsedValue: unknown = value;

  if (typeof parsedValue === "string") {
    const trimmedValue = parsedValue.trim();
    if (!trimmedValue) return [];

    try {
      parsedValue = JSON.parse(trimmedValue);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsedValue)) return [];

  return parsedValue
    .map((entry, index) => {
      const slide = typeof entry === "object" && entry ? (entry as Record<string, unknown>) : {};
      const imageUrl = nonEmptyString(slide.image_url) ?? nonEmptyString(slide.imageUrl);
      if (!imageUrl) return null;

      const title = nonEmptyString(slide.title) ?? "";
      const description = nonEmptyString(slide.description) ?? "";
      const slideId = nonEmptyString(slide.id) ?? `slide-${index + 1}`;

      return {
        id: slideId,
        imageUrl,
        title,
        description
      };
    })
    .filter((slide): slide is TodayAtBarCarouselSlideForm => slide !== null);
}

function normalizeTodayAtBarSlidesForSave(
  slides: TodayAtBarCarouselSlideForm[]
): Array<{ id: string; image_url: string; title?: string; description?: string }> {
  return slides.reduce<Array<{ id: string; image_url: string; title?: string; description?: string }>>(
    (accumulator, slide, index) => {
      const imageUrl = slide.imageUrl.trim();
      if (!imageUrl) return accumulator;

      const normalizedSlide: { id: string; image_url: string; title?: string; description?: string } = {
        id: slide.id.trim() || `slide-${index + 1}`,
        image_url: imageUrl
      };

      const title = slide.title.trim();
      const description = slide.description.trim();

      if (title) normalizedSlide.title = title;
      if (description) normalizedSlide.description = description;

      accumulator.push(normalizedSlide);
      return accumulator;
    },
    []
  );
}

function createTodayAtBarSlideDraft(seed: number): TodayAtBarCarouselSlideForm {
  return {
    id: `slide-${seed}`,
    imageUrl: "",
    title: "",
    description: ""
  };
}

function normalizePromoStoragePath(path: string | null | undefined): string {
  if (!path) return "";

  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function getStorageEntryPath(basePath: string, entryName: string): string {
  const normalizedBasePath = normalizePromoStoragePath(basePath);
  const normalizedEntryName = normalizePromoStoragePath(entryName);

  if (!normalizedBasePath) return normalizedEntryName;
  if (!normalizedEntryName) return normalizedBasePath;
  return `${normalizedBasePath}/${normalizedEntryName}`;
}

function isPromoStorageFolder(entry: Record<string, unknown>): boolean {
  const entryType = typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "";
  if (entryType === "folder") return true;
  if (entryType === "file") return false;

  if (entry.metadata && typeof entry.metadata === "object") {
    return false;
  }

  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  return id.length === 0;
}

function isSupportedPromoImageFile(fileName: string): boolean {
  const normalized = fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) return false;
  const extension = normalized.slice(lastDot + 1);
  return SUPPORTED_PROMO_IMAGE_EXTENSIONS.has(extension);
}

function parseSortTime(value: string | null): number {
  if (!value) return 0;
  const parsedTime = Date.parse(value);
  return Number.isFinite(parsedTime) ? parsedTime : 0;
}

function sortPromoBucketImages(options: PromoBucketImageOption[]): PromoBucketImageOption[] {
  return [...options].sort((firstOption, secondOption) => {
    const byDate = parseSortTime(secondOption.updatedAt) - parseSortTime(firstOption.updatedAt);
    if (byDate !== 0) return byDate;
    return firstOption.path.localeCompare(secondOption.path);
  });
}

function formatFileSize(sizeInBytes: number | null): string {
  if (typeof sizeInBytes !== "number" || sizeInBytes <= 0) return "Unknown size";
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;

  const sizeInKb = sizeInBytes / 1024;
  if (sizeInKb < 1024) return `${sizeInKb.toFixed(1)} KB`;

  const sizeInMb = sizeInKb / 1024;
  return `${sizeInMb.toFixed(1)} MB`;
}

function mapTodayAtBarRowToForm(row: TodayAtBarRow | null | undefined): TodayAtBarForm {
  const parsedInterval = typeof row?.carousel_interval_ms === "number" ? row.carousel_interval_ms : NaN;
  const carouselIntervalMs = Number.isFinite(parsedInterval)
    ? String(clampCarouselInterval(parsedInterval))
    : String(TODAY_AT_BAR_CAROUSEL_INTERVAL_DEFAULT);

  return {
    title: row?.title?.trim() ?? "",
    description: row?.description?.trim() ?? "",
    dose: row?.dose?.trim() ?? "",
    extractionTime: row?.extraction_time?.trim() ?? "",
    brewTemp: row?.brew_temp?.trim() ?? "",
    guestScore: row?.guest_score === null || row?.guest_score === undefined ? "" : String(row.guest_score),
    carouselEnabled: row?.carousel_enabled === true,
    carouselAutoplay: row?.carousel_autoplay !== false,
    carouselIntervalMs,
    carouselSlides: parseTodayAtBarCarouselSlides(row?.carousel_slides)
  };
}

function formatOrderDateTime(value: string | null): string {
  if (!value) return "Unknown time";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila"
  });
}

function applyLocalStatusUpdate(
  orderList: DashboardOrder[],
  orderId: string,
  nextStatus: ActionConfig["nextStatus"]
): DashboardOrder[] {
  const targetOrder = orderList.find((order) => order.id === orderId);
  if (!targetOrder) return orderList;

  return upsertLiveOrder(orderList, {
    ...targetOrder,
    status: nextStatus
  });
}

function getActionConfig(status: unknown): ActionConfig | null {
  if (status === "received") {
    return { label: "Start Preparing", nextStatus: "brewing" };
  }

  if (status === "preparing" || status === "brewing") {
    return { label: "Mark as Ready", nextStatus: "ready" };
  }

  if (status === "ready") {
    return { label: "Complete Order", nextStatus: "completed" };
  }

  return null;
}

function orderTypeLabel(orderType: string | null): string {
  if (orderType === "delivery") return "Delivery";
  return "Pickup";
}

function paymentLabel(paymentMethod: string | null): string {
  if (isGCashPayment(paymentMethod)) return "GCash";
  return "Cash";
}

function formatPickupTimeLabel(orderType: string | null, pickupTime: string | null): string {
  if (orderType === "delivery") {
    return "N/A for delivery";
  }

  const normalizedPickupTime = typeof pickupTime === "string" ? pickupTime.trim() : "";
  return normalizedPickupTime || "ASAP";
}

function normalizePaymentMethod(paymentMethod: string | null): string {
  if (typeof paymentMethod !== "string") return "";
  return paymentMethod.trim().toLowerCase();
}

function compactPaymentMethod(paymentMethod: string | null): string {
  return normalizePaymentMethod(paymentMethod).replace(/[\s_-]+/g, "");
}

function isGCashPayment(paymentMethod: string | null): boolean {
  return compactPaymentMethod(paymentMethod) === "gcash";
}

function parseOrderTotal(totalPrice: DashboardOrder["total_price"]): number {
  if (typeof totalPrice === "number" && Number.isFinite(totalPrice)) return totalPrice;
  return 0;
}

function getManilaDateParts(date: Date): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return { year, month, day };
}

function getTodayDateInputValue(): string {
  const { year, month, day } = getManilaDateParts(new Date());
  return `${year}-${month}-${day}`;
}

function getCurrentMonthInputValue(): string {
  const { year, month } = getManilaDateParts(new Date());
  return `${year}-${month}`;
}

function buildSalesDateRange(filterMode: FilterMode, selectedDay: string, selectedMonth: string): SalesDateRange {
  if (filterMode === "monthly") {
    const fallbackMonth = getCurrentMonthInputValue();
    const monthValue = /^\d{4}-\d{2}$/.test(selectedMonth) ? selectedMonth : fallbackMonth;
    const startDate = new Date(`${monthValue}-01T00:00:00+08:00`);
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    return { startIso: startDate.toISOString(), endIso: endDate.toISOString() };
  }

  const fallbackDay = getTodayDateInputValue();
  const dayValue = /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) ? selectedDay : fallbackDay;
  const startDate = new Date(`${dayValue}T00:00:00+08:00`);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { startIso: startDate.toISOString(), endIso: endDate.toISOString() };
}

function isOrderWithinDateRange(order: DashboardOrder, range: SalesDateRange): boolean {
  if (!order.created_at) return false;
  const createdAt = new Date(order.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= new Date(range.startIso) && createdAt < new Date(range.endIso);
}

function upsertAndFilterCompletedOrders(
  orderList: DashboardOrder[],
  incomingOrder: DashboardOrder,
  range: SalesDateRange
): DashboardOrder[] {
  const mergedOrders = upsertCompletedOrder(orderList, incomingOrder);
  return sortByCreatedAt(mergedOrders.filter((order) => isOrderWithinDateRange(order, range)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const [activeMobileLaneIndex, setActiveMobileLaneIndex] = useState(0);
  const [collapsedOrderIds, setCollapsedOrderIds] = useState<Record<string, boolean>>({});

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<DashboardOrder[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("daily");
  const [selectedDay, setSelectedDay] = useState(getTodayDateInputValue);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInputValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [salesFetchError, setSalesFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [menuItemRecipeCosts, setMenuItemRecipeCosts] = useState<Record<string, number>>({});
  const [salesCostError, setSalesCostError] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuManagerItem[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isAddMenuFormOpen, setIsAddMenuFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuManagerItem | null>(null);
  const [menuForm, setMenuForm] = useState<NewMenuItemForm>(EMPTY_MENU_FORM);
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false);
  const [updatingMenuImageId, setUpdatingMenuImageId] = useState<string | null>(null);
  const [activeMenuImageItem, setActiveMenuImageItem] = useState<MenuManagerItem | null>(null);
  const [menuImageDraftSource, setMenuImageDraftSource] = useState<string | null>(null);
  const [isMenuImagePickerOpen, setIsMenuImagePickerOpen] = useState(false);
  const [menuBucketImages, setMenuBucketImages] = useState<PromoBucketImageOption[]>([]);
  const [isMenuBucketImagesLoading, setIsMenuBucketImagesLoading] = useState(false);
  const [menuBucketImagesError, setMenuBucketImagesError] = useState<string | null>(null);
  const [deletingMenuItemId, setDeletingMenuItemId] = useState<string | null>(null);

  const [todayHighlightRows, setTodayHighlightRows] = useState<TodayHighlightRow[]>([]);
  const [isHighlightsLoading, setIsHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [isAddHighlightsFormOpen, setIsAddHighlightsFormOpen] = useState(false);
  const [highlightCandidateId, setHighlightCandidateId] = useState("");
  const [isSavingHighlight, setIsSavingHighlight] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState<string | null>(null);

  const [todayAtBarForm, setTodayAtBarForm] = useState<TodayAtBarForm>(EMPTY_TODAY_AT_BAR_FORM);
  const [collapsedPromotionalSlideIds, setCollapsedPromotionalSlideIds] = useState<Record<string, boolean>>({});
  const [lastTouchedPromoSlideId, setLastTouchedPromoSlideId] = useState<string | null>(null);
  const [isTodayAtBarLoading, setIsTodayAtBarLoading] = useState(false);
  const [todayAtBarError, setTodayAtBarError] = useState<string | null>(null);
  const [isSavingTodayAtBar, setIsSavingTodayAtBar] = useState(false);
  const [activePromoSlideId, setActivePromoSlideId] = useState<string | null>(null);
  const [isPromoImagePickerOpen, setIsPromoImagePickerOpen] = useState(false);
  const [promoBucketImages, setPromoBucketImages] = useState<PromoBucketImageOption[]>([]);
  const [isPromoBucketImagesLoading, setIsPromoBucketImagesLoading] = useState(false);
  const [promoBucketImagesError, setPromoBucketImagesError] = useState<string | null>(null);

  const [adminNotice, setAdminNotice] = useState<AdminNotice | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState | null>(null);

  const adminPin = useMemo(() => (process.env.NEXT_PUBLIC_ADMIN_PIN ?? "barista123").trim(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedSession = window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === "1";
    if (savedSession) {
      setIsAuthenticated(true);
      setRememberLogin(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAuthenticated && rememberLogin) {
      window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "1");
      return;
    }

    window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  }, [isAuthenticated, rememberLogin]);

  useEffect(() => {
    if (!adminNotice) return;

    const timeoutId = window.setTimeout(() => {
      setAdminNotice(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [adminNotice]);

  useEffect(() => {
    if (!confirmationModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setConfirmationModal(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmationModal]);

  const closeConfirmationModal = () => {
    setConfirmationModal(null);
  };

  const openConfirmationModal = (modalConfig: ConfirmationModalState) => {
    setConfirmationModal(modalConfig);
  };

  const handleConfirmModalAction = () => {
    if (!confirmationModal) return;

    const confirmAction = confirmationModal.onConfirm;
    setConfirmationModal(null);
    void confirmAction();
  };

  const closePromoImagePicker = () => {
    setIsPromoImagePickerOpen(false);
    setActivePromoSlideId(null);
  };

  const closeMenuImagePicker = () => {
    setIsMenuImagePickerOpen(false);
  };

  useEffect(() => {
    setIsTabMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    setCollapsedOrderIds((previousState) => {
      const activeOrderIds = new Set(orders.map((order) => order.id));
      const nextState: Record<string, boolean> = {};

      for (const [orderId, isCollapsed] of Object.entries(previousState)) {
        if (activeOrderIds.has(orderId) && isCollapsed) {
          nextState[orderId] = true;
        }
      }

      return nextState;
    });
  }, [orders]);

  useEffect(() => {
    setCollapsedPromotionalSlideIds((previousState) => {
      const nextState: Record<string, boolean> = {};

      for (const slide of todayAtBarForm.carouselSlides) {
        nextState[slide.id] = previousState[slide.id] ?? true;
      }

      return nextState;
    });
  }, [todayAtBarForm.carouselSlides]);

  useEffect(() => {
    if (!isPromoImagePickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsPromoImagePickerOpen(false);
      setActivePromoSlideId(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPromoImagePickerOpen]);

  useEffect(() => {
    if (!activePromoSlideId) return;

    const stillExists = todayAtBarForm.carouselSlides.some((slide) => slide.id === activePromoSlideId);
    if (stillExists) return;

    setIsPromoImagePickerOpen(false);
    setActivePromoSlideId(null);
  }, [todayAtBarForm.carouselSlides, activePromoSlideId]);

  const salesDateRange = useMemo(() => {
    return buildSalesDateRange(filterMode, selectedDay, selectedMonth);
  }, [filterMode, selectedDay, selectedMonth]);

  const filteredCompletedOrders = useMemo(() => {
    return completedOrders.filter((order) => isOrderWithinDateRange(order, salesDateRange));
  }, [completedOrders, salesDateRange]);

  useEffect(() => {
    let isCancelled = false;

    const loadRecipeCosts = async () => {
      setSalesCostError(null);

      const menuItemIds = new Set<string>();
      for (const order of filteredCompletedOrders) {
        const orderItems = normalizeOrderItems(order.items);
        for (const item of orderItems) {
          if (item.menuItemId) {
            menuItemIds.add(item.menuItemId);
          }
        }
      }

      if (menuItemIds.size === 0) {
        if (isCancelled) return;
        setMenuItemRecipeCosts({});
        return;
      }

      const { data: recipeRows, error: recipeError } = await supabase
        .from("recipe_ingredients")
        .select("menu_item_id, ingredient_id, quantity")
        .in("menu_item_id", [...menuItemIds]);

      if (recipeError) {
        if (isCancelled) return;
        setMenuItemRecipeCosts({});
        setSalesCostError(recipeError.message || "Unable to load recipe costs for sales summary.");
        return;
      }

      const normalizedRecipeRows = (recipeRows ?? []) as Array<{
        menu_item_id: string;
        ingredient_id: string;
        quantity: number | string;
      }>;

      const ingredientIds = new Set<string>();
      for (const row of normalizedRecipeRows) {
        if (typeof row.ingredient_id === "string" && row.ingredient_id.trim()) {
          ingredientIds.add(row.ingredient_id);
        }
      }

      if (ingredientIds.size === 0) {
        if (isCancelled) return;
        setMenuItemRecipeCosts({});
        return;
      }

      const { data: ingredientRows, error: ingredientError } = await supabase
        .from("ingredients")
        .select("id, cost_per_unit")
        .in("id", [...ingredientIds]);

      if (ingredientError) {
        if (isCancelled) return;
        setMenuItemRecipeCosts({});
        setSalesCostError(ingredientError.message || "Unable to load ingredient costs for sales summary.");
        return;
      }

      const ingredientCostById = new Map<string, number>();
      for (const ingredient of (ingredientRows ?? []) as Array<{ id: string; cost_per_unit: number | string }>) {
        ingredientCostById.set(ingredient.id, parseMoney(ingredient.cost_per_unit));
      }

      const nextRecipeCosts: Record<string, number> = {};
      for (const row of normalizedRecipeRows) {
        const ingredientCost = ingredientCostById.get(row.ingredient_id) ?? 0;
        const ingredientQuantity = parseMoney(row.quantity);
        nextRecipeCosts[row.menu_item_id] = (nextRecipeCosts[row.menu_item_id] ?? 0) + ingredientQuantity * ingredientCost;
      }

      if (isCancelled) return;
      setMenuItemRecipeCosts(nextRecipeCosts);
    };

    void loadRecipeCosts();

    return () => {
      isCancelled = true;
    };
  }, [filteredCompletedOrders]);

  const salesMetrics = useMemo<SalesMetrics>(() => {
    const totals = filteredCompletedOrders.reduce<SalesMetrics>(
      (totals, order) => {
        const orderTotal = parseOrderTotal(order.total_price);
        const isGcash = isGCashPayment(order.payment_method);

        totals.gross += orderTotal;

        const itemCogs = normalizeOrderItems(order.items).reduce((sum, item) => {
          if (!item.menuItemId) return sum;
          const recipeCost = menuItemRecipeCosts[item.menuItemId] ?? 0;
          return sum + recipeCost * item.quantity;
        }, 0);
        totals.cogs += itemCogs;

        if (isGcash) {
          totals.gcash += orderTotal;
        } else {
          totals.cash += orderTotal;
        }

        return totals;
      },
      { gross: 0, cogs: 0, grossProfit: 0, cash: 0, gcash: 0 }
    );

    totals.grossProfit = totals.gross - totals.cogs;
    return totals;
  }, [filteredCompletedOrders, menuItemRecipeCosts]);

  const recentCompletedOrders = useMemo(() => {
    return [...filteredCompletedOrders]
      .sort((firstOrder, secondOrder) => {
        const firstCreatedAt = firstOrder.created_at ?? "";
        const secondCreatedAt = secondOrder.created_at ?? "";
        return secondCreatedAt.localeCompare(firstCreatedAt);
      })
      .slice(0, 12);
  }, [filteredCompletedOrders]);

  const highlightedMenuItemIds = useMemo(() => {
    return new Set(todayHighlightRows.map((highlightRow) => highlightRow.menu_item_id));
  }, [todayHighlightRows]);

  const todayHighlightItems = useMemo(() => {
    const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));
    return todayHighlightRows
      .map((highlightRow) => {
        const item = menuItemsById.get(highlightRow.menu_item_id);
        if (!item) return null;

        return {
          rowId: highlightRow.id,
          item
        };
      })
      .filter((entry): entry is { rowId: string; item: MenuManagerItem } => Boolean(entry));
  }, [menuItems, todayHighlightRows]);

  const availableHighlightMenuItems = useMemo(() => {
    return menuItems.filter((menuItem) => !highlightedMenuItemIds.has(menuItem.id));
  }, [menuItems, highlightedMenuItemIds]);

  const activePromoSlide = useMemo(() => {
    if (!activePromoSlideId) return null;
    return todayAtBarForm.carouselSlides.find((slide) => slide.id === activePromoSlideId) ?? null;
  }, [todayAtBarForm.carouselSlides, activePromoSlideId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const loadActiveOrders = async () => {
      setIsLoading(true);
      setFetchError(null);

      const activeResult = await supabase
        .from("orders")
        .select(ORDER_SELECT_FIELDS)
        .in("status", ["received", "preparing", "brewing", "ready"])
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (activeResult.error) {
        setFetchError(activeResult.error?.message || "Unable to load dashboard data.");
        setOrders([]);
        setIsLoading(false);
        return;
      }

      const loadedOrders = ((activeResult.data ?? []) as DashboardOrder[]).filter((order) => isBoardStatus(order.status));
      setOrders(sortByCreatedAt(loadedOrders));
      setIsLoading(false);
    };

    void loadActiveOrders();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const loadCompletedOrders = async () => {
      setIsSalesLoading(true);
      setSalesFetchError(null);

      const [liveCompletedResult, archivedCompletedResult] = await Promise.all([
        supabase
          .from("orders")
          .select(ORDER_SELECT_FIELDS)
          .eq("status", "completed")
          .gte("created_at", salesDateRange.startIso)
          .lt("created_at", salesDateRange.endIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders_archive")
          .select(ORDER_SELECT_FIELDS)
          .eq("status", "completed")
          .gte("created_at", salesDateRange.startIso)
          .lt("created_at", salesDateRange.endIso)
          .order("created_at", { ascending: false })
      ]);

      if (!isMounted) return;

      if (liveCompletedResult.error || archivedCompletedResult.error) {
        setSalesFetchError(
          liveCompletedResult.error?.message ||
            archivedCompletedResult.error?.message ||
            "Unable to load completed orders for sales summary."
        );
        setCompletedOrders([]);
        setIsSalesLoading(false);
        return;
      }

      const liveCompletedOrders = ((liveCompletedResult.data ?? []) as DashboardOrder[]).filter((order) => isCompletedStatus(order.status));
      const archivedCompletedOrders = ((archivedCompletedResult.data ?? []) as DashboardOrder[]).filter((order) => isCompletedStatus(order.status));
      setCompletedOrders(mergeCompletedOrders(liveCompletedOrders, archivedCompletedOrders));
      setIsSalesLoading(false);
    };

    void loadCompletedOrders();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, salesDateRange.endIso, salesDateRange.startIso]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const loadTodayAtBar = async () => {
      setIsTodayAtBarLoading(true);
      setTodayAtBarError(null);

      const { data, error } = await supabase
        .from("today_at_bar")
        .select(TODAY_AT_BAR_SELECT_FIELDS)
        .eq("id", 1)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setTodayAtBarError(error.message || "Unable to load Promotional content.");
        setIsTodayAtBarLoading(false);
        return;
      }

      if (!data) {
        setTodayAtBarError("Promotional row with id = 1 was not found. Please run the latest schema.sql.");
        setIsTodayAtBarLoading(false);
        return;
      }

      setTodayAtBarForm(mapTodayAtBarRowToForm(data as TodayAtBarRow));
      setLastTouchedPromoSlideId(null);
      setIsTodayAtBarLoading(false);
    };

    void loadTodayAtBar();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const ordersChannel = supabase
      .channel("barista-dashboard-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders"
        },
        (payload: { new: DashboardOrder }) => {
          setOrders((previousOrders) => upsertLiveOrder(previousOrders, payload.new));
          setCompletedOrders((previousOrders) => upsertAndFilterCompletedOrders(previousOrders, payload.new, salesDateRange));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders"
        },
        (payload: { new: DashboardOrder }) => {
          setOrders((previousOrders) => upsertLiveOrder(previousOrders, payload.new));
          setCompletedOrders((previousOrders) => upsertAndFilterCompletedOrders(previousOrders, payload.new, salesDateRange));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders"
        },
        (payload: { old?: { id?: string } }) => {
          if (!payload.old?.id) return;
          setOrders((previousOrders) => previousOrders.filter((order) => order.id !== payload.old?.id));
          setCompletedOrders((previousOrders) => previousOrders.filter((order) => order.id !== payload.old?.id));
        }
      )
      .subscribe();

    const archiveChannel = supabase
      .channel("barista-dashboard-orders-archive")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders_archive"
        },
        (payload: { new: DashboardOrder }) => {
          setCompletedOrders((previousOrders) => upsertAndFilterCompletedOrders(previousOrders, payload.new, salesDateRange));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders_archive"
        },
        (payload: { new: DashboardOrder }) => {
          setCompletedOrders((previousOrders) => upsertAndFilterCompletedOrders(previousOrders, payload.new, salesDateRange));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders_archive"
        },
        (payload: { old?: { id?: string } }) => {
          if (!payload.old?.id) return;
          setCompletedOrders((previousOrders) => previousOrders.filter((order) => order.id !== payload.old?.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(archiveChannel);
    };
  }, [isAuthenticated, salesDateRange]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const loadMenuItems = async () => {
      setIsMenuLoading(true);
      setMenuError(null);

      const { data, error } = await supabase
        .from("menu_items")
        .select(MENU_ITEM_SELECT_FIELDS)
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        setMenuError(error.message || "Unable to load menu items.");
        setMenuItems([]);
        setIsMenuLoading(false);
        return;
      }

      const normalizedMenuItems = ((data ?? []) as MenuManagerItem[]).map(normalizeMenuManagerItem);
      setMenuItems(sortMenuItemsByName(normalizedMenuItems));
      setIsMenuLoading(false);
    };

    void loadMenuItems();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const loadTodayHighlights = async () => {
      setIsHighlightsLoading(true);
      setHighlightsError(null);

      const { data, error } = await supabase
        .from("today_highlights")
        .select(TODAY_HIGHLIGHT_SELECT_FIELDS)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (error) {
        setHighlightsError(error.message || "Unable to load today highlights.");
        setTodayHighlightRows([]);
        setIsHighlightsLoading(false);
        return;
      }

      setTodayHighlightRows(sortTodayHighlights((data ?? []) as TodayHighlightRow[]));
      setIsHighlightsLoading(false);
    };

    void loadTodayHighlights();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pinInput.trim() === adminPin) {
      setIsAuthenticated(true);
      setPinError(null);
      setPinInput("");
      return;
    }

    setPinError("Incorrect PIN. Please try again.");
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    }

    setIsAuthenticated(false);
    setActiveTab("orders");
    setPinInput("");
    setPinError(null);
    setFetchError(null);
    setSalesFetchError(null);
    setActionError(null);
    setOrders([]);
    setCompletedOrders([]);
    setMenuItemRecipeCosts({});
    setSalesCostError(null);
    setUpdatingOrderId(null);
    setMenuItems([]);
    setMenuError(null);
    setIsAddMenuFormOpen(false);
    setEditingItem(null);
    setMenuForm(EMPTY_MENU_FORM);
    setUpdatingMenuImageId(null);
    setActiveMenuImageItem(null);
    setMenuImageDraftSource(null);
    setIsMenuImagePickerOpen(false);
    setMenuBucketImages([]);
    setMenuBucketImagesError(null);
    setIsMenuBucketImagesLoading(false);
    setDeletingMenuItemId(null);
    setTodayHighlightRows([]);
    setHighlightsError(null);
    setIsAddHighlightsFormOpen(false);
    setHighlightCandidateId("");
    setDeletingHighlightId(null);
    setTodayAtBarForm(EMPTY_TODAY_AT_BAR_FORM);
    setCollapsedPromotionalSlideIds({});
    setLastTouchedPromoSlideId(null);
    setTodayAtBarError(null);
    setActivePromoSlideId(null);
    setIsPromoImagePickerOpen(false);
    setPromoBucketImages([]);
    setPromoBucketImagesError(null);
    setIsPromoBucketImagesLoading(false);
    setAdminNotice(null);
  };

  const handleRequestLogout = () => {
    openConfirmationModal({
      title: "Logout from dashboard?",
      message: "You will be signed out and need to enter the dashboard PIN again.",
      confirmLabel: "Logout",
      onConfirm: handleLogout
    });
  };

  const toggleOrderCard = (orderId: string) => {
    setCollapsedOrderIds((previousState) => ({
      ...previousState,
      [orderId]: !previousState[orderId]
    }));
  };

  const togglePromotionalSlideCard = (slideId: string) => {
    setCollapsedPromotionalSlideIds((previousState) => {
      const isCurrentlyCollapsed = previousState[slideId] !== false;

      return {
        ...previousState,
        [slideId]: !isCurrentlyCollapsed
      };
    });
  };

  const updateOrderStatus = async (orderId: string, newStatus: ActionConfig["nextStatus"]) => {
    setActionError(null);
    setUpdatingOrderId(orderId);

    const sourceOrder = orders.find((order) => order.id === orderId);

    const { data, error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId)
      .select("id")
      .maybeSingle();

    if (error) {
      setActionError(error.message || "Unable to update order status.");
      setUpdatingOrderId((currentOrderId) => (currentOrderId === orderId ? null : currentOrderId));
      return;
    }

    if (!data?.id) {
      setActionError("Status update was blocked by database permissions. Please apply the latest schema policies.");
      setUpdatingOrderId((currentOrderId) => (currentOrderId === orderId ? null : currentOrderId));
      return;
    }

    setOrders((previousOrders) => applyLocalStatusUpdate(previousOrders, orderId, newStatus));
    if (sourceOrder) {
      setCompletedOrders((previousOrders) =>
        upsertAndFilterCompletedOrders(previousOrders, {
          ...sourceOrder,
          status: newStatus
        }, salesDateRange)
      );
    }

    setUpdatingOrderId((currentOrderId) => (currentOrderId === orderId ? null : currentOrderId));
  };

  const resetMenuFormState = () => {
    setEditingItem(null);
    setMenuForm(EMPTY_MENU_FORM);
  };

  const openCreateMenuForm = () => {
    setIsAddMenuFormOpen(true);
    resetMenuFormState();
    setMenuError(null);
  };

  const handleStartEditMenuItem = (menuItem: MenuManagerItem) => {
    setEditingItem(menuItem);
    setMenuForm({
      name: menuItem.name,
      description: menuItem.description ?? "",
      basePrice: String(parseMoney(menuItem.base_price)),
      category: normalizeMenuCategory(menuItem.category)
    });
    setIsAddMenuFormOpen(true);
    setMenuError(null);
  };

  const handleCancelEditMenuItem = () => {
    resetMenuFormState();
    setMenuError(null);
  };

  const handleCreateMenuItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingMenuItem) return;

    const nextName = menuForm.name.trim();
    const nextDescription = menuForm.description.trim();
    const nextPrice = Number(menuForm.basePrice);
    const nextCategory = normalizeMenuCategory(menuForm.category);

    if (!nextName) {
      setMenuError("Drink name is required.");
      return;
    }

    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setMenuError("Base price must be a valid non-negative number.");
      return;
    }

    setIsSavingMenuItem(true);
    setMenuError(null);

    const payload = {
      name: nextName,
      description: nextDescription,
      base_price: nextPrice,
      category: nextCategory
    };

    const isEditing = Boolean(editingItem?.id);

    const query = isEditing
      ? supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editingItem?.id)
          .select(MENU_ITEM_SELECT_FIELDS)
          .maybeSingle()
      : supabase
          .from("menu_items")
          .insert([
            {
              ...payload,
              image_url: null
            }
          ])
          .select(MENU_ITEM_SELECT_FIELDS)
          .single();

    const { data, error } = await query;

    if (error || !data) {
      const hasCategoryError = error?.message?.toLowerCase().includes("category");
      setMenuError(hasCategoryError ? "Menu category field is missing. Please apply the latest schema.sql first." : error?.message || "Unable to add menu item.");
      setIsSavingMenuItem(false);
      return;
    }

    const savedMenuItem = normalizeMenuManagerItem(data as MenuManagerItem);
    setMenuItems((previousItems) => {
      if (!isEditing) {
        return sortMenuItemsByName([...previousItems, savedMenuItem]);
      }

      return sortMenuItemsByName(previousItems.map((item) => (item.id === savedMenuItem.id ? savedMenuItem : item)));
    });
    resetMenuFormState();
    setIsAddMenuFormOpen(false);
    setIsSavingMenuItem(false);
    setAdminNotice({ tone: "success", message: isEditing ? "Menu item updated." : "New drink added to menu." });
  };

  const openMenuImageDialog = (menuItem: MenuManagerItem) => {
    setActiveMenuImageItem(menuItem);
    setMenuImageDraftSource(menuItem.image_url);
    setIsMenuImagePickerOpen(false);
    setMenuBucketImagesError(null);
    setMenuError(null);
  };

  const closeMenuImageDialog = () => {
    setActiveMenuImageItem(null);
    setMenuImageDraftSource(null);
    setIsMenuImagePickerOpen(false);
  };

  const updateMenuItemImage = async (
    menuItem: MenuManagerItem,
    nextImageUrl: string | null,
    successMessage: string
  ): Promise<MenuManagerItem | null> => {
    setUpdatingMenuImageId(menuItem.id);
    setMenuError(null);

    const { data, error } = await supabase
      .from("menu_items")
      .update({ image_url: nextImageUrl })
      .eq("id", menuItem.id)
      .select(MENU_ITEM_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      setMenuError(error.message || "Unable to update menu image.");
      setUpdatingMenuImageId(null);
      return null;
    }

    if (!data?.id) {
      setMenuError("Image update was blocked by database permissions. Please apply the latest schema policies.");
      setUpdatingMenuImageId(null);
      return null;
    }

    const updatedMenuItem = normalizeMenuManagerItem(data as MenuManagerItem);

    setMenuItems((previousItems) =>
      sortMenuItemsByName(previousItems.map((item) => (item.id === menuItem.id ? updatedMenuItem : item)))
    );
    setUpdatingMenuImageId(null);
    setAdminNotice({ tone: "success", message: successMessage });
    return updatedMenuItem;
  };

  const removeMenuItemImage = async (menuItem: MenuManagerItem) => {
    const updatedMenuItem = await updateMenuItemImage(
      menuItem,
      null,
      `Image removed for ${menuItem.name}.`
    );

    if (!updatedMenuItem) return;

    if (activeMenuImageItem?.id === updatedMenuItem.id) {
      setActiveMenuImageItem(updatedMenuItem);
    }
    setMenuImageDraftSource(null);
    setIsMenuImagePickerOpen(false);
  };

  const handleRemoveActiveMenuImage = () => {
    if (!activeMenuImageItem?.image_url || updatingMenuImageId) return;

    const menuItem = activeMenuImageItem;
    openConfirmationModal({
      title: "Remove Menu Image",
      message: `Remove image for ${menuItem.name}? This will keep the menu item but clear its image preview.`,
      confirmLabel: "Remove Image",
      onConfirm: () => removeMenuItemImage(menuItem)
    });
  };

  const deleteMenuItem = async (menuItem: MenuManagerItem) => {
    if (deletingMenuItemId) return;

    setDeletingMenuItemId(menuItem.id);
    setMenuError(null);

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", menuItem.id);

    if (error) {
      setMenuError(error.message || "Unable to delete menu item.");
      setDeletingMenuItemId(null);
      return;
    }

    setMenuItems((previousItems) => previousItems.filter((item) => item.id !== menuItem.id));
    setTodayHighlightRows((previousRows) => previousRows.filter((row) => row.menu_item_id !== menuItem.id));

    if (editingItem?.id === menuItem.id) {
      resetMenuFormState();
    }

    if (activeMenuImageItem?.id === menuItem.id) {
      closeMenuImageDialog();
    }

    setDeletingMenuItemId(null);
    setAdminNotice({ tone: "success", message: "Menu item deleted." });
  };

  const handleDeleteMenuItem = (menuItem: MenuManagerItem) => {
    if (deletingMenuItemId) return;

    openConfirmationModal({
      title: "Delete Menu Item",
      message: `Delete ${menuItem.name}? This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => deleteMenuItem(menuItem)
    });
  };

  const handleAddTodayHighlight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingHighlight) return;

    const selectedMenuItemId = highlightCandidateId.trim();
    if (!selectedMenuItemId) {
      setHighlightsError("Please select a drink to add to Today Highlights.");
      return;
    }

    setHighlightsError(null);
    setIsSavingHighlight(true);

    const { data, error } = await supabase
      .from("today_highlights")
      .insert([
        {
          menu_item_id: selectedMenuItemId
        }
      ])
      .select(TODAY_HIGHLIGHT_SELECT_FIELDS)
      .single();

    if (error || !data?.id) {
      setHighlightsError(error?.message || "Unable to add drink highlight.");
      setIsSavingHighlight(false);
      return;
    }

    setTodayHighlightRows((previousRows) => sortTodayHighlights([...previousRows, data as TodayHighlightRow]));
    setHighlightCandidateId("");
    setIsAddHighlightsFormOpen(false);
    setIsSavingHighlight(false);
    setAdminNotice({ tone: "success", message: "Drink added to Today Highlights." });
  };

  const deleteTodayHighlight = async (highlightRowId: string) => {
    if (deletingHighlightId) return;

    setDeletingHighlightId(highlightRowId);
    setHighlightsError(null);

    const { error } = await supabase
      .from("today_highlights")
      .delete()
      .eq("id", highlightRowId);

    if (error) {
      setHighlightsError(error.message || "Unable to remove highlighted drink.");
      setDeletingHighlightId(null);
      return;
    }

    setTodayHighlightRows((previousRows) => previousRows.filter((row) => row.id !== highlightRowId));
    setDeletingHighlightId(null);
    setAdminNotice({ tone: "success", message: "Highlighted drink removed." });
  };

  const handleDeleteTodayHighlight = (highlightRowId: string, menuItemName: string) => {
    if (deletingHighlightId) return;

    openConfirmationModal({
      title: "Remove Today Highlight",
      message: `Remove ${menuItemName} from Today Highlights?`,
      confirmLabel: "Remove",
      onConfirm: () => deleteTodayHighlight(highlightRowId)
    });
  };

  const loadPromoBucketImages = async () => {
    if (!PROMO_IMAGE_BUCKET_NAME) {
      setPromoBucketImages([]);
      setPromoBucketImagesError(
        "Missing NEXT_PUBLIC_PROMO_IMAGE_BUCKET_NAME. Configure this env var to enable bucket image picker."
      );
      return;
    }

    setIsPromoBucketImagesLoading(true);
    setPromoBucketImagesError(null);

    const normalizedPrefix = normalizePromoStoragePath(PROMO_IMAGE_BUCKET_PREFIX);
    const queue = [normalizedPrefix];
    const visitedFolders = new Set<string>();
    const seenFilePaths = new Set<string>();
    const collectedOptions: PromoBucketImageOption[] = [];

    while (queue.length > 0) {
      const currentFolder = normalizePromoStoragePath(queue.shift() ?? "");
      if (visitedFolders.has(currentFolder)) {
        continue;
      }

      visitedFolders.add(currentFolder);
      let offset = 0;

      while (true) {
        const { data, error } = await supabase.storage
          .from(PROMO_IMAGE_BUCKET_NAME)
          .list(currentFolder, {
            limit: 100,
            offset,
            sortBy: { column: "name", order: "asc" }
          });

        if (error) {
          setPromoBucketImages([]);
          setPromoBucketImagesError(error.message || "Unable to load images from Supabase Storage.");
          setIsPromoBucketImagesLoading(false);
          return;
        }

        const entries = (data ?? []) as Record<string, unknown>[];

        for (const entry of entries) {
          const entryName = typeof entry.name === "string" ? entry.name.trim() : "";
          if (!entryName || entryName === ".emptyFolderPlaceholder") continue;

          const fullPath = getStorageEntryPath(currentFolder, entryName);
          if (!fullPath) continue;

          if (isPromoStorageFolder(entry)) {
            queue.push(fullPath);
            continue;
          }

          if (!isSupportedPromoImageFile(entryName)) {
            continue;
          }

          if (seenFilePaths.has(fullPath)) {
            continue;
          }
          seenFilePaths.add(fullPath);

          const { data: publicUrlData } = supabase.storage
            .from(PROMO_IMAGE_BUCKET_NAME)
            .getPublicUrl(fullPath);

          collectedOptions.push({
            name: entryName,
            path: fullPath,
            publicUrl: publicUrlData.publicUrl,
            updatedAt: typeof entry.updated_at === "string" ? entry.updated_at : null,
            sizeInBytes:
              typeof entry.metadata === "object" && entry.metadata !== null && typeof (entry.metadata as { size?: unknown }).size === "number"
                ? ((entry.metadata as { size: number }).size ?? null)
                : null
          });
        }

        if (entries.length < 100) {
          break;
        }

        offset += 100;
      }
    }

    setPromoBucketImages(sortPromoBucketImages(collectedOptions));
    setIsPromoBucketImagesLoading(false);
  };

  const loadMenuBucketImages = async () => {
    if (!PROMO_IMAGE_BUCKET_NAME) {
      setMenuBucketImages([]);
      setMenuBucketImagesError(
        "Missing NEXT_PUBLIC_PROMO_IMAGE_BUCKET_NAME. Configure this env var to enable bucket image picker."
      );
      return;
    }

    setIsMenuBucketImagesLoading(true);
    setMenuBucketImagesError(null);

    const normalizedPrefix = normalizePromoStoragePath(PROMO_IMAGE_BUCKET_PREFIX);
    const queue = [normalizedPrefix];
    const visitedFolders = new Set<string>();
    const seenFilePaths = new Set<string>();
    const collectedOptions: PromoBucketImageOption[] = [];

    while (queue.length > 0) {
      const currentFolder = normalizePromoStoragePath(queue.shift() ?? "");
      if (visitedFolders.has(currentFolder)) {
        continue;
      }

      visitedFolders.add(currentFolder);
      let offset = 0;

      while (true) {
        const { data, error } = await supabase.storage
          .from(PROMO_IMAGE_BUCKET_NAME)
          .list(currentFolder, {
            limit: 100,
            offset,
            sortBy: { column: "name", order: "asc" }
          });

        if (error) {
          setMenuBucketImages([]);
          setMenuBucketImagesError(error.message || "Unable to load images from Supabase Storage.");
          setIsMenuBucketImagesLoading(false);
          return;
        }

        const entries = (data ?? []) as Record<string, unknown>[];

        for (const entry of entries) {
          const entryName = typeof entry.name === "string" ? entry.name.trim() : "";
          if (!entryName || entryName === ".emptyFolderPlaceholder") continue;

          const fullPath = getStorageEntryPath(currentFolder, entryName);
          if (!fullPath) continue;

          if (isPromoStorageFolder(entry)) {
            queue.push(fullPath);
            continue;
          }

          if (!isSupportedPromoImageFile(entryName)) {
            continue;
          }

          if (seenFilePaths.has(fullPath)) {
            continue;
          }
          seenFilePaths.add(fullPath);

          const { data: publicUrlData } = supabase.storage
            .from(PROMO_IMAGE_BUCKET_NAME)
            .getPublicUrl(fullPath);

          collectedOptions.push({
            name: entryName,
            path: fullPath,
            publicUrl: publicUrlData.publicUrl,
            updatedAt: typeof entry.updated_at === "string" ? entry.updated_at : null,
            sizeInBytes:
              typeof entry.metadata === "object" && entry.metadata !== null && typeof (entry.metadata as { size?: unknown }).size === "number"
                ? ((entry.metadata as { size: number }).size ?? null)
                : null
          });
        }

        if (entries.length < 100) {
          break;
        }

        offset += 100;
      }
    }

    setMenuBucketImages(sortPromoBucketImages(collectedOptions));
    setIsMenuBucketImagesLoading(false);
  };

  const openMenuImagePicker = () => {
    if (!activeMenuImageItem) return;

    setIsMenuImagePickerOpen(true);
    void loadMenuBucketImages();
  };

  const handleSelectMenuBucketImage = async (publicUrl: string) => {
    if (!activeMenuImageItem || updatingMenuImageId) return;

    const updatedMenuItem = await updateMenuItemImage(
      activeMenuImageItem,
      publicUrl,
      `Image updated for ${activeMenuImageItem.name}.`
    );

    if (!updatedMenuItem) return;

    setActiveMenuImageItem(updatedMenuItem);
    setMenuImageDraftSource(updatedMenuItem.image_url);
    setIsMenuImagePickerOpen(false);
  };

  const openPromoImagePicker = (slideId: string) => {
    setActivePromoSlideId(slideId);
    setIsPromoImagePickerOpen(true);
    void loadPromoBucketImages();
  };

  const handleSelectPromoBucketImage = (publicUrl: string) => {
    if (!activePromoSlideId) return;
    handleUpdateTodayAtBarSlide(activePromoSlideId, "imageUrl", publicUrl);
    closePromoImagePicker();
  };

  const handleAddTodayAtBarSlide = () => {
    const newSlide = createTodayAtBarSlideDraft(Date.now());

    setTodayAtBarForm((previousForm) => ({
      ...previousForm,
      carouselSlides: [...previousForm.carouselSlides, newSlide]
    }));
    setCollapsedPromotionalSlideIds((previousState) => ({
      ...previousState,
      [newSlide.id]: true
    }));
    setLastTouchedPromoSlideId(newSlide.id);
  };

  const handleUpdateTodayAtBarSlide = (
    slideId: string,
    field: "imageUrl" | "title" | "description",
    value: string
  ) => {
    setTodayAtBarForm((previousForm) => ({
      ...previousForm,
      carouselSlides: previousForm.carouselSlides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              [field]: value
            }
          : slide
      )
    }));
    setLastTouchedPromoSlideId(slideId);
  };

  const handleRemoveTodayAtBarSlide = (slideId: string) => {
    setTodayAtBarForm((previousForm) => ({
      ...previousForm,
      carouselSlides: previousForm.carouselSlides.filter((slide) => slide.id !== slideId)
    }));

    setLastTouchedPromoSlideId((previousSlideId) => (previousSlideId === slideId ? null : previousSlideId));
  };

  const handleSaveTodayAtBar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingTodayAtBar) return;

    setTodayAtBarError(null);
    setIsSavingTodayAtBar(true);

    const parsedCarouselIntervalMs = Number(todayAtBarForm.carouselIntervalMs);
    const normalizedCarouselIntervalMs = Number.isFinite(parsedCarouselIntervalMs)
      ? clampCarouselInterval(parsedCarouselIntervalMs)
      : TODAY_AT_BAR_CAROUSEL_INTERVAL_DEFAULT;
    const normalizedCarouselSlides = normalizeTodayAtBarSlidesForSave(todayAtBarForm.carouselSlides);

    const payload = {
      title: todayAtBarForm.title.trim(),
      description: todayAtBarForm.description.trim(),
      dose: todayAtBarForm.dose.trim(),
      extraction_time: todayAtBarForm.extractionTime.trim(),
      brew_temp: todayAtBarForm.brewTemp.trim(),
      guest_score: todayAtBarForm.guestScore.trim(),
      carousel_enabled: todayAtBarForm.carouselEnabled,
      carousel_autoplay: todayAtBarForm.carouselAutoplay,
      carousel_interval_ms: normalizedCarouselIntervalMs,
      carousel_slides: normalizedCarouselSlides
    };

    const { data, error } = await supabase
      .from("today_at_bar")
      .update(payload)
      .eq("id", 1)
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      setTodayAtBarError(error?.message || "Promotional row with id = 1 was not found.");
      setIsSavingTodayAtBar(false);
      return;
    }

    const parsedSlides = parseTodayAtBarCarouselSlides(normalizedCarouselSlides);

    setTodayAtBarForm((previousForm) => ({
      ...previousForm,
      carouselIntervalMs: String(normalizedCarouselIntervalMs),
      carouselSlides: parsedSlides
    }));
    setCollapsedPromotionalSlideIds((previousState) => {
      const nextState: Record<string, boolean> = {};

      for (const slide of parsedSlides) {
        nextState[slide.id] = previousState[slide.id] ?? true;
      }

      if (lastTouchedPromoSlideId && lastTouchedPromoSlideId in nextState) {
        nextState[lastTouchedPromoSlideId] = true;
      }

      return nextState;
    });
    setIsSavingTodayAtBar(false);
    setAdminNotice({ tone: "success", message: "Landing promotional content saved." });
  };

  const groupedOrders = useMemo(() => {
    return orders.reduce<Record<ColumnKey, DashboardOrder[]>>(
      (accumulator, order) => {
        const key = normalizeStatus(order.status);
        if (!key) return accumulator;
        accumulator[key].push(order);
        return accumulator;
      },
      {
        received: [],
        preparing: [],
        ready: []
      }
    );
  }, [orders]);

  const liveOrderLanes = [
    {
      boardClass: "board-preparing",
      countLabel: "In progress",
      heading: "PREPARING",
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </svg>
      ),
      orders: groupedOrders.preparing
    },
    {
      boardClass: "board-new",
      countLabel: "Just placed",
      heading: "NEW ORDERS",
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
        </svg>
      ),
      orders: groupedOrders.received
    },
    {
      boardClass: "board-ready",
      countLabel: "Pickup / handoff",
      heading: "READY FOR PICKUP",
      icon: (
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ),
      orders: groupedOrders.ready
    }
  ];

  const isUpdatingActiveMenuImage = activeMenuImageItem ? updatingMenuImageId === activeMenuImageItem.id : false;

  if (!isAuthenticated) {
    return (
      <main className="barista-login-shell">
        <section className="barista-login-card" aria-label="Barista login">
          <p className="barista-dashboard-kicker">Espressonism Ops</p>
          <h1>Barista Login</h1>
          <p className="barista-dashboard-copy">Enter your dashboard PIN to manage active orders and sales summary.</p>

          <form className="barista-login-form" onSubmit={handleLogin}>
            <label htmlFor="baristaPin">Dashboard PIN</label>
            <input
              id="baristaPin"
              type="password"
              value={pinInput}
              onChange={(event) => {
                setPinInput(event.target.value);
                if (pinError) setPinError(null);
              }}
              placeholder="Enter PIN"
              autoComplete="current-password"
              required
            />

            <label className="barista-login-remember" htmlFor="baristaRemember">
              <input
                id="baristaRemember"
                type="checkbox"
                checked={rememberLogin}
                onChange={(event) => setRememberLogin(event.target.checked)}
              />
              <span>Remember me in this browser session</span>
            </label>

            {pinError ? <p className="barista-state barista-state-error">{pinError}</p> : null}

            <button type="submit" className="barista-action-btn">
              Login
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="barista-dashboard">
      <header className="barista-dashboard-header">
        <div className="barista-dashboard-header-main">
          <div className="barista-dashboard-header-top">
            <p className="barista-dashboard-kicker">Espressonism Ops</p>
          </div>
          <h1>Barista Dashboard</h1>
          <p className="barista-dashboard-copy">Track all active cups from queue to handoff.</p>
        </div>
        <div className="barista-dashboard-actions">
          <nav className="barista-tab-nav barista-tab-nav-desktop" aria-label="Dashboard sections">
            {ADMIN_TABS.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`barista-tab-btn ${isActive ? "barista-tab-btn-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                  aria-pressed={isActive}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="barista-mobile-tab-menu">
            <button
              type="button"
              className="barista-mobile-tab-toggle"
              aria-expanded={isTabMenuOpen}
              aria-controls="baristaMobileTabMenu"
              onClick={() => setIsTabMenuOpen((previousState) => !previousState)}
            >
              <span aria-hidden="true">☰</span>
              <span>Sections</span>
            </button>

            {isTabMenuOpen ? (
              <div id="baristaMobileTabMenu" className="barista-mobile-tab-panel" aria-label="Dashboard sections">
                {ADMIN_TABS.map((tab) => {
                  const isActive = tab.key === activeTab;

                  return (
                    <button
                      key={`mobile-tab-${tab.key}`}
                      type="button"
                      className={`barista-tab-btn barista-mobile-tab-item ${isActive ? "barista-tab-btn-active" : ""}`}
                      onClick={() => setActiveTab(tab.key)}
                      aria-pressed={isActive}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button type="button" className="barista-logout-btn barista-logout-btn-danger" onClick={handleRequestLogout}>
            Logout
          </button>
        </div>
      </header>

      {adminNotice ? (
        <p
          className={`barista-inline-state ${adminNotice.tone === "success" ? "barista-inline-state-success" : "barista-inline-state-error"}`}
          role="status"
        >
          {adminNotice.message}
        </p>
      ) : null}

      <section className="barista-tab-content">

      {activeTab === "orders" ? (
        <section className="barista-orders-panel" aria-label="Live orders board">
          {isLoading ? (
            <>
              <div className="barista-lane-cycler" aria-label="Loading mobile lane controls" aria-busy="true">
                <Skeleton type="block" width="11rem" height="2.4rem" />
                <Skeleton type="block" width="11rem" height="2.4rem" />
                <Skeleton type="block" width="11rem" height="2.4rem" />
              </div>

              <section className="barista-grid" aria-label="Loading active order board" aria-busy="true">
                <article className="barista-column board-preparing">
                  <header className="barista-column-header">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <p>In progress</p>
                      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
                        PREPARING
                      </h2>
                    </div>
                    <Skeleton type="text" width={28} />
                  </header>

                  <div className="barista-column-list">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <SkeletonPageSection
                        key={`orders-skeleton-preparing-${index}`}
                        className="barista-order-card"
                        titleWidth="48%"
                        lineCount={5}
                        lineWidths={["58%", "100%", "92%", "74%", "48%"]}
                      />
                    ))}
                  </div>
                </article>

                <article className="barista-column board-new">
                  <header className="barista-column-header">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <p>Just placed</p>
                      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
                        NEW ORDERS
                      </h2>
                    </div>
                    <Skeleton type="text" width={28} />
                  </header>

                  <div className="barista-column-list">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <SkeletonPageSection
                        key={`orders-skeleton-received-${index}`}
                        className="barista-order-card"
                        titleWidth="48%"
                        lineCount={5}
                        lineWidths={["58%", "100%", "92%", "74%", "48%"]}
                      />
                    ))}
                  </div>
                </article>

                <article className="barista-column board-ready">
                  <header className="barista-column-header">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <p>Pickup / handoff</p>
                      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        READY FOR PICKUP
                      </h2>
                    </div>
                    <Skeleton type="text" width={28} />
                  </header>

                  <div className="barista-column-list">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <SkeletonPageSection
                        key={`orders-skeleton-ready-${index}`}
                        className="barista-order-card"
                        titleWidth="48%"
                        lineCount={5}
                        lineWidths={["58%", "100%", "92%", "74%", "48%"]}
                      />
                    ))}
                  </div>
                </article>
              </section>
            </>
          ) : null}
          {fetchError ? <p className="barista-state barista-state-error">{fetchError}</p> : null}
          {actionError ? <p className="barista-state barista-state-error">{actionError}</p> : null}

          {!isLoading && !fetchError ? (
            <>
              <div className="barista-lane-cycler" aria-label="Mobile lane controls">
                {liveOrderLanes.map((lane, laneIndex) => {
                  const isActive = laneIndex === activeMobileLaneIndex;
                  const mobileButtonTitle =
                    lane.boardClass === "board-preparing"
                      ? "Preparing"
                      : lane.boardClass === "board-new"
                        ? "New Orders"
                        : "Ready for Pick orders";
                  const mobileButtonLabel = `${mobileButtonTitle} (${lane.orders.length})`;

                  return (
                    <button
                      key={`mobile-lane-${lane.boardClass}`}
                      type="button"
                      className={`barista-mobile-lane-btn ${lane.boardClass === "board-preparing" ? "barista-mobile-lane-btn-preparing" : ""}`}
                      onClick={() => setActiveMobileLaneIndex(laneIndex)}
                      aria-pressed={isActive}
                    >
                      {mobileButtonLabel}
                    </button>
                  );
                })}
              </div>

              <section className="barista-grid barista-grid-cycler" aria-label="Active order kanban board">
              {liveOrderLanes.map((lane, laneIndex) => (
                <article
                  key={lane.boardClass}
                  className={`barista-column ${lane.boardClass} ${laneIndex === activeMobileLaneIndex ? "barista-column-mobile-active" : ""}`}
                >
                  <header className="barista-column-header">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <p>{lane.countLabel}</p>
                      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {lane.icon}
                        {lane.heading}
                      </h2>
                    </div>
                    <span className="barista-column-count" aria-label={`${lane.orders.length} orders`}>
                      {lane.orders.length}
                    </span>
                  </header>

                  <div className="barista-column-list">
                    {lane.orders.length === 0 ? <p className="barista-empty">No orders in this lane.</p> : null}

                    {lane.orders.map((order) => {
                      const items = normalizeOrderItems(order.items);
                      const isDelivery = order.order_type === "delivery";
                      const isGcash = isGCashPayment(order.payment_method);
                      const pickupTimeLabel = formatPickupTimeLabel(order.order_type, order.pickup_time);
                      const specialInstructions = order.special_instructions?.trim() || "";
                      const actionConfig = getActionConfig(order.status);
                      const isUpdating = updatingOrderId === order.id;
                      const isCollapsibleCard = lane.orders.length > 1;
                      const isCardCollapsed = Boolean(collapsedOrderIds[order.id]) && isCollapsibleCard;
                      const orderDetailsId = `barista-order-details-${order.id}`;

                      return (
                        <article key={order.id} className="barista-order-card">
                          <div className="barista-order-head">
                            <div>
                              <h3>{order.customer_name?.trim() || "Walk-in Customer"}</h3>
                              <p>{order.customer_phone?.trim() || "No phone provided"}</p>
                            </div>

                            <div className="barista-order-head-actions">
                              <span className={`barista-badge ${isDelivery ? "barista-badge-delivery" : "barista-badge-pickup"}`}>
                                {orderTypeLabel(order.order_type)}
                              </span>

                              {isCollapsibleCard ? (
                                <button
                                  type="button"
                                  className="barista-order-collapse-btn"
                                  aria-expanded={!isCardCollapsed}
                                  aria-controls={orderDetailsId}
                                  onClick={() => toggleOrderCard(order.id)}
                                >
                                  {isCardCollapsed ? "Expand" : "Collapse"}
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div id={orderDetailsId} hidden={isCardCollapsed}>
                            {isDelivery ? (
                              <p className="barista-delivery-address">
                                Deliver to: {order.delivery_address?.trim() || "No delivery address provided"}
                              </p>
                            ) : null}

                            <div className="barista-meta-row">
                              <span>Payment: {paymentLabel(order.payment_method)}</span>
                              {isGcash ? <strong>Ref: {order.gcash_reference?.trim() || "Pending"}</strong> : <strong>Pay at Counter</strong>}
                            </div>

                            <div className="barista-meta-row">
                              <span>Pickup Time: {pickupTimeLabel}</span>
                              <strong>Placed: {formatOrderDateTime(order.created_at)}</strong>
                            </div>

                            {specialInstructions ? (
                              <p className="barista-delivery-address">Special instructions: {specialInstructions}</p>
                            ) : null}

                            <ul className="barista-items-list" aria-label="Order items">
                              {items.length === 0 ? (
                                <li className="barista-item-row">No item details provided.</li>
                              ) : (
                                items.map((item, index) => {
                                  const lineTotal = item.quantity * item.unitPrice;
                                  const meta = `${item.size} / ${item.milk}`;

                                  return (
                                    <li key={`${order.id}-item-${index}`} className="barista-item-row">
                                      <div>
                                        <p className="barista-item-main">
                                          {item.quantity}x {item.name}
                                        </p>
                                        <p className="barista-item-sub">{meta}</p>
                                      </div>
                                      <strong>{formatCurrency(lineTotal)}</strong>
                                    </li>
                                  );
                                })
                              )}
                            </ul>

                            <p className="barista-total-row">
                              <span>Total</span>
                              <strong>{formatCurrency(order.total_price)}</strong>
                            </p>

                            {actionConfig ? (
                              <button
                                type="button"
                                className="barista-action-btn"
                                onClick={() => void updateOrderStatus(order.id, actionConfig.nextStatus)}
                                disabled={isUpdating}
                              >
                                {isUpdating ? "Updating..." : actionConfig.label}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </article>
              ))}
              </section>
            </>
          ) : null}

        </section>
      ) : null}

      {activeTab === "menu" ? (
        <section className="barista-manager-panel" aria-label="Menu manager">
          <header className="barista-manager-head">
            <div>
              <p className="barista-dashboard-kicker">Owner CMS</p>
              <h2>Menu Manager</h2>
              <p>Create or remove drinks from the public menu.</p>
            </div>

            <button
              type="button"
              className="barista-manager-toggle"
              onClick={openCreateMenuForm}
            >
              Add New Drink
            </button>
          </header>

          {menuError ? <p className="barista-state barista-state-error">{menuError}</p> : null}

          {isMenuLoading ? (
            <div className="barista-menu-table-wrap" aria-label="Loading menu items table" aria-busy="true">
              <SkeletonPageSection titleWidth="36%" lineCount={2} lineWidths={["52%", "70%"]} />
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonTableRow
                  key={`menu-table-skeleton-${index}`}
                  columns={6}
                  columnWidths={["18%", "14%", "30%", "12%", "14%", "12%"]}
                />
              ))}
            </div>
          ) : menuItems.length === 0 ? (
            <p className="barista-empty">No menu items available.</p>
          ) : (
            <div className="barista-menu-table-wrap" aria-label="Menu items table">
              <table className="barista-menu-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Image</th>
                    <th className="barista-table-action-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((menuItem) => {
                    const isDeleting = deletingMenuItemId === menuItem.id;
                    const isUpdatingImage = updatingMenuImageId === menuItem.id;

                    return (
                      <tr key={menuItem.id}>
                        <td>{menuItem.name}</td>
                        <td>{formatMenuCategoryLabel(menuItem.category)}</td>
                        <td>{menuItem.description?.trim() || "No description"}</td>
                        <td>{formatCurrency(parseMoney(menuItem.base_price))}</td>
                        <td>
                          <button
                            type="button"
                            className="barista-menu-image-btn"
                            onClick={() => openMenuImageDialog(menuItem)}
                            disabled={isUpdatingImage}
                          >
                            {menuItem.image_url ? "Image" : "Add Image"}
                          </button>
                        </td>
                        <td className="barista-menu-actions">
                          <button
                            type="button"
                            className="barista-menu-edit-btn"
                            onClick={() => handleStartEditMenuItem(menuItem)}
                            disabled={isDeleting || isUpdatingImage}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="barista-danger-btn"
                            onClick={() => handleDeleteMenuItem(menuItem)}
                            disabled={isDeleting || isUpdatingImage}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "highlights" ? (
        <section className="barista-manager-panel" aria-label="Today highlights manager">
          <header className="barista-manager-head">
            <div>
              <p className="barista-dashboard-kicker">Owner CMS</p>
              <h2>Today Highlights</h2>
              <p>Choose which drinks appear in the quick-add highlights on the order page.</p>
            </div>

            <button
              type="button"
              className="barista-manager-toggle"
              disabled={availableHighlightMenuItems.length === 0}
              onClick={() => {
                setIsAddHighlightsFormOpen(true);
                setHighlightCandidateId(availableHighlightMenuItems[0]?.id ?? "");
                setHighlightsError(null);
              }}
            >
              Add Highlight
            </button>
          </header>

          {highlightsError ? <p className="barista-state barista-state-error">{highlightsError}</p> : null}

          {isHighlightsLoading ? (
            <div className="barista-menu-table-wrap" aria-label="Loading today highlights table" aria-busy="true">
              <SkeletonPageSection titleWidth="42%" lineCount={2} lineWidths={["58%", "76%"]} />
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonTableRow
                  key={`highlights-table-skeleton-${index}`}
                  columns={4}
                  columnWidths={["24%", "42%", "16%", "18%"]}
                />
              ))}
            </div>
          ) : todayHighlightItems.length === 0 ? (
            <p className="barista-empty">No highlighted drinks yet. Add one to show quick-add options on /order.</p>
          ) : (
            <div className="barista-menu-table-wrap" aria-label="Today highlights table">
              <table className="barista-menu-table">
                <thead>
                  <tr>
                    <th>Drink</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th className="barista-table-action-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todayHighlightItems.map(({ rowId, item }) => {
                    const isDeleting = deletingHighlightId === rowId;

                    return (
                      <tr key={rowId}>
                        <td>{item.name}</td>
                        <td>{item.description?.trim() || "No description"}</td>
                        <td>{formatCurrency(parseMoney(item.base_price))}</td>
                        <td className="barista-menu-actions">
                          <button
                            type="button"
                            className="barista-danger-btn"
                            onClick={() => handleDeleteTodayHighlight(rowId, item.name)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Removing..." : "Remove"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "promotional" ? (
        <section className="barista-manager-panel" aria-label="Promotional manager">
          <header className="barista-manager-head">
            <div>
              <p className="barista-dashboard-kicker">Owner CMS</p>
              <h2>Promotional</h2>
              <p>Manage homepage promo carousel settings and slides.</p>
            </div>
          </header>

          {todayAtBarError ? <p className="barista-state barista-state-error">{todayAtBarError}</p> : null}

          {isTodayAtBarLoading ? (
            <div className="barista-manager-form barista-manager-form-stretch" aria-label="Loading promotional form" aria-busy="true">
              <SkeletonFormBlock fields={4} />
            </div>
          ) : (
            <form className="barista-manager-form barista-manager-form-stretch" onSubmit={handleSaveTodayAtBar}>
              <div className="barista-manager-form-grid">
                <label className="barista-form-field barista-form-field-toggle" htmlFor="todayBarCarouselEnabled">
                  <input
                    id="todayBarCarouselEnabled"
                    type="checkbox"
                    checked={todayAtBarForm.carouselEnabled}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, carouselEnabled: event.target.checked }))
                    }
                  />
                  <span>Carousel Enabled</span>
                </label>

                <label className="barista-form-field barista-form-field-toggle" htmlFor="todayBarCarouselAutoplay">
                  <input
                    id="todayBarCarouselAutoplay"
                    type="checkbox"
                    checked={todayAtBarForm.carouselAutoplay}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, carouselAutoplay: event.target.checked }))
                    }
                  />
                  <span>Carousel Autoplay</span>
                </label>

                <label className="barista-form-field" htmlFor="todayBarCarouselIntervalMs">
                  Carousel Interval (ms)
                  <input
                    id="todayBarCarouselIntervalMs"
                    type="number"
                    min={TODAY_AT_BAR_CAROUSEL_INTERVAL_MIN}
                    max={TODAY_AT_BAR_CAROUSEL_INTERVAL_MAX}
                    step={100}
                    value={todayAtBarForm.carouselIntervalMs}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, carouselIntervalMs: event.target.value }))
                    }
                    placeholder={String(TODAY_AT_BAR_CAROUSEL_INTERVAL_DEFAULT)}
                  />
                </label>

                <div className="barista-form-field barista-form-field-full" aria-label="Carousel slides editor">
                  <span>Carousel Slides</span>
                  <p className="barista-image-helper">
                    Add one or more slides. Only slides with an image URL are saved.
                  </p>

                  {todayAtBarForm.carouselSlides.length === 0 ? (
                    <p className="barista-image-helper">No slides added yet.</p>
                  ) : (
                    todayAtBarForm.carouselSlides.map((slide, index) => {
                      const isSlideCollapsed = collapsedPromotionalSlideIds[slide.id] !== false;

                      return (
                      <article key={slide.id} className="barista-promo-slide-card">
                        <header className="barista-promo-slide-card-head">
                          <h3 className="barista-promo-slide-card-title">Slide {index + 1}</h3>
                          <button
                            type="button"
                            className="barista-order-collapse-btn barista-promo-slide-collapse-btn"
                            aria-expanded={!isSlideCollapsed}
                            aria-controls={`todayBarSlideFields-${slide.id}`}
                            onClick={() => togglePromotionalSlideCard(slide.id)}
                          >
                            {isSlideCollapsed ? "Expand" : "Collapse"}
                          </button>
                        </header>

                        <div
                          id={`todayBarSlideFields-${slide.id}`}
                          className="barista-manager-form-grid barista-promo-slide-fields"
                          hidden={isSlideCollapsed}
                        >
                          <label className="barista-form-field barista-form-field-full" htmlFor={`todayBarSlideImage-${slide.id}`}>
                            Slide {index + 1} Image URL
                            <div className="barista-promo-slide-image-actions">
                              <button
                                type="button"
                                className="barista-menu-image-btn"
                                onClick={() => openPromoImagePicker(slide.id)}
                              >
                                Choose from Bucket
                              </button>
                              <span className="barista-image-helper">Manual URL still works as fallback.</span>
                            </div>
                            <input
                              id={`todayBarSlideImage-${slide.id}`}
                              type="text"
                              value={slide.imageUrl}
                              onChange={(event) =>
                                handleUpdateTodayAtBarSlide(slide.id, "imageUrl", event.target.value)
                              }
                              placeholder="https://..."
                            />
                          </label>

                          <label className="barista-form-field" htmlFor={`todayBarSlideTitle-${slide.id}`}>
                            Slide Title (Optional)
                            <input
                              id={`todayBarSlideTitle-${slide.id}`}
                              type="text"
                              value={slide.title}
                              onChange={(event) =>
                                handleUpdateTodayAtBarSlide(slide.id, "title", event.target.value)
                              }
                              placeholder="Featured roast"
                            />
                          </label>

                          <label className="barista-form-field" htmlFor={`todayBarSlideDescription-${slide.id}`}>
                            Slide Description (Optional)
                            <input
                              id={`todayBarSlideDescription-${slide.id}`}
                              type="text"
                              value={slide.description}
                              onChange={(event) =>
                                handleUpdateTodayAtBarSlide(slide.id, "description", event.target.value)
                              }
                              placeholder="Citrus bloom, cacao finish"
                            />
                          </label>

                          <button
                            type="button"
                            className="barista-danger-btn"
                            onClick={() => handleRemoveTodayAtBarSlide(slide.id)}
                          >
                            Remove Slide
                          </button>
                        </div>
                      </article>
                      );
                    })
                  )}

                  <button type="button" className="barista-logout-btn" onClick={handleAddTodayAtBarSlide}>
                    Add Slide
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="barista-action-btn barista-manager-submit barista-promotional-submit"
                disabled={isSavingTodayAtBar}
              >
                {isSavingTodayAtBar ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </section>
      ) : null}

      {activeTab === "sales" ? (
        <section className="barista-manager-panel barista-sales-manager-panel" aria-label="Sales summary">
          <header className="barista-manager-head">
            <div>
              <p className="barista-dashboard-kicker">Owner Analytics</p>
              <h2>Sales Summary</h2>
              <p>Snapshot of completed sales pulled from live and archived orders.</p>
            </div>

            <div className="sales-summary-controls sales-summary-controls-compact" role="group" aria-label="Sales summary filters">
              <label className="sales-summary-control" htmlFor="salesFilterMode">
                <span>View Mode</span>
                <select
                  id="salesFilterMode"
                  value={filterMode}
                  onChange={(event) => setFilterMode(event.target.value === "monthly" ? "monthly" : "daily")}
                >
                  <option value="daily">Daily View</option>
                  <option value="monthly">Monthly View</option>
                </select>
              </label>

              {filterMode === "daily" ? (
                <label className="sales-summary-control" htmlFor="salesSelectedDay">
                  <span>Selected Day</span>
                  <input
                    id="salesSelectedDay"
                    type="date"
                    value={selectedDay}
                    onChange={(event) => setSelectedDay(event.target.value)}
                  />
                </label>
              ) : (
                <label className="sales-summary-control" htmlFor="salesSelectedMonth">
                  <span>Selected Month</span>
                  <input
                    id="salesSelectedMonth"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  />
                </label>
              )}
            </div>
          </header>

          {isSalesLoading ? (
            <div className="barista-sales-content" aria-label="Loading sales summary" aria-busy="true">
              <div className="barista-sales-grid barista-sales-grid-panel">
                {Array.from({ length: 3 }).map((_, index) => (
                  <article className="barista-sales-card" key={`sales-card-skeleton-${index}`}>
                    <Skeleton type="text" width="44%" />
                    <Skeleton type="text" width="68%" />
                  </article>
                ))}
              </div>

              <div className="barista-sales-list" role="list" aria-label="Loading completed orders list">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonListRow key={`sales-list-skeleton-${index}`} />
                ))}
              </div>
            </div>
          ) : null}
          {salesFetchError ? <p className="barista-state barista-state-error">{salesFetchError}</p> : null}
          {salesCostError ? <p className="barista-state barista-state-error">{salesCostError}</p> : null}

          {!isSalesLoading && !salesFetchError ? (
            <div className="barista-sales-content">
              <div className="barista-sales-grid barista-sales-grid-panel">
                <article className="barista-sales-card sales-metric sales-metric-profit">
                  <p>Gross Profit</p>
                  <strong>{formatCurrency(salesMetrics.grossProfit)}</strong>
                </article>

                <article className="barista-sales-card sales-metric">
                  <p>Total Gross Sales</p>
                  <strong>{formatCurrency(salesMetrics.gross)}</strong>
                </article>

                <article className="barista-sales-card sales-metric">
                  <p>Total COGS</p>
                  <strong>{formatCurrency(salesMetrics.cogs)}</strong>
                </article>

                <article className="barista-sales-card sales-metric">
                  <p>Cash Total</p>
                  <strong>{formatCurrency(salesMetrics.cash)}</strong>
                </article>

                <article className="barista-sales-card sales-metric">
                  <p>GCash Total</p>
                  <strong>{formatCurrency(salesMetrics.gcash)}</strong>
                </article>
              </div>

              {recentCompletedOrders.length === 0 ? (
                <p className="barista-empty">No completed orders for the selected period yet.</p>
              ) : (
                <div className="barista-sales-list" role="list" aria-label="Recent completed orders">
                  {recentCompletedOrders.map((order) => (
                    <article key={order.id} className="barista-sales-list-item" role="listitem">
                      <div>
                        <p className="barista-sales-list-id">Order {order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="barista-sales-list-meta">
                          {order.customer_name?.trim() || "Walk-in Customer"} | {orderTypeLabel(order.order_type)} | Pickup: {formatPickupTimeLabel(order.order_type, order.pickup_time)} | {formatOrderDateTime(order.created_at)}
                        </p>
                      </div>
                      <strong>{formatCurrency(order.total_price)}</strong>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "inventory" ? (
        <section className="barista-manager-panel" aria-label="Inventory manager">
          <header className="barista-manager-head">
            <div>
              <h2>Inventory Manager</h2>
              <p>Maintain ingredient costs and assign recipe ingredients per menu item.</p>
            </div>
          </header>
          <InventoryManager />
        </section>
      ) : null}

      </section>

      {isAddMenuFormOpen ? (
        <div
          className="barista-image-modal-backdrop"
          role="presentation"
          onClick={() => {
            setIsAddMenuFormOpen(false);
            resetMenuFormState();
            setMenuError(null);
          }}
        >
          <section
            className="barista-image-modal barista-manager-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingItem ? `Edit ${editingItem.name}` : "Add new drink"}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Owner CMS</p>
                <h3>{editingItem ? "Edit Drink" : "Add New Drink"}</h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={() => {
                  setIsAddMenuFormOpen(false);
                  resetMenuFormState();
                  setMenuError(null);
                }}
                aria-label="Close add drink form"
              >
                X
              </button>
            </header>

            <form className="barista-manager-form" onSubmit={handleCreateMenuItem}>
              <div className="barista-manager-form-grid">
                <label className="barista-form-field" htmlFor="menuItemName">
                  Name
                  <input
                    id="menuItemName"
                    type="text"
                    value={menuForm.name}
                    onChange={(event) => setMenuForm((previousForm) => ({ ...previousForm, name: event.target.value }))}
                    placeholder="Spanish Latte"
                    required
                  />
                </label>

                <label className="barista-form-field" htmlFor="menuItemCategory">
                  Category
                  <select
                    id="menuItemCategory"
                    value={menuForm.category}
                    onChange={(event) =>
                      setMenuForm((previousForm) => ({
                        ...previousForm,
                        category: normalizeMenuCategory(event.target.value)
                      }))
                    }
                  >
                    {MENU_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="barista-form-field" htmlFor="menuItemPrice">
                  Base Price (PHP)
                  <input
                    id="menuItemPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={menuForm.basePrice}
                    onChange={(event) => setMenuForm((previousForm) => ({ ...previousForm, basePrice: event.target.value }))}
                    placeholder="145"
                    required
                  />
                </label>

                <label className="barista-form-field barista-form-field-full" htmlFor="menuItemDescription">
                  Description
                  <textarea
                    id="menuItemDescription"
                    rows={2}
                    value={menuForm.description}
                    onChange={(event) => setMenuForm((previousForm) => ({ ...previousForm, description: event.target.value }))}
                    placeholder="Silky espresso with condensed milk sweetness."
                  />
                </label>

                <p className="barista-image-helper barista-form-field-full">
                  After adding a drink, open its Image button in the table to choose an image from Supabase bucket files.
                </p>
              </div>

              {menuError ? <p className="barista-state barista-state-error">{menuError}</p> : null}

              <div className="barista-manager-actions">
                <button
                  type="button"
                  className="barista-logout-btn"
                  onClick={() => {
                    setIsAddMenuFormOpen(false);
                    resetMenuFormState();
                    setMenuError(null);
                  }}
                >
                  Cancel
                </button>

                {editingItem ? (
                  <button
                    type="button"
                    className="barista-logout-btn"
                    onClick={handleCancelEditMenuItem}
                    disabled={isSavingMenuItem}
                  >
                    Cancel Edit
                  </button>
                ) : null}

                <button
                  type="submit"
                  className="barista-action-btn barista-manager-submit"
                  disabled={isSavingMenuItem}
                >
                  {isSavingMenuItem ? "Saving..." : editingItem ? "Update Item" : "Add Item"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {isAddHighlightsFormOpen ? (
        <div
          className="barista-image-modal-backdrop"
          role="presentation"
          onClick={() => {
            setIsAddHighlightsFormOpen(false);
            setHighlightCandidateId("");
            setHighlightsError(null);
          }}
        >
          <section
            className="barista-image-modal barista-manager-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add highlight"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Owner CMS</p>
                <h3>Add Highlight</h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={() => {
                  setIsAddHighlightsFormOpen(false);
                  setHighlightCandidateId("");
                  setHighlightsError(null);
                }}
                aria-label="Close add highlight form"
              >
                X
              </button>
            </header>

            <form className="barista-manager-form" onSubmit={handleAddTodayHighlight}>
              <div className="barista-manager-form-grid">
                <label className="barista-form-field barista-form-field-full" htmlFor="highlightMenuItem">
                  Highlight Drink
                  <select
                    id="highlightMenuItem"
                    value={highlightCandidateId}
                    onChange={(event) => setHighlightCandidateId(event.target.value)}
                    disabled={availableHighlightMenuItems.length === 0 || isSavingHighlight}
                    required
                  >
                    <option value="">Select a drink from your menu</option>
                    {availableHighlightMenuItems.map((menuItem) => (
                      <option key={menuItem.id} value={menuItem.id}>
                        {menuItem.name} ({formatCurrency(parseMoney(menuItem.base_price))})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {highlightsError ? <p className="barista-state barista-state-error">{highlightsError}</p> : null}

              <div className="barista-manager-actions">
                <button
                  type="button"
                  className="barista-logout-btn"
                  onClick={() => {
                    setIsAddHighlightsFormOpen(false);
                    setHighlightCandidateId("");
                    setHighlightsError(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="barista-action-btn barista-manager-submit"
                  disabled={availableHighlightMenuItems.length === 0 || isSavingHighlight}
                >
                  {isSavingHighlight ? "Saving..." : "Add Drink"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {activeMenuImageItem ? (
        <div className="barista-image-modal-backdrop" role="presentation" onClick={closeMenuImageDialog}>
          <section
            className="barista-image-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeMenuImageItem.name} image editor`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Menu Item Image</p>
                <h3>{activeMenuImageItem.name}</h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={closeMenuImageDialog}
                aria-label="Close image editor"
              >
                X
              </button>
            </header>

            <div className="barista-image-modal-preview">
              {menuImageDraftSource ? (
                <NextImage
                  src={menuImageDraftSource}
                  alt={`${activeMenuImageItem.name} preview`}
                  className="barista-image-modal-preview-image"
                  width={640}
                  height={640}
                  sizes="(max-width: 760px) 100vw, 420px"
                  unoptimized
                />
              ) : (
                <p className="barista-image-modal-empty">No image selected yet.</p>
              )}
            </div>

            <p className="barista-image-helper barista-promo-picker-config">
              Bucket: {PROMO_IMAGE_BUCKET_NAME || "Not configured"}
              {PROMO_IMAGE_BUCKET_PREFIX ? ` / ${PROMO_IMAGE_BUCKET_PREFIX}` : ""}
            </p>

            <div className="barista-image-modal-actions">
              <button type="button" className="barista-logout-btn" onClick={closeMenuImageDialog}>
                Close
              </button>

              <button
                type="button"
                className="barista-menu-remove-image"
                onClick={handleRemoveActiveMenuImage}
                disabled={!activeMenuImageItem.image_url || isUpdatingActiveMenuImage}
              >
                Remove Image
              </button>

              <button
                type="button"
                className="barista-action-btn barista-image-modal-action"
                onClick={openMenuImagePicker}
                disabled={isUpdatingActiveMenuImage}
              >
                Choose from Bucket
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isMenuImagePickerOpen ? (
        <div className="barista-image-modal-backdrop" role="presentation" onClick={closeMenuImagePicker}>
          <section
            className="barista-image-modal barista-manager-modal barista-promo-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menuBucketPickerTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Menu Item Image</p>
                <h3 id="menuBucketPickerTitle">
                  {activeMenuImageItem ? `Choose image for ${activeMenuImageItem.name}` : "Select Menu Image"}
                </h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={closeMenuImagePicker}
                aria-label="Close menu image picker"
              >
                X
              </button>
            </header>

            <p className="barista-image-helper barista-promo-picker-config">
              Bucket: {PROMO_IMAGE_BUCKET_NAME || "Not configured"}
              {PROMO_IMAGE_BUCKET_PREFIX ? ` / ${PROMO_IMAGE_BUCKET_PREFIX}` : ""}
            </p>

            <div className="barista-promo-picker-body" aria-live="polite">
              {isMenuBucketImagesLoading ? (
                <div className="barista-promo-picker-loading" aria-label="Loading bucket images" aria-busy="true">
                  <SkeletonModalBody sections={2} />
                </div>
              ) : menuBucketImagesError ? (
                <div className="barista-promo-picker-state">
                  <p className="barista-state barista-state-error">{menuBucketImagesError}</p>
                  <button
                    type="button"
                    className="barista-logout-btn"
                    onClick={() => {
                      void loadMenuBucketImages();
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : menuBucketImages.length === 0 ? (
                <div className="barista-promo-picker-state">
                  <p className="barista-empty">
                    No image files found in this bucket/folder yet.
                    {normalizePromoStoragePath(PROMO_IMAGE_BUCKET_PREFIX)
                      ? ` Active prefix: ${normalizePromoStoragePath(PROMO_IMAGE_BUCKET_PREFIX)}`
                      : " Active prefix: / (bucket root)"}
                  </p>
                </div>
              ) : (
                <div className="barista-promo-picker-grid" role="list" aria-label="Bucket image files">
                  {menuBucketImages.map((option) => {
                    const isSelected = activeMenuImageItem?.image_url?.trim() === option.publicUrl;

                    return (
                      <button
                        key={option.path}
                        type="button"
                        className={`barista-promo-picker-item${isSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          void handleSelectMenuBucketImage(option.publicUrl);
                        }}
                        aria-label={`Use ${option.name} for this menu item image`}
                        role="listitem"
                        disabled={isUpdatingActiveMenuImage}
                      >
                        <span
                          className="barista-promo-picker-thumb"
                          style={{ backgroundImage: `url(${option.publicUrl})` }}
                          aria-hidden="true"
                        />
                        <span className="barista-promo-picker-copy">
                          <strong>{option.name}</strong>
                          <small>{option.path}</small>
                          <small>
                            {formatFileSize(option.sizeInBytes)}
                            {option.updatedAt ? ` | ${new Date(option.updatedAt).toLocaleDateString("en-PH")}` : ""}
                          </small>
                          {isSelected ? <span className="barista-promo-picker-selected">Selected</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="barista-image-modal-actions">
              <button type="button" className="barista-logout-btn" onClick={closeMenuImagePicker}>
                Back
              </button>

              <button
                type="button"
                className="barista-action-btn barista-image-modal-action"
                onClick={() => {
                  void loadMenuBucketImages();
                }}
                disabled={isMenuBucketImagesLoading}
              >
                {isMenuBucketImagesLoading ? "Refreshing..." : "Refresh List"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isPromoImagePickerOpen ? (
        <div className="barista-image-modal-backdrop" role="presentation" onClick={closePromoImagePicker}>
          <section
            className="barista-image-modal barista-manager-modal barista-promo-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promoBucketPickerTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Promotional Slide Image</p>
                <h3 id="promoBucketPickerTitle">
                  {activePromoSlide ? "Choose from Bucket" : "Select Slide Image"}
                </h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={closePromoImagePicker}
                aria-label="Close image picker"
              >
                X
              </button>
            </header>

            <p className="barista-image-helper barista-promo-picker-config">
              Bucket: {PROMO_IMAGE_BUCKET_NAME || "Not configured"}
              {PROMO_IMAGE_BUCKET_PREFIX ? ` / ${PROMO_IMAGE_BUCKET_PREFIX}` : ""}
            </p>

            <div className="barista-promo-picker-body" aria-live="polite">
              {isPromoBucketImagesLoading ? (
                <div className="barista-promo-picker-loading" aria-label="Loading bucket images" aria-busy="true">
                  <SkeletonModalBody sections={2} />
                </div>
              ) : promoBucketImagesError ? (
                <div className="barista-promo-picker-state">
                  <p className="barista-state barista-state-error">{promoBucketImagesError}</p>
                  <button
                    type="button"
                    className="barista-logout-btn"
                    onClick={() => {
                      void loadPromoBucketImages();
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : promoBucketImages.length === 0 ? (
                <div className="barista-promo-picker-state">
                  <p className="barista-empty">
                    No image files found in this bucket/folder yet.
                    {normalizePromoStoragePath(PROMO_IMAGE_BUCKET_PREFIX)
                      ? ` Active prefix: ${normalizePromoStoragePath(PROMO_IMAGE_BUCKET_PREFIX)}`
                      : " Active prefix: / (bucket root)"}
                  </p>
                </div>
              ) : (
                <div className="barista-promo-picker-grid" role="list" aria-label="Bucket image files">
                  {promoBucketImages.map((option) => {
                    const isSelected = activePromoSlide?.imageUrl.trim() === option.publicUrl;

                    return (
                      <button
                        key={option.path}
                        type="button"
                        className={`barista-promo-picker-item${isSelected ? " is-selected" : ""}`}
                        onClick={() => handleSelectPromoBucketImage(option.publicUrl)}
                        aria-label={`Use ${option.name} for this slide image`}
                        role="listitem"
                      >
                        <span
                          className="barista-promo-picker-thumb"
                          style={{ backgroundImage: `url(${option.publicUrl})` }}
                          aria-hidden="true"
                        />
                        <span className="barista-promo-picker-copy">
                          <strong>{option.name}</strong>
                          <small>{option.path}</small>
                          <small>
                            {formatFileSize(option.sizeInBytes)}
                            {option.updatedAt ? ` | ${new Date(option.updatedAt).toLocaleDateString("en-PH")}` : ""}
                          </small>
                          {isSelected ? <span className="barista-promo-picker-selected">Selected</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="barista-image-modal-actions">
              <button type="button" className="barista-logout-btn" onClick={closePromoImagePicker}>
                Close
              </button>

              <button
                type="button"
                className="barista-action-btn barista-image-modal-action"
                onClick={() => {
                  void loadPromoBucketImages();
                }}
                disabled={isPromoBucketImagesLoading}
              >
                {isPromoBucketImagesLoading ? "Refreshing..." : "Refresh List"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmationModal ? (
        <div className="barista-image-modal-backdrop" role="presentation" onClick={closeConfirmationModal}>
          <section
            className="barista-image-modal barista-manager-modal barista-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="baristaConfirmTitle"
            aria-describedby="baristaConfirmMessage"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Confirm Action</p>
                <h3 id="baristaConfirmTitle">{confirmationModal.title}</h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={closeConfirmationModal}
                aria-label="Close confirmation modal"
              >
                X
              </button>
            </header>

            <p id="baristaConfirmMessage" className="barista-confirm-modal-copy">
              {confirmationModal.message}
            </p>

            <div className="barista-image-modal-actions">
              <button type="button" className="barista-logout-btn" onClick={closeConfirmationModal}>
                Cancel
              </button>

              <button type="button" className="barista-danger-btn" onClick={handleConfirmModalAction}>
                {confirmationModal.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
