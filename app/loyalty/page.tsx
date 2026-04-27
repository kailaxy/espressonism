"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { AuthModal, Navbar, Skeleton, SkeletonGroup, SkeletonListRow } from "../components";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

type LoyaltyProfileRow = {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  current_stamps: number;
  total_stamps_earned: number;
};

type ArchivedOrderRow = {
  id: string;
  customer_name: string | null;
  total_price: string | number | null;
  status: string | null;
  order_type: string | null;
  payment_method: string | null;
  gcash_reference: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  special_instructions: string | null;
  items: unknown;
  created_at: string;
};

type ArchivedOrderItem = {
  name: string;
  quantity: number | null;
  modifiers: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringFromKeys(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
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

function formatPeso(value: string | number | null): string {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
    return "PHP --";
  }

  return `PHP ${numericValue.toFixed(2)}`;
}

function formatOrderDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsedDate);
}

function formatOrderDateTime(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsedDate);
}

function formatOrderIdShort(orderId: string): string {
  const trimmed = orderId.trim();
  if (!trimmed) return "Unknown";

  return trimmed.slice(0, 8).toUpperCase();
}

function formatStatusLabel(status: string | null): string {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "ready") return "Ready";
  if (normalized === "brewing") return "Brewing";
  if (normalized === "received") return "Received";

  return "Completed";
}

function formatOrderTypeLabel(orderType: string | null): string {
  const normalized = orderType?.trim().toLowerCase();

  if (normalized === "delivery") return "Delivery";
  if (normalized === "pickup" || normalized === "pick-up") return "Pickup";

  return "Not specified";
}

function formatPaymentMethodLabel(paymentMethod: string | null): string {
  const normalized = paymentMethod?.trim().toLowerCase();

  if (normalized === "gcash") return "GCash";
  if (normalized === "cash") return "Cash";

  return "Not specified";
}

function parseArchivedOrderItems(items: unknown): ArchivedOrderItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((item, index) => {
    if (typeof item === "string") {
      const normalizedName = item.trim();
      return {
        name: normalizedName.length > 0 ? normalizedName : `Item ${index + 1}`,
        quantity: null,
        modifiers: []
      };
    }

    if (!isRecord(item)) {
      return {
        name: `Item ${index + 1}`,
        quantity: null,
        modifiers: []
      };
    }

    const name = getStringFromKeys(item, ["name", "itemName", "title"]) ?? `Item ${index + 1}`;
    const quantity = getPositiveNumberFromKeys(item, ["quantity", "qty"]);
    const selectedOptionsRaw = Array.isArray(item.selected_options)
      ? item.selected_options
      : Array.isArray(item.selectedOptions)
        ? item.selectedOptions
        : [];
    const selectedOptions = selectedOptionsRaw
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (isRecord(entry)) {
          return getStringFromKeys(entry, ["name"]);
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));
    const modifierCandidates = [
      getStringFromKeys(item, ["size"]),
      getStringFromKeys(item, ["milk"]),
      ...selectedOptions,
      getStringFromKeys(item, ["notes", "specialInstructions"])
    ].filter((value): value is string => Boolean(value));

    return {
      name,
      quantity,
      modifiers: modifierCandidates
    };
  });
}

