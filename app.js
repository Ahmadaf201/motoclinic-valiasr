const API_URL = "https://motoclinic-api.onrender.com/api";

const app = document.getElementById("app");

const buttonStyle = `
  padding:18px;
  border:none;
  border-radius:12px;
  background:#222;
  color:white;
  font-size:16px;
  cursor:pointer;
`;

const inputStyle = `
  width:100%;
  padding:14px;
  margin:8px 0;
  border-radius:10px;
  border:1px solid #ddd;
  box-sizing:border-box;
  font-family:Tahoma,Arial,sans-serif;
`;

async function loadDashboard() {
  app.innerHTML = `
    <div dir="rtl" style="
      font-family:Tahoma,Arial,sans-serif;
      max-width:1100px;
      margin:auto;
      padding:20px;
    ">

      <h1>🏍️ موتو کلینیک ولیعصر (عج)</h1>

      <p style="color:#666">
        سیستم هوشمند مدیریت تعمیرگاه موتورسیکلت
      </p>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:15px;
        margin-top:25px;
      ">

        <div style="padding:20px;border-radius:15px;background:#fff;">
          👤
          <h3>مشتریان</h3>
          <strong id="customers">...</strong>
        </div>

        <div style="padding:20px;border-radius:15px;background:#fff;">
          🏍️
          <h3>موتورسیکلت‌ها</h3>
          <strong id="motorcycles">...</strong>
        </div>

        <div style="padding:20px;border-radius:15px;background:#fff;">
          🔧
          <h3>پرونده‌های فعال</h3>
          <strong id="cases">...</strong>
        </div>

        <div style="padding:20px;border-radius:15px;background:#fff;">
          💰
          <h3>دریافتی</h3>
          <strong id="income">...</strong>
          <span> تومان</span>
        </div>

      </div>

      <h2 style="margin-top:35px;">دسترسی سریع</h2>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
        gap:12px;
      ">

        <button onclick="newCustomer()" style="${buttonStyle}">
          ➕ ثبت مشتری
        </button>

        <button onclick="newMotorcycle()" style="${buttonStyle}">
          🏍️ ثبت موتورسیکلت
        </button>

        <button onclick="newCase()" style="${buttonStyle}">
          🔧 پذیرش تعمیرگاه
        </button>

      </div>

      <div id="message" style="margin-top:25px;"></div>

      <div style="
        margin-top:30px;
        padding:18px;
        border-radius:15px;
        background:#fff;
      ">
        <h3>پرونده‌های تعمیر</h3>
        <div id="caseList">
          در حال دریافت اطلاعات...
        </div>
      </div>

      <div style="
        margin-top:20px;
        padding:18px;
        border-radius:15px;
        background:#fff;
      ">
        <h3>وضعیت سیستم</h3>
        <p id="apiStatus">در حال اتصال...</p>
      </div>

    </div>
  `;

  try {
    const response = await fetch(`${API_URL}/dashboard`);

    if (!response.ok) {
      throw new Error("API error");
    }

    const data = await response.json();

    document.getElementById("customers").textContent =
      Number(data.customers).toLocaleString("fa-IR");

    document.getElementById("motorcycles").textContent =
      Number(data.motorcycles).toLocaleString("fa-IR");

    document.getElementById("cases").textContent =
      Number(data.activeCases).toLocaleString("fa-IR");

    document.getElementById("income").textContent =
      Number(data.revenue).toLocaleString("fa-IR");

    document.getElementById("apiStatus").innerHTML =
      "🟢 اتصال به سیستم برقرار است";

    await loadCases();

  } catch (error) {
    const status = document.getElementById("apiStatus");

    if (status) {
      status.innerHTML = "🔴 خطا در اتصال به API";
    }
  }
}

// ─────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────

function showMessage(text) {
  const message = document.getElementById("message");

  if (!message) return;

  message.innerHTML = `
    <div style="
      padding:15px;
      background:#fff8df;
      border-radius:12px;
      border:1px solid #eadb9a;
    ">
      ${text}
    </div>
  `;
}

// ─────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────

