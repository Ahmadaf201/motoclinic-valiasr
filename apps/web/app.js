(() => {
  "use strict";

  /*
   * MotoClinic Public Website
   * Frontend API connection
   */

  const API_BASE =
    window.MOTOCLINIC_API_URL ||
    (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "https://motoclinic-api.onrender.com");

  const REQUEST_ENDPOINT = `${API_BASE}/api/customer-requests`;
  const CASE_ENDPOINT = `${API_BASE}/api/cases`;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  function clean(value) {
    return String(value ?? "").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.className = `site-message ${type}`;
    element.hidden = false;
  }

  function hideMessage(element) {
    if (!element) return;

    element.hidden = true;
    element.textContent = "";
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message || `خطای سرور (${response.status})`
      );
    }

    return data;
  }

  /* =========================
     MOBILE MENU
  ========================= */

  const menuButton = $("[data-menu-toggle]");
  const mobileMenu = $("[data-mobile-menu]");

  if (menuButton && mobileMenu) {
    menuButton.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.toggle("is-open");

      menuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    });

    $$("#siteNav a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileMenu.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* =========================
     REQUEST MODAL
  ========================= */

  const requestModal = $("#requestModal");
  const openRequestButtons = $$(
    "[data-open-request], #openRequest, #heroRequestButton"
  );
  const closeRequestButtons = $$(
    "[data-close-request], #closeRequest"
  );

  function openRequestModal() {
    if (!requestModal) return;

    requestModal.classList.add("is-open");
    requestModal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    setTimeout(() => {
      $("#requestName")?.focus();
    }, 100);
  }

  function closeRequestModal() {
    if (!requestModal) return;

    requestModal.classList.remove("is-open");
    requestModal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");
  }

  openRequestButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openRequestModal();
    });
  });

  closeRequestButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeRequestModal();
    });
  });

  if (requestModal) {
    requestModal.addEventListener("click", (event) => {
      if (event.target === requestModal) {
        closeRequestModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeRequestModal();
    }
  });

  /* =========================
     REQUEST FORM
  ========================= */

  const requestForm = $("#requestForm");
  const requestFormMessage = $("#requestFormMessage");

  if (requestForm) {
    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      hideMessage(requestFormMessage);

      const name =
        clean($("#requestName")?.value);

      const phone =
        clean($("#requestPhone")?.value);

      const motorcycle =
        clean($("#requestMotorcycle")?.value);

      const service =
        clean($("#requestService")?.value);

      const description =
        clean($("#requestDescription")?.value);

      if (!name) {
        showMessage(
          requestFormMessage,
          "لطفاً نام خود را وارد کنید.",
          "error"
        );
        $("#requestName")?.focus();
        return;
      }

      if (!phone) {
        showMessage(
          requestFormMessage,
          "لطفاً شماره تماس خود را وارد کنید.",
          "error"
        );
        $("#requestPhone")?.focus();
        return;
      }

      const phoneDigits = phone.replace(/\D/g, "");

      if (phoneDigits.length < 10) {
        showMessage(
          requestFormMessage,
          "شماره تماس واردشده معتبر نیست.",
          "error"
        );
        $("#requestPhone")?.focus();
        return;
      }

      const submitButton =
        requestForm.querySelector(
          'button[type="submit"]'
        );

      const originalText =
        submitButton?.textContent || "ثبت درخواست";

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "در حال ثبت...";
      }

      try {
        const data = await apiRequest(
          REQUEST_ENDPOINT,
          {
            method: "POST",
            body: JSON.stringify({
              name,
              phone,
              motorcycle,
              service,
              description,
            }),
          }
        );

        if (data?.request) {
          localStorage.setItem(
            "motoclinic_last_request",
            JSON.stringify(data.request)
          );
        }

        showMessage(
          requestFormMessage,
          data?.message ||
            "درخواست شما با موفقیت ثبت شد.",
          "success"
        );

        requestForm.reset();

        setTimeout(() => {
          closeRequestModal();
        }, 1800);
      } catch (error) {
        console.error(
          "Customer request error:",
          error
        );

        showMessage(
          requestFormMessage,
          error.message ||
            "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.",
          "error"
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  /* =========================
     TRACKING
  ========================= */

  const trackingForm = $("#trackingForm");
  const trackingResult = $("#trackingResult");

  function statusLabel(status) {
    const value = clean(status).toUpperCase();

    const labels = {
      RECEIVED: "دریافت موتور",
      INSPECTION: "در حال بررسی",
      DIAGNOSIS: "تشخیص عیب",
      WAITING_APPROVAL: "در انتظار تأیید",
      APPROVED: "تأیید شده",
      IN_PROGRESS: "در حال تعمیر",
      WAITING_PART: "در انتظار قطعه",
      READY: "آماده تحویل",
      DELIVERED: "تحویل شده",
      COMPLETED: "تکمیل شده",
      CANCELLED: "لغو شده",
      NEW: "جدید",
    };

    return labels[value] || status || "نامشخص";
  }

  function renderTrackingCase(caseData) {
    if (!trackingResult) return;

    if (!caseData) {
      trackingResult.innerHTML = `
        <div class="tracking-empty">
          <strong>پرونده‌ای پیدا نشد.</strong>
          <span>کد پیگیری را بررسی کنید و دوباره تلاش کنید.</span>
        </div>
      `;
      return;
    }

    const customerName =
      escapeHtml(
        caseData.customer_name ||
        caseData.customerName ||
        "مشتری"
      );

    const motorcycle =
      [
        caseData.motorcycle_brand,
        caseData.motorcycle_model,
      ]
        .filter(Boolean)
        .join(" ");

    const code =
      caseData.code ||
      caseData.case_code ||
      caseData.id ||
      "—";

    const status =
      statusLabel(caseData.status);

    const description =
      caseData.description ||
      caseData.problem ||
      "توضیحی ثبت نشده است.";

    trackingResult.innerHTML = `
      <div class="tracking-card">
        <div class="tracking-card-head">
          <div>
            <small>کد پیگیری</small>
            <strong>${escapeHtml(code)}</strong>
          </div>

          <span class="tracking-status">
            ${escapeHtml(status)}
          </span>
        </div>

        <div class="tracking-info">
          <div>
            <span>مشتری</span>
            <strong>${customerName}</strong>
          </div>

          <div>
            <span>موتورسیکلت</span>
            <strong>
              ${escapeHtml(motorcycle || "ثبت نشده")}
            </strong>
          </div>

          <div>
            <span>وضعیت تعمیر</span>
            <strong>${escapeHtml(status)}</strong>
          </div>

          <div>
            <span>شرح</span>
            <strong>${escapeHtml(description)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  if (trackingForm) {
    trackingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const input =
        trackingForm.querySelector(
          'input[name="code"], #trackingCode, input'
        );

      const code = clean(input?.value);

      if (!code) {
        if (trackingResult) {
          trackingResult.innerHTML = `
            <div class="tracking-empty error">
              لطفاً کد پیگیری را وارد کنید.
            </div>
          `;
        }

        input?.focus();
        return;
      }

      const submitButton =
        trackingForm.querySelector(
          'button[type="submit"]'
        );

      const originalText =
        submitButton?.textContent || "پیگیری";

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "در حال بررسی...";
      }

      try {
        const url =
          `${CASE_ENDPOINT}?code=${encodeURIComponent(code)}`;

        const data =
          await apiRequest(url);

        const foundCase =
          data?.case ||
          data?.cases?.[0] ||
          null;

        renderTrackingCase(foundCase);
      } catch (error) {
        console.error(
          "Tracking error:",
          error
        );

        if (trackingResult) {
          trackingResult.innerHTML = `
            <div class="tracking-empty error">
              ${
                escapeHtml(
                  error.message ||
                  "خطا در دریافت اطلاعات پرونده."
                )
              }
            </div>
          `;
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  /* =========================
     PHONE INPUT
  ========================= */

  const phoneInput = $("#requestPhone");

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value =
        phoneInput.value.replace(/[^\d+\-\s]/g, "");
    });
  }

  /* =========================
     SMOOTH SCROLL
  ========================= */

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId =
        link.getAttribute("href");

      if (
        !targetId ||
        targetId === "#" ||
        targetId.length < 2
      ) {
        return;
      }

      const target =
        document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  /* =========================
     API HEALTH CHECK
  ========================= */

  async function checkApi() {
    try {
      const response =
        await fetch(`${API_BASE}/health`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

      if (!response.ok) {
        throw new Error("API unavailable");
      }

      const data =
        await response.json();

      console.log(
        "MotoClinic API:",
        data
      );

      document.documentElement.dataset.api =
        "online";
    } catch (error) {
      console.warn(
        "MotoClinic API is currently unavailable.",
        error
      );

      document.documentElement.dataset.api =
        "offline";
    }
  }

  /* =========================
     PUBLIC API
  ========================= */

  window.MotoClinic = {
    API_BASE,
    openRequestModal,
    closeRequestModal,
    checkApi,
  };

  checkApi();
})();
