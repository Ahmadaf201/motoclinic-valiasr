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

  } catch (error) {
    document.getElementById("apiStatus").innerHTML =
      "🔴 خطا در اتصال به API";
  }
}

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

// ثبت مشتری
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

    loadDashboard();

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

// ثبت موتورسیکلت
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

      <select id="motorcycleCustomer" style="${inputStyle}">
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

    loadDashboard();

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

function newCase() {
  showMessage(
    "🔧 بخش پذیرش تعمیرگاه را بعد از تکمیل ثبت موتورسیکلت فعال می‌کنیم."
  );
}

loadDashboard();
