const checkoutModal = document.querySelector("#checkout-modal");
const closeModalButtons = document.querySelectorAll(".modal-close");
const openCheckoutButtons = document.querySelectorAll(".open-checkout");
const ageGate = document.querySelector("#age-gate");
const ageConfirm = document.querySelector("#age-confirm");
const siteShell = document.querySelector("#site-shell");
const promoToggle = document.querySelector(".promo-toggle");
const planList = document.querySelector("#plan-list");
const bioText = document.querySelector("#bioText");
const bioToggle = document.querySelector("#bioToggle");
const previewVideos = document.querySelectorAll(".content-preview video");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutNameInput = checkoutForm?.querySelector('input[name="name"]');
const checkoutEmailInput = checkoutForm?.querySelector('input[name="email"]');
const paymentFeedback = document.querySelector("#payment-feedback");
const pixResult = document.querySelector("#pix-result");
const pixQrImage = document.querySelector("#pix-qr-image");
const pixQrEmpty = document.querySelector("#pix-qr-empty");
const pixCode = document.querySelector("#pix-code");
const copyPixButton = document.querySelector(".copy-pix-button");
const checkPaymentButton = document.querySelector(".check-payment-button");
const deliveryStatus = document.querySelector("#delivery-status");
const purchaseToast = document.querySelector("#purchase-toast");
const purchaseToastName = document.querySelector("#purchase-toast-name");
const purchaseToastClose = document.querySelector(".toast-close");
const upsellModal = document.querySelector("#upsell-modal");
const upsellModalCloseButtons = document.querySelectorAll("#upsell-modal .modal-close");
const upsellAcceptButton = document.querySelector(".upsell-accept");
const upsellDeclineButton = document.querySelector(".upsell-decline");
const selectedPlanIdInput = document.querySelector("#selected-plan-id");
const selectedPlanLabel = document.querySelector("#selected-plan-label");
const selectedPlanPrice = document.querySelector("#selected-plan-price");
const summaryPlanLabel = document.querySelector("#summary-plan-label");
const summaryPlanPrice = document.querySelector("#summary-plan-price");
const summaryOfferRow = document.querySelector("#summary-offer-row");
const summaryOfferPrice = document.querySelector("#summary-offer-price");
const checkoutTotalPrice = document.querySelector("#checkout-total-price");
const checkoutOfferAcceptedInput = document.querySelector("#checkout-offer-accepted");
const offerChoiceButtons = document.querySelectorAll("[data-offer-choice]");
const submitPaymentButton = document.querySelector(".submit-payment");
const promoValidity = document.querySelector("#promo-validity");

let currentOrderId = null;
let currentTransactionHash = null;
let pollTimer = null;
let checkoutTracked = false;
let addToCartTracked = false;
let leadTracked = false;
let purchaseTracked = false;
let latestCustomerData = null;
let latestOrderItem = null;
let isGeneratingPayment = false;
let lastPixSignature = "";
let selectedPlan = {
  id: "15d",
  label: "15 Dias",
  price: 17.99,
};
let checkoutOfferAccepted = false;

const checkoutOffer = {
  id: "ofertao",
  label: "Oferta exclusiva",
  price: 19.9,
};

const activeOrderStorageKey = "active_order";
const externalIdCookieName = "site_external_id";
const trackingStorageKey = "checkout_tracking";
const upsellStoragePrefix = "upsell_seen_";
const purchaseToastMessages = [
  "Andre Pereira assinou 3 Meses",
  "Joao Carlos assinou 15 Dias",
  "Carlos Henrique assinou 6 Meses",
  "Julio Almeida assinou 3 Meses",
  "Vinicius Campos assinou 30 Dias",
  "Rafael Lima assinou 15 Dias",
  "Lucas Martins assinou 6 Meses",
  "Bruno Oliveira assinou 30 Dias",
  "Thiago Pereira assinou 3 Meses",
  "Mateus Santos assinou 15 Dias",
  "Eduardo Costa assinou 6 Meses",
  "Felipe Rocha assinou 30 Dias",
  "Gabriel Souza assinou 3 Meses",
];
const purchaseToastTimes = ["ha 3 minutos", "ha 5 minutos", "ha 8 minutos", "ha 11 minutos"];
let purchaseToastIndex = 0;

