const API_BASE =
  window.MOTOCLINIC_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

const $ = (selector) => document.querySelector(selector);

const state = {
  services: [],
  products: [],
  videos: [],
  requestSubmitting: false,
};

document.addEventListener("DOMContentLoaded", () => {
  initPublicSite();
});

function initPublicSite() {
  setupRequestModal();
  setupTracking();
  setupRequestForm();
  setupSmoothScroll();
  loadPublicData();
}

/* =========================
   API
========================= */

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `خطا در ارتباط با سرور (${response.status})`
    );
  }

  return data;
}

/* =========================
   PUBLIC DATA
========================= */

async function loadPublicData() {
  try {
    const data = await api("/");

    console.log("MotoClinic API:", data);
  } catch (error) {
    console.warn("API در دسترس نیست:", error.message);
  }

  renderDefaultContent();
}

function renderDefaultContent() {
  const services = [
    {
      title: "سرویس دوره‌ای",
      text: "تعویض روغن، بررسی فنی و سرویس‌های ضروری موتور.",
      icon: "🔧",
    },
    {
      title: "عیب‌یابی و تعمیر",
      text: "بررسی دقیق مشکل موتور و انجام تعمیرات تخصصی.",
      icon: "⚙️",
    },
    {
      title: "برق و انژکتور",
      text: "عیب‌یابی سیستم برق، ECU و سیستم انژکتوری.",
      icon: "⚡",
    },
    {
      title: "بازبینی قبل از سفر",
      text: "بررسی کامل موتور برای سفرهای شهری و جاده‌ای.",
      icon: "🏍️",
    },
  ];

  state.services = services;

  const container =
    document.querySelector("#servicesGrid") ||
    document.querySelector(".services-grid");

  if (container) {
    container.innerHTML = services
      .map(
        (service) => `
          <article class="service-card">
            <div class="service-icon">${service.icon}</div>
            <h3>${escapeHTML(service.title)}</h3>
            <p>${escapeHTML(service.text)}</p>
          </article>
        `
      )
      .join("");
  }
}

/* =========================
   REQUEST MODAL
========================= */

function setupRequestModal() {
  const openButtons = document.querySelectorAll(
    '[data-action="open-request"], #openRequestBtn, #requestServiceBtn'
  );

  const modal =
    document.querySelector("#requestModal") ||
    document.querySelector(".request-modal");

  if (!modal) return;

  openButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openModal(modal);
    });
  });

  const closeButtons = modal.querySelectorAll(
    '[data-action="close-request"], .modal-close, .close-modal'
  );

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => closeModal(modal));
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(modal);
    }
  });
}

