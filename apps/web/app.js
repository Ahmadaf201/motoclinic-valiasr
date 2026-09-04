(() => {
  "use strict";

  const API_BASE =
    window.MOTOCLINIC_API_URL ||
    (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "https://motoclinic-api.onrender.com");

  const REQUEST_ENDPOINT =
    `${API_BASE}/api/customer-requests`;

  const CASE_ENDPOINT =
    `${API_BASE}/api/cases`;

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    document.querySelectorAll(selector);

  const clean = (value) =>
    String(value ?? "").trim();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
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
        data?.message ||
        `خطای سرور (${response.status})`
      );
    }

    return data;
  }

  /* =========================================
     REQUEST MODAL
  ========================================= */

  const requestModal =
    $("#requestModal");

  const requestForm =
    $("#requestForm");

  const requestMessage =
    $("#requestFormMessage");

  function openRequestModal() {
    if (!requestModal) {
      console.error(
        "requestModal not found"
      );
      return;
    }

    requestModal.classList.add("is-open");
    requestModal.classList.add("active");

    requestModal.setAttribute(
      "aria-hidden",
      "false"
    );

    requestModal.style.display = "flex";

    document.body.classList.add(
      "modal-open"
    );

    setTimeout(() => {
      $("#requestName")?.focus();
    }, 100);
  }

  function closeRequestModal() {
    if (!requestModal) return;

    requestModal.classList.remove("is-open");
    requestModal.classList.remove("active");

    requestModal.setAttribute(
      "aria-hidden",
      "true"
    );

    requestModal.style.display = "none";

    document.body.classList.remove(
      "modal-open"
    );
  }

  /*
   * هر دکمه‌ای که مربوط به درخواست سرویس باشد
   * شناسایی می‌شود؛ حتی اگر ID متفاوت داشته باشد.
   */

  $$(
    '[data-open-request], #openRequest, #heroRequestButton, #requestButton, #serviceRequest, .request-service-btn'
  ).forEach((button) => {
    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        openRequestModal();
      }
    );
  });

  /*
   * دکمه‌های دارای متن «درخواست سرویس»
   */

  $$("button, a").forEach((element) => {
    const text =
      clean(element.textContent);

    if (
      text.includes("درخواست سرویس") &&
      !element.dataset.requestBound
    ) {
      element.dataset.requestBound =
        "true";

      element.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          openRequestModal();
        }
      );
    }
  });

  $$(
    '[data-close-request], #closeRequest, #closeRequestModal, .modal-close'
  ).forEach((button) => {
    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        closeRequestModal();
      }
    );
  });

  if (requestModal) {
    requestModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target === requestModal
        ) {
          closeRequestModal();
        }
      }
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeRequestModal();
      }
    }
  );

  /* =========================================
     REQUEST FORM
  ========================================= */

  if (requestForm) {
    requestForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (requestMessage) {
          requestMessage.hidden = true;
          requestMessage.textContent = "";
        }

        const name =
          clean($("#requestName")?.value);

        const phone =
          clean($("#requestPhone")?.value);

        const motorcycle =
          clean(
            $("#requestMotorcycle")?.value
          );

        const service =
          clean(
            $("#requestService")?.value
          );

        const description =
          clean(
            $("#requestDescription")?.value
          );

        if (!name) {
          showFormMessage(
            "لطفاً نام خود را وارد کنید.",
            "error"
          );
          $("#requestName")?.focus();
          return;
        }

        if (!phone) {
          showFormMessage(
            "لطفاً شماره تماس خود را وارد کنید.",
            "error"
          );
          $("#requestPhone")?.focus();
          return;
        }

        const digits =
          phone.replace(/\D/g, "");

        if (digits.length < 10) {
          showFormMessage(
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
          submitButton?.textContent ||
          "ثبت درخواست";

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent =
            "در حال ثبت...";
        }

        try {
          const data =
            await apiRequest(
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
              JSON.stringify(
                data.request
              )
            );
          }

          showFormMessage(
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
            "Request error:",
            error
          );

          showFormMessage(
            error.message ||
              "ثبت درخواست انجام نشد.",
            "error"
          );
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
              originalText;
          }
        }
      }
    );
  }

  function showFormMessage(
    message,
    type
  ) {
    if (!requestMessage) {
      alert(message);
      return;
    }

    requestMessage.textContent =
      message;

    requestMessage.hidden = false;

    requestMessage.className =
      `site-message ${type}`;
  }

  /* =========================================
     TRACKING
  ========================================= */

  const trackingForm =
    $("#trackingForm");

  const trackingResult =
    $("#trackingResult");

  function statusLabel(status) {
    const value =
      clean(status).toUpperCase();

    const labels = {
      RECEIVED: "دریافت موتور",
      INSPECTION: "در حال بررسی",
      DIAGNOSIS: "تشخیص عیب",
      WAITING_APPROVAL:
        "در انتظار تأیید",
      APPROVED: "تأیید شده",
      IN_PROGRESS: "در حال تعمیر",
      WAITING_PART:
        "در انتظار قطعه",
      READY: "آماده تحویل",
      DELIVERED: "تحویل شده",
      COMPLETED: "تکمیل شده",
      CANCELLED: "لغو شده",
    };

    return (
      labels[value] ||
      status ||
      "نامشخص"
    );
  }

  function renderTrackingCase(
    caseData
  ) {
    if (!trackingResult) return;

    if (!caseData) {
      trackingResult.innerHTML = `
        <div class="tracking-empty">
          <strong>
            پرونده‌ای پیدا نشد.
          </strong>
          <span>
            کد پیگیری را بررسی کنید.
          </span>
        </div>
      `;
      return;
    }

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
      statusLabel(
        caseData.status
      );

    const customer =
      caseData.customer_name ||
      "مشتری";

    const description =
      caseData.description ||
      "توضیحی ثبت نشده است.";

    trackingResult.innerHTML = `
      <div class="tracking-card">

        <div class="tracking-card-head">

          <div>
            <small>
              کد پیگیری
            </small>

            <strong>
              ${escapeHtml(code)}
            </strong>
          </div>

          <span class="tracking-status">
            ${escapeHtml(status)}
          </span>

        </div>

        <div class="tracking-info">

          <div>
            <span>مشتری</span>
            <strong>
              ${escapeHtml(customer)}
            </strong>
          </div>

          <div>
            <span>موتورسیکلت</span>
            <strong>
              ${escapeHtml(
                motorcycle || "ثبت نشده"
              )}
            </strong>
          </div>

          <div>
            <span>وضعیت</span>
            <strong>
              ${escapeHtml(status)}
            </strong>
          </div>

          <div>
            <span>شرح</span>
            <strong>
              ${escapeHtml(description)}
            </strong>
          </div>

        </div>

      </div>
    `;
  }

  if (trackingForm) {
    trackingForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const input =
          trackingForm.querySelector(
            "input"
          );

        const code =
          clean(input?.value);

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

        const button =
          trackingForm.querySelector(
            'button[type="submit"]'
          );

        const originalText =
          button?.textContent ||
          "پیگیری وضعیت";

        if (button) {
          button.disabled = true;
          button.textContent =
            "در حال بررسی...";
        }

        try {
          const data =
            await apiRequest(
              `${CASE_ENDPOINT}?code=${encodeURIComponent(
                code
              )}`
            );

          renderTrackingCase(
            data?.case ||
              data?.cases?.[0] ||
              null
          );
        } catch (error) {
          console.error(
            "Tracking error:",
            error
          );

          if (trackingResult) {
            trackingResult.innerHTML = `
              <div class="tracking-empty error">
                ${escapeHtml(
                  error.message ||
                    "خطا در دریافت اطلاعات."
                )}
              </div>
            `;
          }
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent =
              originalText;
          }
        }
      }
    );
  }

  /* =========================================
     MOBILE MENU
  ========================================= */

  const menuButton =
    $(
      "[data-menu-toggle], #menuToggle, #mobileMenuButton"
    );

  const mobileMenu =
    $(
      "[data-mobile-menu], #mobileMenu"
    );

  if (
    menuButton &&
    mobileMenu
  ) {
    menuButton.addEventListener(
      "click",
      () => {
        const opened =
          mobileMenu.classList.toggle(
            "is-open"
          );

        mobileMenu.classList.toggle(
          "active",
          opened
        );

        menuButton.setAttribute(
          "aria-expanded",
          String(opened)
        );
      }
    );
  }

  /* =========================================
     PHONE
  ========================================= */

  const phoneInput =
    $("#requestPhone");

  if (phoneInput) {
    phoneInput.addEventListener(
      "input",
      () => {
        phoneInput.value =
          phoneInput.value.replace(
            /[^\d+\-\s]/g,
            ""
          );
      }
    );
  }

  /* =========================================
     SMOOTH SCROLL
  ========================================= */

  $$('a[href^="#"]').forEach(
    (link) => {
      link.addEventListener(
        "click",
        (event) => {
          const id =
            link.getAttribute(
              "href"
            );

          if (
            !id ||
            id === "#"
          ) {
            return;
          }

          const target =
            document.querySelector(id);

          if (!target) return;

          event.preventDefault();

          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

          mobileMenu?.classList.remove(
            "is-open"
          );

          mobileMenu?.classList.remove(
            "active"
          );
        }
      );
    }
  );

  /* =========================================
     API HEALTH
  ========================================= */

  async function checkApi() {
    try {
      const response =
        await fetch(
          `${API_BASE}/health`,
          {
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          "API unavailable"
        );
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
        "MotoClinic API unavailable",
        error
      );

      document.documentElement.dataset.api =
        "offline";
    }
  }

  window.MotoClinic = {
    API_BASE,
    openRequestModal,
    closeRequestModal,
    checkApi,
  };

  checkApi();

})();