function newCustomer() {
  document.getElementById("message").innerHTML = `
    <div style="
      padding:20px;
      background:#fff;
      border-radius:15px;
      margin-top:20px;
    ">

      <h2>👤 ثبت مشتری جدید</h2>

      <input
        id="customerName"
        placeholder="نام و نام خانوادگی *"
        style="${inputStyle}"
      >

      <input
        id="customerPhone"
        placeholder="شماره موبایل"
        type="tel"
        style="${inputStyle}"
      >

      <input
        id="customerAddress"
        placeholder="آدرس"
        style="${inputStyle}"
      >

      <textarea
        id="customerNotes"
        placeholder="توضیحات"
        style="${inputStyle}height:100px;"
      ></textarea>

      <button
        onclick="saveCustomer()"
        style="${buttonStyle}"
      >
        💾 ذخیره مشتری
      </button>

    </div>
  `;
}

async function saveCustomer() {
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const address = document.getElementById("customerAddress").value.trim();
  const notes = document.getElementById("customerNotes").value.trim();

  if (!name) {
    showMessage("⚠️ نام مشتری را وارد کنید.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        phone,
        address,
        notes
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "خطا در ثبت مشتری");
    }

    showMessage(`
      <strong>✅ مشتری با موفقیت ثبت شد.</strong>
      <br>
      شناسه مشتری: ${data.id}
    `);

    await loadDashboard();

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// MOTORCYCLES
// ─────────────────────────────────────────────

async function newMotorcycle() {
  const message = document.getElementById("message");

  message.innerHTML = `
    <div style="
      padding:20px;
      background:#fff;
      border-radius:15px;
      margin-top:20px;
    ">
      <h2>🏍️ ثبت موتورسیکلت جدید</h2>

      <p style="color:#666;">
        ابتدا مالک موتورسیکلت را انتخاب کنید.
      </p>

      <div id="motorcycleFormStatus">
        در حال دریافت لیست مشتریان...
      </div>
    </div>
  `;

  try {
    const response = await fetch(`${API_URL}/customers`);

    if (!response.ok) {
      throw new Error("خطا در دریافت مشتریان");
    }

    const customers = await response.json();

    if (!customers.length) {
      message.innerHTML = `
        <div style="
          padding:20px;
          background:#fff;
          border-radius:15px;
          margin-top:20px;
        ">
          <h2>🏍️ ثبت موتورسیکلت</h2>

          <p>هنوز مشتری ثبت نشده است.</p>

          <button
            onclick="newCustomer()"
            style="${buttonStyle}"
          >
            ➕ ابتدا ثبت مشتری
          </button>
        </div>
      `;

      return;
    }

    document.getElementById("motorcycleFormStatus").innerHTML = `

      <select
        id="motorcycleCustomer"
        style="${inputStyle}"
      >
        <option value="">انتخاب مالک *</option>

        ${customers.map(customer => `
          <option value="${customer.id}">
            ${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}
          </option>
        `).join("")}

      </select>

      <input
        id="motorcyclePlate"
        placeholder="شماره پلاک *"
        style="${inputStyle}"
      >

      <input
        id="motorcycleBrand"
        placeholder="برند موتور؛ مثال: Honda"
        style="${inputStyle}"
      >

      <input
        id="motorcycleModel"
        placeholder="مدل؛ مثال: CG 125"
        style="${inputStyle}"
      >

      <input
        id="motorcycleYear"
        placeholder="سال ساخت"
        type="number"
        style="${inputStyle}"
      >

      <input
        id="motorcycleColor"
        placeholder="رنگ"
        style="${inputStyle}"
      >

      <input
        id="motorcycleVin"
        placeholder="شماره شاسی / VIN"
        style="${inputStyle}"
      >

      <input
        id="motorcycleMileage"
        placeholder="کارکرد کیلومتر"
        type="number"
        min="0"
        value="0"
        style="${inputStyle}"
      >

      <button
        onclick="saveMotorcycle()"
        style="${buttonStyle}"
      >
        💾 ذخیره موتورسیکلت
      </button>
    `;

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

async function saveMotorcycle() {
  const customerId =
    document.getElementById("motorcycleCustomer").value;

  const plate =
    document.getElementById("motorcyclePlate").value.trim();

  const brand =
    document.getElementById("motorcycleBrand").value.trim();

  const model =
    document.getElementById("motorcycleModel").value.trim();

  const year =
    document.getElementById("motorcycleYear").value.trim();

  const color =
    document.getElementById("motorcycleColor").value.trim();

  const vin =
    document.getElementById("motorcycleVin").value.trim();

  const mileage =
    document.getElementById("motorcycleMileage").value.trim();

  if (!customerId) {
    showMessage("⚠️ مالک موتورسیکلت را انتخاب کنید.");
    return;
  }

  if (!plate) {
    showMessage("⚠️ شماره پلاک را وارد کنید.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/motorcycles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId,
        plate,
        brand,
        model,
        year: year ? Number(year) : null,
        color,
        vin,
        mileage: mileage ? Number(mileage) : 0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "خطا در ثبت موتورسیکلت");
    }

    showMessage(`
      <strong>✅ موتورسیکلت با موفقیت ثبت شد.</strong>
      <br>
      پلاک: ${data.plate}
      <br>
      شناسه موتورسیکلت: ${data.id}
    `);

    await loadDashboard();

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// SERVICE CASES
// ─────────────────────────────────────────────

async function newCase() {
  const message = document.getElementById("message");

  message.innerHTML = `
    <div style="
      padding:20px;
      background:#fff;
      border-radius:15px;
      margin-top:20px;
    ">

      <h2>🔧 پذیرش تعمیرگاه</h2>

      <p style="color:#666;">
        مشتری و موتورسیکلت را انتخاب کنید و مشکل اعلام‌شده را ثبت کنید.
      </p>

      <div id="caseFormStatus">
        در حال دریافت اطلاعات...
      </div>

    </div>
  `;

  try {
    const response = await fetch(`${API_URL}/customers`);

    if (!response.ok) {
      throw new Error("خطا در دریافت مشتریان");
    }

    const customers = await response.json();

    if (!customers.length) {
      message.innerHTML = `
        <div style="
          padding:20px;
          background:#fff;
          border-radius:15px;
          margin-top:20px;
        ">

          <h2>🔧 پذیرش تعمیرگاه</h2>

          <p>
            ابتدا باید یک مشتری ثبت کنید.
          </p>

          <button
            onclick="newCustomer()"
            style="${buttonStyle}"
          >
            ➕ ثبت مشتری
          </button>

        </div>
      `;

      return;
    }

    document.getElementById("caseFormStatus").innerHTML = `

      <label>
        👤 مشتری
      </label>

      <select
        id="caseCustomer"
        onchange="loadCaseMotorcycles()"
        style="${inputStyle}"
      >

        <option value="">
          انتخاب مشتری *
        </option>

        ${customers.map(customer => `
          <option value="${customer.id}">
            ${customer.name}${customer.phone ? ` - ${customer.phone}` : ""}
          </option>
        `).join("")}

      </select>

      <label>
        🏍️ موتورسیکلت
      </label>

      <select
        id="caseMotorcycle"
        style="${inputStyle}"
      >
        <option value="">
          ابتدا مشتری را انتخاب کنید
        </option>
      </select>

      <textarea
        id="caseComplaint"
        placeholder="شرح مشکل / درخواست مشتری *"
        style="${inputStyle}height:120px;"
      ></textarea>

      <textarea
        id="caseDiagnosis"
        placeholder="تشخیص اولیه (اختیاری)"
        style="${inputStyle}height:100px;"
      ></textarea>

      <select
        id="casePriority"
        style="${inputStyle}"
      >

        <option value="NORMAL">
          اولویت عادی
        </option>

        <option value="LOW">
          اولویت پایین
        </option>

        <option value="HIGH">
          اولویت بالا
        </option>

        <option value="URGENT">
          🔴 فوری
        </option>

      </select>

      <button
        onclick="saveCase()"
        style="${buttonStyle}"
      >
        💾 ثبت پذیرش
      </button>
    `;

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

// دریافت موتورسیکلت‌های مشتری
async function loadCaseMotorcycles() {
  const customerId =
    document.getElementById("caseCustomer").value;

  const motorcycleSelect =
    document.getElementById("caseMotorcycle");

  if (!customerId) {
    motorcycleSelect.innerHTML = `
      <option value="">
        ابتدا مشتری را انتخاب کنید
      </option>
    `;

    return;
  }

  motorcycleSelect.innerHTML = `
    <option value="">
      در حال دریافت موتورسیکلت‌ها...
    </option>
  `;

  try {
    const response = await fetch(
      `${API_URL}/customers/${customerId}/motorcycles`
    );

    if (!response.ok) {
      throw new Error("خطا در دریافت موتورسیکلت‌ها");
    }

    const motorcycles = await response.json();

    if (!motorcycles.length) {
      motorcycleSelect.innerHTML = `
        <option value="">
          برای این مشتری موتورسیکلتی ثبت نشده است
        </option>
      `;

      return;
    }

    motorcycleSelect.innerHTML = `
      <option value="">
        انتخاب موتورسیکلت *
      </option>

      ${motorcycles.map(motorcycle => `
        <option value="${motorcycle.id}">
          ${motorcycle.plate}
          ${motorcycle.brand ? ` - ${motorcycle.brand}` : ""}
          ${motorcycle.model ? ` ${motorcycle.model}` : ""}
        </option>
      `).join("")}
    `;

  } catch (error) {
    motorcycleSelect.innerHTML = `
      <option value="">
        خطا در دریافت اطلاعات
      </option>
    `;
  }
}

// ثبت پرونده
async function saveCase() {
  const customerId =
    document.getElementById("caseCustomer").value;

  const motorcycleId =
    document.getElementById("caseMotorcycle").value;

  const complaint =
    document.getElementById("caseComplaint").value.trim();

  const diagnosis =
    document.getElementById("caseDiagnosis").value.trim();

  const priority =
    document.getElementById("casePriority").value;

  if (!customerId) {
    showMessage("⚠️ مشتری را انتخاب کنید.");
    return;
  }

  if (!motorcycleId) {
    showMessage("⚠️ موتورسیکلت را انتخاب کنید.");
    return;
  }

  if (!complaint) {
    showMessage("⚠️ شرح مشکل مشتری را وارد کنید.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customerId,
        motorcycleId,
        complaint,
        diagnosis,
        priority
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "خطا در ثبت پذیرش");
    }

    showMessage(`
      <strong>✅ پذیرش با موفقیت ثبت شد.</strong>
      <br>
      شماره پرونده:
      ${data.id}
      <br>
      وضعیت:
      پرونده جدید
    `);

    await loadDashboard();

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// CASE LIST
// ─────────────────────────────────────────────

async function loadCases() {
  const caseList = document.getElementById("caseList");

  if (!caseList) return;

  try {
    const response = await fetch(`${API_URL}/cases`);

    if (!response.ok) {
      throw new Error("خطا");
    }

    const cases = await response.json();

    if (!cases.length) {
      caseList.innerHTML = `
        <p style="color:#777;">
          هنوز پرونده‌ای ثبت نشده است.
        </p>
      `;

      return;
    }

    caseList.innerHTML = cases.map(item => `

      <div style="
        padding:16px;
        margin:10px 0;
        border:1px solid #eee;
        border-radius:12px;
        background:#fafafa;
      ">

        <strong>
          👤 ${item.customer_name}
        </strong>

        <br>

        🏍️
        ${item.brand || ""}
        ${item.model || ""}
        — پلاک:
        ${item.plate}

        <br>

        🔧
        ${item.complaint}

        <br>

        <span style="
          display:inline-block;
          margin-top:8px;
          padding:5px 10px;
          border-radius:8px;
          background:#eee;
        ">
          وضعیت: ${translateStatus(item.status)}
        </span>

        <span style="
          display:inline-block;
          margin-top:8px;
          padding:5px 10px;
          border-radius:8px;
          background:#eee;
        ">
          اولویت: ${translatePriority(item.priority)}
        </span>

      </div>

    `).join("");

  } catch (error) {
    caseList.innerHTML = `
      <p style="color:#c00;">
        خطا در دریافت پرونده‌ها
      </p>
    `;
  }
}

// ترجمه وضعیت
function translateStatus(status) {
  const statuses = {
    OPEN: "باز",
    DIAGNOSIS: "در حال عیب‌یابی",
    WAITING_APPROVAL: "منتظر تأیید",
    IN_PROGRESS: "در حال تعمیر",
    WAITING_PARTS: "منتظر قطعه",
    READY: "آماده تحویل",
    COMPLETED: "تکمیل شده",
    CLOSED: "بسته شده"
  };

  return statuses[status] || status;
}

// ترجمه اولویت
function translatePriority(priority) {
  const priorities = {
    LOW: "پایین",
    NORMAL: "عادی",
    HIGH: "بالا",
    URGENT: "فوری"
  };

  return priorities[priority] || priority;
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

loadDashboard();
