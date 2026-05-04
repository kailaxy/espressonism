"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navbar,
  AuthModal,
  ModifierModal,
  CartModal,
  OrderTimeline,
  ReceiptView
} from "../components";
import {
  type CartLine,
  type MenuItem,
  type MenuItemCustomizationOption,
  type SelectedCustomizationOption,
  type SizeOption,
  type OrderType,
  type PaymentMethod
} from "../components/Order";
import KioskOrderPage from "./KioskOrderPage";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

const ORDER_STATUS_TRACKABLE = ["received", "brewing", "ready", "completed", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUS_TRACKABLE)[number];
type CheckoutStep = "cart" | "payment" | "tracking";

const ORDER_DRAFT_STORAGE_KEY = "espressonism-order-draft-v1";

const MENU_NOTES: Record<string, string> = {
  "spanish latte": "Best seller",
  "orange cold brew": "Seasonal",
  "double espresso": "Strong + clean finish"
};

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  base_price: number | string;
  price_solo: number | string | null;
  price_doppio: number | string | null;
  image_url: string | null;
  category: string | null;
}

interface CustomizationOptionRow {
  id: string;
  name: string;
  option_type: string;
  extra_cost: number | string;
  active: boolean;
}

interface MenuItemCustomizationRow {
  menu_item_id: string;
  required: boolean;
  max_select: number;
  sort_order: number;
  customization: CustomizationOptionRow | null;
}

interface MenuCategoryRow {
  key: string;
  label: string;
  sort_order: number;
  active: boolean;
}

interface ToastMessage {
  id: number;
  message: string;
}

interface PersistedOrderDraft {
  cartLines: CartLine[];
  pickupTime: string;
  customerName: string;
  customerPhone: string;
  specialInstructions: string;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  deliveryAddress: string;
  gcashReference: string;
}

interface SubmittedOrderSnapshot {
  orderId: string;
  createdAt: string;
  lines: CartLine[];
  totalPrice: number;
  orderType: OrderType;
  pickupTime: string | null;
  paymentMethod: PaymentMethod;
  gcashReference: string;
}

function isOrderType(value: unknown): value is OrderType {
  return value === "pickup" || value === "delivery";
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "gcash";
}

function normalizeMenuCategory(value: unknown): MenuItem["category"] {
  if (typeof value === "string" && value.trim()) return value;
  return "signature";
}

function mapMenuRowToItem(row: MenuItemRow): MenuItem {
  return mapMenuRowToItemWithOptions(row, []);
}

function mapMenuRowToItemWithOptions(row: MenuItemRow, options: MenuItemCustomizationOption[]): MenuItem {
  const normalizedName = row.name.trim().toLowerCase();
  const parsedBasePrice = Number(row.base_price);
  const parsedSoloPrice = Number(row.price_solo);
  const parsedDoppioPrice = Number(row.price_doppio);
  const safeBasePrice = Number.isFinite(parsedBasePrice) ? parsedBasePrice : 0;
  const safeSoloPrice = Number.isFinite(parsedSoloPrice) ? parsedSoloPrice : safeBasePrice;
  const safeDoppioPrice = Number.isFinite(parsedDoppioPrice) ? parsedDoppioPrice : safeBasePrice;

  return {
    id: row.id,
    name: row.name,
    description: row.description?.trim() || "",
    price: safeSoloPrice,
    priceSolo: safeSoloPrice,
    priceDoppio: safeDoppioPrice,
    category: normalizeMenuCategory(row.category),
    imageUrl: row.image_url,
    note: MENU_NOTES[normalizedName],
    customizationOptions: options
  };
}

