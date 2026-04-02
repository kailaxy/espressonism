"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Hero,
  Navbar,
  CategoryTabs,
  MenuGrid,
  ModifierModal,
  CartModal,
  OrderTimeline,
  ReceiptView
} from "../components";
import {
  type CartLine,
  type MenuItem,
  type MilkOption,
  type SizeOption,
  type OrderType,
  type PaymentMethod
} from "../components/Order";
import { smoothScrollToElement } from "../lib/smoothScroll";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

const ORDER_STATUS_TRACKABLE = ["received", "brewing", "ready", "completed", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUS_TRACKABLE)[number];
type CheckoutStep = "cart" | "payment" | "tracking";

const ORDER_DRAFT_STORAGE_KEY = "espressonism-order-draft-v1";
const ORDER_HISTORY_STORAGE_KEY = "espressonism-order-history-v1";
const ORDER_HISTORY_LIMIT = 12;

const HIGHLIGHT_ITEM_NAMES = new Set([
  "spanish latte",
  "sea salt mocha",
  "orange cold brew",
  "butter croissant"
]);

const ESPRESSO_ITEM_NAMES = new Set([
  "double espresso",
  "americano black",
  "piccolo latte",
  "espresso"
]);

const BITES_KEYWORDS = ["croissant", "melt", "tart", "cookie", "sandwich", "ham", "choco"];

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
  image_url: string | null;
}

interface ToastMessage {
  id: number;
  message: string;
}

interface PersistedOrderDraft {
  cartLines: CartLine[];
  pickupWindow: string;
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
  paymentMethod: PaymentMethod;
  gcashReference: string;
}

interface OrderHistoryEntry extends SubmittedOrderSnapshot {
  status: OrderStatus;
  customerName: string;
  specialInstructions: string;
  pickupWindow: string;
  orderType: OrderType;
}

function isOrderType(value: unknown): value is OrderType {
  return value === "pickup" || value === "delivery";
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "gcash";
}

function inferMenuCategory(name: string): MenuItem["category"] {
  const normalizedName = name.trim().toLowerCase();

  if (ESPRESSO_ITEM_NAMES.has(normalizedName)) {
    return "espresso";
  }

  if (BITES_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return "bites";
  }

  return "signature";
}

function mapMenuRowToItem(row: MenuItemRow): MenuItem {
  const normalizedName = row.name.trim().toLowerCase();
  const parsedPrice = Number(row.base_price);

  return {
    id: row.id,
    name: row.name,
    description: row.description?.trim() || "Crafted fresh for your next coffee break.",
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    category: inferMenuCategory(row.name),
    note: MENU_NOTES[normalizedName]
  };
}

function pickupText(value: string): string {
  if (value === "in-10") return "In 10 minutes";
  if (value === "in-20") return "In 20 minutes";
  if (value === "in-30") return "In 30 minutes";
  return "On your arrival";
}

function calculateUnitPrice(basePrice: number, size: SizeOption, milk: MilkOption): number {
  const sizeCharge = size === "large" ? 20 : 0;
  const milkCharge = milk === "whole" ? 0 : 50;
  return basePrice + sizeCharge + milkCharge;
}

function isSizeOption(value: unknown): value is SizeOption {
  return value === "regular" || value === "large";
}

function isMilkOption(value: unknown): value is MilkOption {
  return value === "whole" || value === "oat" || value === "almond";
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;

  const line = value as Partial<CartLine>;
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
    isMilkOption(line.milk)
  );
}

