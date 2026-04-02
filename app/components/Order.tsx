import { useEffect, useMemo, useRef } from "react";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: "espresso" | "signature" | "bites";
  note?: string;
}

export type SizeOption = "regular" | "large";
export type MilkOption = "whole" | "oat" | "almond";
export type OrderType = "pickup" | "delivery";
export type PaymentMethod = "cash" | "gcash";
export type TrackerStatus = "received" | "brewing" | "ready" | "completed" | "cancelled";

const MODAL_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

function getFocusableChildren(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("aria-hidden")
  );
}

function useModalKeyboardAndFocusTrap<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const modalRef = useRef<T | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modalElement = modalRef.current;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initialFocus = getFocusableChildren(modalElement)[0] ?? modalElement;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableChildren = getFocusableChildren(modalElement);
      if (focusableChildren.length === 0) {
        event.preventDefault();
        modalElement.focus();
        return;
      }

      const firstFocusable = focusableChildren[0];
      const lastFocusable = focusableChildren[focusableChildren.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstFocusable || activeElement === modalElement) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    modalElement.addEventListener("keydown", handleKeyDown);

    return () => {
      modalElement.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  return modalRef;
}

interface CategoryTabsProps {
  activeCategory: "all" | MenuItem["category"];
  onChange: (value: "all" | MenuItem["category"]) => void;
}