function generatePickupTimes(): string[] {
  const now = new Date();
  const prepReadyTime = new Date(now.getTime() + 15 * 60 * 1000);

  // Check if we can offer the next 15-minute slot
  const currentMinutes = prepReadyTime.getMinutes();
  let targetMinutes = Math.ceil(currentMinutes / 15) * 15;
  
  // If ceiling rounds to 60+, we need the next hour
  if (targetMinutes >= 60) {
    targetMinutes -= 60;
    prepReadyTime.setHours(prepReadyTime.getHours() + 1);
  }
  
  prepReadyTime.setMinutes(targetMinutes, 0, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  return Array.from({ length: 5 }, (_, index) => {
    const slotTime = new Date(prepReadyTime.getTime() + index * 15 * 60 * 1000);
    return formatter.format(slotTime);
  });
}

function formatLegacyPickupWindow(value: string): string {
  if (value === "in-10") return "In 10 minutes";
  if (value === "in-20") return "In 20 minutes";
  if (value === "in-30") return "In 30 minutes";
  if (value === "custom") return "On your arrival";
  return value;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return 0;
  return parsed;
}

function calculateUnitPrice(item: MenuItem, size: SizeOption, selectedOptions: SelectedCustomizationOption[]): number {
  const sizePrice = size === "doppio" ? item.priceDoppio : item.priceSolo;
  const addOnsTotal = selectedOptions.reduce((sum, option) => sum + toNumber(option.extraCost), 0);
  return sizePrice + addOnsTotal;
}

function isSizeOption(value: unknown): value is SizeOption {
  return value === "solo" || value === "doppio";
}

function isSelectedCustomizationOption(value: unknown): value is SelectedCustomizationOption {
  if (!value || typeof value !== "object") return false;

  const option = value as Partial<SelectedCustomizationOption>;
  return (
    typeof option.id === "string" &&
    typeof option.name === "string" &&
    typeof option.optionType === "string" &&
    typeof option.extraCost === "number" &&
    Number.isFinite(option.extraCost)
  );
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;

  const line = value as Partial<CartLine>;
  const hasValidImageUrl = line.imageUrl === undefined || line.imageUrl === null || typeof line.imageUrl === "string";

  return (
    typeof line.id === "string" &&
    typeof line.itemId === "string" &&
    typeof line.name === "string" &&
    typeof line.basePrice === "number" &&
    Number.isFinite(line.basePrice) &&
    typeof line.unitPrice === "number" &&
    Number.isFinite(line.unitPrice) &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    isSizeOption(line.size) &&
    Array.isArray(line.selectedOptions) &&
    line.selectedOptions.every(isSelectedCustomizationOption) &&
    hasValidImageUrl
  );
}

function parseOrderDraft(rawDraft: string): PersistedOrderDraft | null {
  try {
    const parsed = JSON.parse(rawDraft) as Partial<PersistedOrderDraft> & { pickupWindow?: string };
    if (!parsed || typeof parsed !== "object") return null;

    const safeCartLines = Array.isArray(parsed.cartLines) ? parsed.cartLines.filter(isCartLine) : [];

    return {
      cartLines: safeCartLines,
      pickupTime:
        typeof parsed.pickupTime === "string"
          ? parsed.pickupTime
          : typeof parsed.pickupWindow === "string"
            ? formatLegacyPickupWindow(parsed.pickupWindow)
            : "",
      customerName: typeof parsed.customerName === "string" ? parsed.customerName : "",
      customerPhone: typeof parsed.customerPhone === "string" ? parsed.customerPhone : "",
      specialInstructions: typeof parsed.specialInstructions === "string" ? parsed.specialInstructions : "",
      orderType: isOrderType(parsed.orderType) ? parsed.orderType : "pickup",
      paymentMethod: isPaymentMethod(parsed.paymentMethod) ? parsed.paymentMethod : "cash",
      deliveryAddress: typeof parsed.deliveryAddress === "string" ? parsed.deliveryAddress : "",
      gcashReference: typeof parsed.gcashReference === "string" ? parsed.gcashReference : ""
    };
  } catch {
    return null;
  }
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  if (value === "received" || value === "brewing" || value === "ready" || value === "completed" || value === "cancelled") {
    return value;
  }

  return "received";
}

function mergeCartLines(existingLines: CartLine[], nextLines: CartLine[]): CartLine[] {
  const mergedLines = existingLines.map((line) => ({ ...line }));

  nextLines.forEach((incomingLine) => {
    const matchingLine = mergedLines.find((line) => line.id === incomingLine.id);
    if (matchingLine) {
      matchingLine.quantity += incomingLine.quantity;
      return;
    }

    mergedLines.push({ ...incomingLine });
  });

  return mergedLines;
}

function buildDefaultSelectedOptionIds(item: MenuItem): string[] {
  const groupedOptions = item.customizationOptions.reduce<Record<string, MenuItemCustomizationOption[]>>((acc, option) => {
    const key = option.optionType || "other";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(option);
    return acc;
  }, {});

  const defaults = new Set<string>();

  Object.values(groupedOptions).forEach((options) => {
    const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const requiredOptions = sorted.filter((option) => option.required);
    if (requiredOptions.length === 0) return;

    const maxSelect = Math.max(...requiredOptions.map((option) => option.maxSelect), 1);
    requiredOptions.slice(0, maxSelect).forEach((option) => defaults.add(option.id));
  });

  return [...defaults];
}

function normalizeSelectedOptionIds(item: MenuItem, selectedOptionIds: string[]): string[] {
  const availableById = new Map(item.customizationOptions.map((option) => [option.id, option]));
  const safeSelected = selectedOptionIds.filter((optionId) => availableById.has(optionId));

  const groupedOptions = item.customizationOptions.reduce<Record<string, MenuItemCustomizationOption[]>>((acc, option) => {
    const key = option.optionType || "other";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(option);
    return acc;
  }, {});

  const normalized = new Set<string>(safeSelected);

  Object.values(groupedOptions).forEach((options) => {
    const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const selectedInGroup = sorted.filter((option) => normalized.has(option.id));
    const maxSelect = Math.max(...sorted.map((option) => option.maxSelect), 1);

    if (selectedInGroup.length > maxSelect) {
      selectedInGroup.slice(maxSelect).forEach((option) => normalized.delete(option.id));
    }

    const hasRequired = sorted.some((option) => option.required);
    const selectedAfterClamp = sorted.filter((option) => normalized.has(option.id));
    if (hasRequired && selectedAfterClamp.length === 0) {
      const fallback = sorted.find((option) => option.required) ?? sorted[0];
      if (fallback) {
        normalized.add(fallback.id);
      }
    }
  });

  return [...normalized];
}

function mapSelectedOptions(item: MenuItem, selectedOptionIds: string[]): SelectedCustomizationOption[] {
  const selectedSet = new Set(selectedOptionIds);
  return item.customizationOptions
    .filter((option) => selectedSet.has(option.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((option) => ({
      id: option.id,
      name: option.name,
      optionType: option.optionType,
      extraCost: option.extraCost
    }));
}

function notifyTelegramOrderPlaced(payload: {
  orderId: string;
  customerName: string;
  orderType: OrderType;
  pickupTime?: string | null;
  items: Array<{ name: string; quantity: number; size: SizeOption }>;
  totalPrice: number;
  specialInstructions?: string;
}): void {
  try {
    void fetch("/api/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Telegram notification failed.", { status: response.status });
        }
      })
      .catch((error) => {
        console.error("Telegram notification failed.", error);
      });
  } catch (error) {
    console.error("Telegram notification failed.", error);
  }
}

