const API_URL = "https://motoclinic-api.onrender.com/api";

const app = document.getElementById("app");

const buttonStyle = `
  display:inline-block;
  margin-top:10px;
  padding:10px 14px;
  border:none;
  border-radius:8px;
  background:#222;
  color:#fff;
  cursor:pointer;
  font-size:14px;
`;

const inputStyle = `
  width:100%;
  box-sizing:border-box;
  padding:11px;
  margin:6px 0 10px;
  border:1px solid #ccc;
  border-radius:8px;
  font-size:15px;
`;

function showMessage(message, error = false) {
  const box = document.createElement("div");

  box.style.cssText = `
    margin:15px 0;
    padding:12px;
    border-radius:8px;
    background:${error ? "#ffe5e5" : "#e7f7e7"};
    color:${error ? "#a00000" : "#176b17"};
    font-weight:bold;
  `;

  box.textContent = message;

  app.prepend(box);

  setTimeout(() => box.remove(), 4000);
}

function statusText(status) {
  const map = {
    OPEN: "باز",
    DIAGNOSIS: "در حال عیب‌یابی",
    WAITING_APPROVAL: "در انتظار تأیید",
    IN_PROGRESS: "در حال تعمیر",
    WAITING_PARTS: "در انتظار قطعه",
    READY: "آماده تحویل",
    COMPLETED: "تکمیل شده",
    CLOSED: "بسته شده"
  };

  return map[status] || status;
}

function priorityText(priority) {
  const map = {
    LOW: "کم",
    NORMAL: "عادی",
    HIGH: "زیاد",
    URGENT: "فوری"
  };

  return map[priority] || priority;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "خطای سرور");
  }

  return data;
}

async function loadDashboard() {
  try {
    const data = await api("/dashboard");

    app.innerHTML = `
      <div style="
        font-family:Tahoma,Arial,sans-serif;
        max-width:1000px;
        margin:auto;
        padding:20px;
        direction:rtl;
      ">

        <h1 style="margin-bottom:5px;">
          🏍️ موتو کلینیک ولیعصر (عج)
        </h1>

        <p style="color:#666;margin-top:0;">
          سیستم هوشمند مدیریت تعمیرگاه موتورسیکلت
        </p>

        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:12px;
          margin:20px 0;
        ">

          <div style="padding:18px;border-radius:12px;background:#f5f5f5;text-align:center;">
            <div style="font-size:28px;">👤</div>
            <div>مشتریان</div>
            <strong style="font-size:24px;">${data.customers}</strong>
          </div>

          <div style="padding:18px;border-radius:12px;background:#f5f5f5;text-align:center;">
            <div style="font-size:28px;">🏍️</div>
            <div>موتورسیکلت‌ها</div>
            <strong style="font-size:24px;">${data.motorcycles}</strong>
          </div>

          <div style="padding:18px;border-radius:12px;background:#f5f5f5;text-align:center;">
            <div style="font-size:28px;">🔧</div>
            <div>پرونده‌های فعال</div>
            <strong style="font-size:24px;">${data.activeCases}</strong>
          </div>

          <div style="padding:18px;border-radius:12px;background:#f5f5f5;text-align:center;">
            <div style="font-size:28px;">💰</div>
            <div>دریافتی</div>
            <strong style="font-size:24px;">
              ${Number(data.revenue || 0).toLocaleString("fa-IR")}
            </strong>
            <span> تومان</span>
          </div>

        </div>

        <h2>دسترسی سریع</h2>

        <div style="
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          margin-bottom:20px;
        ">

          <button onclick="showCustomerForm()" style="${buttonStyle}">
            ➕ ثبت مشتری
          </button>

          <button onclick="showMotorcycleForm()" style="${buttonStyle}">
            🏍️ ثبت موتورسیکلت
          </button>

          <button onclick="showCaseForm()" style="${buttonStyle}">
            🔧 پذیرش تعمیرگاه
          </button>

        </div>

        <div id="forms"></div>

        <h2>پرونده‌های تعمیر</h2>

        <div id="cases">
          در حال دریافت اطلاعات...
        </div>

        <h2>وضعیت سیستم</h2>

        <div style="
          padding:12px;
          background:#e7f7e7;
          border-radius:8px;
          color:#176b17;
          font-weight:bold;
        ">
          🟢 اتصال به سیستم برقرار است
        </div>

      </div>
    `;

    await loadCases();

  } catch (error) {

    app.innerHTML = `
      <div style="
        font-family:Tahoma,Arial,sans-serif;
        direction:rtl;
        text-align:center;
        padding:50px 20px;
      ">
        <h2>❌ خطا در اتصال به سیستم</h2>
        <p>${error.message}</p>

        <button onclick="loadDashboard()" style="${buttonStyle}">
          🔄 تلاش مجدد
        </button>
      </div>
    `;
  }
}