export function CategoryTabs({ activeCategory, onChange }: CategoryTabsProps) {
  const tabs: Array<{ id: "all" | MenuItem["category"]; label: string }> = [
    { id: "all", label: "All" },
    { id: "espresso", label: "Espresso" },
    { id: "signature", label: "Signature" },
    { id: "bites", label: "Bites" }
  ];

  return (
    <div className="order-tabs" role="tablist" aria-label="Menu categories">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeCategory === tab.id}
          className={`order-tab ${activeCategory === tab.id ? "order-tab-active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface MenuGridProps {
  items: MenuItem[];
  quantities: Record<string, number>;
  onSelectItem: (item: MenuItem) => void;
}

export function MenuGrid({ items, quantities, onSelectItem }: MenuGridProps) {
  return (
    <div className="order-menu-grid-v2">
      {items.map((item) => {
        const quantity = quantities[item.id] ?? 0;

        return (
          <article key={item.id} className="order-menu-card-v2">
            <p className="order-item-category">{item.category}</p>
            <h3>{item.name}</h3>
            <p className="order-item-description">{item.description}</p>
            {item.note ? <p className="order-item-note">{item.note}</p> : null}

            <div className="order-card-footer">
              <p className="order-price-v2">PHP {item.price.toFixed(2)}</p>
              <button
                type="button"
                className="order-customize-btn"
                onClick={() => onSelectItem(item)}
                aria-label={`Add ${item.name}`}
              >
                Add +
              </button>
            </div>

            {quantity > 0 ? <p className="order-item-cart-count">In cart: {quantity}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

export interface CartLine {
  id: string;
  itemId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  size: SizeOption;
  milk: MilkOption;
}

interface ModifierModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  size: SizeOption;
  milk: MilkOption;
  finalPrice: number;
  onSizeChange: (value: SizeOption) => void;
  onMilkChange: (value: MilkOption) => void;
  onClose: () => void;
  onAddToCart: () => void;
}

export function ModifierModal({
  isOpen,
  item,
  size,
  milk,
  finalPrice,
  onSizeChange,
  onMilkChange,
  onClose,
  onAddToCart
}: ModifierModalProps) {
  const modalRef = useModalKeyboardAndFocusTrap<HTMLElement>(isOpen, onClose);

  if (!isOpen || !item) return null;

  return (
    <div className="order-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={modalRef}
        className="order-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${item.name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="order-modal-head">
          <div>
            <p className="order-kicker">Item Modifiers</p>
            <h3>{item.name}</h3>
          </div>
          <button type="button" className="order-modal-close" onClick={onClose} aria-label="Close modifiers">
            X
          </button>
        </header>

        <p className="order-modal-description">{item.description}</p>

        <fieldset className="modifier-fieldset">
          <legend>Size</legend>
          <label>
            <input
              type="radio"
              name="size"
              value="regular"
              checked={size === "regular"}
              onChange={() => onSizeChange("regular")}
            />
            Regular
          </label>
          <label>
            <input type="radio" name="size" value="large" checked={size === "large"} onChange={() => onSizeChange("large")} />
            Large (+PHP 20)
          </label>
        </fieldset>

        <fieldset className="modifier-fieldset">
          <legend>Milk</legend>
          <label>
            <input type="radio" name="milk" value="whole" checked={milk === "whole"} onChange={() => onMilkChange("whole")} />
            Whole
          </label>
          <label>
            <input type="radio" name="milk" value="oat" checked={milk === "oat"} onChange={() => onMilkChange("oat")} />
            Oat (+PHP 50)
          </label>
          <label>
            <input type="radio" name="milk" value="almond" checked={milk === "almond"} onChange={() => onMilkChange("almond")} />
            Almond (+PHP 50)
          </label>
        </fieldset>

        <div className="order-modal-total">
          <span>Final Price</span>
          <strong>PHP {finalPrice.toFixed(2)}</strong>
        </div>

        <div className="order-modal-actions">
          <button type="button" className="order-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="order-primary-btn" onClick={onAddToCart}>
            Add to Cart
          </button>
        </div>
      </section>
    </div>
  );
}

function formatModifierText(size: SizeOption, milk: MilkOption): string {
  const sizeText = size === "large" ? "Large" : "Regular";
  const milkText = milk === "whole" ? "Whole milk" : milk === "oat" ? "Oat milk" : "Almond milk";
  return `${sizeText}, ${milkText}`;
}

interface CartModalProps {
  isOpen: boolean;
  lines: CartLine[];
  subtotal: number;
  serviceFee: number;
  grandTotal: number;
  isCheckingOut: boolean;
  checkoutError: string | null;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  deliveryAddress: string;
  pickupWindow: string;
  customerName: string;
  customerPhone: string;
  specialInstructions: string;
  onOrderTypeChange: (value: OrderType) => void;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onDeliveryAddressChange: (value: string) => void;
  onPickupWindowChange: (value: string) => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onSpecialInstructionsChange: (value: string) => void;
  onRemoveLine: (lineId: string) => void;
  onClearOrder: () => void;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartModal({
  isOpen,
  lines,
  subtotal,
  serviceFee,
  grandTotal,
  isCheckingOut,
  checkoutError,
  orderType,
  paymentMethod,
  deliveryAddress,
  pickupWindow,
  customerName,
  customerPhone,
  specialInstructions,
  onOrderTypeChange,
  onPaymentMethodChange,
  onDeliveryAddressChange,
  onPickupWindowChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onSpecialInstructionsChange,
  onRemoveLine,
  onClearOrder,
  onClose,
  onCheckout
}: CartModalProps) {
  const modalRef = useModalKeyboardAndFocusTrap<HTMLElement>(isOpen, onClose);

  if (!isOpen) return null;

  const deliveryAddressRequired = orderType === "delivery";
  const missingDeliveryAddress = deliveryAddressRequired && deliveryAddress.trim().length === 0;
  const checkoutDisabled =
    lines.length === 0 ||
    customerName.trim().length === 0 ||
    customerPhone.trim().length === 0 ||
    missingDeliveryAddress ||
    isCheckingOut;

  return (
    <div className="order-modal-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={modalRef}
        className="order-modal order-cart-modal"
        aria-label="Order summary"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="order-modal-head">
          <h2>Your Order</h2>
          <button type="button" className="order-modal-close" onClick={onClose} aria-label="Close cart">
            X
          </button>
        </header>

        {lines.length === 0 ? (
          <p className="order-empty">Choose at least one drink or bite to continue.</p>
        ) : (
          <ul className="order-line-list">
            {lines.map((line) => (
              <li key={line.id}>
                <div>
                  <strong>{line.name}</strong>
                  <span>{line.quantity} x PHP {line.unitPrice.toFixed(2)}</span>
                  <span className="order-line-modifiers">{formatModifierText(line.size, line.milk)}</span>
                </div>
                <div className="order-line-actions">
                  <em>PHP {(line.unitPrice * line.quantity).toFixed(2)}</em>
                  <button
                    type="button"
                    className="order-line-remove"
                    onClick={() => onRemoveLine(line.id)}
                    aria-label={`Remove ${line.name} from your order`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 ? (
          <button type="button" className="order-clear-btn" onClick={onClearOrder}>
            Clear Order
          </button>
        ) : null}

        <label className="order-pickup-label" htmlFor="pickupWindow">
          Pickup Window
        </label>
        <select
          id="pickupWindow"
          className="order-pickup-select"
          value={pickupWindow}
          onChange={(event) => onPickupWindowChange(event.target.value)}
        >
          <option value="in-10">In 10 minutes</option>
          <option value="in-20">In 20 minutes</option>
          <option value="in-30">In 30 minutes</option>
          <option value="custom">On my arrival</option>
        </select>

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
                  onChange={() => onOrderTypeChange("pickup")}
                />
                Pick-up
              </label>
              <label className={`checkout-choice ${orderType === "delivery" ? "checkout-choice-active" : ""}`}>
                <input
                  type="radio"
                  name="orderType"
                  value="delivery"
                  checked={orderType === "delivery"}
                  onChange={() => onOrderTypeChange("delivery")}
                />
                Delivery
              </label>
            </div>
          </fieldset>

          {deliveryAddressRequired ? (
            <label className="checkout-field" htmlFor="deliveryAddress">
              Delivery Address *
              <textarea
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(event) => onDeliveryAddressChange(event.target.value)}
                placeholder="House number, street, barangay, city"
                rows={2}
                required
              />
            </label>
          ) : null}

          <label className="checkout-field" htmlFor="customerName">
            Customer Name *
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(event) => onCustomerNameChange(event.target.value)}
              placeholder="Enter your name"
              required
            />
          </label>
          <label className="checkout-field" htmlFor="customerPhone">
            Contact Number *
            <input
              id="customerPhone"
              type="text"
              inputMode="tel"
              value={customerPhone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              placeholder="09XXXXXXXXX"
              required
            />
          </label>
          <label className="checkout-field" htmlFor="specialInstructions">
            Special Instructions
            <textarea
              id="specialInstructions"
              value={specialInstructions}
              onChange={(event) => onSpecialInstructionsChange(event.target.value)}
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
                  onChange={() => onPaymentMethodChange("cash")}
                />
                Cash
              </label>
              <label className={`checkout-choice ${paymentMethod === "gcash" ? "checkout-choice-active" : ""}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="gcash"
                  checked={paymentMethod === "gcash"}
                  onChange={() => onPaymentMethodChange("gcash")}
                />
                GCash
              </label>
            </div>
          </fieldset>
        </div>

        <div className="order-totals">
          <p>
            <span>Subtotal</span>
            <strong>PHP {subtotal.toFixed(2)}</strong>
          </p>
          <p>
            <span>Service</span>
            <strong>PHP {serviceFee.toFixed(2)}</strong>
          </p>
          <p className="order-grand-total">
            <span>Total</span>
            <strong>PHP {grandTotal.toFixed(2)}</strong>
          </p>
        </div>

        {checkoutError ? (
          <p className="order-checkout-error" role="alert">
            {checkoutError}
          </p>
        ) : null}

        <button type="button" className="order-checkout-btn-v2" disabled={checkoutDisabled} onClick={onCheckout}>
          {isCheckingOut ? "Proceeding..." : "Proceed to Payment"}
        </button>
      </aside>
    </div>
  );
}

