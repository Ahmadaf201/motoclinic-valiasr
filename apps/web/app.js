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
  showMessage("👤 فرم ثبت مشتری را در مرحله بعد فعال می‌کنیم.");
}

function newMotorcycle() {
  showMessage("🏍️ فرم ثبت موتورسیکلت را در مرحله بعد فعال می‌کنیم.");
}

function newCase() {
  showMessage("🔧 فرم پذیرش تعمیرگاه را در مرحله بعد فعال می‌کنیم.");
}

loadDashboard();