async function loadCases() {
  const container = document.getElementById("cases");

  if (!container) return;

  try {
    const cases = await api("/cases");

    if (!cases.length) {
      container.innerHTML = `
        <div style="
          padding:20px;
          background:#f5f5f5;
          border-radius:10px;
        ">
          هنوز پرونده‌ای ثبت نشده است.
        </div>
      `;
      return;
    }

    container.innerHTML = cases.map(item => `
      <div style="
        background:#fff;
        border:1px solid #ddd;
        border-radius:12px;
        padding:16px;
        margin-bottom:12px;
      ">

        <div style="font-weight:bold;font-size:17px;">
          👤 ${item.customer_name || "بدون نام"}
        </div>

        <div style="margin-top:8px;">
          🏍️ ${item.brand || ""} ${item.model || ""}
          — پلاک: ${item.plate || "-"}
        </div>

        <div style="margin-top:8px;">
          🔧 ${item.complaint || "-"}
        </div>

        <div style="margin-top:8px;">
          وضعیت:
          <strong>${statusText(item.status)}</strong>

          &nbsp;

          اولویت:
          <strong>${priorityText(item.priority)}</strong>
        </div>

        <button
          onclick="openCase('${item.id}')"
          style="${buttonStyle}"
        >
          📋 مشاهده پرونده
        </button>

      </div>
    `).join("");

  } catch (error) {

    container.innerHTML = `
      <div style="
        padding:15px;
        background:#ffe5e5;
        color:#a00000;
        border-radius:8px;
      ">
        ❌ خطا در دریافت پرونده‌ها:
        ${error.message}
      </div>
    `;
  }
}

function showCustomerForm() {

  const forms = document.getElementById("forms");

  forms.innerHTML = `
    <div style="
      padding:18px;
      background:#f7f7f7;
      border-radius:12px;
      margin-bottom:20px;
    ">

      <h3>➕ ثبت مشتری جدید</h3>

      <input id="customerName"
        placeholder="نام و نام خانوادگی"
        style="${inputStyle}">

      <input id="customerPhone"
        placeholder="شماره تماس"
        style="${inputStyle}">

      <input id="customerAddress"
        placeholder="آدرس"
        style="${inputStyle}">

      <textarea id="customerNotes"
        placeholder="یادداشت"
        style="${inputStyle};min-height:80px;"></textarea>

      <button onclick="saveCustomer()" style="${buttonStyle}">
        💾 ذخیره مشتری
      </button>

      <button onclick="closeForms()" style="${buttonStyle};background:#777;">
        بستن
      </button>

    </div>
  `;
}

async function saveCustomer() {

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const address = document.getElementById("customerAddress").value.trim();
  const notes = document.getElementById("customerNotes").value.trim();

  if (!name || !phone) {
    showMessage("نام و شماره تماس الزامی است.", true);
    return;
  }

  try {

    await api("/customers", {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        address,
        notes
      })
    });

    await loadDashboard();

    showMessage("✅ مشتری با موفقیت ثبت شد.");

  } catch (error) {

    showMessage(
      "❌ خطا در ثبت مشتری: " + error.message,
      true
    );
  }
}

async function showMotorcycleForm() {

  try {

    const customers = await api("/customers");

    const forms = document.getElementById("forms");

    forms.innerHTML = `
      <div style="
        padding:18px;
        background:#f7f7f7;
        border-radius:12px;
        margin-bottom:20px;
      ">

        <h3>🏍️ ثبت موتورسیکلت</h3>

        <select id="motorCustomer" style="${inputStyle}">
          <option value="">انتخاب مشتری</option>

          ${customers.map(c => `
            <option value="${c.id}">
              ${c.name} — ${c.phone}
            </option>
          `).join("")}

        </select>

        <input id="motorPlate"
          placeholder="پلاک"
          style="${inputStyle}">

        <input id="motorBrand"
          placeholder="برند"
          style="${inputStyle}">

        <input id="motorModel"
          placeholder="مدل"
          style="${inputStyle}">

        <input id="motorYear"
          placeholder="سال"
          type="number"
          style="${inputStyle}">

        <input id="motorColor"
          placeholder="رنگ"
          style="${inputStyle}">

        <input id="motorVin"
          placeholder="VIN / شماره شاسی"
          style="${inputStyle}">

        <input id="motorMileage"
          placeholder="کارکرد"
          type="number"
          value="0"
          style="${inputStyle}">

        <button onclick="saveMotorcycle()" style="${buttonStyle}">
          💾 ذخیره موتورسیکلت
        </button>

        <button onclick="closeForms()" style="${buttonStyle};background:#777;">
          بستن
        </button>

      </div>
    `;

  } catch (error) {

    showMessage(
      "❌ خطا در دریافت مشتریان: " + error.message,
      true
    );
  }
}

