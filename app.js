const API_URL = "https://motoclinic-api.onrender.com/api";

const app = document.getElementById("app");

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
  const separator = path.includes("?") ? "&" : "?";

  const response = await fetch(
    `${API_URL}${path}${separator}_v=7`,
    {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
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
      `خطای سرور: ${response.status}`
    );
  }

  return data;
}

function showMessage(message, type = "success") {
  const old = document.getElementById("app-message");

  if (old) {
    old.remove();
  }

  const box = document.createElement("div");

  box.id = "app-message";
  box.style.cssText = `
    position:fixed;
    top:20px;
    left:50%;
    transform:translateX(-50%);
    z-index:9999;
    padding:14px 22px;
    border-radius:12px;
    font-family:Tahoma,Arial,sans-serif;
    font-size:14px;
    box-shadow:0 5px 20px rgba(0,0,0,.2);
    direction:rtl;
    max-width:90%;
    text-align:center;
    background:${type === "error" ? "#b91c1c" : "#15803d"};
    color:white;
  `;

  box.textContent = message;

  document.body.appendChild(box);

  setTimeout(() => {
    box.remove();
  }, 3500);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadDashboard() {
  try {
    const data = await api("/dashboard");

    document.getElementById("customers-count").textContent =
      data.customers ?? 0;

    document.getElementById("motorcycles-count").textContent =
      data.motorcycles ?? 0;

    document.getElementById("cases-count").textContent =
      data.activeCases ?? 0;

    document.getElementById("revenue-count").textContent =
      formatMoney(data.revenue) + " تومان";
  } catch (error) {
    console.error(error);
  }
}

async function loadCustomers() {
  customers = await api("/customers");
  renderCustomers();
}

async function loadMotorcycles() {
  motorcycles = await api("/motorcycles");
  renderMotorcycles();
}

async function loadCases() {
  cases = await api("/cases");
  renderCases();
}

function renderCustomers() {
  const box = document.getElementById("customers-list");

  if (!box) return;

  if (!customers.length) {
    box.innerHTML = "هنوز مشتری ثبت نشده است.";
    return;
  }

  box.innerHTML = customers
    .map(
      (customer) => `
        <div class="list-item">
          <strong>${escapeHtml(customer.name)}</strong>
          <div>📞 ${escapeHtml(customer.phone)}</div>
          ${
            customer.address
              ? `<div>📍 ${escapeHtml(customer.address)}</div>`
              : ""
          }
        </div>
      `
    )
    .join("");
}

function renderMotorcycles() {
  const box = document.getElementById(
    "motorcycles-list"
  );

  if (!box) return;

  if (!motorcycles.length) {
    box.innerHTML =
      "هنوز موتورسیکلتی ثبت نشده است.";
    return;
  }

  box.innerHTML = motorcycles
    .map(
      (motorcycle) => `
        <div class="list-item">
          <strong>
            ${escapeHtml(
              motorcycle.brand || ""
            )}
            ${escapeHtml(
              motorcycle.model || ""
            )}
          </strong>
          <div>
            🏍️ پلاک:
            ${escapeHtml(motorcycle.plate)}
          </div>
          <div>
            👤 مالک:
            ${escapeHtml(
              motorcycle.customer_name || ""
            )}
          </div>
        </div>
      `
    )
    .join("");
}

function renderCases() {
  const box = document.getElementById("cases-list");

  if (!box) return;

  if (!cases.length) {
    box.innerHTML =
      "هنوز پرونده‌ای ثبت نشده است.";
    return;
  }

  box.innerHTML = cases
    .map(
      (item) => `
        <div class="list-item">
          <strong>
            👤 ${escapeHtml(
              item.customer_name
            )}
          </strong>

          <div>
            🏍️
            ${escapeHtml(
              item.motorcycle_brand || ""
            )}
            ${escapeHtml(
              item.motorcycle_model || ""
            )}
            — پلاک:
            ${escapeHtml(
              item.motorcycle_plate
            )}
          </div>

          <div>
            🔧 ${escapeHtml(
              item.complaint
            )}
          </div>

          <div>
            وضعیت:
            ${escapeHtml(
              statusLabels[item.status] ||
              item.status
            )}

            &nbsp;

            اولویت:
            ${escapeHtml(
              priorityLabels[item.priority] ||
              item.priority
            )}
          </div>

          <button
            type="button"
            onclick="showCaseDetail('${item.id}')"
          >
            📋 مشاهده پرونده
          </button>
        </div>
      `
    )
    .join("");
}

function renderApp() {
  app.innerHTML = `
    <div
      style="
        max-width:1100px;
        margin:auto;
        padding:20px;
        font-family:Tahoma,Arial,sans-serif;
        direction:rtl;
      "
    >

      <h1>
        🏍️ موتو کلینیک ولیعصر(عج)
      </h1>

      <p>
        سیستم مدیریت هوشمند تعمیرگاه
      </p>

      <hr>

      <h2>📊 داشبورد</h2>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:12px;
        "
      >

        <div class="dashboard-card">
          <strong>👤 مشتریان</strong>
          <div id="customers-count">0</div>
        </div>

        <div class="dashboard-card">
          <strong>🏍️ موتورسیکلت‌ها</strong>
          <div id="motorcycles-count">0</div>
        </div>

        <div class="dashboard-card">
          <strong>🔧 پرونده‌های فعال</strong>
          <div id="cases-count">0</div>
        </div>

        <div class="dashboard-card">
          <strong>💰 درآمد</strong>
          <div id="revenue-count">0 تومان</div>
        </div>

      </div>

      <hr>

      <h2>👤 ثبت مشتری</h2>

      <form id="customer-form">

        <input
          id="customer-name"
          placeholder="نام و نام خانوادگی"
          required
        >

        <input
          id="customer-phone"
          placeholder="شماره تماس"
          required
        >

        <input
          id="customer-address"
          placeholder="آدرس"
        >

        <textarea
          id="customer-notes"
          placeholder="یادداشت"
        ></textarea>

        <button type="submit">
          💾 ثبت مشتری
        </button>

      </form>

      <div id="customers-list"></div>

      <hr>

      <h2>🏍️ ثبت موتورسیکلت</h2>

      <form id="motorcycle-form">

        <select
          id="motorcycle-customer"
          required
        >
          <option value="">
            انتخاب مشتری
          </option>
        </select>

        <input
          id="motorcycle-plate"
          placeholder="پلاک"
          required
        >

        <input
          id="motorcycle-brand"
          placeholder="برند"
        >

        <input
          id="motorcycle-model"
          placeholder="مدل"
        >

        <input
          id="motorcycle-year"
          type="number"
          placeholder="سال"
        >

        <input
          id="motorcycle-color"
          placeholder="رنگ"
        >

        <input
          id="motorcycle-mileage"
          type="number"
          placeholder="کارکرد"
        >

        <button type="submit">
          💾 ثبت موتورسیکلت
        </button>

      </form>

      <div id="motorcycles-list"></div>

      <hr>

      <h2>🔧 ایجاد پرونده تعمیر</h2>

      <form id="case-form">

        <select
          id="case-customer"
          required
        >
          <option value="">
            انتخاب مشتری
          </option>
        </select>

        <select
          id="case-motorcycle"
          required
        >
          <option value="">
            ابتدا مشتری را انتخاب کنید
          </option>
        </select>

        <textarea
          id="case-complaint"
          placeholder="شرح مشکل مشتری"
          required
        ></textarea>

        <textarea
          id="case-diagnosis"
          placeholder="تشخیص اولیه"
        ></textarea>

        <select id="case-priority">
          <option value="LOW">کم</option>
          <option value="NORMAL" selected>
            عادی
          </option>
          <option value="HIGH">بالا</option>
          <option value="URGENT">فوری</option>
        </select>

        <button type="submit">
          💾 ایجاد پرونده
        </button>

      </form>

      <div id="cases-list"></div>

      <hr>

      <div id="case-detail"></div>

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
      loadCustomerMotorcyclesForCase
    );
}

async function saveCustomer(event) {
  event.preventDefault();

  try {
    const name =
      document.getElementById(
        "customer-name"
      ).value.trim();

    const phone =
      document.getElementById(
        "customer-phone"
      ).value.trim();

    const address =
      document.getElementById(
        "customer-address"
      ).value.trim();

    const notes =
      document.getElementById(
        "customer-notes"
      ).value.trim();

    const result = await api(
      "/customers",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          address,
          notes,
        }),
      }
    );

    showMessage(
      result.message ||
      "مشتری ثبت شد"
    );

    document
      .getElementById("customer-form")
      .reset();

    await loadCustomers();
    await loadDashboard();

    fillCustomerSelects();
  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "خطا در ثبت مشتری",
      "error"
    );
  }
}

function fillCustomerSelects() {
  const motorcycleCustomer =
    document.getElementById(
      "motorcycle-customer"
    );

  const caseCustomer =
    document.getElementById(
      "case-customer"
    );

  const options = `
    <option value="">
      انتخاب مشتری
    </option>

    ${customers
      .map(
        (customer) => `
          <option value="${customer.id}">
            ${escapeHtml(customer.name)}
            — ${escapeHtml(customer.phone)}
          </option>
        `
      )
      .join("")}
  `;

  if (motorcycleCustomer) {
    motorcycleCustomer.innerHTML =
      options;
  }

  if (caseCustomer) {
    caseCustomer.innerHTML =
      options;
  }
}

async function saveMotorcycle(event) {
  event.preventDefault();

  try {
    const customerId =
      document.getElementById(
        "motorcycle-customer"
      ).value;

    const plate =
      document.getElementById(
        "motorcycle-plate"
      ).value.trim();

    const brand =
      document.getElementById(
        "motorcycle-brand"
      ).value.trim();

    const model =
      document.getElementById(
        "motorcycle-model"
      ).value.trim();

    const year =
      document.getElementById(
        "motorcycle-year"
      ).value;

    const color =
      document.getElementById(
        "motorcycle-color"
      ).value.trim();

    const mileage =
      document.getElementById(
        "motorcycle-mileage"
      ).value;

    const result = await api(
      "/motorcycles",
      {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          plate,
          brand,
          model,
          year: year
            ? Number(year)
            : null,
          color,
          mileage: mileage
            ? Number(mileage)
            : 0,
        }),
      }
    );

    showMessage(
      result.message ||
      "موتورسیکلت ثبت شد"
    );

    document
      .getElementById("motorcycle-form")
      .reset();

    await loadMotorcycles();
    await loadDashboard();

    fillCustomerSelects();
  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "خطا در ثبت موتورسیکلت",
      "error"
    );
  }
}

async function loadCustomerMotorcyclesForCase() {
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
    const data = await api(
      `/customers/${customerId}/motorcycles`
    );

    if (!data.length) {
      select.innerHTML = `
        <option value="">
          برای این مشتری موتورسیکلت ثبت نشده
        </option>
      `;
      return;
    }

    select.innerHTML = `
      <option value="">
        انتخاب موتورسیکلت
      </option>

      ${data
        .map(
          (motorcycle) => `
            <option value="${motorcycle.id}">
              ${escapeHtml(
                motorcycle.brand || ""
              )}
              ${escapeHtml(
                motorcycle.model || ""
              )}
              — پلاک:
              ${escapeHtml(
                motorcycle.plate
              )}
            </option>
          `
        )
        .join("")}
    `;
  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "خطا در دریافت موتورسیکلت‌ها",
      "error"
    );
  }
}

async function saveCase(event) {
  event.preventDefault();

  try {
    const customerId =
      document.getElementById(
        "case-customer"
      ).value;

    const motorcycleId =
      document.getElementById(
        "case-motorcycle"
      ).value;

    const complaint =
      document.getElementById(
        "case-complaint"
      ).value.trim();

    const diagnosis =
      document.getElementById(
        "case-diagnosis"
      ).value.trim();

    const priority =
      document.getElementById(
        "case-priority"
      ).value;

    const result = await api(
      "/cases",
      {
        method: "POST",
        body: JSON.stringify({
          customer_id: customerId,
          motorcycle_id: motorcycleId,
          complaint,
          diagnosis,
          priority,
        }),
      }
    );

    showMessage(
      result.message ||
      "پرونده ایجاد شد"
    );

    document
      .getElementById("case-form")
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
      error.message ||
      "خطا در ایجاد پرونده",
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
    <h2>📋 پرونده</h2>
    <p>در حال دریافت اطلاعات...</p>
  `;

  try {
    const result =
      await api(`/cases/${caseId}`);

    const item = result.case;

    box.innerHTML = `
      <div class="case-detail-card">

        <h2>📋 جزئیات پرونده</h2>

        <p>
          <strong>مشتری:</strong>
          ${escapeHtml(
            item.customer_name
          )}
        </p>

        <p>
          <strong>تلفن:</strong>
          ${escapeHtml(
            item.customer_phone
          )}
        </p>

        <p>
          <strong>موتورسیکلت:</strong>
          ${escapeHtml(
            item.motorcycle_brand || ""
          )}
          ${escapeHtml(
            item.motorcycle_model || ""
          )}
        </p>

        <p>
          <strong>پلاک:</strong>
          ${escapeHtml(
            item.motorcycle_plate
          )}
        </p>

        <p>
          <strong>مشکل:</strong>
          ${escapeHtml(
            item.complaint
          )}
        </p>

        ${
          item.diagnosis
            ? `
              <p>
                <strong>تشخیص:</strong>
                ${escapeHtml(
                  item.diagnosis
                )}
              </p>
            `
            : ""
        }

        <p>
          <strong>وضعیت فعلی:</strong>
          <span id="current-status">
            ${escapeHtml(
              statusLabels[item.status] ||
              item.status
            )}
          </span>
        </p>

        <hr>

        <label>
          تغییر وضعیت پرونده
        </label>

        <select
          id="case-status-select"
        >
          ${Object.entries(
            statusLabels
          )
            .map(
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
            )
            .join("")}
        </select>

        <button
          type="button"
          id="save-status-button"
          onclick="changeCaseStatus('${item.id}')"
        >
          💾 ذخیره وضعیت
        </button>

        <div
          id="status-result"
          style="
            margin-top:10px;
            font-weight:bold;
          "
        ></div>

      </div>
    `;
  } catch (error) {
    console.error(error);

    box.innerHTML = `
      <div>
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

  const status = select.value;

  button.disabled = true;

  resultBox.textContent =
    "⏳ در حال ذخیره وضعیت...";

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

    resultBox.textContent =
      `✅ ${
        result.message ||
        "وضعیت با موفقیت ذخیره شد"
      }`;

    const currentStatus =
      document.getElementById(
        "current-status"
      );

    if (currentStatus) {
      currentStatus.textContent =
        statusLabels[status] ||
        status;
    }

    showMessage(
      result.message ||
      "وضعیت پرونده ذخیره شد"
    );

    await loadCases();
    await loadDashboard();
  } catch (error) {
    console.error(error);

    resultBox.textContent =
      `❌ ${error.message}`;

    showMessage(
      error.message ||
      "خطا در ذخیره وضعیت",
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

    fillCustomerSelects();
  } catch (error) {
    console.error(error);

    showMessage(
      error.message ||
      "خطا در اتصال به سرور",
      "error"
    );
  }
}

window.showCaseDetail =
  showCaseDetail;

window.changeCaseStatus =
  changeCaseStatus;

init();
