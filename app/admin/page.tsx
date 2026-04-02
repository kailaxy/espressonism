"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

type OrderStatus = "received" | "preparing" | "brewing" | "ready" | "completed" | "cancelled";

type DashboardOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string | null;
  delivery_address: string | null;
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

const ORDER_SELECT_FIELDS =
  "id, customer_name, customer_phone, order_type, delivery_address, payment_method, gcash_reference, items, total_price, status, created_at";
const ADMIN_AUTH_STORAGE_KEY = "espressonism-admin-auth-session-v1";

const COLUMNS: ColumnConfig[] = [
  { key: "received", title: "New Orders", subtitle: "Just placed" },
  { key: "preparing", title: "Preparing", subtitle: "In progress" },
  { key: "ready", title: "Ready", subtitle: "Pickup / handoff" }
];

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2
});

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return pesoFormatter.format(0);
  return pesoFormatter.format(value);
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

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<DashboardOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
    setPinInput("");
    setPinError(null);
    setFetchError(null);
    setActionError(null);
    setOrders([]);
    setCompletedOrders([]);
    setUpdatingOrderId(null);
    setIsDrawerOpen(false);
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

      <section
        className={`barista-sales-drawer ${isDrawerOpen ? "barista-sales-drawer-open" : ""}`}
        aria-label="Sales summary drawer"
      >
        <button
          type="button"
          className="barista-sales-drawer-toggle"
          onClick={() => setIsDrawerOpen((open) => !open)}
          aria-expanded={isDrawerOpen}
        >
          <span className="barista-sales-drawer-arrow" aria-hidden="true">
            {isDrawerOpen ? "↓" : "↑"}
          </span>
          <span>{isDrawerOpen ? "Sales Summary" : "Swipe up / Click for Sales Summary"}</span>
        </button>

        <div className="barista-sales-drawer-body">
          <div className="barista-sales-grid">
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

          <button type="button" className="barista-sales-close" onClick={() => setIsDrawerOpen(false)}>
            Close
          </button>
        </div>
      </section>
    </main>
  );
}
