"use client";

import NextImage from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

type OrderStatus = "received" | "preparing" | "brewing" | "ready" | "completed" | "cancelled";
type AdminTab = "orders" | "menu" | "highlights" | "today-bar" | "sales";
type MenuCategory = "espresso" | "signature" | "bites";

type DashboardOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string | null;
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

type SalesTotals = {
  today: number;
  week: number;
  month: number;
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
};

type TodayAtBarForm = {
  title: string;
  description: string;
  dose: string;
  extractionTime: string;
  brewTemp: string;
  guestScore: string;
};

type AdminNotice = {
  tone: "success" | "error";
  message: string;
};

const ORDER_SELECT_FIELDS =
  "id, customer_name, customer_phone, order_type, delivery_address, special_instructions, payment_method, gcash_reference, items, total_price, status, created_at";
const MENU_ITEM_SELECT_FIELDS = "*";
const TODAY_HIGHLIGHT_SELECT_FIELDS = "id, menu_item_id, created_at";
const TODAY_AT_BAR_SELECT_FIELDS = "id, title, description, dose, extraction_time, brew_temp, guest_score";
const ADMIN_AUTH_STORAGE_KEY = "espressonism-admin-auth-session-v1";
const MAX_MENU_IMAGE_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const MENU_IMAGE_CROP_PREVIEW_SIZE = 280;
const MENU_IMAGE_CROP_OUTPUT_SIZE = 640;
const MENU_IMAGE_ZOOM_MIN = 1;
const MENU_IMAGE_ZOOM_MAX = 3;

const COLUMNS: ColumnConfig[] = [
  { key: "received", title: "New Orders", subtitle: "Just placed" },
  { key: "preparing", title: "Preparing", subtitle: "In progress" },
  { key: "ready", title: "Ready", subtitle: "Pickup / handoff" }
];

const ADMIN_TABS: Array<{ key: AdminTab; label: string }> = [
  { key: "orders", label: "Live Orders" },
  { key: "menu", label: "Menu Manager" },
  { key: "highlights", label: "Today Highlights" },
  { key: "today-bar", label: "Today at the Bar" },
  { key: "sales", label: "Sales Summary" }
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
  guestScore: ""
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
    const size = typeof item.size === "string" ? item.size : "regular";
    const milk = typeof item.milk === "string" ? item.milk : "whole";

    return {
      name,
      quantity,
      unitPrice,
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

function mapTodayAtBarRowToForm(row: TodayAtBarRow | null | undefined): TodayAtBarForm {
  return {
    title: row?.title?.trim() ?? "",
    description: row?.description?.trim() ?? "",
    dose: row?.dose?.trim() ?? "",
    extractionTime: row?.extraction_time?.trim() ?? "",
    brewTemp: row?.brew_temp?.trim() ?? "",
    guestScore: row?.guest_score === null || row?.guest_score === undefined ? "" : String(row.guest_score)
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
  if (paymentMethod === "gcash") return "GCash";
  return "Cash";
}

function parseOrderTotal(totalPrice: DashboardOrder["total_price"]): number {
  if (typeof totalPrice === "number" && Number.isFinite(totalPrice)) return totalPrice;
  return 0;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to process uploaded image."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("Unable to process uploaded image."));
    };

    reader.readAsDataURL(file);
  });
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadImageElement(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error("Unable to load image."));
    };

    image.src = sourceUrl;
  });
}

function drawSquareCroppedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  squareSize: number,
  zoom: number,
  horizontalPanPercent: number,
  verticalPanPercent: number
) {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;

  if (!naturalWidth || !naturalHeight) {
    throw new Error("Unable to read image dimensions.");
  }

  const safeZoom = clampNumber(zoom, MENU_IMAGE_ZOOM_MIN, MENU_IMAGE_ZOOM_MAX);
  const coverScale = Math.max(squareSize / naturalWidth, squareSize / naturalHeight) * safeZoom;
  const drawWidth = naturalWidth * coverScale;
  const drawHeight = naturalHeight * coverScale;

  const maxOffsetX = Math.max(0, (drawWidth - squareSize) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - squareSize) / 2);

  const offsetX = clampNumber(horizontalPanPercent, -100, 100) / 100 * maxOffsetX;
  const offsetY = clampNumber(verticalPanPercent, -100, 100) / 100 * maxOffsetY;

  const drawX = (squareSize - drawWidth) / 2 + offsetX;
  const drawY = (squareSize - drawHeight) / 2 + offsetY;

  context.clearRect(0, 0, squareSize, squareSize);
  context.fillStyle = "#1f1209";
  context.fillRect(0, 0, squareSize, squareSize);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function createSquareCroppedDataUrl(
  image: HTMLImageElement,
  zoom: number,
  horizontalPanPercent: number,
  verticalPanPercent: number,
  outputSize: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare cropped image.");
  }

  drawSquareCroppedImage(context, image, outputSize, zoom, horizontalPanPercent, verticalPanPercent);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<DashboardOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuManagerItem[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isAddMenuFormOpen, setIsAddMenuFormOpen] = useState(false);
  const [menuForm, setMenuForm] = useState<NewMenuItemForm>(EMPTY_MENU_FORM);
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false);
  const [updatingMenuImageId, setUpdatingMenuImageId] = useState<string | null>(null);
  const [activeMenuImageItem, setActiveMenuImageItem] = useState<MenuManagerItem | null>(null);
  const [isMenuImageEditorOpen, setIsMenuImageEditorOpen] = useState(false);
  const [menuImageDraftSource, setMenuImageDraftSource] = useState<string | null>(null);
  const [menuImageElement, setMenuImageElement] = useState<HTMLImageElement | null>(null);
  const [menuImageZoom, setMenuImageZoom] = useState<number>(MENU_IMAGE_ZOOM_MIN);
  const [menuImagePanX, setMenuImagePanX] = useState(0);
  const [menuImagePanY, setMenuImagePanY] = useState(0);
  const [isProcessingMenuImageUpload, setIsProcessingMenuImageUpload] = useState(false);
  const [deletingMenuItemId, setDeletingMenuItemId] = useState<string | null>(null);
  const menuImageCropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [todayHighlightRows, setTodayHighlightRows] = useState<TodayHighlightRow[]>([]);
  const [isHighlightsLoading, setIsHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [isAddHighlightsFormOpen, setIsAddHighlightsFormOpen] = useState(false);
  const [highlightCandidateId, setHighlightCandidateId] = useState("");
  const [isSavingHighlight, setIsSavingHighlight] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState<string | null>(null);

  const [todayAtBarForm, setTodayAtBarForm] = useState<TodayAtBarForm>(EMPTY_TODAY_AT_BAR_FORM);
  const [isTodayAtBarLoading, setIsTodayAtBarLoading] = useState(false);
  const [todayAtBarError, setTodayAtBarError] = useState<string | null>(null);
  const [isSavingTodayAtBar, setIsSavingTodayAtBar] = useState(false);

  const [adminNotice, setAdminNotice] = useState<AdminNotice | null>(null);

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

  const salesTotals = useMemo<SalesTotals>(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    const daysSinceMonday = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return completedOrders.reduce<SalesTotals>(
      (totals, order) => {
        if (!order.created_at) return totals;
        const createdAt = new Date(order.created_at);
        if (Number.isNaN(createdAt.getTime())) return totals;

        const orderTotal = parseOrderTotal(order.total_price);

        if (createdAt >= startOfToday) totals.today += orderTotal;
        if (createdAt >= startOfWeek) totals.week += orderTotal;
        if (createdAt >= startOfMonth) totals.month += orderTotal;

        return totals;
      },
      { today: 0, week: 0, month: 0 }
    );
  }, [completedOrders]);

  const recentCompletedOrders = useMemo(() => {
    return [...completedOrders]
      .sort((firstOrder, secondOrder) => {
        const firstCreatedAt = firstOrder.created_at ?? "";
        const secondCreatedAt = secondOrder.created_at ?? "";
        return secondCreatedAt.localeCompare(firstCreatedAt);
      })
      .slice(0, 12);
  }, [completedOrders]);

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

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const loadOrders = async () => {
      setIsLoading(true);
      setFetchError(null);

      const [activeResult, liveCompletedResult, archivedCompletedResult] = await Promise.all([
        supabase
          .from("orders")
          .select(ORDER_SELECT_FIELDS)
          .in("status", ["received", "preparing", "brewing", "ready"])
          .order("created_at", { ascending: true }),
        supabase
          .from("orders")
          .select(ORDER_SELECT_FIELDS)
          .eq("status", "completed")
          .order("created_at", { ascending: false }),
        supabase
          .from("orders_archive")
          .select(ORDER_SELECT_FIELDS)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
      ]);

      if (!isMounted) return;

      if (activeResult.error || liveCompletedResult.error || archivedCompletedResult.error) {
        setFetchError(
          activeResult.error?.message ||
            liveCompletedResult.error?.message ||
            archivedCompletedResult.error?.message ||
            "Unable to load dashboard data."
        );
        setOrders([]);
        setCompletedOrders([]);
        setIsLoading(false);
        return;
      }

      const loadedOrders = ((activeResult.data ?? []) as DashboardOrder[]).filter((order) => isBoardStatus(order.status));
      const liveCompletedOrders = ((liveCompletedResult.data ?? []) as DashboardOrder[]).filter((order) => isCompletedStatus(order.status));
      const archivedCompletedOrders = ((archivedCompletedResult.data ?? []) as DashboardOrder[]).filter((order) => isCompletedStatus(order.status));
      const loadedCompletedOrders = mergeCompletedOrders(liveCompletedOrders, archivedCompletedOrders);
      setOrders(sortByCreatedAt(loadedOrders));
      setCompletedOrders(loadedCompletedOrders);
      setIsLoading(false);
    };

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateImage = async () => {
      if (!menuImageDraftSource) {
        setMenuImageElement(null);
        return;
      }

      try {
        const loadedImage = await loadImageElement(menuImageDraftSource);
        if (isCancelled) return;
        setMenuImageElement(loadedImage);
      } catch {
        if (isCancelled) return;
        setMenuImageElement(null);
        setMenuError("Unable to load image for editing.");
      }
    };

    void hydrateImage();

    return () => {
      isCancelled = true;
    };
  }, [menuImageDraftSource]);

  useEffect(() => {
    if (!activeMenuImageItem || !isMenuImageEditorOpen) return;

    const canvas = menuImageCropCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!menuImageElement) {
      context.fillStyle = "#20160f";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f3dcae";
      context.font = "700 14px 'DM Sans'";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("Upload an image to start cropping", canvas.width / 2, canvas.height / 2);
      return;
    }

    drawSquareCroppedImage(
      context,
      menuImageElement,
      canvas.width,
      menuImageZoom,
      menuImagePanX,
      menuImagePanY
    );
  }, [activeMenuImageItem, isMenuImageEditorOpen, menuImageElement, menuImageZoom, menuImagePanX, menuImagePanY]);

  const resetMenuImageCrop = () => {
    setMenuImageZoom(MENU_IMAGE_ZOOM_MIN);
    setMenuImagePanX(0);
    setMenuImagePanY(0);
  };

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
        setTodayAtBarError(error.message || "Unable to load Today at the Bar content.");
        setIsTodayAtBarLoading(false);
        return;
      }

      if (!data) {
        setTodayAtBarError("Today at the Bar row with id = 1 was not found. Please run the latest schema.sql.");
        setIsTodayAtBarLoading(false);
        return;
      }

      setTodayAtBarForm(mapTodayAtBarRowToForm(data as TodayAtBarRow));
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
          setCompletedOrders((previousOrders) => upsertCompletedOrder(previousOrders, payload.new));
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
          setCompletedOrders((previousOrders) => upsertCompletedOrder(previousOrders, payload.new));
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
          setCompletedOrders((previousOrders) => upsertCompletedOrder(previousOrders, payload.new));
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
          setCompletedOrders((previousOrders) => upsertCompletedOrder(previousOrders, payload.new));
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
  }, [isAuthenticated]);

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
    setActionError(null);
    setOrders([]);
    setCompletedOrders([]);
    setUpdatingOrderId(null);
    setMenuItems([]);
    setMenuError(null);
    setIsAddMenuFormOpen(false);
    setMenuForm(EMPTY_MENU_FORM);
    setUpdatingMenuImageId(null);
    setActiveMenuImageItem(null);
    setIsMenuImageEditorOpen(false);
    setMenuImageDraftSource(null);
    setMenuImageElement(null);
    setMenuImageZoom(MENU_IMAGE_ZOOM_MIN);
    setMenuImagePanX(0);
    setMenuImagePanY(0);
    setIsProcessingMenuImageUpload(false);
    setDeletingMenuItemId(null);
    setTodayHighlightRows([]);
    setHighlightsError(null);
    setIsAddHighlightsFormOpen(false);
    setHighlightCandidateId("");
    setDeletingHighlightId(null);
    setTodayAtBarForm(EMPTY_TODAY_AT_BAR_FORM);
    setTodayAtBarError(null);
    setAdminNotice(null);
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
        upsertCompletedOrder(previousOrders, {
          ...sourceOrder,
          status: newStatus
        })
      );
    }

    setUpdatingOrderId((currentOrderId) => (currentOrderId === orderId ? null : currentOrderId));
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

    const { data, error } = await supabase
      .from("menu_items")
      .insert([
        {
          name: nextName,
          description: nextDescription,
          base_price: nextPrice,
          image_url: null,
          category: nextCategory
        }
      ])
      .select(MENU_ITEM_SELECT_FIELDS)
      .single();

    if (error || !data) {
      const hasCategoryError = error?.message?.toLowerCase().includes("category");
      setMenuError(hasCategoryError ? "Menu category field is missing. Please apply the latest schema.sql first." : error?.message || "Unable to add menu item.");
      setIsSavingMenuItem(false);
      return;
    }

    const createdMenuItem = normalizeMenuManagerItem(data as MenuManagerItem);
    setMenuItems((previousItems) => sortMenuItemsByName([...previousItems, createdMenuItem]));
    setMenuForm(EMPTY_MENU_FORM);
    setIsAddMenuFormOpen(false);
    setIsSavingMenuItem(false);
    setAdminNotice({ tone: "success", message: "New drink added to menu." });
  };

  const openMenuImageDialog = (menuItem: MenuManagerItem) => {
    setActiveMenuImageItem(menuItem);
    setMenuImageDraftSource(menuItem.image_url);
    setMenuImageElement(null);
    resetMenuImageCrop();
    setIsMenuImageEditorOpen(false);
    setIsProcessingMenuImageUpload(false);
    setMenuError(null);
  };

  const closeMenuImageDialog = () => {
    setActiveMenuImageItem(null);
    setMenuImageDraftSource(null);
    setMenuImageElement(null);
    resetMenuImageCrop();
    setIsMenuImageEditorOpen(false);
    setIsProcessingMenuImageUpload(false);
  };

  const handleStartMenuImageEdit = () => {
    setIsMenuImageEditorOpen(true);
    resetMenuImageCrop();
  };

  const handleMenuImageEditorUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMenuError("Please upload a valid image file.");
      return;
    }

    if (file.size > MAX_MENU_IMAGE_UPLOAD_BYTES) {
      setMenuError("Image must be 1.5MB or smaller.");
      return;
    }

    setIsProcessingMenuImageUpload(true);
    setMenuError(null);

    try {
      const uploadedImageSource = await readFileAsDataUrl(file);
      setMenuImageDraftSource(uploadedImageSource);
      setIsMenuImageEditorOpen(true);
      resetMenuImageCrop();
    } catch {
      setMenuError("Unable to process uploaded image.");
    } finally {
      setIsProcessingMenuImageUpload(false);
    }
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

  const handleSaveCroppedMenuImage = async () => {
    if (!activeMenuImageItem || !menuImageElement || updatingMenuImageId || isProcessingMenuImageUpload) return;

    try {
      const croppedImageDataUrl = createSquareCroppedDataUrl(
        menuImageElement,
        menuImageZoom,
        menuImagePanX,
        menuImagePanY,
        MENU_IMAGE_CROP_OUTPUT_SIZE
      );

      const updatedMenuItem = await updateMenuItemImage(
        activeMenuImageItem,
        croppedImageDataUrl,
        `Image updated for ${activeMenuImageItem.name}.`
      );

      if (!updatedMenuItem) return;

      setActiveMenuImageItem(updatedMenuItem);
      setMenuImageDraftSource(updatedMenuItem.image_url);
      setIsMenuImageEditorOpen(false);
      resetMenuImageCrop();
    } catch {
      setMenuError("Unable to apply image crop.");
    }
  };

  const handleRemoveActiveMenuImage = async () => {
    if (!activeMenuImageItem?.image_url || updatingMenuImageId) return;

    const isConfirmed = window.confirm(`Remove image for ${activeMenuImageItem.name}?`);
    if (!isConfirmed) return;

    const updatedMenuItem = await updateMenuItemImage(
      activeMenuImageItem,
      null,
      `Image removed for ${activeMenuImageItem.name}.`
    );

    if (!updatedMenuItem) return;

    setActiveMenuImageItem(updatedMenuItem);
    setMenuImageDraftSource(null);
    setMenuImageElement(null);
    setIsMenuImageEditorOpen(false);
    resetMenuImageCrop();
  };

  const handleDeleteMenuItem = async (menuItem: MenuManagerItem) => {
    if (deletingMenuItemId) return;

    const isConfirmed = window.confirm(`Delete ${menuItem.name}? This cannot be undone.`);
    if (!isConfirmed) return;

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

    if (activeMenuImageItem?.id === menuItem.id) {
      closeMenuImageDialog();
    }

    setDeletingMenuItemId(null);
    setAdminNotice({ tone: "success", message: "Menu item deleted." });
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

  const handleDeleteTodayHighlight = async (highlightRowId: string, menuItemName: string) => {
    if (deletingHighlightId) return;

    const isConfirmed = window.confirm(`Remove ${menuItemName} from Today Highlights?`);
    if (!isConfirmed) return;

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

  const handleSaveTodayAtBar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingTodayAtBar) return;

    setTodayAtBarError(null);
    setIsSavingTodayAtBar(true);

    const payload = {
      title: todayAtBarForm.title.trim(),
      description: todayAtBarForm.description.trim(),
      dose: todayAtBarForm.dose.trim(),
      extraction_time: todayAtBarForm.extractionTime.trim(),
      brew_temp: todayAtBarForm.brewTemp.trim(),
      guest_score: todayAtBarForm.guestScore.trim()
    };

    const { data, error } = await supabase
      .from("today_at_bar")
      .update(payload)
      .eq("id", 1)
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      setTodayAtBarError(error?.message || "Today at the Bar row with id = 1 was not found.");
      setIsSavingTodayAtBar(false);
      return;
    }

    setIsSavingTodayAtBar(false);
    setAdminNotice({ tone: "success", message: "Landing Today at the Bar content saved." });
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
        <div className="barista-dashboard-header-top">
          <p className="barista-dashboard-kicker">Espressonism Ops</p>
          <button type="button" className="barista-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <h1>Barista Dashboard</h1>
        <p className="barista-dashboard-copy">Track all active cups from queue to handoff.</p>
      </header>

      <nav className="barista-tab-nav" aria-label="Dashboard sections">
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
          {isLoading ? <p className="barista-state">Loading active orders...</p> : null}
          {fetchError ? <p className="barista-state barista-state-error">{fetchError}</p> : null}
          {actionError ? <p className="barista-state barista-state-error">{actionError}</p> : null}

          {!isLoading && !fetchError ? (
            <section className="barista-board-grid" aria-label="Active order kanban board">
              {COLUMNS.map((column) => {
                const columnOrders = groupedOrders[column.key];

                return (
                  <article key={column.key} className="barista-column">
                    <header className="barista-column-header">
                      <div>
                        <p>{column.subtitle}</p>
                        <h2>{column.title}</h2>
                      </div>
                      <span className="barista-column-count" aria-label={`${columnOrders.length} orders`}>
                        {columnOrders.length}
                      </span>
                    </header>

                    <div className="barista-column-list">
                      {columnOrders.length === 0 ? <p className="barista-empty">No orders in this lane.</p> : null}

                      {columnOrders.map((order) => {
                        const items = normalizeOrderItems(order.items);
                        const isDelivery = order.order_type === "delivery";
                        const isGcash = order.payment_method === "gcash";
                        const specialInstructions = order.special_instructions?.trim() || "";
                        const actionConfig = getActionConfig(order.status);
                        const isUpdating = updatingOrderId === order.id;

                        return (
                          <article key={order.id} className="barista-order-card">
                            <div className="barista-order-head">
                              <div>
                                <h3>{order.customer_name?.trim() || "Walk-in Customer"}</h3>
                                <p>{order.customer_phone?.trim() || "No phone provided"}</p>
                              </div>

                              <span className={`barista-badge ${isDelivery ? "barista-badge-delivery" : "barista-badge-pickup"}`}>
                                {orderTypeLabel(order.order_type)}
                              </span>
                            </div>

                            {isDelivery ? (
                              <p className="barista-delivery-address">
                                Deliver to: {order.delivery_address?.trim() || "No delivery address provided"}
                              </p>
                            ) : null}

                            <div className="barista-meta-row">
                              <span>Payment: {paymentLabel(order.payment_method)}</span>
                              {isGcash ? (
                                <strong>Ref: {order.gcash_reference?.trim() || "Pending"}</strong>
                              ) : (
                                <strong>Pay at Counter</strong>
                              )}
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
                          </article>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </section>
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
              onClick={() => {
                setIsAddMenuFormOpen(true);
                setMenuForm(EMPTY_MENU_FORM);
                setMenuError(null);
              }}
            >
              Add New Drink
            </button>
          </header>

          {menuError ? <p className="barista-state barista-state-error">{menuError}</p> : null}

          {isMenuLoading ? (
            <p className="barista-state">Loading menu items...</p>
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
                    <th>Action</th>
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
                            className="barista-danger-btn"
                            onClick={() => void handleDeleteMenuItem(menuItem)}
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
            <p className="barista-state">Loading today highlights...</p>
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
                    <th>Action</th>
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
                            onClick={() => void handleDeleteTodayHighlight(rowId, item.name)}
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

      {activeTab === "today-bar" ? (
        <section className="barista-manager-panel" aria-label="Today at the Bar manager">
          <header className="barista-manager-head">
            <div>
              <p className="barista-dashboard-kicker">Owner CMS</p>
              <h2>Today at the Bar</h2>
              <p>Edit the landing page hero card content shown on the homepage.</p>
            </div>
          </header>

          {todayAtBarError ? <p className="barista-state barista-state-error">{todayAtBarError}</p> : null}

          {isTodayAtBarLoading ? (
            <p className="barista-state">Loading Today at the Bar content...</p>
          ) : (
            <form className="barista-manager-form barista-manager-form-stretch" onSubmit={handleSaveTodayAtBar}>
              <div className="barista-manager-form-grid">
                <label className="barista-form-field" htmlFor="todayBarTitle">
                  Title
                  <input
                    id="todayBarTitle"
                    type="text"
                    value={todayAtBarForm.title}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, title: event.target.value }))
                    }
                    placeholder="Today at the Bar"
                  />
                </label>

                <label className="barista-form-field" htmlFor="todayBarDose">
                  Dose
                  <input
                    id="todayBarDose"
                    type="text"
                    value={todayAtBarForm.dose}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, dose: event.target.value }))
                    }
                    placeholder="18g"
                  />
                </label>

                <label className="barista-form-field" htmlFor="todayBarExtractionTime">
                  Extraction Time
                  <input
                    id="todayBarExtractionTime"
                    type="text"
                    value={todayAtBarForm.extractionTime}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, extractionTime: event.target.value }))
                    }
                    placeholder="27s"
                  />
                </label>

                <label className="barista-form-field" htmlFor="todayBarBrewTemp">
                  Brew Temp
                  <input
                    id="todayBarBrewTemp"
                    type="text"
                    value={todayAtBarForm.brewTemp}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, brewTemp: event.target.value }))
                    }
                    placeholder="92C"
                  />
                </label>

                <label className="barista-form-field" htmlFor="todayBarGuestScore">
                  Guest Score
                  <input
                    id="todayBarGuestScore"
                    type="text"
                    value={todayAtBarForm.guestScore}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, guestScore: event.target.value }))
                    }
                    placeholder="4.9 / 5"
                  />
                </label>

                <label className="barista-form-field barista-form-field-full" htmlFor="todayBarDescription">
                  Description
                  <textarea
                    id="todayBarDescription"
                    rows={4}
                    value={todayAtBarForm.description}
                    onChange={(event) =>
                      setTodayAtBarForm((previousForm) => ({ ...previousForm, description: event.target.value }))
                    }
                    placeholder="Single-origin updates, roast notes, and daily bar highlights."
                  />
                </label>
              </div>

              <button type="submit" className="barista-action-btn barista-manager-submit" disabled={isSavingTodayAtBar}>
                {isSavingTodayAtBar ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </section>
      ) : null}

      {activeTab === "sales" ? (
        <section className="barista-manager-panel" aria-label="Sales summary">
          <header className="barista-manager-head">
            <div>
              <p className="barista-dashboard-kicker">Owner Analytics</p>
              <h2>Sales Summary</h2>
              <p>Snapshot of completed sales pulled from live and archived orders.</p>
            </div>
          </header>

          {isLoading ? <p className="barista-state">Loading sales data...</p> : null}
          {fetchError ? <p className="barista-state barista-state-error">{fetchError}</p> : null}

          {!isLoading && !fetchError ? (
            <>
              <div className="barista-sales-grid barista-sales-grid-panel">
                <article className="barista-sales-card">
                  <p>Today</p>
                  <strong>{formatCurrency(salesTotals.today)}</strong>
                </article>

                <article className="barista-sales-card">
                  <p>This Week</p>
                  <strong>{formatCurrency(salesTotals.week)}</strong>
                </article>

                <article className="barista-sales-card">
                  <p>This Month</p>
                  <strong>{formatCurrency(salesTotals.month)}</strong>
                </article>
              </div>

              {recentCompletedOrders.length === 0 ? (
                <p className="barista-empty">No completed orders yet.</p>
              ) : (
                <div className="barista-sales-list" role="list" aria-label="Recent completed orders">
                  {recentCompletedOrders.map((order) => (
                    <article key={order.id} className="barista-sales-list-item" role="listitem">
                      <div>
                        <p className="barista-sales-list-id">Order {order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="barista-sales-list-meta">
                          {order.customer_name?.trim() || "Walk-in Customer"} | {orderTypeLabel(order.order_type)} | {formatOrderDateTime(order.created_at)}
                        </p>
                      </div>
                      <strong>{formatCurrency(order.total_price)}</strong>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      </section>

      {isAddMenuFormOpen ? (
        <div
          className="barista-image-modal-backdrop"
          role="presentation"
          onClick={() => {
            setIsAddMenuFormOpen(false);
            setMenuForm(EMPTY_MENU_FORM);
            setMenuError(null);
          }}
        >
          <section
            className="barista-image-modal barista-manager-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add new drink"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="barista-image-modal-head">
              <div>
                <p className="barista-dashboard-kicker">Owner CMS</p>
                <h3>Add New Drink</h3>
              </div>

              <button
                type="button"
                className="barista-image-modal-close"
                onClick={() => {
                  setIsAddMenuFormOpen(false);
                  setMenuForm(EMPTY_MENU_FORM);
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
                  After adding a drink, open its Image button in the table to upload, crop, and save a square image.
                </p>
              </div>

              {menuError ? <p className="barista-state barista-state-error">{menuError}</p> : null}

              <div className="barista-manager-actions">
                <button
                  type="button"
                  className="barista-logout-btn"
                  onClick={() => {
                    setIsAddMenuFormOpen(false);
                    setMenuForm(EMPTY_MENU_FORM);
                    setMenuError(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="barista-action-btn barista-manager-submit"
                  disabled={isSavingMenuItem}
                >
                  {isSavingMenuItem ? "Saving..." : "Add Drink"}
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

            {!isMenuImageEditorOpen ? (
              <>
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
                    <p className="barista-image-modal-empty">No image uploaded yet.</p>
                  )}
                </div>

                <div className="barista-image-modal-actions">
                  <button type="button" className="barista-logout-btn" onClick={closeMenuImageDialog}>
                    Close
                  </button>

                  <button
                    type="button"
                    className="barista-menu-remove-image"
                    onClick={() => void handleRemoveActiveMenuImage()}
                    disabled={!activeMenuImageItem.image_url || isUpdatingActiveMenuImage}
                  >
                    Remove Image
                  </button>

                  <button type="button" className="barista-action-btn barista-image-modal-action" onClick={handleStartMenuImageEdit}>
                    Edit
                  </button>
                </div>
              </>
            ) : (
              <div className="barista-image-editor-wrap">
                <div className="barista-image-editor-canvas-wrap">
                  <canvas
                    ref={menuImageCropCanvasRef}
                    width={MENU_IMAGE_CROP_PREVIEW_SIZE}
                    height={MENU_IMAGE_CROP_PREVIEW_SIZE}
                    className="barista-image-editor-canvas"
                  />
                </div>

                <div className="barista-image-editor-controls">
                  <label className="barista-form-field" htmlFor="menuImageZoom">
                    Zoom ({menuImageZoom.toFixed(2)}x)
                    <input
                      id="menuImageZoom"
                      type="range"
                      min={MENU_IMAGE_ZOOM_MIN}
                      max={MENU_IMAGE_ZOOM_MAX}
                      step="0.01"
                      value={menuImageZoom}
                      onChange={(event) => setMenuImageZoom(Number(event.target.value))}
                    />
                  </label>

                  <label className="barista-form-field" htmlFor="menuImagePanX">
                    Move Left / Right ({Math.round(menuImagePanX)})
                    <input
                      id="menuImagePanX"
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={menuImagePanX}
                      onChange={(event) => setMenuImagePanX(Number(event.target.value))}
                    />
                  </label>

                  <label className="barista-form-field" htmlFor="menuImagePanY">
                    Move Up / Down ({Math.round(menuImagePanY)})
                    <input
                      id="menuImagePanY"
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={menuImagePanY}
                      onChange={(event) => setMenuImagePanY(Number(event.target.value))}
                    />
                  </label>
                </div>

                <div className="barista-image-editor-upload-row">
                  <label
                    className={`barista-upload-btn ${isProcessingMenuImageUpload ? "barista-upload-btn-disabled" : ""}`}
                  >
                    {isProcessingMenuImageUpload ? "Processing..." : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        void handleMenuImageEditorUpload(event);
                      }}
                      disabled={isProcessingMenuImageUpload}
                    />
                  </label>

                  <p>Final image uses a fixed square crop. Adjust zoom and position before saving.</p>
                </div>

                <div className="barista-image-modal-actions">
                  <button type="button" className="barista-logout-btn" onClick={() => setIsMenuImageEditorOpen(false)}>
                    Back
                  </button>

                  <button
                    type="button"
                    className="barista-action-btn barista-image-modal-action"
                    onClick={() => {
                      void handleSaveCroppedMenuImage();
                    }}
                    disabled={!menuImageElement || isProcessingMenuImageUpload || isUpdatingActiveMenuImage}
                  >
                    {isUpdatingActiveMenuImage ? "Saving..." : "Save Cropped Image"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
