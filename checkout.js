const checkoutForm = document.querySelector("#checkout-page-form");
const checkoutPlanLabel = document.querySelector("#checkout-plan-label");
const checkoutPlanPeriod = document.querySelector("#checkout-plan-period");
const checkoutPlanPrice = document.querySelector("#checkout-plan-price");
const checkoutTotal = document.querySelector("#checkout-total");
const addonInputs = document.querySelectorAll('input[name="addons"]');
const checkoutFeedback = document.querySelector("#checkout-feedback");
const generatePixButton = document.querySelector(".generate-pix");
const pixResultPage = document.querySelector("#pix-result-page");
const checkoutPixQr = document.querySelector("#checkout-pix-qr");
const checkoutPixEmpty = document.querySelector("#checkout-pix-empty");
const checkoutPixCode = document.querySelector("#checkout-pix-code");
const copyPixPageButton = document.querySelector(".copy-pix-page");
const checkPaymentPageButton = document.querySelector(".check-payment-page");
const checkoutDeliveryStatus = document.querySelector("#checkout-delivery-status");

const plans = {
  "15d": {
    label: "Privacy Nicolle Caroline",
    period: "15 Dias",
    price: 17.99,
  },
  "30d": {
    label: "30 Dias",
    period: "30 Dias",
    price: 62.9,
  },
  "3m": {
    label: "3 Meses",
    period: "3 Meses",
    price: 75.9,
  },
  "6m": {
    label: "6 Meses",
    period: "6 Meses",
    price: 87.9,
  },
  "upsell-6m": {
    label: "6 Meses",
    period: "6 Meses",
    price: 19.9,
  },
};

let currentOrderId = null;
let currentTransactionHash = null;
let pollTimer = null;
let pixCopyToastTimer = null;
let selectedPlanId = new URLSearchParams(window.location.search).get("planId") || "15d";
let selectedPlan = plans[selectedPlanId] || plans["15d"];
if (!plans[selectedPlanId]) selectedPlanId = "15d";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getSelectedAddons() {
  return Array.from(addonInputs)
    .filter((input) => input.checked)
    .map((input) => ({
      id: input.value,
      price: Number(input.dataset.price || 0),
    }));
}

function getTotal() {
  return getSelectedAddons().reduce((sum, addon) => sum + addon.price, selectedPlan.price);
}

function updateTotal() {
  if (checkoutPlanLabel) checkoutPlanLabel.textContent = selectedPlan.label;
  if (checkoutPlanPeriod) checkoutPlanPeriod.textContent = selectedPlan.period;
  if (checkoutPlanPrice) checkoutPlanPrice.textContent = formatCurrency(selectedPlan.price);
  if (checkoutTotal) checkoutTotal.textContent = formatCurrency(getTotal());
  if (generatePixButton) generatePixButton.textContent = `GERAR PIX - ${formatCurrency(getTotal())}`;
}

function blurCheckoutFieldOnOutsideTap(event) {
  const activeElement = document.activeElement;
  const isTextField =
    activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

  if (!isTextField || !checkoutForm?.contains(activeElement)) return;

  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("input, textarea, select")) return;

  activeElement.blur();
}

function setFeedback(message = "", type = "info") {
  if (!checkoutFeedback) return;
  checkoutFeedback.textContent = message;
  checkoutFeedback.dataset.type = type;
}

function setDeliveryStatus(message = "", type = "info") {
  if (!checkoutDeliveryStatus) return;
  checkoutDeliveryStatus.textContent = message;
  checkoutDeliveryStatus.dataset.type = type;
}

async function copyPixCode() {
  const code = checkoutPixCode?.value || "";
  if (!code) return false;

  try {
    await navigator.clipboard.writeText(code);
  } catch {
    checkoutPixCode.select();
    document.execCommand("copy");
  }

  checkoutPixCode.blur();
  return true;
}