async function saveMotorcycle() {

  const customer_id =
    document.getElementById("motorCustomer").value;

  const plate =
    document.getElementById("motorPlate").value.trim();

  const brand =
    document.getElementById("motorBrand").value.trim();

  const model =
    document.getElementById("motorModel").value.trim();

  const yearValue =
    document.getElementById("motorYear").value;

  const color =
    document.getElementById("motorColor").value.trim();

  const vin =
    document.getElementById("motorVin").value.trim();

  const mileageValue =
    document.getElementById("motorMileage").value;

  if (!customer_id || !plate) {
    showMessage(
      "انتخاب مشتری و وارد کردن پلاک الزامی است.",
      true
    );
    return;
  }

  try {

    await api("/motorcycles", {
      method: "POST",
      body: JSON.stringify({
        customer_id,
        plate,
        brand,
        model,
        year: yearValue ? Number(yearValue) : null,
        color,
        vin,
        mileage: mileageValue ? Number(mileageValue) : 0
      })
    });

    await loadDashboard();

    showMessage("✅ موتورسیکلت با موفقیت ثبت شد.");

  } catch (error) {

    showMessage(
      "❌ خطا در ثبت موتورسیکلت: " + error.message,
      true
    );
  }
}

async function showCaseForm() {

  try {

    const customers = await api("/customers");

    const forms = document.getElementById("forms");

    forms.innerHTML = `
      <div style="
        padding:18px;
        background:#f7f7f7;
        border-radius:12px;
        margin-bottom:20px;
      ">

        <h3>🔧 پذیرش تعمیرگاه</h3>

        <label>مشتری</label>

        <select
          id="caseCustomer"
          onchange="loadCustomerMotorcycles()"
          style="${inputStyle}"
        >
          <option value="">انتخاب مشتری</option>

          ${customers.map(c => `
            <option value="${c.id}">
              ${c.name} — ${c.phone}
            </option>
          `).join("")}

        </select>

        <label>موتورسیکلت</label>

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
          placeholder="شرح مشکل / درخواست مشتری"
          style="${inputStyle};min-height:100px;"
        ></textarea>

        <textarea
          id="caseDiagnosis"
          placeholder="تشخیص اولیه"
          style="${inputStyle};min-height:80px;"
        ></textarea>

        <select id="casePriority" style="${inputStyle}">
          <option value="NORMAL">اولویت عادی</option>
          <option value="LOW">اولویت کم</option>
          <option value="HIGH">اولویت زیاد</option>
          <option value="URGENT">فوری</option>
        </select>

        <button onclick="saveCase()" style="${buttonStyle}">
          💾 ثبت پرونده
        </button>

        <button onclick="closeForms()" style="${buttonStyle};background:#777;">
          بستن
        </button>

      </div>
    `;

  } catch (error) {

    showMessage(
      "❌ خطا در دریافت اطلاعات: " + error.message,
      true
    );
  }
}

async function loadCustomerMotorcycles() {

  const customerId =
    document.getElementById("caseCustomer").value;

  const select =
    document.getElementById("caseMotorcycle");

  if (!customerId) {

    select.innerHTML = `
      <option value="">
        ابتدا مشتری را انتخاب کنید
      </option>
    `;

    return;
  }

  try {

    const motorcycles =
      await api(`/motorcycles/customer/${customerId}`);

    if (!motorcycles.length) {

      select.innerHTML = `
        <option value="">
          برای این مشتری موتورسیکلتی ثبت نشده
        </option>
      `;

      return;
    }

    select.innerHTML = motorcycles.map(m => `
      <option value="${m.id}">
        ${m.brand || ""} ${m.model || ""} — پلاک ${m.plate}
      </option>
    `).join("");

  } catch (error) {

    showMessage(
      "❌ خطا در دریافت موتورسیکلت‌ها: " + error.message,
      true
    );
  }
}