interface OrderTimelineProps {
  orderNumber: string;
  pickupLabel: string;
  orderStatus: TrackerStatus;
  customerName: string;
  specialInstructions: string;
  onAdvanceForTesting: () => void;
  onReady: () => void;
  onReset: () => void;
}

function CoffeeBeanIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`order-stage-icon ${className}`.trim()} aria-hidden="true">
      <path
        d="M8.5 3.8c-3 0-5.3 2.2-5.3 5.1 0 4.2 4.3 8.8 7.8 11.1 3.2-2.3 7.4-6.5 7.4-10.7 0-2.9-2.2-5.1-5.1-5.1-1.8 0-3.2.9-4.3 2.1C8.7 4.9 8.6 4.4 8.5 3.8Z"
        fill="currentColor"
      />
      <path d="M12.5 6.7c-1.9 2-3.2 4.8-3.4 8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CoffeeDripIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`order-stage-icon ${className}`.trim()} aria-hidden="true">
      <path d="M6 4h12v3H6zM8 8h8l1 8H7l1-8Z" fill="currentColor" />
      <path d="M12 10v3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 15.5c.7.6.7 1.3 0 1.9-.7-.6-.7-1.3 0-1.9Z" fill="#fff" />
      <path d="M4.5 20h15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CupReadyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`order-stage-icon ${className}`.trim()} aria-hidden="true">
      <path d="M5 8.5h10.8a2.2 2.2 0 0 1 0 4.4H14.6a4.8 4.8 0 0 1-9.6 0V8.5Z" fill="currentColor" />
      <path d="M5 16h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8.4 6.2V4.8M11.2 6.2V4.2M14 6.2V4.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function OrderTimeline({
  orderNumber,
  pickupLabel,
  orderStatus,
  customerName,
  specialInstructions,
  onAdvanceForTesting,
  onReady,
  onReset
}: OrderTimelineProps) {
  const isReceived = orderStatus === "received";
  const isPreparing = orderStatus === "brewing";
  const isReady = orderStatus === "ready" || orderStatus === "completed";

  return (
    <section className="order-timeline" aria-live="polite">
      <p className="order-kicker">Order Confirmed</p>
      <h2>Ticket {orderNumber}</h2>
      <p className="order-timeline-copy">For {customerName} - Pickup: {pickupLabel}</p>
      {specialInstructions.trim() ? <p className="order-timeline-copy">Special instructions: {specialInstructions}</p> : null}

      <div className="order-stage-list">
        <article className={`order-stage-card ${isReceived ? "order-stage-card-active" : ""}`}>
          <span className={`order-stage-icon-wrap ${isReceived ? "order-stage-icon-pulse" : ""}`}>
            <CoffeeBeanIcon />
          </span>
          <div className="order-stage-content">
            <h3>Received</h3>
            {isReceived ? <p className="order-stage-copy">Selecting the best beans...</p> : <p className="order-stage-muted">Queued</p>}
          </div>
        </article>

        <article className={`order-stage-card ${isPreparing ? "order-stage-card-active" : ""}`}>
          <span className={`order-stage-icon-wrap ${isPreparing ? "order-stage-icon-bounce" : ""}`}>
            <CoffeeDripIcon />
          </span>
          <div className="order-stage-content">
            <h3>Preparing</h3>
            {isPreparing ? <p className="order-stage-copy">Brewing your perfect cup...</p> : <p className="order-stage-muted">Waiting for brew queue</p>}
          </div>
        </article>

        <article className={`order-stage-card ${isReady ? "order-stage-card-active" : ""}`}>
          <span className="order-stage-icon-wrap">
            <CupReadyIcon />
          </span>
          <div className="order-stage-content">
            <h3>Ready</h3>
            {isReady ? (
              <button type="button" className="order-ready-btn" onClick={onReady}>
                Coffee is Ready!
              </button>
            ) : (
              <p className="order-stage-muted">Cup station warming up</p>
            )}
          </div>
        </article>
      </div>

      <div className="order-timeline-actions">
        <button type="button" className="order-secondary-btn" onClick={onAdvanceForTesting}>
          Advance Stage (Test)
        </button>
        <button type="button" className="order-secondary-btn" onClick={onReset}>
          Start New Order
        </button>
      </div>
    </section>
  );
}

