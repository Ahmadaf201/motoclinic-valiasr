const API_URL = "https://motoclinic-api.onrender.com/api";
const AUTH_TOKEN_KEY = "motoclinic_auth_token";

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

// ─────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    showLogin();
    throw new Error("نشست شما منقضی شده است.");
  }

  return response;
}

function showLogin() {
  app.innerHTML = `
    <div dir="rtl" style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f3f3f3;
      font-family:Tahoma,Arial,sans-serif;
      padding:20px;
      box-sizing:border-box;
    ">

      <div style="
        width:380px;
        max-width:100%;
        background:#fff;
        padding:30px;
        border-radius:20px;
        box-shadow:0 10px 35px rgba(0,0,0,.12);
        box-sizing:border-box;
      ">

        <div style="
          text-align:center;
          font-size:48px;
          margin-bottom:10px;
        ">
          🏍️
        </div>

        <h1 style="
          text-align:center;
          margin:0 0 10px;
          font-size:24px;
        ">
          موتو کلینیک ولیعصر (عج)
        </h1>

        <p style="
          text-align:center;
          color:#777;
          margin-bottom:25px;
        ">
          ورود به پنل مدیریت تعمیرگاه
        </p>

        <input
          id="loginUsername"
          type="text"
          placeholder="نام کاربری"
          autocomplete="username"
          style="${inputStyle}"
        >

        <input
          id="loginPassword"
          type="password"
          placeholder="رمز عبور"
          autocomplete="current-password"
          style="${inputStyle}"
          onkeydown="if(event.key === 'Enter') login()"
        >

        <button
          onclick="login()"
          style="
            ${buttonStyle}
            width:100%;
            margin-top:10px;
          "
        >
          🔐 ورود به سیستم
        </button>

        <div
          id="loginError"
          style="
            color:#d00;
            text-align:center;
            margin-top:15px;
            min-height:22px;
            font-size:14px;
          "
        ></div>

      </div>
    </div>
  `;

  setTimeout(() => {
    const input = document.getElementById("loginUsername");
    if (input) input.focus();
  }, 50);
}

async function login() {
  const usernameElement = document.getElementById("loginUsername");
  const passwordElement = document.getElementById("loginPassword");
  const errorElement = document.getElementById("loginError");

  if (!usernameElement || !passwordElement || !errorElement) {
    return;
  }

  const username = usernameElement.value.trim();
  const password = passwordElement.value;

  if (!username || !password) {
    errorElement.textContent =
      "⚠️ نام کاربری و رمز عبور را وارد کنید.";
    return;
  }

  errorElement.textContent = "در حال ورود...";

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      errorElement.textContent =
        data.message || "❌ نام کاربری یا رمز عبور اشتباه است.";
      return;
    }

    if (!data.token) {
      errorElement.textContent =
        "❌ سرور توکن ورود ارسال نکرد.";
      return;
    }

    localStorage.setItem(AUTH_TOKEN_KEY, data.token);

    await initApp();

  } catch (error) {
    console.error(error);

    errorElement.textContent =
      "❌ ارتباط با سرور برقرار نشد.";
  }
}

async function initApp() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  if (!token) {
    showLogin();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      showLogin();
      return;
    }

    const data = await response.json();

    window.currentUser = data.user || null;

    await loadDashboard();

  } catch (error) {
    console.error(error);

    localStorage.removeItem(AUTH_TOKEN_KEY);
    showLogin();
  }
}

