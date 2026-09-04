(() => {
  "use strict";

  /*
   * MotoClinic Public Website
   * Frontend -> Real Backend API
   */

  const API_BASE =
    window.MOTOCLINIC_API_URL ||
    (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? "http://localhost:4000"
        : "https://motoclinic-api.onrender.com"
    );

  const REQUEST_ENDPOINT =
    `${API_BASE}/api/customer-requests`;

  const CASE_ENDPOINT =
    `${API_BASE}/api/cases`;

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));

  /* =========================
     HELPERS
  ========================= */

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

  function showMessage(
    container,
    message,
    type = "info"
  ) {
    if (!container) return;

    container.innerHTML = `
      <div class="site-message ${type}">
        ${escapeHtml(message)}
      </div>
    `;
  }

  async function apiRequest(
    url,
    options = {}
  ) {
    const response =
      await fetch(url, {
        ...options,
        headers: {
          "Content-Type":
            "application/json",
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
        "خطا در ارتباط با سرور"
      );
    }

    return data;
  }

  /* =========================
     REQUEST MODAL
  ========================= */

  const requestModal =
    $("#requestModal");

  const openRequestButtons =
    $$(
      '[data-open-request], #openRequestModal, #heroRequestBtn, #floatingRequestBtn'
    );

  const closeRequestButtons =
    $$(
      '[data-close-request], #closeRequestModal'
    );

  function openRequestModal() {
    if (!requestModal) return;

    requestModal.classList.add("open");
    requestModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );

    setTimeout(() => {
      $("#requestName")?.focus();
    }, 100);
  }

  function closeRequestModal() {
    if (!requestModal) return;

    requestModal.classList.remove("open");
    requestModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "modal-open"
    );
  }

  openRequestButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          openRequestModal();
        }
      );
    }
  );

  closeRequestButtons.forEach(
    (button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          closeRequestModal();
        }
      );
    }
  );

  requestModal?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        requestModal
      ) {
        closeRequestModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        requestModal?.classList.contains(
          "open"
        )
      ) {
        closeRequestModal();
      }
    }
  );

  /* =========================
     CUSTOMER REQUEST
  ========================= */

  const requestForm =
    $("#requestForm");

  requestForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const submitButton =
        requestForm.querySelector(
          'button[type="submit"]'
        );

      const messageBox =
        $("#requestFormMessage");

      const formData =
        new FormData(requestForm);

      const name =
        clean(
          formData.get("name") ||
          $("#requestName")?.value
        );

      const phone =
        clean(
          formData.get("phone") ||
          $("#requestPhone")?.value
        );

      const motorcycle =
        clean(
          formData.get("motorcycle") ||
          $("#requestMotorcycle")?.value
        );

      const service =
        clean(
          formData.get("service") ||
          $("#requestService")?.value
        );

      const description =
        clean(
          formData.get("description") ||
          formData.get("message") ||
          $("#requestDescription")?.value
        );

      if (!name || !phone) {
        showMessage(
          messageBox,
          "لطفاً نام و شماره تماس را وارد کنید.",
          "error"
        );
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText =
          submitButton.textContent;

        submitButton.textContent =
          "در حال ثبت درخواست...";
      }

      try {
        const result =
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

        showMessage(
          messageBox,
          result?.message ||
            "درخواست شما با موفقیت ثبت شد.",
          "success"
        );

        requestForm.reset();

        /*
         * اطلاعات آخرین درخواست فقط
         * برای تجربه کاربری در مرورگر نگهداری می‌شود.
         * مرجع اصلی اطلاعات، Database است.
         */
        if (result?.request) {
          try {
            localStorage.setItem(
              "motoclinic_last_request",
              JSON.stringify(
                result.request
              )
            );
          } catch {}
        }

        setTimeout(() => {
          closeRequestModal();
        }, 1800);
      } catch (error) {
        console.error(
          "REQUEST SUBMIT ERROR:",
          error
        );

        showMessage(
          messageBox,
          error.message ||
            "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.",
          "error"
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;

          submitButton.textContent =
            submitButton.dataset.originalText ||
            "ثبت درخواست";
        }
      }
    }
  );

  /* =========================
     TRACKING
  ========================= */

  const trackingForm =
    $("#trackingForm");

  const trackingResult =
    $("#trackingResult");

  function getStatusLabel(status) {
    const labels = {
      OPEN: "باز",
      DIAGNOSIS:
        "در حال عیب‌یابی",
      WAITING_APPROVAL:
        "در انتظار تأیید",
      IN_PROGRESS:
        "در حال تعمیر",
      WAITING_PARTS:
        "در انتظار قطعه",
      READY:
        "آماده تحویل",
      COMPLETED:
        "تکمیل شده",
      CLOSED:
        "بسته شده",
    };

    return (
      labels[status] ||
      status ||
      "نامشخص"
    );
  }

  function renderCase(caseData) {
    if (!trackingResult) return;

    if (!caseData) {
      showMessage(
        trackingResult,
        "پرونده‌ای با این کد پیدا نشد.",
        "error"
      );
      return;
    }

    const customerName =
      caseData.customer_name ||
      "مشتری";

    const motorcycle =
      [
        caseData.motorcycle_brand,
        caseData.motorcycle_model,
      ]
        .filter(Boolean)
        .join(" ") ||
      "موتورسیکلت";

    const plate =
      caseData.motorcycle_plate ||
      "ثبت نشده";

    const status =
      getStatusLabel(
        caseData.status
      );

    const complaint =
      caseData.complaint ||
      "ثبت نشده";

    trackingResult.innerHTML = `
      <div class="tracking-card">
        <div class="tracking-card-head">
          <div>
            <span class="tracking-eyebrow">
              وضعیت پرونده
            </span>

            <h3>
              ${escapeHtml(
                customerName
              )}
            </h3>
          </div>

          <span class="tracking-status">
            ${escapeHtml(status)}
          </span>
        </div>

        <div class="tracking-grid">
          <div>
            <small>موتورسیکلت</small>
            <strong>
              ${escapeHtml(
                motorcycle
              )}
            </strong>
          </div>

          <div>
            <small>پلاک</small>
            <strong>
              ${escapeHtml(plate)}
            </strong>
          </div>

          <div>
            <small>شرح مشکل</small>
            <strong>
              ${escapeHtml(
                complaint
              )}
            </strong>
          </div>
        </div>
      </div>
    `;
  }

  trackingForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const input =
        trackingForm.querySelector(
          'input[name="code"], #trackingCode'
        );

      const button =
        trackingForm.querySelector(
          'button[type="submit"]'
        );

      const code =
        clean(input?.value);

      if (!code) {
        showMessage(
          trackingResult,
          "کد پیگیری را وارد کنید.",
          "error"
        );
        return;
      }

      if (button) {
        button.disabled = true;
        button.dataset.originalText =
          button.textContent;
        button.textContent =
          "در حال بررسی...";
      }

      try {
        /*
         * Backend برای GET /api/cases?code=
         * پشتیبانی شده است.
         */
        const url =
          `${CASE_ENDPOINT}?code=${encodeURIComponent(
            code
          )}`;

        const result =
          await apiRequest(url);

        const foundCase =
          result?.case ||
          result?.cases?.[0] ||
          null;

        renderCase(foundCase);
      } catch (error) {
        console.error(
          "TRACKING ERROR:",
          error
        );

        showMessage(
          trackingResult,
          error.message ||
            "خطا در دریافت وضعیت پرونده.",
          "error"
        );
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent =
            button.dataset.originalText ||
            "پیگیری";
        }
      }
    }
  );

  /* =========================
     SMOOTH SCROLL
  ========================= */

  $$('a[href^="#"]').forEach(
    (link) => {
      link.addEventListener(
        "click",
        (event) => {
          const targetId =
            link.getAttribute("href");

          if (
            !targetId ||
            targetId === "#"
          ) {
            return;
          }

          const target =
            document.querySelector(
              targetId
            );

          if (!target) return;

          event.preventDefault();

          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

          /*
           * اگر منوی موبایل در CSS/HTML
           * وجود داشته باشد، بسته شود.
           */
          document.body.classList.remove(
            "menu-open"
          );
        }
      );
    }
  );

  /* =========================
     MOBILE MENU
  ========================= */

  const menuButton =
    $("#mobileMenuButton");

  const mobileMenu =
    $("#mobileMenu");

  menuButton?.addEventListener(
    "click",
    () => {
      mobileMenu?.classList.toggle(
        "open"
      );

      document.body.classList.toggle(
        "menu-open"
      );
    }
  );

  /* =========================
     PHONE NUMBER
  ========================= */

  $$(
    'input[type="tel"], input[name="phone"]'
  ).forEach((input) => {
    input.addEventListener(
      "input",
      () => {
        input.value =
          input.value.replace(
            /[^0-9+\-\s()]/g,
            ""
          );
      }
    );
  });

  /* =========================
     API STATUS
  ========================= */

  async function checkApi() {
    try {
      const result =
        await fetch(
          `${API_BASE}/api/health`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      if (!result.ok) {
        throw new Error(
          "API unavailable"
        );
      }

      return true;
    } catch (error) {
      console.warn(
        "MotoClinic API is currently unavailable.",
        error
      );

      return false;
    }
  }

  /* =========================
     INITIALIZATION
  ========================= */

  window.MotoClinic = {
    API_BASE,
    openRequestModal,
    closeRequestModal,
    checkApi,
  };

  checkApi();

  console.log(
    "MotoClinic Public Website initialized:",
    API_BASE
  );
})();