function playPreviewVideos() {
  if (!previewVideos.length) return;

  previewVideos.forEach((video) => {
    video.muted = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    const playPromise = video.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDatePtBr(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function updatePromoValidity() {
  if (!promoValidity) return;
  promoValidity.textContent = `ESSA PROMOÇÃO É VÁLIDA ATÉ ${formatDatePtBr()}`;
}

function getPixelProductParams(plan = selectedPlan) {
  const total = getCheckoutTotal(plan);
  const contents = [
    {
      id: `site-18-nicolle-premium-${plan.id}`,
      quantity: 1,
      item_price: plan.price,
    },
  ];

  if (checkoutOfferAccepted) {
    contents.push({
      id: `site-18-nicolle-${checkoutOffer.id}`,
      quantity: 1,
      item_price: checkoutOffer.price,
    });
  }

  return {
    content_name: `Acesso Premium Nicolle - ${plan.label}${checkoutOfferAccepted ? " + Oferta exclusiva" : ""}`,
    content_type: "product",
    contents,
    content_ids: [`site-18-nicolle-premium-${plan.id}`],
    currency: "BRL",
    value: total,
  };
}

function getPurchasePixelParams() {
  return {
    ...getPixelProductParams(),
    value: getCheckoutTotal(),
    currency: "BRL",
  };
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function setCookie(name, value, days = 90) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function captureFbclid() {
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return getCookie("_fbc");

  const existing = getCookie("_fbc");
  if (existing && existing.includes(fbclid)) return existing;

  const fbc = `fb.1.${Date.now()}.${fbclid}`;
  setCookie("_fbc", fbc);
  return fbc;
}

function getOrCreateFbp() {
  const existing = getCookie("_fbp");
  if (existing) return existing;

  const randomValue = Math.floor(Math.random() * 10 ** 16);
  const fbp = `fb.1.${Date.now()}.${randomValue}`;
  setCookie("_fbp", fbp);
  return fbp;
}

function getOrCreateExternalId() {
  const existing = getCookie(externalIdCookieName);
  if (existing) return existing;

  const externalId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}.${Math.random().toString(16).slice(2)}`;
  setCookie(externalIdCookieName, externalId, 365);
  return externalId;
}

function getMetaUserData(extra = {}) {
  return {
    fbp: getOrCreateFbp(),
    fbc: captureFbclid(),
    external_id: extra.external_id || getOrCreateExternalId(),
    email: extra.email,
    phone: extra.phone,
  };
}

function getMetaAttributionData() {
  return {
    fbp: getOrCreateFbp(),
    fbc: captureFbclid(),
    external_id: getOrCreateExternalId(),
    event_source_url: window.location.href,
  };
}

function getTrackingData() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["src", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const tracking = {};

  keys.forEach((key) => {
    tracking[key] = params.get(key) || "";
  });

  try {
    const saved = JSON.parse(window.localStorage.getItem(trackingStorageKey) || "{}");
    keys.forEach((key) => {
      tracking[key] = tracking[key] || saved[key] || "";
    });
    window.localStorage.setItem(trackingStorageKey, JSON.stringify(tracking));
  } catch {
    // Tracking is helpful for attribution, but checkout must keep working without localStorage.
  }

  return tracking;
}

function createEventId(eventName) {
  if (window.crypto?.randomUUID) {
    return `${eventName}.${window.crypto.randomUUID()}`;
  }

  return `${eventName}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
}

function sendCapiEvent({ eventName, eventId, params = {}, customer = {} }) {
  return fetch("/api/meta/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: params,
      user_data: getMetaUserData(customer),
    }),
  }).catch((error) => {
    console.warn("[Meta CAPI] Falha ao enviar evento", eventName, error);
  });
}

function trackMetaEvent(eventName, params = {}, options = {}) {
  const eventId = options.eventId || createEventId(eventName);
  const customer = options.customer || latestCustomerData || {};

  if (!options.skipBrowser && typeof window.fbq === "function") {
    window.fbq("track", eventName, params, { eventID: eventId });
  }

  if (!options.skipCapi) {
    sendCapiEvent({
      eventName,
      eventId,
      params,
      customer,
    });
  }

  return eventId;
}

function trackPixel(eventName, params = {}) {
  if (typeof window.fbq === "function") {
    window.fbq("track", eventName, params);
  }
}

function getPurchaseStorageKey(orderId) {
  return `purchase_tracked_${orderId}`;
}

function hasTrackedPurchase(orderId) {
  if (!orderId) return purchaseTracked;

  try {
    return window.localStorage.getItem(getPurchaseStorageKey(orderId)) === "1";
  } catch {
    return purchaseTracked;
  }
}

function markPurchaseTracked(orderId) {
  purchaseTracked = true;

  if (!orderId) return;

  try {
    window.localStorage.setItem(getPurchaseStorageKey(orderId), "1");
  } catch {
    // Ignore storage failures; the in-memory guard still prevents repeats in this session.
  }
}

function saveActiveOrder(order = {}) {
  try {
    window.localStorage.setItem(activeOrderStorageKey, JSON.stringify(order));
  } catch {
    // The checkout still works if the browser blocks localStorage.
  }
}

function restoreActiveOrder() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(activeOrderStorageKey) || "{}");
    if (!saved.orderId) return;

    currentOrderId = saved.orderId;
    currentTransactionHash = saved.transactionHash || null;
    latestCustomerData = saved.customer || null;
    latestOrderItem = saved.item || null;
    if (saved.item?.id && saved.item?.label) {
      updateSelectedPlan(saved.item);
    }
    setCheckoutOfferAccepted(Boolean(saved.offerAccepted || saved.item?.offerAccepted), { preserveOrder: true });
    if (saved.customer && saved.item?.id) {
      lastPixSignature = [saved.item.id, saved.customer.name || "", saved.customer.email || "", checkoutOfferAccepted]
        .map((value) => String(value).trim().toLowerCase())
        .join("|");
    }
    if (saved.pixCode && pixCode) pixCode.value = saved.pixCode;

    if (saved.pixCode && pixQrImage && pixQrEmpty) {
      const qrImageSource = normalizeQrImageSource(saved.pixBase64, saved.pixCode);

      if (qrImageSource) {
        pixQrImage.src = qrImageSource;
        pixQrImage.classList.add("is-visible");
        pixQrEmpty.classList.add("is-hidden");
      }
    }
  } catch {
    // Ignore invalid persisted state.
  }
}