interface ReceiptViewProps {
  orderId: string | null;
  createdAt: string;
  lines: CartLine[];
  totalPrice: number;
  paymentMethod: PaymentMethod;
  gcashReference: string;
  onReset: () => void;
}

export function ReceiptView({
  orderId,
  createdAt,
  lines,
  totalPrice,
  paymentMethod,
  gcashReference,
  onReset
}: ReceiptViewProps) {
  const receiptPaperRef = useRef<HTMLElement | null>(null);
  const fallbackOrderNumber = useMemo(() => String(Math.floor(1000 + Math.random() * 9000)), []);
  const receiptOrderLabel = orderId ? orderId.toUpperCase() : fallbackOrderNumber;
  const createdAtLabel = useMemo(
    () =>
      new Date(createdAt).toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila"
      }),
    [createdAt]
  );

  const paymentLine = paymentMethod === "gcash"
    ? `PAID VIA GCASH - Ref: ${gcashReference || "N/A"}`
    : "TO PAY AT COUNTER";

  const handleSaveReceiptAsImage = async () => {
    if (!receiptPaperRef.current) return;

    try {
      const { toPng } = await import("html-to-image");
      const imageData = await toPng(receiptPaperRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff"
      });

      const downloadLink = document.createElement("a");
      const safeOrderId = receiptOrderLabel.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
      downloadLink.download = `espressonism-receipt-${safeOrderId || "order"}.png`;
      downloadLink.href = imageData;
      downloadLink.click();
    } catch (error) {
      console.error("Failed to save receipt image:", error);
    }
  };

  return (
    <section className="order-receipt-shell receipt-print-root" aria-live="polite">
      <article ref={receiptPaperRef} className="order-receipt-paper">
        <header className="receipt-header">
          <p>ESPRESSONISM</p>
          <p>Digital Receipt</p>
        </header>

        <div className="receipt-meta">
          <p>Order ID: {receiptOrderLabel}</p>
          <p>Date: {createdAtLabel}</p>
        </div>

        <div className="receipt-divider" />

        <ul className="receipt-line-list">
          {lines.map((line) => {
            const lineTotal = line.quantity * line.unitPrice;
            const sizeLabel = line.size === "large" ? "Large" : "Regular";
            const milkLabel = line.milk === "whole" ? "Whole" : line.milk === "oat" ? "Oat" : "Almond";

            return (
              <li key={line.id} className="receipt-line-item">
                <div className="receipt-line-main">
                  <p>{line.quantity} x {line.name}</p>
                  <p className="receipt-line-meta">{sizeLabel} / {milkLabel}</p>
                </div>
                <strong>PHP {lineTotal.toFixed(2)}</strong>
              </li>
            );
          })}
        </ul>

        <div className="receipt-divider" />

        <p className="receipt-total-row">
          <span>Total</span>
          <strong>PHP {totalPrice.toFixed(2)}</strong>
        </p>

        <p className="receipt-payment-line">{paymentLine}</p>

        <div className="receipt-print-actions">
          <button type="button" className="order-primary-btn" onClick={handleSaveReceiptAsImage}>
            Save Receipt as Image
          </button>
          <button type="button" className="order-secondary-btn" onClick={onReset}>
            Start New Order
          </button>
        </div>
      </article>
    </section>
  );
}