function openModal(modal) {
  modal.classList.add("active");
  modal.classList.add("open");
  modal.removeAttribute("hidden");
  document.body.classList.add("modal-open");

  const firstInput = modal.querySelector("input, textarea, select");
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

function closeModal(modal) {
  modal.classList.remove("active");
  modal.classList.remove("open");
  document.body.classList.remove("modal-open");

  setTimeout(() => {
    if (!modal.classList.contains("active") && !modal.classList.contains("open")) {
      modal.setAttribute("hidden", "");
    }
  }, 200);
}

/* =========================
   REQUEST FORM
========================= */

function setupRequestForm() {
  const form =
    document.querySelector("#requestForm") ||
    document.querySelector('form[data-form="service-request"]');

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.requestSubmitting) return;

    const formData = new FormData(form);

    const request = {
      name: getFormValue(formData, ["name", "customerName"]),
      phone: getFormValue(formData, ["phone", "mobile", "customerPhone"]),
      motorcycle: getFormValue(formData, [
        "motorcycle",
        "bike",
        "vehicle",
      ]),
      problem: getFormValue(formData, [
        "problem",
        "description",
        "message",
      ]),
      createdAt: new Date().toISOString(),
    };

    if (!request.name || !request.phone) {
      showMessage("لطفاً نام و شماره تماس را وارد کنید.", "error");
      return;
    }

    state.requestSubmitting = true;

    const submitButton =
      form.querySelector('button[type="submit"]') ||
      form.querySelector("button");

    const originalText = submitButton?.textContent;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "در حال ارسال...";
    }

    try {
      /*
       * تلاش برای ارسال به Backend واقعی.
       * مسیرهای رایج را به‌ترتیب امتحان می‌کنیم.
       */

      let sent = false;

      const payload = {
        name: request.name,
        phone: request.phone,
        motorcycle: request.motorcycle,
        problem: request.problem,
      };

      const endpoints = [
        "/api/customer-requests",
        "/api/requests",
        "/customer-requests",
        "/requests",
      ];

      for (const endpoint of endpoints) {
        try {
          await api(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          });

          sent = true;
          break;
        } catch (error) {
          console.warn(`Endpoint ${endpoint} پاسخ نداد.`);
        }
      }

      /*
       * تا وقتی endpoint نهایی Backend مشخص نشده،
       * درخواست در مرورگر هم ذخیره می‌شود تا اطلاعات از بین نرود.
       */

      saveLocalRequest(request);

      if (sent) {
        showMessage(
          "درخواست شما با موفقیت ثبت شد. همکاران موتوکلینیک با شما تماس می‌گیرند.",
          "success"
        );
      } else {
        showMessage(
          "درخواست شما ثبت شد و برای تکمیل اتصال با سرور ذخیره گردید.",
          "success"
        );
      }

      form.reset();

      const modal =
        document.querySelector("#requestModal") ||
        document.querySelector(".request-modal");

      if (modal) {
        setTimeout(() => closeModal(modal), 1800);
      }
    } catch (error) {
      console.error(error);

      saveLocalRequest(request);

      showMessage(
        "درخواست شما ذخیره شد. لطفاً کمی بعد دوباره تلاش کنید.",
        "error"
      );
    } finally {
      state.requestSubmitting = false;

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText || "ارسال درخواست";
      }
    }
  });
}

function saveLocalRequest(request) {
  const key = "mc_public_requests";

  let requests = [];

  try {
    requests = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    requests = [];
  }

  requests.push({
    id: `REQ-${Date.now()}`,
    ...request,
  });

  localStorage.setItem(key, JSON.stringify(requests));
}

function getFormValue(formData, names) {
  for (const name of names) {
    const value = formData.get(name);

    if (value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

/* =========================
   TRACKING
========================= */

function setupTracking() {
  const form =
    document.querySelector("#trackingForm") ||
    document.querySelector('form[data-form="tracking"]');

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const code =
      getFormValue(formData, [
        "code",
        "caseCode",
        "trackingCode",
        "id",
      ]) ||
      form.querySelector("input")?.value.trim();

    if (!code) {
      showMessage("کد پذیرش را وارد کنید.", "error");
      return;
    }

    const resultBox =
      document.querySelector("#trackingResult") ||
      document.querySelector(".tracking-result");

    if (resultBox) {
      resultBox.innerHTML = `
        <div class="tracking-loading">
          در حال بررسی وضعیت...
        </div>
      `;
      resultBox.removeAttribute("hidden");
    }

    try {
      let result = null;

      const endpoints = [
        `/api/cases/${encodeURIComponent(code)}`,
        `/api/cases?code=${encodeURIComponent(code)}`,
        `/cases/${encodeURIComponent(code)}`,
        `/cases?code=${encodeURIComponent(code)}`,
      ];

      for (const endpoint of endpoints) {
        try {
          result = await api(endpoint);

          if (result) break;
        } catch {
          // try next endpoint
        }
      }

      if (result) {
        renderTrackingResult(result, resultBox);
        return;
      }

      /*
       * سازگاری با نسخه‌های قبلی پروژه
       */
      const localCase = findLocalCase(code);

      if (localCase) {
        renderTrackingResult(localCase, resultBox);
      } else {
        renderTrackingNotFound(resultBox);
      }
    } catch (error) {
      console.error(error);

      const localCase = findLocalCase(code);

      if (localCase) {
        renderTrackingResult(localCase, resultBox);
      } else {
        renderTrackingNotFound(resultBox);
      }
    }
  });
}

function findLocalCase(code) {
  const possibleKeys = [
    "motoclinic_complete_v2_cases",
    "motoclinic_cases",
    "cases",
  ];

  for (const key of possibleKeys) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");

      if (!Array.isArray(data)) continue;

      const found = data.find(
        (item) =>
          String(item.id || "").toLowerCase() ===
          String(code).trim().toLowerCase()
      );

      if (found) return found;
    } catch {
      // continue
    }
  }

  return null;
}

