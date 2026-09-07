'use strict';

/* =========================================================
   MOTO CLINIC VALIASR
   Premium Frontend
   Public Website + Admin Panel
   Backend API v1.0.0
   ========================================================= */

const API_URL =
  window.__API_URL__ ||
  'https://motoclinic-api.onrender.com/api';

const TOKEN_KEY = 'motoclinic_token';
const USER_KEY = 'motoclinic_user';

const state = {
  user: null,
  cases: [],
  customers: [],
  motorcycles: [],
  dashboard: null
};

/* =========================
   HELPERS
   ========================= */

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function money(value) {
  return Number(value || 0).toLocaleString('fa-IR');
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function saveSession(user, jwt) {
  state.user = user || null;

  if (jwt) {
    localStorage.setItem(TOKEN_KEY, jwt);
  }

  if (user) {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user)
    );
  }
}

function loadSession() {
  try {
    state.user = JSON.parse(
      localStorage.getItem(USER_KEY) || 'null'
    );
  } catch {
    state.user = null;
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  state.user = null;
  state.cases = [];
  state.customers = [];
  state.motorcycles = [];
  state.dashboard = null;
}

function authHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token()) {
    headers.Authorization =
      `Bearer ${token()}`;
  }

  return headers;
}

async function api(path, options = {}) {

  const response = await fetch(
    API_URL.replace(/\/$/, '') + path,
    {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {

    if (response.status === 401) {
      clearSession();
    }

    throw new Error(
      data.message ||
      data.error ||
      `خطای سرور ${response.status}`
    );
  }

  return data;
}

function toast(message, type = '') {

  let el = $('mcToast');

  if (!el) {

    el = document.createElement('div');

    el.id = 'mcToast';

    el.className = 'toast';

    document.body.appendChild(el);
  }

  el.textContent = message;

  el.className =
    `toast ${type}`;

  el.style.display = 'block';

  clearTimeout(window.__toastTimer);

  window.__toastTimer =
    setTimeout(() => {
      el.style.display = 'none';
    }, 2800);
}

function statusClass(status) {
  const map = {
    OPEN: 'status-received',
    IN_PROGRESS: 'status-progress',
    WAITING_APPROVAL: 'status-diagnosis',
    APPROVED: 'status-progress',
    REPAIRING: 'status-progress',
    READY_FOR_DELIVERY: 'status-ready',
    DELIVERED: 'status-completed',
    CANCELLED: 'status-default'
  };

  return map[status] || 'status-default';
}

function statusText(status) {
  const map = {
    OPEN: 'باز',
    IN_PROGRESS: 'در حال بررسی',
    WAITING_APPROVAL: 'در انتظار تأیید',
    APPROVED: 'تأیید شده',
    REPAIRING: 'در حال تعمیر',
    READY_FOR_DELIVERY: 'آماده تحویل',
    DELIVERED: 'تحویل شده',
    CANCELLED: 'لغو شده'
  };

  return map[status] || status || 'ثبت شده';
}

function isClosedCase(status) {
  return ['DELIVERED', 'CANCELLED'].includes(status);
}

function caseCode(c) {
  return c?.case_code ||
    c?.caseCode ||
    c?.code ||
    c?.id ||
    '-';
}

/* =========================
   DATA NORMALIZATION
   ========================= */

function extractCases(data) {

  if (Array.isArray(data?.cases)) {
    return data.cases;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function extractCustomers(data) {

  if (Array.isArray(data?.customers)) {
    return data.customers;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function extractMotorcycles(data) {

  if (Array.isArray(data?.motorcycles)) {
    return data.motorcycles;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

/* =========================
   DATA
   ========================= */

async function loadPublicCases() {

  /*
    Backend v1.0 protects /cases.
    Public tracking does not preload private cases.
  */

  state.cases = [];
}

async function loadAdminData() {

  const results =
    await Promise.allSettled([
      api('/dashboard'),
      api('/cases'),
      api('/customers'),
      api('/motorcycles')
    ]);

  if (
    results[0].status === 'fulfilled'
  ) {

    const data =
      results[0].value;

    state.dashboard =
      data?.dashboard ||
      null;
  }

  if (
    results[1].status === 'fulfilled'
  ) {

    state.cases =
      extractCases(
        results[1].value
      );
  }

  if (
    results[2].status === 'fulfilled'
  ) {

    state.customers =
      extractCustomers(
        results[2].value
      );
  }

  if (
    results[3].status === 'fulfilled'
  ) {

    state.motorcycles =
      extractMotorcycles(
        results[3].value
      );
  }
}

/* =========================
   PUBLIC WEBSITE
   ========================= */

function renderPublic() {

  document.body.innerHTML = `

    <div class="shell">

      <header class="topbar">

        <div class="brand">

          <div class="brand-icon">
            🏍
          </div>

          <div>

            <h1>
              موتو کلینیک
            </h1>

            <span>
              ولیعصر (عج)
            </span>

          </div>

        </div>

        <nav class="nav">

          <a href="#home">
            خانه
          </a>

          <a href="#services">
            خدمات
          </a>

          <a href="#tracking">
            پیگیری تعمیر
          </a>

          <a href="#request">
            درخواست پذیرش
          </a>

        </nav>

        <button
          class="outline-btn"
          onclick="showLogin()"
        >
          ورود مدیریت
        </button>

      </header>

      <main>

        <section
          class="hero"
          id="home"
        >

          <div class="hero-content">

            <div class="eyebrow">
              MOTO CLINIC • PROFESSIONAL SERVICE
            </div>

            <h2>

              تعمیرگاه حرفه‌ای،
              <br>
              برای موتورسیکلت حرفه‌ای

            </h2>

            <p>

              سرویس، تعمیر، عیب‌یابی و نگهداری تخصصی
              موتورسیکلت با فرآیند شفاف و قابل پیگیری.

            </p>

            <div class="hero-actions">

              <button
                class="primary-btn"
                onclick="scrollToId('request')"
              >
                درخواست پذیرش
              </button>

              <button
                class="secondary-btn"
                onclick="scrollToId('tracking')"
              >
                پیگیری تعمیر
              </button>

            </div>

          </div>

        </section>

        <section
          class="section"
          id="services"
        >

          <div class="section-heading">

            <div>

              <span class="eyebrow">
                OUR SERVICES
              </span>

              <h2>
                خدمات موتو کلینیک
              </h2>

            </div>

            <p>
              از سرویس دوره‌ای تا عیب‌یابی و تعمیرات تخصصی.
            </p>

          </div>

          <div class="services-grid">

            <article class="service-card">

              <div class="service-icon">
                🔧
              </div>

              <h3>
                تعمیرات تخصصی
              </h3>

              <p>
                بررسی و تعمیر سیستم‌های فنی و مکانیکی
                موتورسیکلت.
              </p>

            </article>

            <article class="service-card">

              <div class="service-icon">
                ⚙️
              </div>

              <h3>
                سرویس دوره‌ای
              </h3>

              <p>
                سرویس‌های پیشگیرانه برای عملکرد بهتر
                و عمر بیشتر موتور.
              </p>

            </article>

            <article class="service-card">

              <div class="service-icon">
                🩺
              </div>

              <h3>
                عیب‌یابی
              </h3>

              <p>
                بررسی دقیق مشکل قبل از شروع تعمیر.
              </p>

            </article>

            <article class="service-card">

              <div class="service-icon">
                🏁
              </div>

              <h3>
                سرویس سریع
              </h3>

              <p>
                خدمات سریع برای کارهای ضروری و روزمره.
              </p>

            </article>

          </div>

        </section>

        <section class="express">

          <div class="express-content">

            <span class="express-label">
              EXPRESS SERVICE
            </span>

            <h2>

              سریع، دقیق،
              <br>
              بدون دردسر

            </h2>

            <p>

              فرآیند پذیرش و پیگیری تعمیر را ساده کرده‌ایم
              تا همیشه بدانید موتورسیکلت شما در چه مرحله‌ای است.

            </p>

            <div class="express-badge">
              ✓ شفافیت در فرآیند تعمیر
            </div>

          </div>

        </section>

        <section class="section">

          <div class="section-heading">

            <div>

              <span class="eyebrow">
                WHY MOTO CLINIC
              </span>

              <h2>
                چرا موتو کلینیک؟
              </h2>

            </div>

          </div>

          <div class="features-grid">

            <article class="feature-card">

              <strong>
                01
              </strong>

              <h3>
                تشخیص دقیق
              </h3>

              <p>
                مشکل موتورسیکلت قبل از تعمیر بررسی می‌شود.
              </p>

            </article>

            <article class="feature-card">

              <strong>
                02
              </strong>

              <h3>
                فرآیند شفاف
              </h3>

              <p>
                مراحل تعمیر و وضعیت پرونده قابل پیگیری است.
              </p>

            </article>

            <article class="feature-card">

              <strong>
                03
              </strong>

              <h3>
                خدمات حرفه‌ای
              </h3>

              <p>
                هدف ما تعمیر اصولی و افزایش عمر موتورسیکلت است.
              </p>

            </article>

          </div>

        </section>

        <section
          class="section tracking-section"
          id="tracking"
        >

          <div class="section-heading">

            <div>

              <span class="eyebrow">
                TRACK YOUR MOTORCYCLE
              </span>

              <h2>
                پیگیری تعمیر
              </h2>

            </div>

            <p>
              کد پرونده خود را وارد کنید.
            </p>

          </div>

          <div class="tracking-box">

            <form
              class="tracking-form"
              onsubmit="trackCase(event)"
            >

              <input
                id="trackCode"
                placeholder="مثلاً MC-1001"
                autocomplete="off"
                required
              >

              <button
                class="primary-btn"
                type="submit"
              >
                پیگیری پرونده
              </button>

            </form>

            <div
              id="trackingResult"
              class="tracking-result"
            ></div>

          </div>

        </section>

        <section
          class="section request-section"
          id="request"
        >

          <div class="section-heading">

            <div>

              <span class="eyebrow">
                ONLINE REQUEST
              </span>

              <h2>
                درخواست پذیرش
              </h2>

            </div>

            <p>
              اطلاعات اولیه را ارسال کنید تا با شما تماس بگیریم.
            </p>

          </div>

          <div class="request-layout">

            <div class="panel">

              <form
                class="request-form"
                onsubmit="submitRequest(event)"
              >

                <div class="field">

                  <label>
                    نام و نام خانوادگی
                  </label>

                  <input
                    id="requestName"
                    required
                  >

                </div>

                <div class="field">

                  <label>
                    شماره موبایل
                  </label>

                  <input
                    id="requestPhone"
                    inputmode="tel"
                    required
                  >

                </div>

                <div class="field">

                  <label>
                    موتورسیکلت
                  </label>

                  <input
                    id="requestMotorcycle"
                    placeholder="برند و مدل"
                    required
                  >

                </div>

                <div class="field">

                  <label>
                    نوع خدمت
                  </label>

                  <select
                    id="requestService"
                    required
                  >

                    <option value="">
                      انتخاب کنید
                    </option>

                    <option value="سرویس دوره‌ای">
                      سرویس دوره‌ای
                    </option>

                    <option value="تعمیرات">
                      تعمیرات
                    </option>

                    <option value="عیب‌یابی">
                      عیب‌یابی
                    </option>

                    <option value="سرویس سریع">
                      سرویس سریع
                    </option>

                    <option value="سایر">
                      سایر
                    </option>

                  </select>

                </div>

                <div class="field">

                  <label>
                    توضیحات
                  </label>

                  <textarea
                    id="requestDescription"
                    rows="5"
                    placeholder="شرح کوتاهی از مشکل..."
                  ></textarea>

                </div>

                <button
                  class="primary-btn"
                  type="submit"
                >
                  ارسال درخواست
                </button>

              </form>

            </div>

            <div class="contact-card">

              <span class="eyebrow">
                MOTO CLINIC
              </span>

              <h3>
                موتو کلینیک ولیعصر (عج)
              </h3>

              <p>
                تعمیر و سرویس تخصصی موتورسیکلت
                با رویکرد حرفه‌ای و شفاف.
              </p>

              <div class="contact-item">

                <span>
                  تلفن
                </span>

                <strong>
                  09195805965
                </strong>

              </div>

              <div class="contact-item">

                <span>
                  آدرس
                </span>

                <strong>
                  میدان رسالت، خیابان شهید سلمان طرقی، پلاک ۸۶
                </strong>

              </div>

            </div>

          </div>

        </section>

      </main>

      <footer class="footer">

        <div>

          <strong>
            موتو کلینیک ولیعصر (عج)
          </strong>

          <span>
            حرفه‌ای، شفاف، قابل پیگیری
          </span>

        </div>

        <div>
          © ${new Date().getFullYear()} MOTO CLINIC
        </div>

      </footer>

    </div>

    <div
      id="loginModal"
      class="modal"
      style="display:none"
    >

      <div
        class="modal-backdrop"
        onclick="showLogin(false)"
      ></div>

      <div class="modal-card">

        <button
          class="modal-close"
          onclick="showLogin(false)"
        >
          ×
        </button>

        <span class="eyebrow">
          ADMIN ACCESS
        </span>

        <h2>
          ورود مدیریت
        </h2>

        <p>
          برای ورود به پنل مدیریت اطلاعات حساب خود را وارد کنید.
        </p>

        <form
          onsubmit="submitLogin(event)"
          class="login-form"
        >

          <div class="field">

            <label>
              نام کاربری
            </label>

            <input
              id="loginUsername"
              autocomplete="username"
              required
            >

          </div>

          <div class="field">

            <label>
              رمز عبور
            </label>

            <input
              id="loginPassword"
              type="password"
              autocomplete="current-password"
              required
            >

          </div>

          <button
            class="primary-btn"
            type="submit"
          >
            ورود به پنل
          </button>

        </form>

        <div
          id="loginStatus"
          class="status-result"
        ></div>

      </div>

    </div>
  `;
}

/* =========================
   PUBLIC TRACKING
   ========================= */

async function trackCase(event) {

  event.preventDefault();

  const input =
    $('trackCode');

  const result =
    $('trackingResult');

  const code =
    input?.value.trim();

  if (!code) {
    return;
  }

  if (result) {
    result.innerHTML =
      `<div class="loading">
        در حال بررسی پرونده...
      </div>`;
  }

  try {

    const data =
      await api(
        `/cases?code=${encodeURIComponent(code)}`
      );

    const c =
      data?.case ||
      data?.cases?.[0] ||
      null;

    if (!c) {

      if (result) {

        result.innerHTML =
          `<div class="status-result">
             پرونده‌ای با این کد پیدا نشد.
           </div>`;
      }

      return;
    }

    const name =
      c.customer_name ||
      c.customerName ||
      'مشتری';

    const bike =
      [
        c.motorcycle_brand,
        c.motorcycle_model
      ]
        .filter(Boolean)
        .join(' ') ||
      c.motorcycle ||
      '-';

    if (result) {

      result.innerHTML = `

        <div class="tracking-card">

          <div class="tracking-card-top">

            <div>

              <span>
                کد پرونده
              </span>

              <strong>
                ${esc(caseCode(c))}
              </strong>

            </div>

            <span
              class="status-pill ${statusClass(c.status)}"
            >
              ${esc(statusText(c.status))}
            </span>

          </div>

          <div class="tracking-grid">

            <div>

              <span>
                مشتری
              </span>

              <strong>
                ${esc(name)}
              </strong>

            </div>

            <div>

              <span>
                موتورسیکلت
              </span>

              <strong>
                ${esc(bike)}
              </strong>

            </div>

            <div>

              <span>
                پلاک
              </span>

              <strong>
                ${esc(c.motorcycle_plate || '-')}
              </strong>

            </div>

            <div>

              <span>
                آخرین وضعیت
              </span>

              <strong>
                ${esc(statusText(c.status))}
              </strong>

            </div>

          </div>

          <div class="tracking-note">

            برای دریافت جزئیات بیشتر با موتو کلینیک تماس بگیرید.

          </div>

        </div>
      `;
    }

  } catch (err) {

    if (result) {

      result.innerHTML =
        `<div class="status-result">
          ${esc(
            err.message ||
            'پیگیری پرونده انجام نشد'
          )}
        </div>`;
    }
  }
}

/* =========================
   PUBLIC REQUEST
   ========================= */

async function submitRequest(event) {

  event.preventDefault();

  const name =
    $('requestName')?.value.trim();

  const phone =
    $('requestPhone')?.value.trim();

  const motorcycle =
    $('requestMotorcycle')?.value.trim();

  const service =
    $('requestService')?.value.trim();

  const description =
    $('requestDescription')?.value.trim();

  if (
    !name ||
    !phone ||
    !motorcycle ||
    !service
  ) {

    toast(
      'لطفاً اطلاعات الزامی را کامل کنید'
    );

    return;
  }

  try {

    await api(
      '/customer-requests',
      {
        method: 'POST',

        body: JSON.stringify({
          name,
          phone,
          motorcycle,
          service,
          description
        })
      }
    );

    toast(
      'درخواست شما با موفقیت ثبت شد'
    );

    event.target.reset();

  } catch (err) {

    toast(
      err.message ||
      'ثبت درخواست انجام نشد'
    );
  }
}

/* =========================
   LOGIN
   ========================= */

function showLogin(open = true) {

  const modal =
    $('loginModal');

  if (!modal) {
    return;
  }

  modal.style.display =
    open ? 'flex' : 'none';

  if (open) {

    setTimeout(() => {
      $('loginUsername')?.focus();
    }, 100);
  }
}

async function submitLogin(event) {

  event.preventDefault();

  const username =
    $('loginUsername')?.value.trim();

  const password =
    $('loginPassword')?.value;

  const status =
    $('loginStatus');

  if (status) {

    status.textContent =
      'در حال ورود...';

    status.style.display =
      'block';
  }

  try {

    const data =
      await api(
        '/auth/login',
        {
          method: 'POST',

          body: JSON.stringify({
            username,
            password
          })
        }
      );

    saveSession(
      data?.user ||
      data?.account ||
      null,

      data?.token ||
      data?.accessToken ||
      ''
    );

    try {

      const me =
        await api('/auth/me');

      state.user =
        me?.user ||
        me?.account ||
        me;

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(
          state.user
        )
      );

    } catch {}

    await loadAdminData();

    renderAdmin();

    toast(
      'ورود با موفقیت انجام شد'
    );

  } catch (err) {

    if (status) {

      status.textContent =
        err.message ||
        'ورود ناموفق بود';

      status.className =
        'status-result error';
    }

    toast(
      err.message ||
      'ورود ناموفق بود'
    );
  }
}

/* =========================
   ADMIN SHELL
   ========================= */

function renderAdmin() {

  document.body.innerHTML = `

    <div class="shell admin-shell">

      <header class="topbar admin-topbar">

        <div class="brand">

          <div class="brand-icon">
            🏍
          </div>

          <div>

            <h1>
              موتو کلینیک
            </h1>

            <span>
              پنل مدیریت
            </span>

          </div>

        </div>

        <div class="admin-user">

          <span>
            ${esc(
              state.user?.name ||
              state.user?.username ||
              'مدیریت'
            )}
          </span>

          <button
            class="outline-btn"
            onclick="logout()"
          >
            خروج
          </button>

        </div>

      </header>

      <div class="admin-layout">

        <aside class="admin-sidebar">

          <button
            class="admin-nav-btn active"
            data-page="dashboard"
            onclick="renderAdminPage('dashboard')"
          >
            <span>
              ◈
            </span>

            داشبورد
          </button>

          <button
            class="admin-nav-btn"
            data-page="cases"
            onclick="renderAdminPage('cases')"
          >
            <span>
              📋
            </span>

            پرونده‌ها
          </button>

          <button
            class="admin-nav-btn"
            data-page="reception"
            onclick="renderAdminPage('reception')"
          >
            <span>
              ➕
            </span>

            پذیرش جدید
          </button>

          <button
            class="admin-nav-btn"
            data-page="workshop"
            onclick="renderAdminPage('workshop')"
          >
            <span>
              🔧
            </span>

            تعمیرگاه
          </button>

        </aside>

        <main
          id="adminContent"
          class="admin-content"
        ></main>

      </div>

    </div>

  `;

  renderAdminPage('dashboard');
}

function renderAdminPage(page) {

  const root =
    $('adminContent');

  if (!root) {
    return;
  }

  document
    .querySelectorAll(
      '.admin-nav-btn'
    )
    .forEach(btn => {

      btn.classList.toggle(
        'active',
        btn.dataset.page === page
      );
    });

  if (page === 'dashboard') {

    renderAdminDashboard(root);

    return;
  }

  if (page === 'cases') {

    renderAdminCases(root);

    return;
  }

  if (page === 'reception') {

    renderAdminReception(root);

    return;
  }

  if (page === 'workshop') {

    renderAdminWorkshop(root);

    return;
  }

  renderAdminDashboard(root);
}

/* =========================
   ADMIN DASHBOARD
   ========================= */

function renderAdminDashboard(root) {

  const d =
    state.dashboard || {};

  const customers =
    Number(d.customers || 0);

  const motorcycles =
    Number(d.motorcycles || 0);

  const cases =
    Number(d.cases || 0);

  const newRequests =
    Number(d.newRequests || 0);

  const activeCases =
    Number(d.activeCases || 0);

  const waitingApproval =
    Number(d.waitingApproval || 0);

  const readyForDelivery =
    Number(d.readyForDelivery || 0);

  const delivered =
    Number(d.delivered || 0);

  const unpaidBalance =
    Number(d.unpaidBalance || 0);

  root.innerHTML = `

    <section class="section admin-page">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            CONTROL CENTER
          </span>

          <h2>
            داشبورد مدیریت
          </h2>

          <p>
            نمای کلی وضعیت موتو کلینیک
          </p>

        </div>

        <button
          class="secondary-btn"
          onclick="loadAdminData().then(() => renderAdminPage('dashboard'))"
        >
          بروزرسانی
        </button>

      </div>

      <div class="stats-grid">

        <div class="stat-card">

          <span>
            مشتریان
          </span>

          <strong>
            ${money(customers)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            موتورسیکلت‌ها
          </span>

          <strong>
            ${money(motorcycles)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            کل پرونده‌ها
          </span>

          <strong>
            ${money(cases)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            پرونده‌های فعال
          </span>

          <strong>
            ${money(activeCases)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            درخواست‌های جدید
          </span>

          <strong>
            ${money(newRequests)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            در انتظار تأیید
          </span>

          <strong>
            ${money(waitingApproval)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            آماده تحویل
          </span>

          <strong>
            ${money(readyForDelivery)}
          </strong>

        </div>

        <div class="stat-card">

          <span>
            تحویل شده
          </span>

          <strong>
            ${money(delivered)}
          </strong>

        </div>

      </div>

      <div class="dashboard-bottom">

        <div class="panel">

          <div class="panel-title">

            <h3>
              وضعیت مالی
            </h3>

          </div>

          <div class="financial-highlight">

            <span>
              مانده دریافتنی
            </span>

            <strong>
              ${money(unpaidBalance)}
              <small>
                تومان
              </small>
            </strong>

          </div>

        </div>

        <div class="panel">

          <div class="panel-title">

            <h3>
              عملیات سریع
            </h3>

          </div>

          <div class="quick-actions">

            <button
              class="primary-btn"
              onclick="renderAdminPage('reception')"
            >
              پذیرش جدید
            </button>

            <button
              class="secondary-btn"
              onclick="renderAdminPage('cases')"
            >
              مشاهده پرونده‌ها
            </button>

            <button
              class="secondary-btn"
              onclick="renderAdminPage('workshop')"
            >
              وضعیت تعمیرگاه
            </button>

          </div>

        </div>

      </div>

    </section>
  `;
}

/* =========================
   ADMIN CASES
   ========================= */

function renderAdminCases(root) {

  root.innerHTML = `

    <section class="section admin-page">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            SERVICE CASES
          </span>

          <h2>
            پرونده‌های تعمیر
          </h2>

          <p>
            مشاهده و مدیریت پرونده‌های مشتریان
          </p>

        </div>

        <button
          class="primary-btn"
          onclick="renderAdminPage('reception')"
        >
          + پذیرش جدید
        </button>

      </div>

      <div class="panel">

        <div class="toolbar">

          <div class="search-box">

            <input
              id="caseSearch"
              placeholder="جستجو بر اساس کد، مشتری، موبایل یا پلاک..."
              oninput="filterAdminCases()"
            >

          </div>

          <select
            id="caseStatusFilter"
            onchange="filterAdminCases()"
          >

            <option value="">
              همه وضعیت‌ها
            </option>

            <option value="OPEN">
              باز
            </option>

            <option value="IN_PROGRESS">
              در حال بررسی
            </option>

            <option value="WAITING_APPROVAL">
              در انتظار تأیید
            </option>

            <option value="APPROVED">
              تأیید شده
            </option>

            <option value="REPAIRING">
              در حال تعمیر
            </option>

            <option value="READY_FOR_DELIVERY">
              آماده تحویل
            </option>

            <option value="DELIVERED">
              تحویل شده
            </option>

            <option value="CANCELLED">
              لغو شده
            </option>

          </select>

        </div>

        <div
          id="adminCaseRows"
          class="records"
        ></div>

      </div>

    </section>
  `;

  renderAdminCaseRows(
    state.cases,
    $('adminCaseRows')
  );
}

function filterAdminCases() {

  const search =
    $('caseSearch')?.value
      .trim()
      .toLowerCase() || '';

  const status =
    $('caseStatusFilter')?.value || '';

  let rows =
    state.cases.slice();

  if (search) {

    rows =
      rows.filter(c => {

        const text =
          [
            caseCode(c),
            c.customer_name,
            c.customer_phone,
            c.motorcycle_plate,
            c.motorcycle_model,
            c.motorcycle_brand,
            c.complaint,
            c.description
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return text.includes(search);
      });
  }

  if (status) {

    rows =
      rows.filter(
        c => c.status === status
      );
  }

  renderAdminCaseRows(
    rows,
    $('adminCaseRows')
  );
}

function renderAdminCaseRows(
  rows = state.cases,
  root = $('adminCaseRows')
) {

  if (!root) {
    return;
  }

  if (!rows.length) {

    root.innerHTML = `

      <div class="empty-state">

        <strong>
          پرونده‌ای پیدا نشد
        </strong>

        <span>
          هنوز پرونده‌ای با این شرایط ثبت نشده است.
        </span>

      </div>

    `;

    return;
  }

  root.innerHTML =
    rows.map(c => {

      const customer =
        c.customer_name ||
        c.customerName ||
        '-';

      const bike =
        [
          c.motorcycle_brand,
          c.motorcycle_model
        ]
          .filter(Boolean)
          .join(' ') ||
        c.motorcycle ||
        '-';

      const plate =
        c.motorcycle_plate ||
        c.plate ||
        '-';

      return `

        <button
          class="record-row"
          onclick="openAdminCase('${esc(c.id)}')"
        >

          <div class="record-main">

            <strong>
              ${esc(caseCode(c))}
            </strong>

            <span>
              ${esc(customer)}
            </span>

          </div>

          <div class="record-bike">

            <strong>
              ${esc(bike)}
            </strong>

            <span>
              ${esc(plate)}
            </span>

          </div>

          <div class="record-status">

            <span
              class="status-pill ${statusClass(c.status)}"
            >
              ${esc(
                statusText(c.status)
              )}
            </span>

          </div>

          <div class="record-arrow">
            ←
          </div>

        </button>

      `;

    }).join('');
}

/* =========================
   ADMIN CASE DETAIL
   ========================= */

async function openAdminCase(id) {

  const root =
    $('adminContent');

  if (!root) {
    return;
  }

  root.innerHTML = `

    <section class="section">

      <div class="loading">
        در حال دریافت اطلاعات پرونده...
      </div>

    </section>

  `;

  try {

    const data =
      await api(
        `/cases/${encodeURIComponent(id)}`
      );

    const c =
      data?.case ||
      {};

    const tasks =
      Array.isArray(data?.tasks)
        ? data.tasks
        : [];

    const parts =
      Array.isArray(data?.parts)
        ? data.parts
        : [];

    const payments =
      Array.isArray(data?.payments)
        ? data.payments
        : [];

    const notes =
      Array.isArray(data?.notes)
        ? data.notes
        : [];

    const history =
      Array.isArray(data?.history)
        ? data.history
        : [];

    const estimate =
      data?.estimate ||
      null;

    const financial =
      data?.financial ||
      {};

    const customerName =
      c.customer_name ||
      c.customerName ||
      '-';

    const customerPhone =
      c.customer_phone ||
      c.customerPhone ||
      '-';

    const motorcycle =
      [
        c.motorcycle_brand,
        c.motorcycle_model
      ]
        .filter(Boolean)
        .join(' ') ||
      '-';

    const plate =
      c.motorcycle_plate ||
      '-';

    root.innerHTML = `

      <section class="section admin-page">

        <div class="section-heading">

          <div>

            <button
              class="back-btn"
              onclick="renderAdminPage('cases')"
            >
              ← بازگشت به پرونده‌ها
            </button>

            <span class="eyebrow">
              CASE ${esc(caseCode(c))}
            </span>

            <h2>
              پرونده ${esc(caseCode(c))}
            </h2>

            <p>
              ${esc(customerName)}
              •
              ${esc(motorcycle)}
            </p>

          </div>

          <span
            class="status-pill ${statusClass(c.status)}"
          >
            ${esc(
              statusText(c.status)
            )}
          </span>

        </div>

        <div class="case-detail-grid">

          <div class="panel">

            <div class="panel-title">

              <h3>
                اطلاعات پرونده
              </h3>

            </div>

            <div class="detail-grid">

              <div>

                <span>
                  مشتری
                </span>

                <strong>
                  ${esc(customerName)}
                </strong>

              </div>

              <div>

                <span>
                  موبایل
                </span>

                <strong>
                  ${esc(customerPhone)}
                </strong>

              </div>

              <div>

                <span>
                  موتورسیکلت
                </span>

                <strong>
                  ${esc(motorcycle)}
                </strong>

              </div>

              <div>

                <span>
                  پلاک
                </span>

                <strong>
                  ${esc(plate)}
                </strong>

              </div>

              <div>

                <span>
                  اولویت
                </span>

                <strong>
                  ${esc(c.priority || 'NORMAL')}
                </strong>

              </div>

              <div>

                <span>
                  کد پرونده
                </span>

                <strong>
                  ${esc(caseCode(c))}
                </strong>

              </div>

            </div>

          </div>

          <div class="panel">

            <div class="panel-title">

              <h3>
                تغییر وضعیت
              </h3>

            </div>

            <div class="field">

              <label>
                وضعیت پرونده
              </label>

              <select id="caseStatus">

                ${statusOptions(
                  c.status
                )}

              </select>

            </div>

            <div class="field">

              <label>
                شرح مشکل
              </label>

              <textarea
                id="caseComplaint"
                rows="4"
              >${esc(
                c.complaint ||
                c.description ||
                ''
              )}</textarea>

            </div>

            <div class="field">

              <label>
                تشخیص
              </label>

              <textarea
                id="caseDiagnosis"
                rows="4"
              >${esc(
                c.diagnosis ||
                ''
              )}</textarea>

            </div>

            <div class="field">

              <label>
                یادداشت تغییر وضعیت
              </label>

              <textarea
                id="caseStatusNote"
                rows="3"
                placeholder="اختیاری"
              ></textarea>

            </div>

            <button
              class="primary-btn"
              onclick="saveCase('${esc(c.id)}')"
            >
              ذخیره تغییرات
            </button>

          </div>

        </div>

        <div class="case-detail-grid">

          <div class="panel">

            <div class="panel-title">

              <h3>
                کارهای تعمیر
              </h3>

              <span>
                ${money(tasks.length)}
              </span>

            </div>

            ${
              tasks.length
                ? `
                  <div class="detail-list">

                    ${tasks.map(t => `

                      <div class="detail-list-item">

                        <div class="avatar">
                          🔧
                        </div>

                        <div>

                          <strong>
                            ${esc(
                              t.title ||
                              'کار'
                            )}
                          </strong>

                          <span>
                            ${esc(
                              t.technician_name ||
                              ''
                            )}

                            ${
                              t.status
                                ? ' • ' +
                                  esc(t.status)
                                : ''
                            }
                          </span>

                          <small>
                            ${money(
                              t.labor_cost || 0
                            )}
                            تومان
                          </small>

                        </div>

                      </div>

                    `).join('')}

                  </div>
                `
                : `
                  <p>
                    هنوز کاری برای این پرونده ثبت نشده است.
                  </p>
                `
            }

          </div>

          <div class="panel">

            <div class="panel-title">

              <h3>
                قطعات
              </h3>

              <span>
                ${money(parts.length)}
              </span>

            </div>

            ${
              parts.length
                ? `
                  <div class="detail-list">

                    ${parts.map(p => `

                      <div class="detail-list-item">

                        <div class="avatar">
                          ⚙️
                        </div>

                        <div>

                          <strong>
                            ${esc(
                              p.part_name ||
                              p.name ||
                              'قطعه'
                            )}
                          </strong>

                          <span>
                            تعداد:
                            ${money(
                              p.quantity || 0
                            )}
                          </span>

                          <small>
                            ${money(
                              p.unit_price || 0
                            )}
                            تومان
                          </small>

                        </div>

                      </div>

                    `).join('')}

                  </div>
                `
                : `
                  <p>
                    هنوز قطعه‌ای برای این پرونده ثبت نشده است.
                  </p>
                `
            }

          </div>

        </div>

        <div class="case-detail-grid">

          <div class="panel">

            <div class="panel-title">

              <h3>
                وضعیت مالی
              </h3>

            </div>

            <div class="financial-list">

              <div>

                <span>
                  مبلغ کل
                </span>

                <strong>
                  ${money(
                    financial.total ||
                    estimate?.total ||
                    0
                  )}
                  تومان
                </strong>

              </div>

              <div>

                <span>
                  پرداخت شده
                </span>

                <strong>
                  ${money(
                    financial.paid ||
                    0
                  )}
                  تومان
                </strong>

              </div>

              <div>

                <span>
                  مانده
                </span>

                <strong>
                  ${money(
                    financial.balance ||
                    0
                  )}
                  تومان
                </strong>

              </div>

            </div>

          </div>

          <div class="panel">

            <div class="panel-title">

              <h3>
                برآورد
              </h3>

            </div>

            ${
              estimate
                ? `
                  <div class="estimate-box">

                    <span>
                      وضعیت برآورد
                    </span>

                    <strong>
                      ${esc(
                        estimate.status ||
                        '-'
                      )}
                    </strong>

                    <span>
                      مبلغ
                    </span>

                    <strong>
                      ${money(
                        estimate.total || 0
                      )}
                      تومان
                    </strong>

                    ${
                      estimate.discount
                        ? `
                          <span>
                            تخفیف
                          </span>

                          <strong>
                            ${money(
                              estimate.discount
                            )}
                            تومان
                          </strong>
                        `
                        : ''
                    }

                  </div>
                `
                : `
                  <p>
                    هنوز برآوردی ثبت نشده است.
                  </p>
                `
            }

          </div>

        </div>

        <div class="case-detail-grid">

          <div class="panel">

            <div class="panel-title">

              <h3>
                پرداخت‌ها
              </h3>

            </div>

            ${
              payments.length
                ? `
                  <div class="detail-list">

                    ${payments.map(p => `

                      <div class="detail-list-item">

                        <div class="avatar">
                          💳
                        </div>

                        <div>

                          <strong>
                            ${money(
                              p.amount || 0
                            )}
                            تومان
                          </strong>

                          <span>
                            ${esc(
                              p.method || ''
                            )}
                          </span>

                          ${
                            p.reference
                              ? `
                                <small>
                                  ${esc(
                                    p.reference
                                  )}
                                </small>
                              `
                              : ''
                          }

                        </div>

                      </div>

                    `).join('')}

                  </div>
                `
                : `
                  <p>
                    پرداختی ثبت نشده است.
                  </p>
                `
            }

          </div>

          <div class="panel">

            <div class="panel-title">

              <h3>
                یادداشت‌ها
              </h3>

            </div>

            ${
              notes.length
                ? `
                  <div class="notes-list">

                    ${notes.map(n => `

                      <div class="note-item">

                        <p>
                          ${esc(
                            n.body ||
                            n.note ||
                            ''
                          )}
                        </p>

                      </div>

                    `).join('')}

                  </div>
                `
                : `
                  <p>
                    یادداشتی ثبت نشده است.
                  </p>
                `
            }

          </div>

        </div>

        <div class="panel">

          <div class="panel-title">

            <h3>
              تاریخچه پرونده
            </h3>

          </div>

          ${
            history.length
              ? `
                <div class="history-list">

                  ${history.map(h => `

                    <div class="history-item">

                      <span class="history-dot"></span>

                      <div>

                        <strong>
                          ${esc(
                            statusText(
                              h.status ||
                              ''
                            )
                          )}
                        </strong>

                        ${
                          h.note
                            ? `
                              <p>
                                ${esc(
                                  h.note
                                )}
                              </p>
                            `
                            : ''
                        }

                      </div>

                    </div>

                  `).join('')}

                </div>
              `
              : `
                <p>
                  تاریخچه‌ای ثبت نشده است.
                </p>
              `
          }

        </div>

      </section>

    `;

  } catch (err) {

    root.innerHTML = `

      <section class="section">

        <div class="panel">

          <div class="status-result error">

            ${esc(
              err.message ||
              'دریافت جزئیات پرونده انجام نشد'
            )}

          </div>

          <button
            class="secondary-btn"
            onclick="renderAdminPage('cases')"
          >
            بازگشت
          </button>

        </div>

      </section>

    `;
  }
}

/* =========================
   STATUS OPTIONS
   ========================= */

function statusOptions(current) {

  const options = [

    ['OPEN', 'باز'],

    ['IN_PROGRESS', 'در حال بررسی'],

    ['WAITING_APPROVAL', 'در انتظار تأیید'],

    ['APPROVED', 'تأیید شده'],

    ['REPAIRING', 'در حال تعمیر'],

    ['READY_FOR_DELIVERY', 'آماده تحویل'],

    ['DELIVERED', 'تحویل شده'],

    ['CANCELLED', 'لغو شده']

  ];

  return options
    .map(
      ([value, label]) =>
        `<option
          value="${value}"
          ${
            String(current) === value
              ? 'selected'
              : ''
          }
        >
          ${label}
        </option>`
    )
    .join('');
}

/* =========================
   SAVE CASE
   ========================= */

async function saveCase(id) {

  const status =
    $('caseStatus')?.value ||
    'OPEN';

  const complaint =
    $('caseComplaint')?.value
      .trim() ||
    '';

  const diagnosis =
    $('caseDiagnosis')?.value
      .trim() ||
    '';

  const note =
    $('caseStatusNote')?.value
      .trim() ||
    '';

  try {

    await api(
      `/cases/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',

        body: JSON.stringify({
          complaint,
          diagnosis
        })
      }
    );

    await api(
      `/cases/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',

        body: JSON.stringify({
          status,
          note
        })
      }
    );

    toast(
      'تغییرات پرونده با موفقیت ذخیره شد'
    );

    await loadAdminData();

    await openAdminCase(id);

  } catch (err) {

    toast(
      err.message ||
      'ذخیره پرونده انجام نشد'
    );
  }
}

/* =========================
   RECEPTION
   ========================= */

function renderAdminReception(root) {

  root.innerHTML = `

    <section class="section">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            NEW WORK ORDER
          </span>

          <h2>
            پذیرش جدید
          </h2>

          <p>
            ثبت مشتری، موتورسیکلت و درخواست تعمیر
          </p>

        </div>

      </div>

      <div class="workspace">

        <div class="panel">

          <div class="panel-title">

            <h3>
              اطلاعات مشتری
            </h3>

            <span class="section-number">
              01
            </span>

          </div>

          <form
            class="case-form"
            onsubmit="submitReception(event)"
          >

            <div class="field">

              <label>
                نام و نام خانوادگی
              </label>

              <input
                id="adminCustomerName"
                required
              >

            </div>

            <div class="field">

              <label>
                موبایل
              </label>

              <input
                id="adminCustomerPhone"
                inputmode="tel"
                required
              >

            </div>

            <div class="panel-title">

              <h3>
                موتورسیکلت
              </h3>

              <span class="section-number">
                02
              </span>

            </div>

            <div class="field">

              <label>
                برند / مدل
              </label>

              <input
                id="adminBikeModel"
                required
              >

            </div>

            <div class="field">

              <label>
                پلاک / شناسه
              </label>

              <input
                id="adminBikePlate"
                required
              >

            </div>

            <div class="field">

              <label>
                کیلومتر
              </label>

              <input
                id="adminBikeKm"
                inputmode="numeric"
              >

            </div>

            <div class="panel-title">

              <h3>
                درخواست تعمیر
              </h3>

              <span class="section-number">
                03
              </span>

            </div>

            <div class="field">

              <label>
                شرح مشکل
              </label>

              <textarea
                id="adminProblem"
                rows="6"
                required
              ></textarea>

            </div>

            <button
              class="primary-btn"
              type="submit"
            >
              ثبت پذیرش
            </button>

          </form>

        </div>

      </div>

    </section>

  `;
}

async function submitReception(event) {

  event.preventDefault();

  const name =
    $('adminCustomerName')
      .value
      .trim();

  const phone =
    $('adminCustomerPhone')
      .value
      .trim();

  const model =
    $('adminBikeModel')
      .value
      .trim();

  const plate =
    $('adminBikePlate')
      .value
      .trim();

  const mileageRaw =
    $('adminBikeKm')
      .value
      .trim();

  const complaint =
    $('adminProblem')
      .value
      .trim();

  if (
    !name ||
    !phone ||
    !model ||
    !plate ||
    !complaint
  ) {

    toast(
      'نام، موبایل، مدل، پلاک و شرح مشکل الزامی است'
    );

    return;
  }

  try {

    let customer =
      state.customers.find(
        c =>
          String(
            c.phone || ''
          )
            .replace(/\D/g, '') ===
          phone.replace(/\D/g, '')
      );

    if (!customer) {

      const created =
        await api(
          '/customers',
          {
            method: 'POST',

            body: JSON.stringify({
              name,
              phone
            })
          }
        );

      customer =
        created?.customer ||
        created?.data;
    }

    if (!customer?.id) {

      throw new Error(
        'ثبت یا یافتن مشتری انجام نشد'
      );
    }

    const customerBikes =
      extractMotorcycles(
        await api(
          `/motorcycles?customer_id=${encodeURIComponent(
            customer.id
          )}`
        )
      );

    let motorcycle =
      customerBikes.find(
        m =>
          String(
            m.plate ||
            m.plate_number ||
            ''
          ).trim() === plate
      );

    if (!motorcycle) {

      const createdBike =
        await api(
          '/motorcycles',
          {
            method: 'POST',

            body: JSON.stringify({

              customer_id:
                customer.id,

              plate,

              model,

              brand: '',

              mileage:
                mileageRaw
                  ? Number(mileageRaw)
                  : null

            })
          }
        );

      motorcycle =
        createdBike?.motorcycle ||
        createdBike?.data;
    }

    if (!motorcycle?.id) {

      throw new Error(
        'ثبت یا یافتن موتورسیکلت انجام نشد'
      );
    }

    const createdCase =
      await api(
        '/cases',
        {
          method: 'POST',

          body: JSON.stringify({

            customer_id:
              customer.id,

            motorcycle_id:
              motorcycle.id,

            complaint,

            status:
              'OPEN',

            priority:
              'NORMAL'

          })
        }
      );

    const newCase =
      createdCase?.case ||
      createdCase?.data ||
      createdCase;

    toast(
      `پذیرش با موفقیت ثبت شد${
        newCase?.case_code
          ? ' • کد: ' +
            newCase.case_code
          : ''
      }`
    );

    event.target.reset();

    await loadAdminData();

    renderAdminPage(
      'dashboard'
    );

  } catch (err) {

    toast(
      err.message ||
      'ثبت پذیرش انجام نشد'
    );
  }
}

/* =========================
   WORKSHOP
   ========================= */

function renderAdminWorkshop(root) {

  const active =
    state.cases.filter(
      c =>
        !isClosedCase(
          c.status
        )
    );

  root.innerHTML = `

    <section class="section">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            WORKSHOP
          </span>

          <h2>
            وضعیت تعمیرگاه
          </h2>

          <p>
            موتورسیکلت‌های فعال داخل تعمیرگاه
          </p>

        </div>

      </div>

      <div class="panel">

        <div class="records">

          ${
            active.length
              ? active
                  .map(c => {

                    const customer =
                      c.customer_name ||
                      '-';

                    const bike =
                      [
                        c.motorcycle_brand,
                        c.motorcycle_model
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                      '-';

                    return `

                      <button
                        class="record-row"
                        onclick="openAdminCase('${esc(c.id)}')"
                      >

                        <div class="record-main">

                          <strong>
                            ${esc(
                              caseCode(c)
                            )}
                          </strong>

                          <span>
                            ${esc(customer)}
                          </span>

                        </div>

                        <div class="record-bike">

                          <strong>
                            ${esc(bike)}
                          </strong>

                          <span>
                            ${esc(
                              c.motorcycle_plate ||
                              '-'
                            )}
                          </span>

                        </div>

                        <div class="record-status">

                          <span
                            class="status-pill ${statusClass(c.status)}"
                          >
                            ${esc(
                              statusText(
                                c.status
                              )
                            )}
                          </span>

                        </div>

                        <div class="record-arrow">
                          ←
                        </div>

                      </button>

                    `;

                  })
                  .join('')
              : `
                <div class="empty-state">

                  <strong>
                    تعمیرگاه خالی است
                  </strong>

                  <span>
                    در حال حاضر پرونده فعال وجود ندارد.
                  </span>

                </div>
              `
          }

        </div>

      </div>

    </section>

  `;
}

/* =========================
   LOGOUT
   ========================= */

async function logout() {

  try {

    if (token()) {

      await api(
        '/auth/logout',
        {
          method: 'POST'
        }
      );
    }

  } catch {}

  clearSession();

  renderPublic();

  window.scrollTo(
    0,
    0
  );

  toast(
    'از حساب مدیریت خارج شدید'
  );
}

/* =========================
   UI
   ========================= */

function scrollToId(id) {

  document
    .getElementById(id)
    ?.scrollIntoView({
      behavior: 'smooth'
    });
}

/* =========================
   BOOT
   ========================= */

async function boot() {

  loadSession();

  /*
    If a previous session exists,
    verify it against the backend.
  */

  if (
    state.user &&
    token()
  ) {

    try {

      const me =
        await api(
          '/auth/me'
        );

      state.user =
        me?.user ||
        me?.account ||
        me;

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(
          state.user
        )
      );

      await loadAdminData();

      renderAdmin();

      return;

    } catch {

      clearSession();
    }
  }

  await loadPublicCases();

  renderPublic();
}

document.addEventListener(
  'DOMContentLoaded',
  boot
);

/* =========================
   GLOBALS
   ========================= */

window.showLogin =
  showLogin;

window.submitLogin =
  submitLogin;

window.trackCase =
  trackCase;

window.submitRequest =
  submitRequest;

window.scrollToId =
  scrollToId;

window.logout =
  logout;

window.renderAdminPage =
  renderAdminPage;

window.filterAdminCases =
  filterAdminCases;

window.openAdminCase =
  openAdminCase;

window.saveCase =
  saveCase;

window.submitReception =
  submitReception;
