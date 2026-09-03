const API_URL = "http://localhost:4000/api";

const app = document.getElementById("app");

async function loadDashboard() {
  app.innerHTML = `
    <div dir="rtl" style="
      font-family:Tahoma,Arial,sans-serif;
      max-width:1100px;
      margin:auto;
      padding:20px;
      color:#222;
    ">
      <h1 style="margin-bottom:5px;">🏍️ موتو کلینیک ولیعصر (عج)</h1>
      <p style="color:#666;">سیستم هوشمند مدیریت تعمیرگاه موتورسیکلت</p>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:15px;
        margin-top:25px;
      ">

        <div style="padding:20px;border-radius:15px;background:#f5f5f5;">
          <div style="font-size:28px;">👤</div>
          <h3>مشتریان</h3>
          <strong id="customers">۰</strong>
        </div>

        <div style="padding:20px;border-radius:15px;background:#f5f5f5;">
          <div style="font-size:28px;">🏍️</div>
          <h3>موتورسیکلت‌ها</h3>
          <strong id="motorcycles">۰</strong>
        </div>

        <div style="padding:20px;border-radius:15px;background:#f5f5f5;">
          <div style="font-size:28px;">🔧</div>
          <h3>پرونده‌های فعال</h3>
          <strong id="cases">۰</strong>
        </div>

        <div style="padding:20px;border-radius:15px;background:#f5f5f5;">
          <div style="font-size:28px;">💰</div>
          <h3>درآمد</h3>
          <strong id="income">۰ تومان</strong>
        </div>

      </div>

      <div style="margin-top:30px;">
        <h2>دسترسی سریع</h2>

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

          <button onclick="showMessage('بخش جستجوی مشتریان در مرحله بعد فعال می‌شود')" style="${buttonStyle}">
            🔎 جستجوی مشتری
          </button>

        </div>
      </div>

      <div id="message" style="margin-top:25px;"></div>

      <div style="
        margin-top:30px;
        padding:18px;
        border-radius:15px;
        background:#fafafa;
        border:1px solid #eee;
      ">
        <h3>وضعیت سیستم</h3>
        <p id="apiStatus">در حال بررسی اتصال به سرور...</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("API unavailable");
    }

    const data = await response.json();

    document.getElementById("apiStatus").innerHTML =
      `🟢 اتصال به هسته سیستم برقرار است — نسخه ${data.version || "0.1"}`;

  } catch (error) {

    document.getElementById("apiStatus").innerHTML =
      `🟡 رابط کاربری آماده است؛ اتصال به API هنوز برقرار نشده است.`;
  }
}

const buttonStyle = `
  padding:18px;
  border:none;
  border-radius:12px;
  background:#222;
  color:white;
  font-size:16px;
  cursor:pointer;
`;

function showMessage(text) {
  const message = document.getElementById("message");

  message.innerHTML = `
    <div style="
      padding:15px;
      background:#fff8df;
      border-radius:12px;
      border:1px solid #f0df9a;
    ">
      ${text}
    </div>
  `;
}

function newCustomer() {
  showMessage("👤 فرم ثبت مشتری را در مرحله بعد اضافه می‌کنیم.");
}

function newMotorcycle() {
  showMessage("🏍️ فرم ثبت موتورسیکلت را در مرحله بعد اضافه می‌کنیم.");
}

function newCase() {
  showMessage("🔧 فرم پذیرش و ایجاد پرونده تعمیرگاه را در مرحله بعد اضافه می‌کنیم.");
}

loadDashboard();