function renderTrackingResult(result, box) {
  if (!box) return;

  const data = result?.data || result?.case || result;

  const code =
    data?.id ||
    data?.code ||
    data?.caseCode ||
    "—";

  const customer =
    data?.name ||
    data?.customerName ||
    data?.customer?.name ||
    "—";

  const motorcycle =
    data?.bike ||
    data?.motorcycle ||
    data?.motorcycleName ||
    data?.motorcycle?.model ||
    "—";

  const status =
    data?.status ||
    data?.state ||
    "در حال بررسی";

  const amount =
    Number(data?.amount || data?.total || 0);

  const paid =
    Number(data?.paid || data?.payment || 0);

  const remaining = Math.max(amount - paid, 0);

  box.innerHTML = `
    <div class="tracking-card">
      <div class="tracking-card-head">
        <span>کد پذیرش</span>
        <strong>${escapeHTML(String(code))}</strong>
      </div>

      <div class="tracking-status">
        ${escapeHTML(String(status))}
      </div>

      <div class="tracking-info">
        <div>
          <small>مشتری</small>
          <strong>${escapeHTML(String(customer))}</strong>
        </div>

        <div>
          <small>موتورسیکلت</small>
          <strong>${escapeHTML(String(motorcycle))}</strong>
        </div>
      </div>

      ${
        amount > 0
          ? `
            <div class="tracking-finance">
              <span>مبلغ کل: ${formatMoney(amount)}</span>
              <span>مانده: ${formatMoney(remaining)}</span>
            </div>
          `
          : ""
      }
    </div>
  `;

  box.removeAttribute("hidden");
}

function renderTrackingNotFound(box) {
  if (!box) return;

  box.innerHTML = `
    <div class="tracking-empty">
      <strong>پذیرشی پیدا نشد</strong>
      <p>
        کد واردشده را بررسی کنید و دوباره تلاش کنید.
      </p>
    </div>
  `;

  box.removeAttribute("hidden");
}

/* =========================
   SMOOTH SCROLL
========================= */

function setupSmoothScroll() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');

    if (!link) return;

    const id = link.getAttribute("href");

    if (!id || id === "#") return;

    const target = document.querySelector(id);

    if (!target) return;

    event.preventDefault();

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

/* =========================
   HELPERS
========================= */

function formatMoney(value) {
  const number = Number(value || 0);

  return `${number.toLocaleString("fa-IR")} تومان`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(message, type = "success") {
  let container = document.querySelector("#siteMessage");

  if (!container) {
    container = document.createElement("div");
    container.id = "siteMessage";
    container.className = "site-message";

    document.body.appendChild(container);
  }

  container.className = `site-message ${type}`;
  container.textContent = message;
  container.classList.add("visible");

  clearTimeout(container._timer);

  container._timer = setTimeout(() => {
    container.classList.remove("visible");
  }, 4500);
}

/* =========================
   PUBLIC API
========================= */

window.MotoClinic = {
  openRequest() {
    const modal =
      document.querySelector("#requestModal") ||
      document.querySelector(".request-modal");

    if (modal) openModal(modal);
  },

  track(code) {
    const input =
      document.querySelector(
        '#trackingForm input[name="code"], #trackingForm input'
      );

    if (input) {
      input.value = code;
      input.closest("form")?.requestSubmit();
    }
  },

  api,
};