function parseOrderDraft(rawDraft: string): PersistedOrderDraft | null {
  try {
    const parsed = JSON.parse(rawDraft) as Partial<PersistedOrderDraft>;
    if (!parsed || typeof parsed !== "object") return null;

    const safeCartLines = Array.isArray(parsed.cartLines) ? parsed.cartLines.filter(isCartLine) : [];

    return {
      cartLines: safeCartLines,
      pickupWindow: typeof parsed.pickupWindow === "string" ? parsed.pickupWindow : "in-10",
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

function parseOrderHistory(rawHistory: string): OrderHistoryEntry[] {
  try {
    const parsed = JSON.parse(rawHistory) as unknown;
    if (!Array.isArray(parsed)) return [];

    const safeHistory = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;

        const candidate = entry as Partial<OrderHistoryEntry>;
        const safeLines = Array.isArray(candidate.lines) ? candidate.lines.filter(isCartLine) : [];
        if (!candidate.orderId || typeof candidate.orderId !== "string") return null;
        if (!candidate.createdAt || typeof candidate.createdAt !== "string") return null;

        return {
          orderId: candidate.orderId,
          createdAt: candidate.createdAt,
          lines: safeLines,
          totalPrice: typeof candidate.totalPrice === "number" && Number.isFinite(candidate.totalPrice) ? candidate.totalPrice : 0,
          paymentMethod: isPaymentMethod(candidate.paymentMethod) ? candidate.paymentMethod : "cash",
          gcashReference: typeof candidate.gcashReference === "string" ? candidate.gcashReference : "",
          status: normalizeOrderStatus(candidate.status),
          customerName: typeof candidate.customerName === "string" ? candidate.customerName : "Guest",
          specialInstructions: typeof candidate.specialInstructions === "string" ? candidate.specialInstructions : "",
          pickupWindow: typeof candidate.pickupWindow === "string" ? candidate.pickupWindow : "in-10",
          orderType: isOrderType(candidate.orderType) ? candidate.orderType : "pickup"
        } satisfies OrderHistoryEntry;
      })
      .filter((entry): entry is OrderHistoryEntry => Boolean(entry));

    return safeHistory.slice(0, ORDER_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function upsertOrderHistory(history: OrderHistoryEntry[], entry: OrderHistoryEntry): OrderHistoryEntry[] {
  const deduped = history.filter((historyEntry) => historyEntry.orderId !== entry.orderId);
  return [entry, ...deduped].slice(0, ORDER_HISTORY_LIMIT);
}

function orderStatusLabel(status: OrderStatus): string {
  if (status === "received") return "Received";
  if (status === "brewing") return "Preparing";
  if (status === "ready") return "Ready";
  if (status === "completed") return "Completed";
  return "Cancelled";
}

export default function OrderPage() {
  const [activeCategory, setActiveCategory] = useState<"all" | MenuItem["category"]>("all");
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [pickupWindow, setPickupWindow] = useState("in-10");
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
  const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringOrderId, setRestoringOrderId] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizeOption>("regular");
  const [selectedMilk, setSelectedMilk] = useState<MilkOption>("whole");
  const [isModifierOpen, setIsModifierOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
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

  const serviceFee = subtotal > 0 ? 25 : 0;
  const grandTotal = subtotal + serviceFee;

  const highlightItems = useMemo(() => {
    const preferredItems = menuData.filter((item) => HIGHLIGHT_ITEM_NAMES.has(item.name.toLowerCase()));
    if (preferredItems.length > 0) return preferredItems.slice(0, 4);
    return menuData.slice(0, 4);
  }, [menuData]);

  const modifierFinalPrice = useMemo(() => {
    if (!selectedItem) return 0;
    return calculateUnitPrice(selectedItem.price, selectedSize, selectedMilk);
  }, [selectedItem, selectedSize, selectedMilk]);

  const orderNumber = useMemo(() => {
    if (currentOrderId) {
      return `ES-${currentOrderId.slice(0, 8).toUpperCase()}`;
    }

    const seed = grandTotal + cartCount * 7 + 3200;
    return `ES-${seed}`;
  }, [currentOrderId, cartCount, grandTotal]);

  useEffect(() => {
    let isMounted = true;

    const fetchMenuItems = async () => {
      setIsMenuLoading(true);
      setMenuError(null);

      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        setMenuData([]);
        setMenuError("Unable to load menu right now. Please try again in a moment.");
        setIsMenuLoading(false);
        return;
      }

      const mappedMenuItems = ((data ?? []) as MenuItemRow[]).map(mapMenuRowToItem);
      setMenuData(mappedMenuItems);
      setIsMenuLoading(false);
    };

    void fetchMenuItems();

    return () => {
      isMounted = false;
    };
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
    setPickupWindow(draft.pickupWindow);
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

    const rawHistory = window.localStorage.getItem(ORDER_HISTORY_STORAGE_KEY);
    if (!rawHistory) return;

    const parsedHistory = parseOrderHistory(rawHistory);
    if (parsedHistory.length === 0) {
      window.localStorage.removeItem(ORDER_HISTORY_STORAGE_KEY);
      return;
    }

    setOrderHistory(parsedHistory);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const draft: PersistedOrderDraft = {
      cartLines,
      pickupWindow,
      orderType,
      paymentMethod,
      gcashReference,
      deliveryAddress,
      customerName,
      customerPhone,
      specialInstructions
    };

    window.localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [cartLines, pickupWindow, orderType, paymentMethod, gcashReference, deliveryAddress, customerName, customerPhone, specialInstructions]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (orderHistory.length === 0) {
      window.localStorage.removeItem(ORDER_HISTORY_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(orderHistory));
  }, [orderHistory]);

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

  useEffect(() => {
    if (!currentOrderId) return;

    setOrderHistory((previousHistory) => {
      const matchingEntry = previousHistory.find((entry) => entry.orderId === currentOrderId);
      if (!matchingEntry || matchingEntry.status === orderStatus) return previousHistory;

      return upsertOrderHistory(previousHistory, {
        ...matchingEntry,
        status: orderStatus
      });
    });
  }, [currentOrderId, orderStatus]);

  const addToast = (message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2200);
  };

  const openModifier = (item: MenuItem) => {
    setSelectedItem(item);
    setSelectedSize("regular");
    setSelectedMilk("whole");
    setIsModifierOpen(true);
  };

  const addConfiguredItem = (item: MenuItem, size: SizeOption, milk: MilkOption) => {
    const lineId = `${item.id}-${size}-${milk}`;
    const unitPrice = calculateUnitPrice(item.price, size, milk);

    setCartLines((prev) => {
      const existing = prev.find((line) => line.id === lineId);
      if (!existing) {
        return [
          ...prev,
          {
            id: lineId,
            itemId: item.id,
            name: item.name,
            basePrice: item.price,
            unitPrice,
            quantity: 1,
            size,
            milk
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

    addConfiguredItem(selectedItem, selectedSize, selectedMilk);
    setIsModifierOpen(false);
    setSelectedItem(null);
    addToast("Added to cart!");
  };

  const quickAddDefault = (item: MenuItem) => {
    addConfiguredItem(item, "regular", "whole");
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
    const needsDeliveryAddress = orderType === "delivery" && deliveryAddress.trim().length === 0;
    const missingName = customerName.trim().length === 0;
    const missingPhone = customerPhone.trim().length === 0;

    if (cartLines.length === 0 || missingName || missingPhone || needsDeliveryAddress || isCheckingOut) {
      if (needsDeliveryAddress) {
        setCheckoutError("Delivery address is required for delivery orders.");
      } else if (missingName) {
        setCheckoutError("Customer name is required.");
      } else if (missingPhone) {
        setCheckoutError("Contact number is required.");
      }
      return;
    }

    setCheckoutError(null);
    setIsCartOpen(false);
    setCheckoutStep("payment");
  };

  const handleConfirmOrder = async () => {
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
      milk: line.milk
    }));

    const orderInsertPayload = {
      id: clientOrderId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      items: orderItemsPayload,
      total_price: grandTotal,
      status: "received",
      special_instructions: specialInstructions.trim() || null,
      order_type: orderType,
      payment_method: paymentMethod,
      gcash_reference: paymentMethod === "gcash" ? gcashReference.trim() : null,
      delivery_address: orderType === "delivery" ? deliveryAddress.trim() : null
    };

    const { data, error } = await supabase
      .from("orders")
      .insert([orderInsertPayload])
      .select("id, status, created_at")
      .single();

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
      paymentMethod,
      gcashReference: paymentMethod === "gcash" ? gcashReference.trim() : ""
    };

    setSubmittedOrder(submittedSnapshot);
    setOrderHistory((previousHistory) =>
      upsertOrderHistory(previousHistory, {
        ...submittedSnapshot,
        status: normalizedStatus,
        customerName: customerName.trim() || "Guest",
        specialInstructions: specialInstructions.trim(),
        pickupWindow,
        orderType
      })
    );

    setCurrentOrderId(data.id);
    setCartLines([]);
    setIsCartOpen(false);
    setShowReceipt(false);
    setOrderStatus(normalizedStatus);
    setOrderPlaced(true);
    setCheckoutStep("tracking");
    setIsCheckingOut(false);
  };

  const handleAdvanceForTesting = () => {
    setOrderStatus((previousStatus) => {
      if (previousStatus === "received") return "brewing";
      if (previousStatus === "brewing") return "ready";
      return previousStatus;
    });
  };

  const restoreOrderFromHistory = async (entry: OrderHistoryEntry, destination: "tracking" | "receipt") => {
    setHistoryError(null);
    setRestoringOrderId(entry.orderId);

    let latestStatus = entry.status;

    const { data, error } = await supabase
      .from("orders")
      .select("status")
      .eq("id", entry.orderId)
      .maybeSingle();

    if (error) {
      setHistoryError("Could not refresh order status. Showing last saved details.");
    } else if (data?.status) {
      latestStatus = normalizeOrderStatus(data.status);
    }

    const hydratedEntry = latestStatus === entry.status
      ? entry
      : {
          ...entry,
          status: latestStatus
        };

    setOrderHistory((previousHistory) => upsertOrderHistory(previousHistory, hydratedEntry));
    setSubmittedOrder({
      orderId: hydratedEntry.orderId,
      createdAt: hydratedEntry.createdAt,
      lines: hydratedEntry.lines.map((line) => ({ ...line })),
      totalPrice: hydratedEntry.totalPrice,
      paymentMethod: hydratedEntry.paymentMethod,
      gcashReference: hydratedEntry.gcashReference
    });

    setCurrentOrderId(hydratedEntry.orderId);
    setPickupWindow(hydratedEntry.pickupWindow);
    setOrderType(hydratedEntry.orderType);
    setPaymentMethod(hydratedEntry.paymentMethod);
    setGcashReference(hydratedEntry.gcashReference);
    setCustomerName(hydratedEntry.customerName);
    setSpecialInstructions(hydratedEntry.specialInstructions);
    setCheckoutError(null);
    setOrderStatus(hydratedEntry.status);
    setOrderPlaced(true);
    setCheckoutStep("tracking");
    setShowReceipt(destination === "receipt");
    setIsCartOpen(false);
    setRestoringOrderId((currentId) => (currentId === entry.orderId ? null : currentId));
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
    setPickupWindow("in-10");
    setCheckoutError(null);
    setHistoryError(null);
  };

  return (
    <div className="shell order-page-v2" id="home">
      <Navbar cartCount={cartCount} onCartClick={openCartView} hrefPrefix="/" />

      <main className="order-shell">
        {!orderPlaced ? checkoutStep === "payment" ? (
          <section className="order-timeline" aria-live="polite">
            <header className="order-payment-head">
              <button type="button" className="order-secondary-btn" onClick={openCartView}>
                Back to Cart
              </button>
              <h2>Payment Details</h2>
            </header>

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
            <Hero
              title="Order Flow."
              subtitle="Connected Experience"
              description="Same Espressonism story, now with instant pickup ordering. Select your drinks, choose your window, and keep moving."
              actions={[
                {
                  label: "Jump to Menu",
                  variant: "primary",
                  onClick: () => {
                    const section = document.getElementById("order-menu");
                    if (section) smoothScrollToElement(section);
                  }
                },
                { label: "Clear Cart", variant: "ghost", onClick: clearCart }
              ]}
              cardContent={
                <>
                  <h2 className="order-hero-card-title" style={{ marginTop: 0 }}>
                    Today Highlights
                  </h2>
                  <p className="order-hero-card-copy">Quick tap adds the default build. For custom size and milk, use Customize below.</p>
                  {isMenuLoading ? (
                    <p className="order-highlight-meta">Loading live menu...</p>
                  ) : menuError ? (
                    <p className="order-highlight-meta" role="alert">{menuError}</p>
                  ) : (
                    <div className="order-highlight-list" role="list" aria-label="Quick add highlights">
                      {highlightItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="order-highlight-item"
                          onClick={() => quickAddDefault(item)}
                          role="listitem"
                          aria-label={`Add ${item.name} to cart`}
                        >
                          <span className="order-highlight-main">
                            <strong>{item.name}</strong>
                            <span>PHP {item.price.toFixed(0)}</span>
                          </span>
                          <span className="order-highlight-add">Add +</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="order-highlight-meta">
                    Cart now has {cartCount} item{cartCount === 1 ? "" : "s"}.
                  </p>
                </>
              }
            />

            {orderHistory.length > 0 ? (
              <section className="order-history-panel" aria-label="Recent order history">
                <header className="order-history-head">
                  <div>
                    <p className="order-kicker">Order History</p>
                    <h2>Need your receipt again?</h2>
                  </div>
                  <p>Saved on this device for quick access.</p>
                </header>

                {historyError ? (
                  <p className="order-history-error" role="alert">
                    {historyError}
                  </p>
                ) : null}

                <div className="order-history-list" role="list">
                  {orderHistory.map((entry) => {
                    const isRestoring = restoringOrderId === entry.orderId;
                    const createdAtLabel = new Date(entry.createdAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Manila"
                    });

                    return (
                      <article key={entry.orderId} className="order-history-card" role="listitem">
                        <div className="order-history-main">
                          <p className="order-history-id">Order {entry.orderId.slice(0, 8).toUpperCase()}</p>
                          <p className="order-history-meta">
                            {createdAtLabel} | {entry.orderType === "delivery" ? "Delivery" : "Pickup"} | {orderStatusLabel(entry.status)}
                          </p>
                          <p className="order-history-meta">
                            {entry.customerName} | PHP {entry.totalPrice.toFixed(2)}
                          </p>
                        </div>

                        <div className="order-history-actions">
                          <button
                            type="button"
                            className="order-secondary-btn"
                            onClick={() => void restoreOrderFromHistory(entry, "tracking")}
                            disabled={isRestoring}
                          >
                            {isRestoring ? "Opening..." : "Continue Order"}
                          </button>
                          <button
                            type="button"
                            className="order-primary-btn"
                            onClick={() => void restoreOrderFromHistory(entry, "receipt")}
                            disabled={isRestoring}
                          >
                            Open Receipt
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="order-main-grid order-main-grid-single" id="order-menu" aria-label="Order interface">
              <div>
                <CategoryTabs activeCategory={activeCategory} onChange={setActiveCategory} />
                {isMenuLoading ? (
                  <p className="order-empty">Loading menu...</p>
                ) : menuError ? (
                  <p className="order-empty" role="alert">{menuError}</p>
                ) : filteredItems.length === 0 ? (
                  <p className="order-empty">No menu items found for this category.</p>
                ) : (
                  <MenuGrid items={filteredItems} quantities={quantities} onSelectItem={openModifier} />
                )}
              </div>
            </section>

            <button
              type="button"
              className={`view-cart-fab ${isCartBumping ? "view-cart-fab-bump" : ""}`}
              onClick={openCartView}
            >
              View Cart ({cartCount})
            </button>

            <ModifierModal
              isOpen={isModifierOpen}
              item={selectedItem}
              size={selectedSize}
              milk={selectedMilk}
              finalPrice={modifierFinalPrice}
              onSizeChange={setSelectedSize}
              onMilkChange={setSelectedMilk}
              onClose={() => {
                setIsModifierOpen(false);
                setSelectedItem(null);
              }}
              onAddToCart={handleAddFromModifier}
            />

            <CartModal
              isOpen={isCartOpen}
              lines={cartLines}
              subtotal={subtotal}
              serviceFee={serviceFee}
              grandTotal={grandTotal}
              isCheckingOut={isCheckingOut}
              checkoutError={checkoutError}
              orderType={orderType}
              paymentMethod={paymentMethod}
              deliveryAddress={deliveryAddress}
              pickupWindow={pickupWindow}
              customerName={customerName}
              customerPhone={customerPhone}
              specialInstructions={specialInstructions}
              onOrderTypeChange={setOrderType}
              onPaymentMethodChange={setPaymentMethod}
              onDeliveryAddressChange={setDeliveryAddress}
              onPickupWindowChange={setPickupWindow}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              onSpecialInstructionsChange={setSpecialInstructions}
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
            paymentMethod={submittedOrder.paymentMethod}
            gcashReference={submittedOrder.gcashReference}
            onReset={resetOrder}
          />
        ) : (
          <OrderTimeline
            orderNumber={orderNumber}
            pickupLabel={pickupText(pickupWindow)}
            orderStatus={orderStatus}
            customerName={customerName || "Guest"}
            specialInstructions={specialInstructions}
            onAdvanceForTesting={handleAdvanceForTesting}
            onReady={() => setShowReceipt(true)}
            onReset={resetOrder}
          />
        )}
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
