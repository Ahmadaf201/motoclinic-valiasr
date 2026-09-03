const API_URL = "http://localhost:4000/api";

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
      data.customers.toLocaleString("fa-IR");

    document.getElementById("motorcycles").textContent =
      data.motorcycles.toLocaleString("fa-IR");

    document.getElementById("cases").textContent =
      data.activeCases.toLocaleString("fa-IR");

    document.getElementById("income").textContent =
      Number(data.revenue).toLocaleString("fa-IR");

    document.getElementById("apiStatus").innerHTML =
      "🟢 اتصال به سیستم برقرار است";

  } catch (error) {

    document.getElementById("apiStatus").innerHTML =
      "🟡 رابط کاربری آماده است؛ API هنوز اجرا نشده.";

  }
}

function showMessage(text) {
  document.getElementById("message").innerHTML = `
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
        placeholder="نام و نام خانوادگی"
        style="width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ddd;"
      >

      <input
        id="customerPhone"
        placeholder="شماره موبایل"
        type="tel"
        style="width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ddd;"
      >

      <input
        id="customerAddress"
        placeholder="آدرس"
        style="width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ddd;"
      >

      <textarea
        id="customerNotes"
        placeholder="توضیحات"
        style="width:100%;padding:14px;margin:8px 0;border-radius:10px;border:1px solid #ddd;"
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
      <div>
        <strong>✅ مشتری با موفقیت ثبت شد.</strong>
        <br>
        شناسه مشتری: ${data.id}
      </div>
    `);

    loadDashboard();

  } catch (error) {
    showMessage(`❌ ${error.message}`);
  }
}

function newMotorcycle() {
  showMessage("🏍️ فرم ثبت موتورسیکلت را در مرحله بعد فعال می‌کنیم.");
}

function newCase() {
  showMessage("🔧 فرم پذیرش تعمیرگاه را در مرحله بعد فعال می‌کنیم.");
}

loadDashboard();