function showPixCopyToast() {
  const toastHost = pixResultPage || document.body;
  let toast = toastHost.querySelector(".pix-copy-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "pix-copy-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toastHost.appendChild(toast);
  }

  toast.textContent = "Copiado com sucesso";
  toast.classList.remove("is-leaving");
  toast.classList.add("is-visible");
  window.clearTimeout(pixCopyToastTimer);
  pixCopyToastTimer = window.setTimeout(() => {
    toast.classList.add("is-leaving");
    toast.classList.remove("is-visible");
  }, 1300);
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

function showPixResult(data = {}) {
  if (!pixResultPage || !checkoutPixCode) return;

  checkoutPixCode.value = data.pix_code || "";
  const qrImageSource = normalizeQrImageSource(data.pix_base64, data.pix_code);

  if (checkoutPixQr && checkoutPixEmpty) {
    if (qrImageSource) {
      checkoutPixQr.src = qrImageSource;
      checkoutPixQr.classList.add("is-visible");
      checkoutPixEmpty.classList.add("is-hidden");
    } else {
      checkoutPixQr.classList.remove("is-visible");
      checkoutPixEmpty.classList.remove("is-hidden");
    }
  }

  pixResultPage.hidden = false;
  generatePixButton?.classList.add("is-hidden");
  window.requestAnimationFrame(() => {
    const targetTop = pixResultPage.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  });
}

function getTrackingData() {
  const params = new URLSearchParams(window.location.search);
  return {
    src: params.get("src") || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_term: params.get("utm_term") || "",
    utm_content: params.get("utm_content") || "",
  };
}

function getMetaAttributionData() {
  return {
    event_source_url: window.location.href,
  };
}

async function checkOrderStatus() {
  if (!currentOrderId) return;

  const response = await fetch(`/api/orders/${currentOrderId}/status`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível consultar o pedido.");
  }

  if (data.isPaid) {
    window.clearInterval(pollTimer);
    pollTimer = null;
    setDeliveryStatus("Pagamento confirmado. Seu acesso foi liberado.", "success");
    return;
  }

  setDeliveryStatus(
    "Pagamento ainda pendente. Depois de pagar, a confirmacao pode levar alguns instantes.",
    "pending"
  );
}

function startPolling() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    checkOrderStatus().catch((error) => {
      setDeliveryStatus(error.message, "error");
    });
  }, 5000);
}

addonInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateTotal();
    pixResultPage.hidden = true;
    generatePixButton?.classList.remove("is-hidden");
    currentOrderId = null;
    currentTransactionHash = null;
    setFeedback("");
    setDeliveryStatus("");
  });
});

checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(checkoutForm);
  const payload = Object.fromEntries(formData.entries());
  const addons = getSelectedAddons().map((addon) => addon.id);

  generatePixButton.disabled = true;
  generatePixButton.textContent = "GERANDO PIX...";
  setFeedback("");
  setDeliveryStatus("");

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
        deliveryPreference: "email",
        planId: selectedPlanId,
        addons,
        attribution: getMetaAttributionData(),
        tracking: getTrackingData(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível gerar o Pix.");
    }

    currentOrderId = data.order_id;
    currentTransactionHash = data.transaction_hash;
    showPixResult(data);
    setFeedback("Pix gerado. Pague usando o QR Code ou o código copia e cola.", "success");
    setDeliveryStatus(
      currentTransactionHash
      ? "Aguardando confirmação do pagamento."
      : "Pix gerado. Depois de pagar, clique em verificar pagamento.",
      "info"
    );
    startPolling();
  } catch (error) {
    setFeedback(error.message, "error");
    generatePixButton?.classList.remove("is-hidden");
  } finally {
    generatePixButton.disabled = false;
    updateTotal();
  }
});

copyPixPageButton?.addEventListener("click", async () => {
  const wasCopied = await copyPixCode();
  if (!wasCopied) return;

  showPixCopyToast();
});

checkoutPixCode?.addEventListener("pointerdown", async (event) => {
  event.preventDefault();
  const wasCopied = await copyPixCode();
  if (!wasCopied) return;

  showPixCopyToast();
});

checkPaymentPageButton?.addEventListener("click", () => {
  checkOrderStatus().catch((error) => {
    setDeliveryStatus(error.message, "error");
  });
});

document.addEventListener("pointerdown", blurCheckoutFieldOnOutsideTap);

updateTotal();