async function logout() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  try {
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.currentUser = null;

  showLogin();
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

async function loadDashboard() {
  app.innerHTML = `
    <div dir="rtl" style="
      font-family:Tahoma,Arial,sans-serif;
      max-width:1100px;
      margin:auto;
      padding:20px;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:15px;
        flex-wrap:wrap;
      ">

        <div>
          <h1 style="margin-bottom:8px;">
            🏍️ موتو کلینیک ولیعصر (عج)
          </h1>

          <p style="color:#666;margin-top:0;">
            سیستم هوشمند مدیریت تعمیرگاه موتورسیکلت
          </p>
        </div>

        <button
          onclick="logout()"
          style="
            padding:10px 16px;
            border:none;
            border-radius:10px;
            background:#222;
            color:white;
            cursor:pointer;
            font-family:Tahoma,Arial,sans-serif;
          "
        >
          🚪 خروج
        </button>

      </div>

      ${
        window.currentUser
          ? `
            <div style="
              margin-top:10px;
              padding:12px 15px;
              background:#f7f7f7;
              border-radius:10px;
              color:#555;
            ">
              👤 کاربر:
              <strong>${window.currentUser.username || ""}</strong>
              ${
                window.currentUser.role
                  ? ` — ${window.currentUser.role}`
                  : ""
              }
            </div>
          `
          : ""
      }

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
    const response = await apiFetch(`${API_URL}/dashboard`);

    if (!response.ok) {
      throw new Error("API error");
    }

    const data = await response.json();

    document.getElementById("customers").textContent =
      Number(data.customers || 0).toLocaleString("fa-IR");

    document.getElementById("motorcycles").textContent =
      Number(data.motorcycles || 0).toLocaleString("fa-IR");

    document.getElementById("cases").textContent =
      Number(data.activeCases || 0).toLocaleString("fa-IR");

    document.getElementById("income").textContent =
      Number(data.revenue || 0).toLocaleString("fa-IR");

    document.getElementById("apiStatus").innerHTML =
      "🟢 اتصال به سیستم برقرار است";

  } catch (error) {

    console.error(error);

    const status = document.getElementById("apiStatus");

    if (status) {
      status.innerHTML =
        "🔴 خطا در اتصال به API";
    }
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

// ─────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────

function newCustomer() {
  const message = document.getElementById("message");

  if (!message) return;

  message.innerHTML = `
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
  const name =
    document.getElementById("customerName").value.trim();

  const phone =
    document.getElementById("customerPhone").value.trim();

  const address =
    document.getElementById("customerAddress").value.trim();

  const notes =
    document.getElementById("customerNotes").value.trim();

  if (!name) {
    showMessage("⚠️ نام مشتری را وارد کنید.");
    return;
  }

  try {
    const response = await apiFetch(`${API_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        phone,
        address,
        notes,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        "خطا در ثبت مشتری"
      );
    }

    const customer = data.customer || data;

    showMessage(`
      <strong>✅ مشتری با موفقیت ثبت شد.</strong>
      <br>
      نام: ${customer.name || name}
      <br>
      شناسه مشتری: ${customer.id || "ثبت شد"}
    `);

    await loadDashboard();

  } catch (error) {
    console.error(error);
    showMessage(`❌ ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// MOTORCYCLE
// ─────────────────────────────────────────────

async function newMotorcycle() {
  const message = document.getElementById("message");

  if (!message) return;

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
    const response =
      await apiFetch(`${API_URL}/customers`);

    if (!response.ok) {
      throw new Error("خطا در دریافت مشتریان");
    }

    const customers = await response.json();

    if (!Array.isArray(customers) || !customers.length) {

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

    document.getElementById(
      "motorcycleFormStatus"
    ).innerHTML = `

      <select
        id="motorcycleCustomer"
        style="${inputStyle}"
      >

        <option value="">
          انتخاب مالک *
        </option>

        ${customers
          .map(
            (customer) => `
              <option value="${customer.id}">
                ${customer.name}
                ${
                  customer.phone
                    ? ` - ${customer.phone}`
                    : ""
                }
              </option>
            `
          )
          .join("")}

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

    console.error(error);

    showMessage(`❌ ${error.message}`);
  }
}

async function saveMotorcycle() {
  const customerId =
    document.getElementById(
      "motorcycleCustomer"
    ).value;

  const plate =
    document.getElementById(
      "motorcyclePlate"
    ).value.trim();

  const brand =
    document.getElementById(
      "motorcycleBrand"
    ).value.trim();

  const model =
    document.getElementById(
      "motorcycleModel"
    ).value.trim();

  const year =
    document.getElementById(
      "motorcycleYear"
    ).value.trim();

  const color =
    document.getElementById(
      "motorcycleColor"
    ).value.trim();

  const vin =
    document.getElementById(
      "motorcycleVin"
    ).value.trim();

  const mileage =
    document.getElementById(
      "motorcycleMileage"
    ).value.trim();

  if (!customerId) {
    showMessage(
      "⚠️ مالک موتورسیکلت را انتخاب کنید."
    );
    return;
  }

  if (!plate) {
    showMessage(
      "⚠️ شماره پلاک را وارد کنید."
    );
    return;
  }

  try {

    const response =
      await apiFetch(`${API_URL}/motorcycles`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          customerId,
          plate,
          brand,
          model,
          year: year
            ? Number(year)
            : null,
          color,
          vin,
          mileage: mileage
            ? Number(mileage)
            : 0,
        }),
      });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        "خطا در ثبت موتورسیکلت"
      );
    }

    const motorcycle =
      data.motorcycle || data;

    showMessage(`
      <strong>
        ✅ موتورسیکلت با موفقیت ثبت شد.
      </strong>

      <br>

      پلاک:
      ${motorcycle.plate || plate}

      <br>

      شناسه موتورسیکلت:
      ${motorcycle.id || "ثبت شد"}
    `);

    await loadDashboard();

  } catch (error) {

    console.error(error);

    showMessage(`❌ ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// SERVICE CASE
// ─────────────────────────────────────────────

function newCase() {
  showMessage(`
    🔧 بخش پذیرش تعمیرگاه در مرحله بعد فعال می‌شود.
    <br>
    این بخش به زنجیره پرونده تعمیر،
    تشخیص، قطعات، اجرت و وضعیت تعمیر متصل خواهد شد.
  `);
}

// ─────────────────────────────────────────────
// START APPLICATION
// ─────────────────────────────────────────────

initApp();