export default function LoyaltyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const loyaltyFetchSeqRef = useRef(0);

  const [profile, setProfile] = useState<LoyaltyProfileRow | null>(null);
  const [orders, setOrders] = useState<ArchivedOrderRow[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      setUser(data.session?.user ?? null);
      setAuthReady(true);
    };

    void loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        setUser((previousUser) => (previousUser ? null : previousUser));
        setAuthReady(true);
        return;
      }

      const nextUser = session?.user ?? null;
      setUser((previousUser) => {
        const previousUserId = previousUser?.id ?? null;
        const nextUserId = nextUser?.id ?? null;

        if (previousUserId === nextUserId) {
          return previousUser;
        }

        return nextUser;
      });
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLoyaltyData = async () => {
      if (!userId) {
        loyaltyFetchSeqRef.current += 1;
        setProfile(null);
        setOrders([]);
        setDataError(null);
        setIsDataLoading(false);
        return;
      }

      const requestId = loyaltyFetchSeqRef.current + 1;
      loyaltyFetchSeqRef.current = requestId;

      setIsDataLoading(true);
      setDataError(null);

      const [profileResult, ordersResult] = await Promise.all([
        supabase
          .from("loyalty_profiles")
          .select("user_id, full_name, phone_number, current_stamps, total_stamps_earned")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("orders_archive")
          .select(
            "id, customer_name, total_price, status, order_type, payment_method, gcash_reference, customer_phone, delivery_address, special_instructions, items, created_at"
          )
          .eq("user_id", userId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
      ]);

      // Ignore stale responses when auth/user changes while a request is in flight.
      if (!isMounted || requestId !== loyaltyFetchSeqRef.current) return;

      if (profileResult.error || ordersResult.error) {
        setDataError("Unable to load your loyalty data right now.");
      }

      setProfile((profileResult.data as LoyaltyProfileRow | null) ?? null);
      setOrders((ordersResult.data as ArchivedOrderRow[] | null) ?? []);
      setIsDataLoading(false);
    };

    void loadLoyaltyData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const currentStamps = profile?.current_stamps ?? 0;
  const displayStamps = currentStamps % 5;
  const hasFreeDrink = displayStamps === 0 && currentStamps > 0;

  const dynamicHeader = useMemo(() => {
    if (hasFreeDrink) {
      return "Free drink unlocked.";
    }

    if (displayStamps === 4) {
      return "One more stamp to go.";
    }

    if (displayStamps === 0) {
      return "Start your next coffee cycle.";
    }

    return `${5 - displayStamps} stamps until your free drink.`;
  }, [displayStamps, hasFreeDrink]);

  return (
    <div className="shell loyalty-page-shell">
      <Navbar cartCount={0} onCartClick={() => {}} hrefPrefix="/" />

      <main className="loyalty-page-main">
        <section className="loyalty-page-headline">
          <p className="hero-kicker">Grit Coffee Account</p>
          <h1 className="hero-title loyalty-page-title">Coffee Passport</h1>
          <p className="hero-copy loyalty-page-copy">Track your delivery stamps, sync your profile details, and revisit every completed cup.</p>
        </section>

        {!authReady ? (
          <section className="loyalty-page-panel" aria-live="polite" aria-busy="true">
            <div className="loyalty-experience loyalty-page-experience" aria-hidden="true">
              <article className="loyalty-pass">
                <SkeletonGroup>
                  <Skeleton type="text" width="36%" height="0.95rem" />
                  <Skeleton type="text" width="58%" height="1.45rem" />
                  <Skeleton type="text" width="92%" />
                  <div className="loyalty-stamp-grid loyalty-stamp-grid-five">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={`loyalty-session-stamp-loading-${index}`} type="block" height="3.75rem" />
                    ))}
                  </div>
                  <Skeleton type="text" width="54%" />
                </SkeletonGroup>
              </article>

              <aside className="loyalty-details loyalty-profile-sync">
                <SkeletonGroup>
                  <Skeleton type="text" width="46%" height="1.1rem" />
                  <SkeletonListRow />
                  <SkeletonListRow />
                  <SkeletonListRow />
                  <Skeleton type="block" width="100%" height="2.25rem" />
                </SkeletonGroup>
              </aside>
            </div>
          </section>
        ) : null}

        {authReady && !user ? (
          <section className="loyalty-login-prompt" aria-live="polite">
            <h2>Sign in to view your passport</h2>
            <p>Your loyalty progress is tied to your account email and synced from completed delivery orders.</p>
            <button type="button" className="cta" onClick={() => setIsAuthModalOpen(true)}>
              Log In / Sign Up
            </button>
          </section>
        ) : null}

        {authReady && user ? (
          <>
            <section className="loyalty-page-panel">
              <div className="loyalty-experience loyalty-page-experience">
                <article className="loyalty-pass" aria-label="Your coffee passport progress">
                  <header className="loyalty-pass-header">
                    <p className="loyalty-pass-kicker">Grit Coffee Loyalty</p>
                    <h3>{dynamicHeader}</h3>
                    <p className="loyalty-pass-subtitle">
                      {hasFreeDrink
                        ? "Your next regular espresso-based drink is free. Claim it on your next order."
                        : "Every completed delivery order adds one stamp to this cycle."}
                    </p>
                  </header>

                  <div className="loyalty-stamp-grid loyalty-stamp-grid-five" role="list" aria-label="Current cycle stamp progress">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const isFilled = index < displayStamps;
                      return (
                        <div
                          key={`passport-stamp-${index + 1}`}
                          className={`loyalty-stamp ${isFilled ? "loyalty-stamp-filled" : ""}`}
                          role="listitem"
                          aria-label={`Stamp ${index + 1}${isFilled ? " collected" : " empty"}`}
                        >
                          <span>{index + 1}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="loyalty-pass-rule">
                    {hasFreeDrink ? "Free drink available now" : `${5 - displayStamps} more ${5 - displayStamps === 1 ? "stamp" : "stamps"} to unlock your reward`}
                  </p>
                </article>

                <aside className="loyalty-details loyalty-profile-sync">
                  <h4>Latest Profile Sync</h4>
                  <ul>
                    <li>
                      <span className="loyalty-dot" aria-hidden="true" />
                      Full name: {profile?.full_name?.trim() ? profile.full_name : "Not yet synced"}
                    </li>
                    <li>
                      <span className="loyalty-dot" aria-hidden="true" />
                      Phone number: {profile?.phone_number?.trim() ? profile.phone_number : "Not yet synced"}
                    </li>
                    <li>
                      <span className="loyalty-dot" aria-hidden="true" />
                      Total stamps earned: {profile?.total_stamps_earned ?? 0}
                    </li>
                  </ul>
                  <p className="loyalty-details-reward">Only completed orders with your account earn stamps.</p>
                </aside>
              </div>
            </section>

            <section className="loyalty-history">
              <div className="loyalty-history-head">
                <h2>Completed Order History</h2>
                <p>These are your archived completed orders used for loyalty tracking.</p>
              </div>

              {isDataLoading ? (
                <ul className="loyalty-history-list" aria-label="Loading completed order history" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <li className="loyalty-history-item" key={`loyalty-history-loading-${index}`}>
                      <div className="loyalty-history-summary" aria-hidden="true">
                        <div className="loyalty-history-top">
                          <div className="loyalty-history-main">
                            <Skeleton type="text" width="8.2rem" />
                            <Skeleton type="text" width="7.1rem" />
                          </div>
                          <Skeleton type="text" width="5.2rem" />
                        </div>

                        <div className="loyalty-history-summary-line">
                          <Skeleton type="block" width="5.3rem" height="1.2rem" />
                          <Skeleton type="block" width="4.7rem" height="1.2rem" />
                          <Skeleton type="block" width="4.1rem" height="1.2rem" />
                          <Skeleton type="block" width="6.6rem" height="1.2rem" />
                        </div>

                        <Skeleton type="text" width="6.8rem" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {dataError ? <p className="loyalty-page-error">{dataError}</p> : null}

              {!isDataLoading && !dataError && orders.length === 0 ? (
                <p className="loyalty-page-muted">No completed archived orders yet.</p>
              ) : null}

              {!isDataLoading && orders.length > 0 ? (
                <ul className="loyalty-history-list" aria-label="Past completed orders">
                  {orders.map((order) => {
                    const itemList = parseArchivedOrderItems(order.items);
                    const itemCount = itemList.length;
                    const customerName = order.customer_name?.trim() || "Unnamed order";
                    const phoneNumber = order.customer_phone?.trim() || "";
                    const deliveryAddress = order.delivery_address?.trim() || "";
                    const specialInstructions = order.special_instructions?.trim() || "";
                    const gcashReference = order.gcash_reference?.trim() || "";
                    const paymentLabel = formatPaymentMethodLabel(order.payment_method);

                    return (
                      <li className="loyalty-history-item" key={order.id}>
                        <details className="loyalty-history-disclosure">
                          <summary className="loyalty-history-summary">
                            <div className="loyalty-history-top">
                              <div className="loyalty-history-main">
                                <p className="loyalty-history-date">{formatOrderDateTime(order.created_at)}</p>
                                <p className="loyalty-history-id">Order #{formatOrderIdShort(order.id)}</p>
                              </div>
                              <p className="loyalty-history-total">{formatPeso(order.total_price)}</p>
                            </div>
                            <p className="loyalty-history-summary-line">
                              <span>{formatStatusLabel(order.status)}</span>
                              <span>{formatOrderTypeLabel(order.order_type)}</span>
                              <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                              <span>{customerName}</span>
                            </p>
                            <p className="loyalty-history-summary-toggle" aria-hidden="true">
                              Order details
                            </p>
                          </summary>

                          <div className="loyalty-history-expanded">
                            <div className="loyalty-history-meta" role="list" aria-label={`Order ${formatOrderIdShort(order.id)} details`}>
                              <p role="listitem">
                                <span>Status:</span> {formatStatusLabel(order.status)}
                              </p>
                              <p role="listitem">
                                <span>Type:</span> {formatOrderTypeLabel(order.order_type)}
                              </p>
                              <p role="listitem">
                                <span>Name:</span> {customerName}
                              </p>
                              <p role="listitem">
                                <span>Date:</span> {formatOrderDate(order.created_at)}
                              </p>
                            </div>

                            <div className="loyalty-history-detail-grid">
                              <p className="loyalty-history-detail-line">
                                <span>Payment:</span> {paymentLabel}
                                {paymentLabel === "GCash" ? ` - Ref: ${gcashReference || "N/A"}` : ""}
                              </p>

                              {phoneNumber ? (
                                <p className="loyalty-history-detail-line">
                                  <span>Contact:</span> {phoneNumber}
                                </p>
                              ) : null}

                              {deliveryAddress ? (
                                <p className="loyalty-history-detail-line">
                                  <span>Address:</span> {deliveryAddress}
                                </p>
                              ) : null}

                              {specialInstructions ? (
                                <p className="loyalty-history-detail-line loyalty-history-detail-note">
                                  <span>Special instructions:</span> {specialInstructions}
                                </p>
                              ) : null}
                            </div>

                            <div className="loyalty-history-items-wrap">
                              <p className="loyalty-history-items-title">Items</p>
                              {itemList.length > 0 ? (
                                <ul className="loyalty-history-items" aria-label={`Items for order ${formatOrderIdShort(order.id)}`}>
                                  {itemList.map((item, index) => (
                                    <li key={`${order.id}-item-${index}`}>
                                      <p className="loyalty-history-item-line">
                                        <span>{item.quantity ? `${item.quantity}x` : "-"}</span>
                                        {item.name}
                                      </p>
                                      {item.modifiers.length > 0 ? (
                                        <p className="loyalty-history-item-modifiers">{item.modifiers.join(" • ")}</p>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="loyalty-page-muted">No item details saved for this order.</p>
                              )}
                            </div>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => {
          void (async () => {
            await supabase.auth.refreshSession();
            const { data } = await supabase.auth.getSession();
            setUser(data.session?.user ?? null);
            setAuthReady(true);
            setIsAuthModalOpen(false);
          })();
        }}
      />
    </div>
  );
}
