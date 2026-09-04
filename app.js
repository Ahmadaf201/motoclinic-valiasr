const API_URL =
  "https://motoclinic-api.onrender.com/api";

const app =
  document.getElementById("app");

let customers = [];
let motorcycles = [];
let cases = [];

const statusLabels = {
  OPEN: "باز",
  DIAGNOSIS: "در حال عیب‌یابی",
  WAITING_APPROVAL: "در انتظار تأیید",
  IN_PROGRESS: "در حال تعمیر",
  WAITING_PARTS: "در انتظار قطعه",
  READY: "آماده تحویل",
  COMPLETED: "تکمیل شده",
  CLOSED: "بسته شده",
};

const priorityLabels = {
  LOW: "کم",
  NORMAL: "عادی",
  HIGH: "بالا",
  URGENT: "فوری",
};

async function api(path, options = {}) {
  const separator =
    path.includes("?") ? "&" : "?";

  const response = await fetch(
    `${API_URL}${path}${separator}_v=8`,
    {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      `خطای سرور ${response.status}`
    );
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return Number(value || 0)
    .toLocaleString("fa-IR");
}

function showMessage(
  message,
  type = "success"
) {
  const old =
    document.getElementById(
      "toast"
    );

  if (old) old.remove();

  const toast =
    document.createElement("div");

  toast.id = "toast";
  toast.className =
    `toast ${type}`;

  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function renderApp() {
  app.innerHTML = `
    <div class="shell">

      <header class="topbar">

        <div class="brand">
          <div class="brand-icon">🏍️</div>

          <div>
            <h1>
              موتو کلینیک
            </h1>

            <span>
              ولیعصر(عج) • مدیریت هوشمند تعمیرگاه
            </span>
          </div>
        </div>

        <div class="system-status">
          <span></span>
          سیستم آنلاین
        </div>

      </header>

      <main>

        <section class="hero">
          <div>
            <div class="eyebrow">
              مرکز مدیریت تعمیرگاه
            </div>

            <h2>
              امروز تعمیرگاهت را
              <strong>هوشمندتر</strong>
              مدیریت کن.
            </h2>

            <p>
              مشتری، موتورسیکلت و پرونده‌های تعمیر
              همه در یک سیستم یکپارچه.
            </p>
          </div>
        </section>

        <section class="stats-grid">

          <div class="stat-card">
            <div class="stat-icon">👤</div>
            <div>
              <span>مشتریان</span>
              <strong id="customers-count">
                0
              </strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">🏍️</div>
            <div>
              <span>موتورسیکلت‌ها</span>
              <strong id="motorcycles-count">
                0
              </strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">🔧</div>
            <div>
              <span>پرونده‌های فعال</span>
              <strong id="cases-count">
                0
              </strong>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div>
              <span>درآمد</span>
              <strong id="revenue-count">
                ۰ تومان
              </strong>
            </div>
          </div>

        </section>

        <section class="workspace">

          <div class="panel">

            <div class="panel-title">
              <div>
                <span class="section-number">
                  01
                </span>
                <div>
                  <h3>ثبت مشتری</h3>
                  <p>
                    اطلاعات مالک موتورسیکلت
                  </p>
                </div>
              </div>
            </div>

            <form id="customer-form">

              <div class="field">
                <label>نام و نام خانوادگی</label>
                <input
                  id="customer-name"
                  placeholder="مثلاً علی احمدی"
                  required
                >
              </div>

              <div class="field">
                <label>شماره تماس</label>
                <input
                  id="customer-phone"
                  placeholder="09xxxxxxxxx"
                  required
                >
              </div>

              <div class="field full">
                <label>آدرس</label>
                <input
                  id="customer-address"
                  placeholder="آدرس مشتری"
                >
              </div>

              <div class="field full">
                <label>یادداشت</label>
                <textarea
                  id="customer-notes"
                  placeholder="یادداشت‌های مهم مشتری..."
                ></textarea>
              </div>

              <button
                class="primary-btn full"
                type="submit"
              >
                ثبت مشتری
                <span>＋</span>
              </button>

            </form>

            <div
              class="records"
              id="customers-list"
            ></div>

          </div>

          <div class="panel">

            <div class="panel-title">
              <div>
                <span class="section-number">
                  02
                </span>
                <div>
                  <h3>ثبت موتورسیکلت</h3>
                  <p>
                    اتصال موتور به مالک
                  </p>
                </div>
              </div>
            </div>

            <form id="motorcycle-form">

              <div class="field full">
                <label>مالک</label>
                <select
                  id="motorcycle-customer"
                  required
                >
                  <option value="">
                    انتخاب مشتری
                  </option>
                </select>
              </div>

              <div class="field">
                <label>پلاک</label>
                <input
                  id="motorcycle-plate"
                  placeholder="مثلاً TEST-01"
                  required
                >
              </div>

              <div class="field">
                <label>برند</label>
                <input
                  id="motorcycle-brand"
                  placeholder="Honda"
                >
              </div>

              <div class="field">
                <label>مدل</label>
                <input
                  id="motorcycle-model"
                  placeholder="CG125"
                >
              </div>

              <div class="field">
                <label>سال</label>
                <input
                  id="motorcycle-year"
                  type="number"
                  placeholder="1403"
                >
              </div>

              <div class="field">
                <label>رنگ</label>
                <input
                  id="motorcycle-color"
                  placeholder="مشکی"
                >
              </div>

              <div class="field">
                <label>کارکرد</label>
                <input
                  id="motorcycle-mileage"
                  type="number"
                  placeholder="کیلومتر"
                >
              </div>

              <button
                class="primary-btn full"
                type="submit"
              >
                ثبت موتورسیکلت
                <span>＋</span>
              </button>

            </form>

            <div
              class="records"
              id="motorcycles-list"
            ></div>

          </div>

        </section>

        <section class="panel case-panel">

          <div class="panel-title">
            <div>
              <span class="section-number">
                03
              </span>

              <div>
                <h3>ایجاد پرونده تعمیر</h3>
                <p>
                  شروع فرآیند پذیرش و تعمیر
                </p>
              </div>
            </div>
          </div>

          <form
            id="case-form"
            class="case-form"
          >

            <div class="field">
              <label>مشتری</label>
              <select
                id="case-customer"
                required
              >
                <option value="">
                  انتخاب مشتری
                </option>
              </select>
            </div>

            <div class="field">
              <label>موتورسیکلت</label>
              <select
                id="case-motorcycle"
                required
              >
                <option value="">
                  ابتدا مشتری را انتخاب کنید
                </option>
              </select>
            </div>

            <div class="field">
              <label>اولویت</label>
              <select id="case-priority">
                <option value="LOW">
                  کم
                </option>

                <option
                  value="NORMAL"
                  selected
                >
                  عادی
                </option>

                <option value="HIGH">
                  بالا
                </option>

                <option value="URGENT">
                  فوری
                </option>
              </select>
            </div>

            <div class="field full">
              <label>شرح مشکل مشتری</label>
              <textarea
                id="case-complaint"
                placeholder="مشتری چه مشکلی را گزارش کرده است؟"
                required
              ></textarea>
            </div>

            <div class="field full">
              <label>تشخیص اولیه</label>
              <textarea
                id="case-diagnosis"
                placeholder="در صورت نیاز تشخیص اولیه را وارد کنید"
              ></textarea>
            </div>

            <button
              class="primary-btn"
              type="submit"
            >
              ایجاد پرونده
              <span>＋</span>
            </button>

          </form>

        </section>

        <section class="panel">

          <div class="panel-title records-header">
            <div>
              <span class="section-number">
                04
              </span>

              <div>
                <h3>پرونده‌های تعمیر</h3>
                <p>
                  آخرین پذیرش‌های تعمیرگاه
                </p>
              </div>
            </div>

            <span
              class="count-badge"
              id="case-count-badge"
            >
              0 پرونده
            </span>
          </div>

          <div id="cases-list"></div>

        </section>

        <section
          id="case-detail"
          class="case-detail-container"
        ></section>

      </main>

      <footer>
        موتو کلینیک ولیعصر(عج)
        <span>•</span>
        سیستم مدیریت تعمیرگاه
      </footer>

    </div>
  `;

  document
    .getElementById("customer-form")
    .addEventListener(
      "submit",
      saveCustomer
    );

  document
    .getElementById("motorcycle-form")
    .addEventListener(
      "submit",
      saveMotorcycle
    );

  document
    .getElementById("case-form")
    .addEventListener(
      "submit",
      saveCase
    );

  document
    .getElementById("case-customer")
    .addEventListener(
      "change",
      loadCaseMotorcycles
    );
}

function fillCustomerSelects() {
  const html = `
    <option value="">
      انتخاب مشتری
    </option>

    ${customers.map(
      (c) => `
        <option value="${c.id}">
          ${escapeHtml(c.name)}
          — ${escapeHtml(c.phone)}
        </option>
      `
    ).join("")}
  `;

  document.getElementById(
    "motorcycle-customer"
  ).innerHTML = html;

  document.getElementById(
    "case-customer"
  ).innerHTML = html;
}

async function loadDashboard() {
  const data =
    await api("/dashboard");

  document.getElementById(
    "customers-count"
  ).textContent =
    data.customers;

  document.getElementById(
    "motorcycles-count"
  ).textContent =
    data.motorcycles;

  document.getElementById(
    "cases-count"
  ).textContent =
    data.activeCases;

  document.getElementById(
    "revenue-count"
  ).textContent =
    `${money(data.revenue)} تومان`;
}

async function loadCustomers() {
  customers =
    await api("/customers");

  fillCustomerSelects();

  const box =
    document.getElementById(
      "customers-list"
    );

  if (!customers.length) {
    box.innerHTML =
      `<div class="empty">هنوز مشتری ثبت نشده است.</div>`;
    return;
  }

  box.innerHTML = customers
    .map(
      (c) => `
        <div class="mini-record">
          <div class="avatar">👤</div>

          <div>
            <strong>
              ${escapeHtml(c.name)}
            </strong>

            <span>
              ${escapeHtml(c.phone)}
            </span>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadMotorcycles() {
  motorcycles =
    await api("/motorcycles");

  const box =
    document.getElementById(
      "motorcycles-list"
    );

  if (!motorcycles.length) {
    box.innerHTML =
      `<div class="empty">هنوز موتورسیکلتی ثبت نشده است.</div>`;
    return;
  }

  box.innerHTML = motorcycles
    .map(
      (m) => `
        <div class="mini-record">

          <div class="avatar motorcycle">
            🏍️
          </div>

          <div>
            <strong>
              ${escapeHtml(
                m.brand || ""
              )}
              ${escapeHtml(
                m.model || ""
              )}
            </strong>

            <span>
              پلاک:
              ${escapeHtml(m.plate)}
              •
              ${escapeHtml(
                m.customer_name
              )}
            </span>
          </div>

        </div>
      `
    )
    .join("");
}

async function loadCases() {
  cases =
    await api("/cases");

  const box =
    document.getElementById(
      "cases-list"
    );

  document.getElementById(
    "case-count-badge"
  ).textContent =
    `${cases.length.toLocaleString("fa-IR")} پرونده`;

  if (!cases.length) {
    box.innerHTML =
      `<div class="empty">هنوز پرونده‌ای ایجاد نشده است.</div>`;
    return;
  }

  box.innerHTML = cases
    .map(
      (item) => `
        <article class="case-card">

          <div class="case-main">

            <div class="case-person">
              <div class="avatar">
                👤
              </div>

              <div>
                <strong>
                  ${escapeHtml(
                    item.customer_name
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    item.customer_phone ||
                    ""
                  )}
                </span>
              </div>
            </div>

            <div class="case-bike">
              <strong>
                🏍️
                ${escapeHtml(
                  item.motorcycle_brand ||
                  ""
                )}
                ${escapeHtml(
                  item.motorcycle_model ||
                  ""
                )}
              </strong>

              <span>
                پلاک:
                ${escapeHtml(
                  item.motorcycle_plate
                )}
              </span>
            </div>

          </div>

          <div class="complaint">
            <span>شرح مشکل</span>
            ${escapeHtml(
              item.complaint
            )}
          </div>

          <div class="case-bottom">

            <div class="badges">

              <span
                class="status-badge status-${item.status}"
              >
                ${statusLabels[
                  item.status
                ] || item.status}
              </span>

              <span class="priority-badge">
                اولویت:
                ${
                  priorityLabels[
                    item.priority
                  ] ||
                  item.priority
                }
              </span>

            </div>

            <button
              class="outline-btn"
              type="button"
              onclick="showCaseDetail('${item.id}')"
            >
              مشاهده پرونده
              <span>←</span>
            </button>

          </div>

        </article>
      `
    )
    .join("");
}

async function saveCustomer(event) {
  event.preventDefault();

  try {
    const result =
      await api("/customers", {
        method: "POST",
        body: JSON.stringify({
          name:
            document.getElementById(
              "customer-name"
            ).value.trim(),

          phone:
            document.getElementById(
              "customer-phone"
            ).value.trim(),

          address:
            document.getElementById(
              "customer-address"
            ).value.trim(),

          notes:
            document.getElementById(
              "customer-notes"
            ).value.trim(),
        }),
      });

    showMessage(
      result.message
    );

    document
      .getElementById(
        "customer-form"
      )
      .reset();

    await loadCustomers();
    await loadDashboard();
  } catch (error) {
    console.error(error);

    showMessage(
      error.message,
      "error"
    );
  }
}

async function saveMotorcycle(event) {
  event.preventDefault();

  try {
    const result =
      await api("/motorcycles", {
        method: "POST",
        body: JSON.stringify({
          customer_id:
            document.getElementById(
              "motorcycle-customer"
            ).value,

          plate:
            document.getElementById(
              "motorcycle-plate"
            ).value.trim(),

          brand:
            document.getElementById(
              "motorcycle-brand"
            ).value.trim(),

          model:
            document.getElementById(
              "motorcycle-model"
            ).value.trim(),

          year:
            document.getElementById(
              "motorcycle-year"
            ).value || null,

          color:
            document.getElementById(
              "motorcycle-color"
            ).value.trim(),

          mileage:
            document.getElementById(
              "motorcycle-mileage"
            ).value || 0,
        }),
      });

    showMessage(
      result.message
    );

    document
      .getElementById(
        "motorcycle-form"
      )
      .reset();

    await loadMotorcycles();
    await loadDashboard();
  } catch (error) {
    console.error(error);

    showMessage(
      error.message,
      "error"
    );
  }
}

async function loadCaseMotorcycles() {
  const customerId =
    document.getElementById(
      "case-customer"
    ).value;

  const select =
    document.getElementById(
      "case-motorcycle"
    );

  if (!customerId) {
    select.innerHTML = `
      <option value="">
        ابتدا مشتری را انتخاب کنید
      </option>
    `;
    return;
  }

  try {
    const data =
      await api(
        `/customers/${customerId}/motorcycles`
      );

    if (!data.length) {
      select.innerHTML = `
        <option value="">
          برای این مشتری موتورسیکلتی ثبت نشده
        </option>
      `;
      return;
    }

    select.innerHTML = `
      <option value="">
        انتخاب موتورسیکلت
      </option>

      ${data.map(
        (m) => `
          <option value="${m.id}">
            ${escapeHtml(
              m.brand || ""
            )}
            ${escapeHtml(
              m.model || ""
            )}
            — پلاک:
            ${escapeHtml(m.plate)}
          </option>
        `
      ).join("")}
    `;
  } catch (error) {
    showMessage(
      error.message,
      "error"
    );
  }
}

async function saveCase(event) {
  event.preventDefault();

  try {
    const result =
      await api("/cases", {
        method: "POST",
        body: JSON.stringify({
          customer_id:
            document.getElementById(
              "case-customer"
            ).value,

          motorcycle_id:
            document.getElementById(
              "case-motorcycle"
            ).value,

          complaint:
            document.getElementById(
              "case-complaint"
            ).value.trim(),

          diagnosis:
            document.getElementById(
              "case-diagnosis"
            ).value.trim(),

          priority:
            document.getElementById(
              "case-priority"
            ).value,
        }),
      });

    showMessage(
      result.message
    );

    document
      .getElementById(
        "case-form"
      )
      .reset();

    document.getElementById(
      "case-motorcycle"
    ).innerHTML = `
      <option value="">
        ابتدا مشتری را انتخاب کنید
      </option>
    `;

    await loadCases();
    await loadDashboard();
  } catch (error) {
    console.error(error);

    showMessage(
      error.message,
      "error"
    );
  }
}

async function showCaseDetail(caseId) {
  const box =
    document.getElementById(
      "case-detail"
    );

  box.innerHTML = `
    <div class="detail-loading">
      در حال دریافت پرونده...
    </div>
  `;

  box.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  try {
    const result =
      await api(`/cases/${caseId}`);

    const item =
      result.case;

    box.innerHTML = `
      <div class="detail-card">

        <div class="detail-header">

          <div>
            <span class="eyebrow">
              پرونده تعمیر
            </span>

            <h3>
              ${escapeHtml(
                item.customer_name
              )}
            </h3>
          </div>

          <span
            class="status-badge status-${item.status}"
          >
            ${
              statusLabels[
                item.status
              ] || item.status
            }
          </span>

        </div>

        <div class="detail-grid">

          <div class="detail-item">
            <span>شماره تماس</span>
            <strong>
              ${escapeHtml(
                item.customer_phone
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>موتورسیکلت</span>
            <strong>
              ${escapeHtml(
                item.motorcycle_brand ||
                ""
              )}
              ${escapeHtml(
                item.motorcycle_model ||
                ""
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>پلاک</span>
            <strong>
              ${escapeHtml(
                item.motorcycle_plate
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>اولویت</span>
            <strong>
              ${
                priorityLabels[
                  item.priority
                ] ||
                item.priority
              }
            </strong>
          </div>

        </div>

        <div class="detail-description">

          <span>شرح مشکل</span>

          <p>
            ${escapeHtml(
              item.complaint
            )}
          </p>

        </div>

        ${
          item.diagnosis
            ? `
              <div class="detail-description">
                <span>تشخیص</span>
                <p>
                  ${escapeHtml(
                    item.diagnosis
                  )}
                </p>
              </div>
            `
            : ""
        }

        <div class="status-editor">

          <div>
            <span class="editor-label">
              وضعیت فعلی
            </span>

            <strong id="current-status">
              ${
                statusLabels[
                  item.status
                ] || item.status
              }
            </strong>
          </div>

          <div class="status-controls">

            <select
              id="case-status-select"
            >

              ${Object.entries(
                statusLabels
              ).map(
                ([value, label]) => `
                  <option
                    value="${value}"
                    ${
                      item.status === value
                        ? "selected"
                        : ""
                    }
                  >
                    ${label}
                  </option>
                `
              ).join("")}

            </select>

            <button
              id="save-status-button"
              class="primary-btn"
              type="button"
              onclick="changeCaseStatus('${item.id}')"
            >
              ذخیره وضعیت
            </button>

          </div>

        </div>

        <div
          id="status-result"
          class="status-result"
        ></div>

      </div>
    `;
  } catch (error) {
    box.innerHTML = `
      <div class="detail-card error-card">
        خطا در دریافت پرونده:
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

async function changeCaseStatus(caseId) {
  const select =
    document.getElementById(
      "case-status-select"
    );

  const button =
    document.getElementById(
      "save-status-button"
    );

  const resultBox =
    document.getElementById(
      "status-result"
    );

  if (!select) {
    showMessage(
      "انتخاب وضعیت پیدا نشد",
      "error"
    );
    return;
  }

  const status =
    select.value;

  button.disabled = true;

  resultBox.className =
    "status-result loading";

  resultBox.textContent =
    "در حال ذخیره وضعیت...";

  try {
    const result =
      await api(
        `/cases/${caseId}/status`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
          }),
        }
      );

    if (!result.ok) {
      throw new Error(
        result.message ||
        "ذخیره وضعیت انجام نشد"
      );
    }

    const savedStatus =
      result.case?.status;

    if (savedStatus !== status) {
      throw new Error(
        "سرور وضعیت جدید را تأیید نکرد"
      );
    }

    const current =
      document.getElementById(
        "current-status"
      );

    if (current) {
      current.textContent =
        statusLabels[
          savedStatus
        ] || savedStatus;
    }

    resultBox.className =
      "status-result success";

    resultBox.textContent =
      "✓ وضعیت با موفقیت ذخیره شد";

    showMessage(
      result.message
    );

    await loadCases();
    await loadDashboard();

  } catch (error) {
    console.error(
      "STATUS SAVE ERROR:",
      error
    );

    resultBox.className =
      "status-result error";

    resultBox.textContent =
      `✕ ${error.message}`;

    showMessage(
      error.message,
      "error"
    );
  } finally {
    button.disabled = false;
  }
}

async function init() {
  renderApp();

  try {
    await loadCustomers();
    await loadMotorcycles();
    await loadCases();
    await loadDashboard();
  } catch (error) {
    console.error(error);

    showMessage(
      "اتصال به سرور برقرار نشد",
      "error"
    );
  }
}

window.showCaseDetail =
  showCaseDetail;

window.changeCaseStatus =
  changeCaseStatus;

init();