function clearActiveOrder() {
  try {
    window.localStorage.removeItem(activeOrderStorageKey);
  } catch {
    // Nothing to clear.
  }
}

function showPurchaseToast() {
  if (!purchaseToast || !purchaseToastName) return;

  const randomOffset = Math.floor(Math.random() * purchaseToastMessages.length);
  purchaseToastName.textContent = purchaseToastMessages[
    (purchaseToastIndex + randomOffset) % purchaseToastMessages.length
  ];
  const timeText = purchaseToast.querySelector("span");
  if (timeText) {
    timeText.textContent = purchaseToastTimes[purchaseToastIndex % purchaseToastTimes.length];
  }
  purchaseToastIndex += 1;
  purchaseToast.classList.remove("is-visible");
  purchaseToast.setAttribute("aria-hidden", "false");

  window.requestAnimationFrame(() => {
    purchaseToast.classList.add("is-visible");
  });
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return digits.replace(/(\d{2})(\d{0,4})/, "($1) $2");
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");

  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function getCheckoutTotal(plan = selectedPlan) {
  const basePrice = Number(plan?.price || 0);
  return basePrice + (checkoutOfferAccepted ? checkoutOffer.price : 0);
}

function updateCheckoutTotals() {
  const total = getCheckoutTotal();

  if (selectedPlanPrice) selectedPlanPrice.textContent = formatCurrency(selectedPlan.price);
  if (summaryPlanLabel) summaryPlanLabel.textContent = selectedPlan.label;
  if (summaryPlanPrice) summaryPlanPrice.textContent = formatCurrency(selectedPlan.price);
  if (summaryOfferPrice) summaryOfferPrice.textContent = formatCurrency(checkoutOffer.price);
  if (checkoutTotalPrice) checkoutTotalPrice.textContent = formatCurrency(total);

  if (summaryOfferRow) {
    summaryOfferRow.hidden = !checkoutOfferAccepted;
  }

  if (checkoutOfferAcceptedInput) {
    checkoutOfferAcceptedInput.value = checkoutOfferAccepted ? "true" : "false";
  }

  offerChoiceButtons.forEach((button) => {
    const isSelected = button.dataset.offerChoice === (checkoutOfferAccepted ? "yes" : "no");
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function setCheckoutOfferAccepted(value, options = {}) {
  const { preserveOrder = false } = options;
  const nextValue = Boolean(value);
  const changed = nextValue !== checkoutOfferAccepted;
  checkoutOfferAccepted = nextValue;
  updateCheckoutTotals();
  resetSubmitButton(submitPaymentButton);

  if (changed && !preserveOrder) {
    lastPixSignature = "";
    hidePixResult({ clearCode: true });
    if (currentOrderId) {
      currentOrderId = null;
      currentTransactionHash = null;
      clearActiveOrder();
    }
  }
}

function updateSelectedPlan(plan = {}) {
  const price = Number(plan.price || plan.dataset?.planPrice || selectedPlan.price);
  const label = plan.label || plan.dataset?.planLabel || selectedPlan.label;
  const id = plan.id || plan.dataset?.planId || selectedPlan.id;
  const planChanged = id !== selectedPlan.id;

  selectedPlan = { id, label, price };

  if (selectedPlanIdInput) selectedPlanIdInput.value = selectedPlan.id;
  if (selectedPlanLabel) selectedPlanLabel.textContent = selectedPlan.label;
  updateCheckoutTotals();
  if (planChanged) {
    lastPixSignature = "";
  }
  resetSubmitButton(submitPaymentButton);
}

function prefillCheckoutForm() {
  if (checkoutNameInput && latestCustomerData?.name) {
    checkoutNameInput.value = latestCustomerData.name;
  }

  if (checkoutEmailInput && latestCustomerData?.email) {
    checkoutEmailInput.value = latestCustomerData.email;
  }
}

function resetCheckoutInteraction() {
  hidePixResult({ clearCode: true });
  setFeedback("");
  isGeneratingPayment = false;
  lastPixSignature = "";
  if (submitPaymentButton) {
    submitPaymentButton.disabled = false;
    resetSubmitButton(submitPaymentButton);
  }
  if (deliveryStatus) deliveryStatus.textContent = "";
}

function openCheckout(sourceButton, options = {}) {
  const { fresh = false } = options;

  if (sourceButton?.dataset?.planId) {
    updateSelectedPlan(sourceButton);
  } else if (sourceButton?.id && sourceButton?.label && typeof sourceButton?.price !== "undefined") {
    updateSelectedPlan(sourceButton);
  }

  if (!document.body.classList.contains("checkout-page")) {
    const params = new URLSearchParams(window.location.search);
    params.set("planId", selectedPlan.id);
    window.location.href = `/checkout.html?${params.toString()}`;
    return;
  }

  if (fresh) {
    currentOrderId = null;
    currentTransactionHash = null;
    clearActiveOrder();
    checkoutForm?.reset();
    setCheckoutOfferAccepted(false);
    updateSelectedPlan(selectedPlan);
    resetCheckoutInteraction();
  }

  checkoutModal?.classList.add("is-open");
  checkoutModal?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  prefillCheckoutForm();

  if (!checkoutTracked) {
    trackMetaEvent("InitiateCheckout", getPixelProductParams());
    checkoutTracked = true;
  }

  if (currentOrderId && pixCode?.value) {
    showPixResult();
    setSubmitButtonGenerated(submitPaymentButton);
    deliveryStatus.textContent = "Consultando status do pagamento anterior...";
    checkOrderStatus().catch((error) => {
      deliveryStatus.textContent = error.message;
    });
  } else {
    hidePixResult();
    deliveryStatus.textContent = "";
  }
}

function getUpsellStorageKey(orderId) {
  return `${upsellStoragePrefix}${orderId}`;
}

function hasShownUpsell(orderId) {
  if (!orderId) return false;

  try {
    return window.localStorage.getItem(getUpsellStorageKey(orderId)) === "1";
  } catch {
    return false;
  }
}

function markUpsellShown(orderId) {
  if (!orderId) return;

  try {
    window.localStorage.setItem(getUpsellStorageKey(orderId), "1");
  } catch {
    // Ignore storage failures and let the in-memory flow continue.
  }
}

function showUpsellOffer(order) {
  if (!upsellModal || !order?.id || !order?.isPaid) return;

  const planId = order.item?.planId || selectedPlan.id;
  if (planId !== "15d" || hasShownUpsell(order.id)) return;

  markUpsellShown(order.id);
  upsellModal.classList.add("is-open");
  upsellModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeUpsellOffer() {
  upsellModal?.classList.remove("is-open");
  upsellModal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function closeCheckout() {
  checkoutModal?.classList.remove("is-open");
  checkoutModal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setFeedback(message = "", type = "info") {
  if (!paymentFeedback) return;
  paymentFeedback.textContent = message;
  paymentFeedback.dataset.type = type;
}

function hidePixResult({ clearCode = false } = {}) {
  pixResult?.classList.remove("is-open");
  pixResult?.setAttribute("aria-hidden", "true");
  pixResult?.setAttribute("hidden", "");
  if (clearCode && pixCode) pixCode.value = "";

  if (clearCode && pixQrImage && pixQrEmpty) {
    pixQrImage.removeAttribute("src");
    pixQrImage.classList.remove("is-visible");
    pixQrEmpty.classList.remove("is-hidden");
  }
}

function showPixResult() {
  if (!pixCode?.value) return;

  pixResult?.removeAttribute("hidden");
  pixResult?.classList.add("is-open");
  pixResult?.setAttribute("aria-hidden", "false");
}

function resetSubmitButton(button) {
  if (!button) return;
  button.disabled = false;
  button.textContent = `Gerar Pix de ${formatCurrency(getCheckoutTotal())}`;
}

function setSubmitButtonGenerated(button) {
  if (!button) return;
  button.disabled = true;
  button.textContent = "Pix gerado";
}

function getCheckoutSignature(payload = {}) {
  return [selectedPlan.id, payload.name || "", payload.email || "", checkoutOfferAccepted]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

function scrollToPixResult() {
  if (!pixResult) return;

  window.requestAnimationFrame(() => {
    pixResult.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function buildQrCodeUrl(pixPayload = "") {
  if (!pixPayload) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(
    pixPayload
  )}`;
}

function normalizeQrImageSource(qrImage = "", pixPayload = "") {
  const value = String(qrImage || "").trim();

  if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value) {
    return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  }

  return buildQrCodeUrl(pixPayload);
}

async function checkOrderStatus() {
  if (!currentOrderId) return;

  const response = await fetch(`/api/orders/${currentOrderId}/status`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Nao foi possivel consultar o pedido.");
  }

  if (data.isPaid) {
    window.clearInterval(pollTimer);
    pollTimer = null;
    latestOrderItem = data.item || latestOrderItem;

    deliveryStatus.innerHTML = `
      <div class="download-ready">
        <strong>Pagamento confirmado!</strong>
        <span>Seu acesso premium foi confirmado.</span>
      </div>
    `;
    if (!hasTrackedPurchase(currentOrderId)) {
      trackMetaEvent("Purchase", getPurchasePixelParams(), {
        eventId: `Purchase.${currentOrderId}`,
        skipCapi: true,
      });
      markPurchaseTracked(currentOrderId);
    }
    clearActiveOrder();
    setFeedback("Pagamento confirmado. Seu acesso foi liberado.", "success");
    showUpsellOffer({
      id: currentOrderId,
      isPaid: true,
      item: latestOrderItem || data.item || {},
    });
    return;
  }

  deliveryStatus.textContent =
    "Pagamento ainda pendente. Depois de pagar, a confirmacao pode levar alguns instantes.";
}

function startPolling() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    checkOrderStatus().catch((error) => {
      deliveryStatus.textContent = error.message;
    });
  }, 5000);
}

function unlockAgeGate() {
  ageGate?.classList.add("is-hidden");
  siteShell?.classList.add("is-ready");
  siteShell?.setAttribute("aria-hidden", "false");
  document.body.classList.remove("age-locked");
  window.setTimeout(() => {
    if (ageGate) ageGate.style.display = "none";
  }, 420);
}

ageConfirm?.addEventListener("click", unlockAgeGate);

bioToggle?.addEventListener("click", () => {
  const isExpanded = bioText?.classList.toggle("expanded");
  bioToggle.textContent = isExpanded ? "Mostrar menos" : "Mostrar mais";
});

promoToggle?.addEventListener("click", () => {
  const isExpanded = promoToggle.getAttribute("aria-expanded") === "true";
  promoToggle.setAttribute("aria-expanded", String(!isExpanded));
  planList?.classList.toggle("is-collapsed", isExpanded);
});

trackMetaEvent("PageView", {}, { eventId: window.__metaPageViewEventId, skipBrowser: true });
trackMetaEvent("ViewContent", getPixelProductParams());
updatePromoValidity();
updateCheckoutTotals();
restoreActiveOrder();

if (previewVideos.length) {
  playPreviewVideos();
  window.addEventListener("load", playPreviewVideos, { once: true });
  document.addEventListener("pointerdown", playPreviewVideos, { once: true, capture: true });
  document.addEventListener("keydown", playPreviewVideos, { once: true, capture: true });
}

window.setTimeout(showPurchaseToast, 1600);
window.setInterval(showPurchaseToast, 5000);
purchaseToastClose?.addEventListener("click", () => {
  purchaseToast?.classList.remove("is-visible");
});

upsellModalCloseButtons.forEach((button) => {
  button.addEventListener("click", closeUpsellOffer);
});

upsellDeclineButton?.addEventListener("click", closeUpsellOffer);

upsellAcceptButton?.addEventListener("click", () => {
  closeUpsellOffer();
  openCheckout({
    id: "upsell-6m",
    label: "6 Meses",
    price: 19.9,
  }, { fresh: true });
});

offerChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setCheckoutOfferAccepted(button.dataset.offerChoice === "yes");
  });
});

openCheckoutButtons.forEach((button) => button.addEventListener("click", () => openCheckout(button)));
closeModalButtons.forEach((button) => {
  button.addEventListener("click", () => {
    closeCheckout();
  });
});

checkoutModal?.addEventListener("click", (event) => {
  if (event.target === checkoutModal) closeCheckout();
});

upsellModal?.addEventListener("click", (event) => {
  if (event.target === upsellModal) closeUpsellOffer();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (upsellModal?.classList.contains("is-open")) {
      closeUpsellOffer();
      return;
    }
    closeCheckout();
  }
});

checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = checkoutForm.querySelector(".submit-payment");
  const formData = new FormData(checkoutForm);
  const payload = Object.fromEntries(formData.entries());
  const checkoutSignature = getCheckoutSignature(payload);

  if (isGeneratingPayment) return;

  if (currentOrderId && pixCode?.value && checkoutSignature === lastPixSignature) {
    showPixResult();
    scrollToPixResult();
    setSubmitButtonGenerated(submitButton);
    setFeedback("Pix ja gerado. Use o QR Code ou o copia e cola abaixo.", "success");
    return;
  }

  latestCustomerData = {
    name: payload.name,
    email: payload.email,
  };

  isGeneratingPayment = true;
  submitButton.disabled = true;
  submitButton.textContent = "Gerando Pix...";
  setFeedback("");
  deliveryStatus.textContent = "";
  hidePixResult({ clearCode: true });

  try {
    const response = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: {
          name: payload.name,
          email: payload.email,
        },
        deliveryPreference: payload.deliveryPreference,
        planId: payload.planId || selectedPlan.id,
        offerAccepted: checkoutOfferAccepted,
        attribution: getMetaAttributionData(),
        tracking: getTrackingData(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel gerar o Pix.");
    }

    currentOrderId = data.order_id;
    currentTransactionHash = data.transaction_hash;
    lastPixSignature = checkoutSignature;
    saveActiveOrder({
      orderId: currentOrderId,
      transactionHash: currentTransactionHash,
      customer: latestCustomerData,
      item: {
        ...selectedPlan,
        price: getCheckoutTotal(),
        offerAccepted: checkoutOfferAccepted,
      },
      offerAccepted: checkoutOfferAccepted,
      pixCode: data.pix_code || "",
      pixBase64: data.pix_base64 || "",
    });

    if (pixCode) pixCode.value = data.pix_code || "";

    if (pixQrImage && pixQrEmpty) {
      const qrImageSource = normalizeQrImageSource(data.pix_base64, data.pix_code);

      if (qrImageSource) {
        pixQrImage.src = qrImageSource;
        pixQrImage.classList.add("is-visible");
        pixQrEmpty.classList.add("is-hidden");
      } else {
        pixQrImage.classList.remove("is-visible");
        pixQrEmpty.classList.remove("is-hidden");
      }
    }

    showPixResult();
    scrollToPixResult();
    if (!addToCartTracked) {
      trackMetaEvent("AddToCart", getPixelProductParams(), { customer: latestCustomerData });
      addToCartTracked = true;
    }
    if (!leadTracked) {
      trackMetaEvent("Lead", getPixelProductParams(), { customer: latestCustomerData });
      leadTracked = true;
    }
    setFeedback("Pix gerado. Pague usando o QR Code ou o copia e cola.", "success");
    deliveryStatus.textContent = currentTransactionHash
      ? "Aguardando confirmacao do pagamento."
      : "Pix gerado. Depois de pagar, clique em verificar pagamento.";
    startPolling();
    setSubmitButtonGenerated(submitButton);
  } catch (error) {
    setFeedback(error.message, "error");
    resetSubmitButton(submitButton);
  } finally {
    isGeneratingPayment = false;
  }
});

checkoutForm?.addEventListener("input", () => {
  if (isGeneratingPayment) return;
  lastPixSignature = "";
  resetSubmitButton(submitPaymentButton);
});

copyPixButton?.addEventListener("click", async () => {
  const code = pixCode?.value || "";
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
  } catch {
    pixCode.select();
    document.execCommand("copy");
  }

  copyPixButton.textContent = "Codigo copiado";
  window.setTimeout(() => {
    copyPixButton.textContent = "Copiar codigo Pix";
  }, 1600);
});

checkPaymentButton?.addEventListener("click", () => {
  checkOrderStatus().catch((error) => {
    deliveryStatus.textContent = error.message;
  });
});