export default function OrderPage() {
  const [activeCategory, setActiveCategory] = useState<"all" | string>("all");
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Array<{ key: string; label: string }>>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [pickupTime, setPickupTime] = useState("");
  const [pickupTimes, setPickupTimes] = useState<string[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("cart");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrderSnapshot | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("received");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [gcashReference, setGcashReference] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizeOption>("solo");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isModifierOpen, setIsModifierOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCartBumping, setIsCartBumping] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const previousCartCountRef = useRef(0);
  const skipNextCartBumpRef = useRef(false);

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return menuData;
    return menuData.filter((item) => item.category === activeCategory);
  }, [activeCategory, menuData]);

  const quantities = useMemo<Record<string, number>>(() => {
    return cartLines.reduce<Record<string, number>>((acc, line) => {
      acc[line.itemId] = (acc[line.itemId] ?? 0) + line.quantity;
      return acc;
    }, {});
  }, [cartLines]);

  const cartCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity, 0),
    [cartLines]
  );

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cartLines]
  );

  const grandTotal = subtotal;

  const modifierFinalPrice = useMemo(() => {
    if (!selectedItem) return 0;
    const selectedOptions = selectedItem.customizationOptions
      .filter((option) => selectedOptionIds.includes(option.id))
      .map<SelectedCustomizationOption>((option) => ({
        id: option.id,
        name: option.name,
        optionType: option.optionType,
        extraCost: option.extraCost
      }));
    return calculateUnitPrice(selectedItem, selectedSize, selectedOptions);
  }, [selectedItem, selectedSize, selectedOptionIds]);

  const orderNumber = useMemo(() => {
    if (currentOrderId) {
      return `ES-${currentOrderId.slice(0, 8).toUpperCase()}`;
    }

    const seed = grandTotal + cartCount * 7 + 3200;
    return `ES-${seed}`;
  }, [currentOrderId, cartCount, grandTotal]);

  useEffect(() => {
    let isMounted = true;

    const fetchMenuAndCategories = async () => {
      setIsMenuLoading(true);
      setMenuError(null);

      const [categoriesResult, menuResult, customizationsResult] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("key, label, sort_order, active")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("menu_items")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("menu_item_customizations")
          .select("menu_item_id, required, max_select, sort_order, customization:menu_customization_options(id, name, option_type, extra_cost, active)")
          .order("sort_order", { ascending: true })
      ]);

      if (!isMounted) return;

      let fetchedCategories: Array<{ key: string; label: string }> = [];
      if (categoriesResult.error || !categoriesResult.data) {
        // Fallback to hardcoded categories if database query fails
        fetchedCategories = [
          { key: "espresso", label: "Espresso" },
          { key: "signature", label: "Signature" },
          { key: "bites", label: "Bites" }
        ];
      } else {
        fetchedCategories = categoriesResult.data.map((cat: MenuCategoryRow) => ({
          key: cat.key,
          label: cat.label
        }));
      }

      setCategories(fetchedCategories);

      if (menuResult.error) {
        setMenuData([]);
        setMenuError("Unable to load menu right now. Please try again in a moment.");
        setIsMenuLoading(false);
        return;
      }

      const customizationRows = (customizationsResult.data ?? []) as MenuItemCustomizationRow[];
      const customizationMap = customizationRows.reduce<Record<string, MenuItemCustomizationOption[]>>((acc, row) => {
        const customOption = row.customization;
        if (!customOption || customOption.active === false) {
          return acc;
        }

        if (!acc[row.menu_item_id]) {
          acc[row.menu_item_id] = [];
        }

        acc[row.menu_item_id].push({
          id: customOption.id,
          name: customOption.name,
          optionType: customOption.option_type,
          extraCost: toNumber(customOption.extra_cost),
          required: row.required,
          maxSelect: Math.max(1, Number(row.max_select) || 1),
          sortOrder: Number(row.sort_order) || 0
        });

        return acc;
      }, {});

      const mappedMenuItems = ((menuResult.data ?? []) as MenuItemRow[]).map((row) =>
        mapMenuRowToItemWithOptions(row, customizationMap[row.id] ?? [])
      );
      setMenuData(mappedMenuItems);
      setIsMenuLoading(false);
    };

    void fetchMenuAndCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      const nextUser = data?.session?.user;
      if (nextUser?.id) {
        setUser({
          id: nextUser.id,
          email: typeof nextUser.email === "string" ? nextUser.email : null
        });
      } else {
        setUser(null);
      }
    };

    void syncSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
      const nextUser = (session as { user?: { id?: string; email?: string | null } | null } | null)?.user;
      if (nextUser?.id) {
        setUser({
          id: nextUser.id,
          email: typeof nextUser.email === "string" ? nextUser.email : null
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const nextPickupTimes = generatePickupTimes();
    setPickupTimes(nextPickupTimes);
    setPickupTime((currentValue) => currentValue || nextPickupTimes[0] || "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawDraft = window.localStorage.getItem(ORDER_DRAFT_STORAGE_KEY);
    if (!rawDraft) return;

    const draft = parseOrderDraft(rawDraft);
    if (!draft) {
      window.localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
      return;
    }

    skipNextCartBumpRef.current = true;
    setCartLines(draft.cartLines);
    setPickupTime(draft.pickupTime);
    setOrderType(draft.orderType);
    setPaymentMethod(draft.paymentMethod);
    setGcashReference(draft.gcashReference);
    setDeliveryAddress(draft.deliveryAddress);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setSpecialInstructions(draft.specialInstructions);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const draft: PersistedOrderDraft = {
      cartLines,
      pickupTime,
      orderType,
      paymentMethod,
      gcashReference,
      deliveryAddress,
      customerName,
      customerPhone,
      specialInstructions
    };

    window.localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [cartLines, pickupTime, orderType, paymentMethod, gcashReference, deliveryAddress, customerName, customerPhone, specialInstructions]);

  useEffect(() => {
    if (skipNextCartBumpRef.current) {
      skipNextCartBumpRef.current = false;
      previousCartCountRef.current = cartCount;
      return;
    }

    if (cartCount > previousCartCountRef.current) {
      setIsCartBumping(true);
      const timeoutId = window.setTimeout(() => setIsCartBumping(false), 280);
      previousCartCountRef.current = cartCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousCartCountRef.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    if (!currentOrderId) return;
    if (orderStatus === "completed" || orderStatus === "cancelled") return;

    const channel = supabase
      .channel(`order-tracker-${currentOrderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${currentOrderId}`
        },
        (payload: { new?: { status?: unknown } }) => {
          const nextStatusValue = payload.new?.status;
          setOrderStatus(normalizeOrderStatus(nextStatusValue));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentOrderId, orderStatus]);

  useEffect(() => {
    if (orderPlaced) {
      setCheckoutStep("tracking");
    }
  }, [orderPlaced]);

  const addToast = (message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2200);
  };

  const handleAuthSuccess = async () => {
    const { data } = await supabase.auth.getSession();
    const nextUser = data?.session?.user;

    if (nextUser?.id) {
      setUser({
        id: nextUser.id,
        email: typeof nextUser.email === "string" ? nextUser.email : null
      });
      addToast("Signed in. Stamps enabled for this order.");
    } else {
      setUser(null);
    }

    setIsAuthModalOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    addToast("Signed out. You can still checkout as guest.");
  };

  const openModifier = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedSize("solo");
    setSelectedOptionIds(buildDefaultSelectedOptionIds(item));
    setIsModifierOpen(true);
  };

  const handleToggleModifierOption = (optionId: string) => {
    if (!selectedItem) return;

    const option = selectedItem.customizationOptions.find((entry) => entry.id === optionId);
    if (!option) return;

    setSelectedOptionIds((previousIds) => {
      const selectedSet = new Set(previousIds);
      const sameTypeOptions = selectedItem.customizationOptions
        .filter((entry) => entry.optionType === option.optionType)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      const maxSelect = Math.max(...sameTypeOptions.map((entry) => entry.maxSelect), 1);
      const isSelected = selectedSet.has(option.id);

      if (isSelected) {
        const hasOtherSelected = sameTypeOptions.some((entry) => entry.id !== option.id && selectedSet.has(entry.id));
        if (option.required && !hasOtherSelected) {
          return previousIds;
        }
        selectedSet.delete(option.id);
      } else {
        const selectedInType = sameTypeOptions.filter((entry) => selectedSet.has(entry.id));
        if (maxSelect === 1) {
          selectedInType.forEach((entry) => selectedSet.delete(entry.id));
        } else if (selectedInType.length >= maxSelect) {
          const firstSelected = selectedInType[0];
          if (firstSelected) {
            selectedSet.delete(firstSelected.id);
          }
        }
        selectedSet.add(option.id);
      }

      return normalizeSelectedOptionIds(selectedItem, [...selectedSet]);
    });
  };

  const addConfiguredItem = (item: MenuItem, size: SizeOption, optionIds: string[]) => {
    const normalizedOptionIds = normalizeSelectedOptionIds(item, optionIds);
    const selectedOptions = mapSelectedOptions(item, normalizedOptionIds);
    const lineId = `${item.id}-${size}-${normalizedOptionIds.slice().sort().join(".") || "base"}`;
    const unitPrice = calculateUnitPrice(item, size, selectedOptions);
    const basePrice = size === "doppio" ? item.priceDoppio : item.priceSolo;

    setCartLines((prev) => {
      const existing = prev.find((line) => line.id === lineId);
      if (!existing) {
        return [
          ...prev,
          {
            id: lineId,
            itemId: item.id,
            name: item.name,
            basePrice,
            unitPrice,
            quantity: 1,
            size,
            selectedOptions,
            imageUrl: item.imageUrl ?? null
          }
        ];
      }

      return prev.map((line) =>
        line.id === lineId
          ? { ...line, quantity: line.quantity + 1 }
          : line
      );
    });
  };

  const handleAddFromModifier = () => {
    if (!selectedItem) return;

    addConfiguredItem(selectedItem, selectedSize, selectedOptionIds);
    setIsModifierOpen(false);
    setSelectedItem(null);
    setSelectedOptionIds([]);
    addToast("Added to cart!");
  };

  const quickAddDefault = (item: MenuItem) => {
    addConfiguredItem(item, "solo", buildDefaultSelectedOptionIds(item));
    addToast("Added to cart!");
  };

  const removeLine = (lineId: string) => {
    setCartLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const clearCart = () => {
    setCartLines([]);
    setCheckoutError(null);
  };

  const openCartView = () => {
    setCheckoutStep("cart");
    setIsCartOpen(true);
  };

  const handleCheckout = () => {
    if (cartLines.length === 0 || isCheckingOut) {
      return;
    }

    setCheckoutError(null);
    setIsCartOpen(false);
    setCheckoutStep("payment");
  };

  const handleConfirmOrder = async () => {
    // Mandatory login check
    if (!user?.id) {
      setCheckoutError("Please log in before placing your order.");
      setIsAuthModalOpen(true);
      return;
    }

    const needsDeliveryAddress = orderType === "delivery" && deliveryAddress.trim().length === 0;
    const missingName = customerName.trim().length === 0;
    const missingPhone = customerPhone.trim().length === 0;
    const invalidGcashReference = paymentMethod === "gcash" && !/^\d{13}$/.test(gcashReference.trim());

    if (cartLines.length === 0 || missingName || missingPhone || needsDeliveryAddress || invalidGcashReference || isCheckingOut) {
      if (needsDeliveryAddress) {
        setCheckoutError("Delivery address is required for delivery orders.");
      } else if (missingName) {
        setCheckoutError("Customer name is required.");
      } else if (missingPhone) {
        setCheckoutError("Contact number is required.");
      } else if (invalidGcashReference) {
        setCheckoutError("GCash reference number must be exactly 13 digits.");
      }
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    const clientOrderId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();

    const orderItemsPayload = cartLines.map((line) => ({
      id: line.id,
      item_id: line.itemId,
      name: line.name,
      base_price: line.basePrice,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      size: line.size,
      selected_options: line.selectedOptions.map((option) => ({
        id: option.id,
        name: option.name,
        option_type: option.optionType,
        extra_cost: option.extraCost
      })),
      image_url: line.imageUrl ?? null
    }));

    const orderInsertPayload: Record<string, unknown> = {
      id: clientOrderId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      items: orderItemsPayload,
      total_price: grandTotal,
      status: "received",
      special_instructions: specialInstructions.trim() || null,
      pickup_time: pickupTime || null,
      order_type: orderType,
      payment_method: paymentMethod,
      gcash_reference: paymentMethod === "gcash" ? gcashReference.trim() : null,
      delivery_address: orderType === "delivery" ? deliveryAddress.trim() : null,
      user_id: user.id
    };

    let insertResponse = await supabase
      .from("orders")
      .insert([orderInsertPayload])
      .select("id, status, created_at")
      .single();

    // Some deployments may not have optional columns yet (pickup_time, user_id).
    if (insertResponse.error) {
      const fallbackPayload = { ...orderInsertPayload };
      const errorMessage = insertResponse.error.message || "";
      let shouldRetryWithoutColumn = false;

      if (/pickup_time/i.test(errorMessage)) {
        delete fallbackPayload.pickup_time;
        shouldRetryWithoutColumn = true;
      }

      if (/user_id/i.test(errorMessage)) {
        delete fallbackPayload.user_id;
        shouldRetryWithoutColumn = true;
      }

      if (shouldRetryWithoutColumn) {
        insertResponse = await supabase
          .from("orders")
          .insert([fallbackPayload])
          .select("id, status, created_at")
          .single();
      }
    }

    const { data, error } = insertResponse;

    if (error || !data?.id) {
      setCheckoutError(error?.message || "Unable to place your order. Please try again.");
      setIsCheckingOut(false);
      return;
    }

    const normalizedStatus = normalizeOrderStatus(data.status);
    const submittedSnapshot: SubmittedOrderSnapshot = {
      orderId: data.id,
      createdAt: typeof data.created_at === "string" ? data.created_at : submittedAt,
      lines: cartLines.map((line) => ({ ...line })),
      totalPrice: grandTotal,
      orderType,
      pickupTime: orderType === "pickup" ? (pickupTime.trim() || null) : null,
      paymentMethod,
      gcashReference: paymentMethod === "gcash" ? gcashReference.trim() : ""
    };

    setSubmittedOrder(submittedSnapshot);

    setCurrentOrderId(data.id);
    setCartLines([]);
    setIsCartOpen(false);
    setShowReceipt(false);
    setOrderStatus(normalizedStatus);
    setOrderPlaced(true);
    setCheckoutStep("tracking");
    setIsCheckingOut(false);

    notifyTelegramOrderPlaced({
      orderId: data.id,
      customerName: customerName.trim(),
      orderType,
      pickupTime: orderType === "pickup" ? (pickupTime.trim() || null) : null,
      items: cartLines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        size: line.size
      })),
      totalPrice: grandTotal,
      specialInstructions: specialInstructions.trim()
    });
  };

  const handleReorderFromReceipt = () => {
    if (!submittedOrder || submittedOrder.lines.length === 0) return;

    const linesToReorder = submittedOrder.lines.map((line) => ({ ...line }));
    setCartLines((previousLines) => mergeCartLines(previousLines, linesToReorder));
    setOrderPlaced(false);
    setCheckoutStep("cart");
    setShowReceipt(false);
    setCurrentOrderId(null);
    setSubmittedOrder(null);
    setOrderStatus("received");
    setCheckoutError(null);
    setIsCartOpen(true);
    addToast("Items added back to cart.");
  };

  const resetOrder = () => {
    setOrderPlaced(false);
    setCheckoutStep("cart");
    setShowReceipt(false);
    setSubmittedOrder(null);
    setCurrentOrderId(null);
    setOrderStatus("received");
    setCartLines([]);
    setOrderType("pickup");
    setPaymentMethod("cash");
    setGcashReference("");
    setDeliveryAddress("");
    setCustomerName("");
    setCustomerPhone("");
    setSpecialInstructions("");
    setPickupTime(pickupTimes[0] || "");
    setCheckoutError(null);
  };

  const isKioskBrowseStage = !orderPlaced && checkoutStep !== "payment";

  return (
    <div className={isKioskBrowseStage ? "order-page-v2 order-page-v2-browse" : "shell order-page-v2"} id="home">
      <Navbar cartCount={cartCount} onCartClick={openCartView} hrefPrefix="/" />

      <main className={`order-shell ${isKioskBrowseStage ? "order-shell-kiosk" : ""}`}>
        {!orderPlaced ? checkoutStep === "payment" ? (
          <section className="order-timeline" aria-live="polite">
            <header className="order-payment-head">
              <button type="button" className="order-secondary-btn" onClick={openCartView}>
                Back to Cart
              </button>
              <h2>Payment Details</h2>
            </header>

            <div className="checkout-form-grid">
              <fieldset className="checkout-choice-group">
                <legend>Order Type</legend>
                <div className="checkout-choice-list" role="radiogroup" aria-label="Order type">
                  <label className={`checkout-choice ${orderType === "pickup" ? "checkout-choice-active" : ""}`}>
                    <input
                      type="radio"
                      name="orderType"
                      value="pickup"
                      checked={orderType === "pickup"}
                      onChange={() => setOrderType("pickup")}
                    />
                    Pick-up
                  </label>
                  <label className={`checkout-choice ${orderType === "delivery" ? "checkout-choice-active" : ""}`}>
                    <input
                      type="radio"
                      name="orderType"
                      value="delivery"
                      checked={orderType === "delivery"}
                      onChange={() => setOrderType("delivery")}
                    />
                    Delivery
                  </label>
                </div>
              </fieldset>

              {orderType === "delivery" ? (
                <label className="checkout-field" htmlFor="deliveryAddressPayment">
                  Delivery Address *
                  <textarea
                    id="deliveryAddressPayment"
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    placeholder="House number, street, barangay, city"
                    rows={2}
                    required
                  />
                </label>
              ) : null}

              <label className="checkout-field" htmlFor="customerNamePayment">
                Customer Name *
                <input
                  id="customerNamePayment"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </label>
              <label className="checkout-field" htmlFor="customerPhonePayment">
                Contact Number *
                <input
                  id="customerPhonePayment"
                  type="text"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="09XXXXXXXXX"
                  required
                />
              </label>
              <label className="checkout-field" htmlFor="specialInstructionsPayment">
                Special Instructions
                <textarea
                  id="specialInstructionsPayment"
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Less sugar, no straw, etc."
                  rows={2}
                />
              </label>

              <fieldset className="checkout-choice-group">
                <legend>Payment Method</legend>
                <div className="checkout-choice-list" role="radiogroup" aria-label="Payment method">
                  <label className={`checkout-choice ${paymentMethod === "cash" ? "checkout-choice-active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === "cash"}
                      onChange={() => setPaymentMethod("cash")}
                    />
                    Cash
                  </label>
                  <label className={`checkout-choice ${paymentMethod === "gcash" ? "checkout-choice-active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="gcash"
                      checked={paymentMethod === "gcash"}
                      onChange={() => setPaymentMethod("gcash")}
                    />
                    GCash
                  </label>
                </div>
              </fieldset>
            </div>

            <section
              className={`loyalty-banner loyalty-banner-in-payment ${user ? "loyalty-banner-success" : ""}`}
              aria-live="polite"
              aria-label="Loyalty rewards status"
            >
              <div className="loyalty-banner-icon" aria-hidden="true">
                {user ? (
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="m8 12 2.4 2.4L16.4 8.6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 4.5h10v2.3H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M5.2 8.2h13.6v11.3H5.2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M12 8.2v11.3M5.2 12h13.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                )}
              </div>

              <div className="loyalty-banner-body">
                {user ? (
                  <>
                    <p className="loyalty-banner-title">Logged in as {user.email || "your account"}. You will earn stamps for this order!</p>
                    <button
                      type="button"
                      className="loyalty-banner-link"
                      onClick={() => {
                        void handleLogout();
                      }}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <p className="loyalty-banner-title">Please log in to continue with your order</p>
                    <button type="button" className="loyalty-banner-link" onClick={() => setIsAuthModalOpen(true)}>
                      Log in now
                    </button>
                  </>
                )}
              </div>
            </section>

            {paymentMethod === "cash" ? (
              <p className="order-payment-cash-copy">
                Please prepare the exact amount of PHP {grandTotal.toFixed(2)} upon {orderType === "delivery" ? "delivery" : "pickup"}.
              </p>
            ) : (
              <div className="checkout-gcash-placeholder" role="note" aria-label="GCash payment guidance">
                <p className="checkout-gcash-title">GCash Logo Placeholder</p>
                <p className="checkout-gcash-copy">Please scan the QR code at the counter or send payment to 09XXXXXXXXX.</p>

                <label className="checkout-field" htmlFor="gcashReferencePayment">
                  GCash Reference Number (13 digits) *
                  <input
                    id="gcashReferencePayment"
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    pattern="[0-9]{13}"
                    value={gcashReference}
                    onChange={(event) => setGcashReference(event.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 13-digit reference"
                    required
                  />
                </label>
              </div>
            )}

            {checkoutError ? (
              <p className="order-checkout-error" role="alert">
                {checkoutError}
              </p>
            ) : null}

            <button
              type="button"
              className="order-checkout-btn-v2"
              onClick={handleConfirmOrder}
              disabled={
                isCheckingOut ||
                !user?.id ||
                cartLines.length === 0 ||
                customerName.trim().length === 0 ||
                customerPhone.trim().length === 0 ||
                (orderType === "delivery" && deliveryAddress.trim().length === 0) ||
                (paymentMethod === "gcash" && !/^\d{13}$/.test(gcashReference.trim()))
              }
            >
              {isCheckingOut ? "Submitting..." : "Confirm Order"}
            </button>
          </section>
        ) : (
          <>
            <KioskOrderPage
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              items={filteredItems}
              cartLines={cartLines}
              quantities={quantities}
              isMenuLoading={isMenuLoading}
              isHighlightsLoading={false}
              menuError={menuError}
              cartCount={cartCount}
              grandTotal={grandTotal}
              isCartBumping={isCartBumping}
              onQuickAdd={quickAddDefault}
              onCustomize={openModifier}
              onViewCart={openCartView}
              categories={categories}
            />

            <ModifierModal
              isOpen={isModifierOpen}
              item={selectedItem}
              size={selectedSize}
              selectedOptionIds={selectedOptionIds}
              finalPrice={modifierFinalPrice}
              onSizeChange={setSelectedSize}
              onToggleOption={handleToggleModifierOption}
              onClose={() => {
                setIsModifierOpen(false);
                setSelectedItem(null);
                setSelectedOptionIds([]);
              }}
              onAddToCart={handleAddFromModifier}
            />

            <CartModal
              isOpen={isCartOpen}
              lines={cartLines}
              subtotal={subtotal}
              grandTotal={grandTotal}
              isCheckingOut={isCheckingOut}
              pickupTime={pickupTime}
              pickupTimes={pickupTimes}
              onPickupTimeChange={setPickupTime}
              onRemoveLine={removeLine}
              onClearOrder={clearCart}
              onClose={() => setIsCartOpen(false)}
              onCheckout={handleCheckout}
            />

          </>
        ) : showReceipt && submittedOrder ? (
          <ReceiptView
            orderId={submittedOrder.orderId}
            createdAt={submittedOrder.createdAt}
            lines={submittedOrder.lines}
            totalPrice={submittedOrder.totalPrice}
            orderType={submittedOrder.orderType}
            pickupTime={submittedOrder.pickupTime}
            paymentMethod={submittedOrder.paymentMethod}
            gcashReference={submittedOrder.gcashReference}
            onReorder={handleReorderFromReceipt}
            onReset={resetOrder}
          />
        ) : (
          <OrderTimeline
            orderNumber={orderNumber}
            pickupLabel={pickupTime || "As soon as possible"}
            orderStatus={orderStatus}
            customerName={customerName || "Guest"}
            specialInstructions={specialInstructions}
            onReady={() => setShowReceipt(true)}
            onReset={resetOrder}
          />
        )}

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={() => {
            void handleAuthSuccess();
          }}
        />
      </main>

      <div className="toast-stack" aria-live="polite" aria-label="Order notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast toast-success" role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