async function saveCase() {

  const customer_id =
    document.getElementById("caseCustomer").value;

  const motorcycle_id =
    document.getElementById("caseMotorcycle").value;

  const complaint =
    document.getElementById("caseComplaint").value.trim();

  const diagnosis =
    document.getElementById("caseDiagnosis").value.trim();

  const priority =
    document.getElementById("casePriority").value;

  if (!customer_id || !motorcycle_id || !complaint) {

    showMessage(
      "مشتری، موتورسیکلت و شرح مشکل الزامی هستند.",
      true
    );

    return;
  }

  try {

    await api("/cases", {
      method: "POST",
      body: JSON.stringify({
        customer_id,
        motorcycle_id,
        complaint,
        diagnosis,
        priority
      })
    });

    await loadDashboard();

    showMessage("✅ پرونده تعمیر با موفقیت ثبت شد.");

  } catch (error) {

    showMessage(
      "❌ خطا در ثبت پرونده: " + error.message,
      true
    );
  }
}

async function openCase(caseId) {

  try {

    const item =
      await api(`/cases/${caseId}`);

    const forms =
      document.getElementById("forms");

    forms.innerHTML = `
      <div style="
        padding:20px;
        background:#f7f7f7;
        border-radius:12px;
        margin-bottom:20px;
      ">

        <h2>📋 جزئیات پرونده</h2>

        <p>
          👤 <strong>${item.customer_name || "-"}</strong>
        </p>

        <p>
          🏍️
          ${item.brand || ""}
          ${item.model || ""}
          — پلاک:
          ${item.plate || "-"}
        </p>

        <p>
          🔧
          <strong>شرح مشکل:</strong>
          ${item.complaint || "-"}
        </p>

        <p>
          🩺
          <strong>تشخیص:</strong>
          ${item.diagnosis || "ثبت نشده"}
        </p>

        <p>
          اولویت:
          <strong>${priorityText(item.priority)}</strong>
        </p>

        <hr>

        <label>
          تغییر وضعیت پرونده
        </label>

        <select
          id="caseStatus"
          style="${inputStyle}"
        >

          <option value="OPEN"
            ${item.status === "OPEN" ? "selected" : ""}>
            باز
          </option>

          <option value="DIAGNOSIS"
            ${item.status === "DIAGNOSIS" ? "selected" : ""}>
            در حال عیب‌یابی
          </option>

          <option value="WAITING_APPROVAL"
            ${item.status === "WAITING_APPROVAL" ? "selected" : ""}>
            در انتظار تأیید
          </option>

          <option value="IN_PROGRESS"
            ${item.status === "IN_PROGRESS" ? "selected" : ""}>
            در حال تعمیر
          </option>

          <option value="WAITING_PARTS"
            ${item.status === "WAITING_PARTS" ? "selected" : ""}>
            در انتظار قطعه
          </option>

          <option value="READY"
            ${item.status === "READY" ? "selected" : ""}>
            آماده تحویل
          </option>

          <option value="COMPLETED"
            ${item.status === "COMPLETED" ? "selected" : ""}>
            تکمیل شده
          </option>

          <option value="CLOSED"
            ${item.status === "CLOSED" ? "selected" : ""}>
            بسته شده
          </option>

        </select>

        <button
          onclick="changeCaseStatus('${caseId}')"
          style="${buttonStyle}"
        >
          💾 ذخیره وضعیت
        </button>

        <button
          onclick="closeForms()"
          style="${buttonStyle};background:#777;"
        >
          بستن
        </button>

      </div>
    `;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {

    showMessage(
      "❌ خطا در دریافت پرونده: " + error.message,
      true
    );
  }
}

async function changeCaseStatus(caseId) {

  const status =
    document.getElementById("caseStatus").value;

  try {

    await api(`/cases/${caseId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status
      })
    });

    await loadDashboard();

    showMessage(
      "✅ وضعیت پرونده با موفقیت تغییر کرد."
    );

  } catch (error) {

    showMessage(
      "❌ خطا در تغییر وضعیت پرونده: " + error.message,
      true
    );
  }
}

function closeForms() {

  const forms =
    document.getElementById("forms");

  if (forms) {
    forms.innerHTML = "";
  }
}

loadDashboard();
