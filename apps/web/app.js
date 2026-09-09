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
  return [
    'DELIVERED',
    'CANCELLED'
  ].includes(status);
}

function caseCode(c) {
  return (
    c?.case_code ||
    c?.caseCode ||
    c?.code ||
    c?.id ||
    '-'
  );
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

  // Public tracking is intentionally not loading
  // private case data.
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
    results[0].status ===
    'fulfilled'
  ) {

    const data =
      results[0].value;

    state.dashboard =
      data?.dashboard ||
      null;
  }

  if (
    results[1].status ===
    'fulfilled'
  ) {

    state.cases =
      extractCases(
        results[1].value
      );
  }

  if (
    results[2].status ===
    'fulfilled'
  ) {

    state.customers =
      extractCustomers(
        results[2].value
      );
  }

  if (
    results[3].status ===
    'fulfilled'
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
                HOW IT WORKS
              </span>

              <h2>
                فرآیند کار
              </h2>

            </div>

          </div>

          <div class="process-grid">

            <div class="process-step">

              <div class="process-number">
                01
              </div>

              <h3>
                پذیرش
              </h3>

              <p>
                ثبت اطلاعات مشتری و موتورسیکلت.
              </p>

            </div>

            <div class="process-step">

              <div class="process-number">
                02
              </div>

              <h3>
                بررسی
              </h3>

              <p>
                تشخیص مشکل و تعیین خدمات موردنیاز.
              </p>

            </div>

            <div class="process-step">

              <div class="process-number">
                03
              </div>

              <h3>
                تعمیر
              </h3>

              <p>
                اجرای کار و ثبت مراحل تعمیر.
              </p>

            </div>

            <div class="process-step">

              <div class="process-number">
                04
              </div>

              <h3>
                تحویل
              </h3>

              <p>
                کنترل نهایی و آماده‌سازی برای تحویل.
              </p>

            </div>

          </div>

        </section>

        <section
          class="tracking-section"
          id="tracking"
        >

          <div class="tracking-card">

            <span class="eyebrow">
              TRACK YOUR MOTORCYCLE
            </span>

            <h2>
              پیگیری وضعیت تعمیر
            </h2>

            <p>
              کد پذیرش خود را وارد کنید.
            </p>

            <form
              class="tracking-form"
              onsubmit="trackCase(event)"
            >

              <input
                id="trackingCode"
                placeholder="کد پذیرش"
                required
              >

              <button class="primary-btn">
                پیگیری
              </button>

            </form>

            <div id="trackingResult"></div>

          </div>

        </section>

        <section
          class="section"
          id="request"
        >

          <div class="section-heading">

            <div>

              <span class="eyebrow">
                BOOK SERVICE
              </span>

              <h2>
                درخواست پذیرش
              </h2>

            </div>

            <p>
              اطلاعات خود را ارسال کنید تا با شما تماس بگیریم.
            </p>

          </div>

          <div class="workspace">

            <div class="panel">

              <div class="panel-title">

                <h3>
                  اطلاعات درخواست
                </h3>

                <span class="section-number">
                  01
                </span>

              </div>

              <form
                class="case-form"
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
                    placeholder="09xxxxxxxxx"
                    required
                  >

                </div>

                <div class="field">

                  <label>
                    مدل موتورسیکلت
                  </label>

                  <input
                    id="requestBike"
                    placeholder="مثلاً هوندا کلیک"
                    required
                  >

                </div>

                <div class="field">

                  <label>
                    شرح مشکل
                  </label>

                  <textarea
                    id="requestProblem"
                    rows="5"
                    placeholder="مشکل یا سرویس موردنیاز..."
                    required
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

          </div>

        </section>

      </main>

      <footer>

        <div>

          <strong>
            موتو کلینیک ولیعصر (عج)
          </strong>

          <span>
            مرکز تخصصی تعمیر و سرویس موتورسیکلت
          </span>

        </div>

        <div>

          <strong>
            تماس
          </strong>

          <span>
            09195805965
          </span>

        </div>

      </footer>

    </div>
  `;
}

/* =========================
   TRACKING
   ========================= */

async function trackCase(event) {

  event.preventDefault();

  const code =
    $('trackingCode')
      ?.value
      .trim();

  if (!code) return;

  const result =
    $('trackingResult');

  result.innerHTML =
    `<div class="status-result">
      پیگیری عمومی در حال آماده‌سازی است.
    </div>`;
}

/* =========================
   REQUEST
   ========================= */

async function submitRequest(event) {

  event.preventDefault();

  const payload = {

    name:
      $('requestName')
        .value
        .trim(),

    phone:
      $('requestPhone')
        .value
        .trim(),

    motorcycle:
      $('requestBike')
        .value
        .trim(),

    service:
      'درخواست پذیرش',

    description:
      $('requestProblem')
        .value
        .trim()

  };

  try {

    await api(
      '/customer-requests',
      {
        method: 'POST',
        body:
          JSON.stringify(payload)
      }
    );

    toast(
      'درخواست شما با موفقیت ارسال شد'
    );

    event.target.reset();

  } catch (err) {

    toast(
      err.message ||
      'ارسال درخواست انجام نشد'
    );
  }
}

/* =========================
   LOGIN
   ========================= */

function showLogin() {

  const oldModal =
    $('loginModal');

  if (oldModal) {
    oldModal.remove();
  }

  const modal =
    document.createElement('div');

  modal.id =
    'loginModal';

  modal.innerHTML = `

    <div class="login-overlay">

      <div class="login-card">

        <button
          class="login-close"
          onclick="this.closest('#loginModal').remove()"
        >
          ×
        </button>

        <span class="eyebrow">
          MOTO CLINIC ADMIN
        </span>

        <h2>
          ورود مدیریت
        </h2>

        <p>
          برای ورود به پنل مدیریت اطلاعات خود را وارد کنید.
        </p>

        <form
          onsubmit="submitLogin(event)"
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

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  setTimeout(() => {
    $('loginUsername')
      ?.focus();
  }, 50);
}

async function submitLogin(event) {

  event.preventDefault();

  const username =
    $('loginUsername')
      ?.value
      .trim() ||
    '';

  const password =
    $('loginPassword')
      ?.value ||
    '';

  if (
    !username ||
    !password
  ) {

    toast(
      'نام کاربری و رمز عبور را وارد کنید'
    );

    return;
  }

  const button =
    event.submitter ||
    event.target.querySelector(
      'button[type="submit"]'
    );

  const originalText =
    button?.textContent ||
    'ورود به پنل';

  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        'در حال ورود...';
    }

    const data =
      await api(
        '/auth/login',
        {
          method: 'POST',

          body:
            JSON.stringify({
              username,
              password
            })
        }
      );

    const user =
      data?.user ||
      null;

    const jwt =
      data?.token ||
      '';

    if (
      !data?.ok ||
      !user ||
      !jwt
    ) {

      throw new Error(
        'پاسخ ورود از سرور معتبر نیست'
      );
    }

    saveSession(
      user,
      jwt
    );

    const me =
      await api(
        '/auth/me'
      );

    state.user =
      me?.user ||
      user;

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(
        state.user
      )
    );

    $('loginModal')
      ?.remove();

    toast(
      'ورود موفق بود'
    );

    await loadAdminData();

    renderAdmin();

  } catch (err) {

    clearSession();

    toast(
      err.message ||
      'نام کاربری یا رمز عبور اشتباه است'
    );

  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        originalText;
    }
  }
}

/* =========================
   ADMIN
   ========================= */

function renderAdmin() {

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
              پنل مدیریت
            </span>

          </div>

        </div>

        <nav class="nav">

          <button
            data-admin-nav="dashboard"
          >
            داشبورد
          </button>

          <button
            data-admin-nav="cases"
          >
            پرونده‌ها
          </button>

          <button
            data-admin-nav="reception"
          >
            پذیرش جدید
          </button>

          <button
            data-admin-nav="workshop"
          >
            تعمیرگاه
          </button>

        </nav>

        <button
          class="outline-btn"
          onclick="logout()"
        >
          خروج
        </button>

      </header>

      <main
        id="adminMain"
      ></main>

      <footer>

        <div>

          <strong>
            موتو کلینیک ولیعصر (عج)
          </strong>

          <span>
            پنل مدیریت تعمیرگاه
          </span>

        </div>

      </footer>

    </div>
  `;

  document
    .querySelectorAll(
      '[data-admin-nav]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          renderAdminPage(
            button.dataset.adminNav
          );

        }
      );

    });

  renderAdminPage(
    'dashboard'
  );
}

function renderAdminPage(page) {

  const root =
    $('adminMain');

  if (!root) return;

  if (
    page === 'dashboard'
  ) {

    renderAdminDashboard(
      root
    );
  }

  if (
    page === 'cases'
  ) {

    renderAdminCases(
      root
    );
  }

  if (
    page === 'reception'
  ) {

    renderAdminReception(
      root
    );
  }

  if (
    page === 'workshop'
  ) {

    renderAdminWorkshop(
      root
    );
  }
}

/* =========================
   ADMIN DASHBOARD
   ========================= */

function renderAdminDashboard(root) {

  const d =
    state.dashboard ||
    {};

  const active =
    Number(
      d.activeCases ??
      state.cases.filter(
        c =>
          !isClosedCase(
            c.status
          )
      ).length
    );

  const ready =
    Number(
      d.readyForDelivery ??
      state.cases.filter(
        c =>
          c.status ===
          'READY_FOR_DELIVERY'
      ).length
    );

  const customers =
    Number(
      d.customers ??
      state.customers.length
    );

  const cases =
    Number(
      d.cases ??
      state.cases.length
    );

  const waitingApproval =
    Number(
      d.waitingApproval ??
      state.cases.filter(
        c =>
          c.status ===
          'WAITING_APPROVAL'
      ).length
    );

  const unpaid =
    Number(
      d.unpaidBalance ??
      0
    );

  root.innerHTML = `

    <section class="section">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            CONTROL CENTER
          </span>

          <h2>
            داشبورد مدیریت
          </h2>

          <p>
            ${esc(
              state.user?.name ||
              state.user?.username ||
              'مدیریت'
            )}
          </p>

        </div>

      </div>

      <div class="stats-grid">

        <div class="stat-card">

          <div class="stat-icon">
            🏍
          </div>

          <strong>
            ${active}
          </strong>

          <span>
            پرونده فعال
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            ✓
          </div>

          <strong>
            ${ready}
          </strong>

          <span>
            آماده تحویل
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            👤
          </div>

          <strong>
            ${customers}
          </strong>

          <span>
            مشتریان
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            📋
          </div>

          <strong>
            ${cases}
          </strong>

          <span>
            کل پرونده‌ها
          </span>

        </div>

      </div>

      <div class="stats-grid">

        <div class="stat-card">

          <div class="stat-icon">
            ⏳
          </div>

          <strong>
            ${waitingApproval}
          </strong>

          <span>
            در انتظار تأیید
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            💳
          </div>

          <strong>
            ${money(unpaid)}
          </strong>

          <span>
            مانده مطالبات
          </span>

        </div>

      </div>

      <div class="panel">

        <div class="panel-title">

          <h3>
            آخرین پرونده‌ها
          </h3>

          <button
            class="secondary-btn"
            onclick="renderAdminPage('cases')"
          >
            مشاهده همه
          </button>

        </div>

        <div class="records">
          ${renderAdminCaseRows(
            state.cases.slice(
              0,
              8
            )
          )}
        </div>

      </div>

    </section>
  `;
}

/* =========================
   CASES
   ========================= */

function renderAdminCases(root) {

  root.innerHTML = `

    <section class="section">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            WORK ORDERS
          </span>

          <h2>
            پرونده‌های تعمیر
          </h2>

        </div>

        <button
          class="primary-btn"
          onclick="renderAdminPage('reception')"
        >
          + پذیرش جدید
        </button>

      </div>

      <div class="panel">

        <div class="field">

          <input
            id="adminCaseSearch"
            placeholder="جستجوی نام، موبایل، موتور یا کد..."
            oninput="filterAdminCases()"
          >

        </div>

        <div
          id="adminCaseList"
          class="records"
        >

          ${renderAdminCaseRows(
            state.cases
          )}

        </div>

      </div>

    </section>
  `;
}

function filterAdminCases() {

  const query =
    $('adminCaseSearch')
      ?.value
      ?.trim()
      ?.toLowerCase() ||
    '';

  const list =
    state.cases.filter(
      c =>
        JSON.stringify(c)
          .toLowerCase()
          .includes(query)
    );

  const container =
    $('adminCaseList');

  if (container) {

    container.innerHTML =
      renderAdminCaseRows(
        list
      );
  }
}

function renderAdminCaseRows(list) {

  if (!list.length) {

    return `
      <div class="mini-record">
        موردی برای نمایش وجود ندارد.
      </div>
    `;
  }

  return list
    .map(c => {

      const customer =
        c.customer_name ||
        c.customer?.name ||
        c.customerName ||
        'مشتری';

      const phone =
        c.customer_phone ||
        c.customer?.phone ||
        c.phone ||
        '';

      const bike =
        [
          c.motorcycle_brand,
          c.motorcycle_model
        ]
          .filter(Boolean)
          .join(' ') ||
        c.motorcycle?.model ||
        c.motorcycleModel ||
        'موتورسیکلت';

      return `

        <div
          class="mini-record"
          onclick="openAdminCase('${esc(c.id)}')"
        >

          <div class="avatar">
            🏍
          </div>

          <div>

            <strong>
              ${esc(customer)}
            </strong>

            <span>
              ${esc(bike)}
              ${
                phone
                  ? ' • ' +
                    esc(phone)
                  : ''
              }
            </span>

            <small>
              کد:
              ${esc(
                caseCode(c)
              )}
            </small>

          </div>

          <span
            class="badge ${statusClass(c.status)}"
          >
            ${esc(
              statusText(
                c.status
              )
            )}
          </span>

        </div>
      `;

    })
    .join('');
}

/* =========================
   CASE DETAIL
   ========================= */

async function openAdminCase(id) {

  const listCase =
    state.cases.find(
      item =>
        String(item.id) ===
        String(id)
    );

  if (!listCase) return;

  const root =
    $('adminMain');

  if (!root) return;

  root.innerHTML = `
    <section class="section">
      <div class="panel">
        <div class="status-result">
          در حال دریافت جزئیات پرونده...
        </div>
      </div>
    </section>
  `;

  try {

    const fresh =
      await api(
        `/cases/${encodeURIComponent(id)}`
      );

    const c =
      fresh?.case ||
      listCase;

    const tasks =
      Array.isArray(
        fresh?.tasks
      )
        ? fresh.tasks
        : [];

    const parts =
      Array.isArray(
        fresh?.parts
      )
        ? fresh.parts
        : [];

    const estimate =
      fresh?.estimate ||
      null;

    const payments =
      Array.isArray(
        fresh?.payments
      )
        ? fresh.payments
        : [];

    const notes =
      Array.isArray(
        fresh?.notes
      )
        ? fresh.notes
        : [];

    const history =
      Array.isArray(
        fresh?.history
      )
        ? fresh.history
        : [];

    const technicians =
      Array.isArray(
        fresh?.technicians
      )
        ? fresh.technicians
        : [];

    const financial =
      fresh?.financial ||
      {
        total: 0,
        paid: 0,
        balance: 0
      };

    const customer =
      c.customer_name ||
      c.customer?.name ||
      c.customerName ||
      'مشتری';

    const phone =
      c.customer_phone ||
      c.customer?.phone ||
      '';

    const bike =
      [
        c.motorcycle_brand,
        c.motorcycle_model
      ]
        .filter(Boolean)
        .join(' ') ||
      c.motorcycle?.model ||
      'موتورسیکلت';

    const plate =
      c.motorcycle_plate ||
      c.motorcycle?.plate ||
      '';

    root.innerHTML = `

      <section class="section">

        <div class="section-heading">

          <div>

            <span class="eyebrow">
              CASE #${esc(
                caseCode(c)
              )}
            </span>

            <h2>
              مدیریت پرونده تعمیر
            </h2>

          </div>

          <button
            class="secondary-btn"
            onclick="renderAdminPage('cases')"
          >
            برگشت
          </button>

        </div>

        <div class="detail-card">

          <div class="detail-header">

            <div>

              <span>
                مشتری
              </span>

              <strong>
                ${esc(customer)}
              </strong>

              <small>
                ${esc(
                  phone || ''
                )}
              </small>

            </div>

            <span
              class="badge ${statusClass(c.status)}"
            >
              ${esc(
                statusText(
                  c.status
                )
              )}
            </span>

          </div>

          <div class="detail-grid">

            <div class="detail-item">

              <span>
                موبایل
              </span>

              <strong>
                ${esc(
                  phone || '-'
                )}
              </strong>

            </div>

            <div class="detail-item">

              <span>
                موتورسیکلت
              </span>

              <strong>
                ${esc(bike)}
              </strong>

            </div>

            <div class="detail-item">

              <span>
                پلاک
              </span>

              <strong>
                ${esc(
                  plate || '-'
                )}
              </strong>

            </div>

            <div class="detail-item">

              <span>
                مبلغ کل
              </span>

              <strong>
                ${money(
                  financial.total
                )}
                تومان
              </strong>

            </div>

            <div class="detail-item">

              <span>
                پرداخت شده
              </span>

              <strong>
                ${money(
                  financial.paid
                )}
                تومان
              </strong>

            </div>

            <div class="detail-item">

              <span>
                مانده
              </span>

              <strong>
                ${money(
                  financial.balance
                )}
                تومان
              </strong>

            </div>

          </div>

          <div
            class="detail-description"
          >

            <span>
              شرح مشکل
            </span>

            <p>
              ${esc(
                c.complaint ||
                '-'
              )}
            </p>

          </div>

          <div
            class="detail-description"
          >

            <span>
              تشخیص
            </span>

            <p>
              ${esc(
                c.diagnosis ||
                '-'
              )}
            </p>

          </div>

          <div class="status-editor">

            <div class="field">

              <label>
                وضعیت پرونده
              </label>

              <select
                id="caseStatus"
              >
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
                rows="3"
              >${esc(
                c.complaint ||
                ''
              )}</textarea>

            </div>

            <div class="field">

              <label>
                تشخیص
              </label>

              <textarea
                id="caseDiagnosis"
                rows="3"
              >${esc(
                c.diagnosis ||
                ''
              )}</textarea>

            </div>

            <div class="field">

              <label>
                یادداشت وضعیت
              </label>

              <input
                id="caseStatusNote"
                placeholder="مثلاً مشتری در جریان قرار گرفت"
              >

            </div>

            <button
              class="primary-btn"
              onclick="saveCase('${esc(c.id)}')"
            >
              ذخیره تغییرات پرونده
            </button>

          </div>

          <div
            class="detail-description"
          >

            <span>
              کارها و دستمزد
            </span>

            <div class="records">

              ${
                tasks.length

                  ? tasks
                      .map(t => `

                        <div
                          class="mini-record"
                        >

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
                                t.technician?.name ||
                                ''
                              )}

                              ${
                                t.status
                                  ? ' • ' +
                                    esc(
                                      taskStatusText(
                                        t.status
                                      )
                                    )
                                  : ''
                              }

                            </span>

                            <small>
                              ${money(
                                t.labor_cost ||
                                0
                              )}
                              تومان
                            </small>

                          </div>

                          <button
                            class="secondary-btn small-btn"
                            onclick="deleteCaseTask('${esc(t.id)}','${esc(c.id)}')"
                          >
                            حذف
                          </button>

                        </div>

                      `)
                      .join('')

                  : `
                    <p>
                      هنوز کاری ثبت نشده است.
                    </p>
                  `
              }

            </div>

            <div class="status-editor">

              <div class="field">

                <label>
                  عنوان کار
                </label>

                <input
                  id="newTaskTitle"
                  placeholder="مثلاً تعویض روغن و فیلتر"
                >

              </div>

              <div class="field">

                <label>
                  شرح کار
                </label>

                <textarea
                  id="newTaskDescription"
                  rows="2"
                  placeholder="شرح اجرای کار"
                ></textarea>

              </div>

              <div class="field">

                <label>
                  تکنسین
                </label>

                <select
                  id="newTaskTechnician"
                >

                  <option value="">
                    بدون تخصیص
                  </option>

                  ${
                    technicians
                      .map(t => `
                        <option
                          value="${esc(t.id)}"
                        >
                          ${esc(t.name)}
                        </option>
                      `)
                      .join('')
                  }

                </select>

              </div>

              <div class="field">

                <label>
                  دستمزد (تومان)
                </label>

                <input
                  id="newTaskLabor"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                >

              </div>

              <button
                class="primary-btn"
                onclick="addCaseTask('${esc(c.id)}')"
              >
                + ثبت کار
              </button>

            </div>

          </div>

          <div
            class="detail-description"
          >

            <span>
              قطعات مصرفی
            </span>

            <div class="records">

              ${
                parts.length

                  ? parts
                      .map(p => `

                        <div
                          class="mini-record"
                        >

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
                                p.quantity ||
                                0
                              )}
                            </span>

                            <small>
                              ${money(
                                p.unit_price ||
                                0
                              )}
                              تومان
                            </small>

                          </div>

                          <button
                            class="secondary-btn small-btn"
                            onclick="deleteCasePart('${esc(p.id)}','${esc(c.id)}')"
                          >
                            حذف
                          </button>

                        </div>

                      `)
                      .join('')

                  : `
                    <p>
                      هنوز قطعه‌ای ثبت نشده است.
                    </p>
                  `
              }

            </div>

            <div class="status-editor">

              <div class="field">

                <label>
                  نام قطعه
                </label>

                <input
                  id="newPartName"
                  placeholder="مثلاً لنت ترمز"
                >

              </div>

              <div class="field">

                <label>
                  تعداد
                </label>

                <input
                  id="newPartQty"
                  type="number"
                  min="1"
                  step="1"
                  value="1"
                >

              </div>

              <div class="field">

                <label>
                  قیمت واحد (تومان)
                </label>

                <input
                  id="newPartPrice"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                >

              </div>

              <button
                class="primary-btn"
                onclick="addCasePart('${esc(c.id)}')"
              >
                + ثبت قطعه
              </button>

            </div>

          </div>

          <div
            class="detail-description"
          >

            <span>
              برآورد و تأیید هزینه
            </span>

            <div class="detail-grid">

              <div class="detail-item">

                <span>
                  اجرت
                </span>

                <strong>
                  ${money(
                    financial.laborTotal ||
                    0
                  )}
                  تومان
                </strong>

              </div>

              <div class="detail-item">

                <span>
                  قطعات
                </span>

                <strong>
                  ${money(
                    financial.partsTotal ||
                    0
                  )}
                  تومان
                </strong>

              </div>

              <div class="detail-item">

                <span>
                  جمع
                </span>

                <strong>
                  ${money(
                    financial.subtotal ||
                    financial.total ||
                    0
                  )}
                  تومان
                </strong>

              </div>

              <div class="detail-item">

                <span>
                  تخفیف
                </span>

                <strong>
                  ${money(
                    estimate?.discount ||
                    0
                  )}
                  تومان
                </strong>

              </div>

              <div class="detail-item">

                <span>
                  وضعیت
                </span>

                <strong>
                  ${esc(
                    estimate?.status ||
                    'DRAFT'
                  )}
                </strong>

              </div>

              <div class="detail-item">

                <span>
                  مبلغ نهایی
                </span>

                <strong>
                  ${money(
                    estimate?.total ||
                    financial.total ||
                    0
                  )}
                  تومان
                </strong>

              </div>

            </div>

            <div class="status-editor">

              <div class="field">

                <label>
                  تخفیف (تومان)
                </label>

                <input
                  id="caseDiscount"
                  type="number"
                  min="0"
                  step="1000"
                  value="${Number(
                    estimate?.discount ||
                    0
                  )}"
                >

              </div>

              <button
                class="primary-btn"
                onclick="saveCaseEstimate('${esc(c.id)}')"
              >
                محاسبه و ذخیره برآورد
              </button>

              ${
                estimate?.status ===
                'APPROVED'

                  ? `
                    <span
                      class="badge status-progress"
                    >
                      برآورد تأیید شده
                    </span>
                  `

                  : `
                    <button
                      class="secondary-btn"
                      onclick="approveCaseEstimate('${esc(c.id)}')"
                    >
                      تأیید هزینه و شروع تعمیر
                    </button>
                  `
              }

            </div>

          </div>

          <div
            class="detail-description"
          >

            <span>
              پرداخت‌ها
            </span>

            <div class="records">

              ${
                payments.length

                  ? payments
                      .map(p => `

                        <div
                          class="mini-record"
                        >

                          <div class="avatar">
                            💳
                          </div>

                          <div>

                            <strong>
                              ${money(
                                p.amount ||
                                0
                              )}
                              تومان
                            </strong>

                            <span>
                              ${esc(
                                paymentMethodText(
                                  p.method
                                )
                              )}
                            </span>

                            <small>
                              ${esc(
                                p.reference ||
                                ''
                              )}
                            </small>

                          </div>

                        </div>

                      `)
                      .join('')

                  : `
                    <p>
                      پرداختی ثبت نشده است.
                    </p>
                  `
              }

            </div>

            <div class="status-editor">

              <div class="field">

                <label>
                  مبلغ پرداخت
                </label>

                <input
                  id="newPaymentAmount"
                  type="number"
                  min="1"
                  step="1000"
                  placeholder="0"
                >

              </div>

              <div class="field">

                <label>
                  روش پرداخت
                </label>

                <select
                  id="newPaymentMethod"
                >

                  <option value="CASH">
                    نقدی
                  </option>

                  <option value="CARD">
                    کارت
                  </option>

                  <option value="TRANSFER">
                    کارت‌به‌کارت / انتقال
                  </option>

                </select>

              </div>

              <div class="field">

                <label>
                  شماره پیگیری
                </label>

                <input
                  id="newPaymentReference"
                  placeholder="اختیاری"
                >

              </div>

              <button
                class="primary-btn"
                onclick="addCasePayment('${esc(c.id)}')"
              >
                + ثبت پرداخت
              </button>

            </div>

          </div>

          <div
            class="detail-description"
          >

            <span>
              یادداشت‌ها
            </span>

            <div class="records">

              ${
                notes.length

                  ? notes
                      .map(n => `

                        <div
                          class="mini-record"
                        >

                          <div class="avatar">
                            📝
                          </div>

                          <div>

                            <strong>
                              ${esc(
                                n.body ||
                                n.note ||
                                ''
                              )}
                            </strong>

                            <small>
                              ${esc(
                                n.created_at ||
                                ''
                              )}
                            </small>

                          </div>

                        </div>

                      `)
                      .join('')

                  : `
                    <p>
                      یادداشتی ثبت نشده است.
                    </p>
                  `
              }

            </div>

            <div class="status-editor">

              <div class="field">

                <label>
                  یادداشت جدید
                </label>

                <textarea
                  id="newCaseNote"
                  rows="3"
                  placeholder="یادداشت داخلی پرونده..."
                ></textarea>

              </div>

              <button
                class="primary-btn"
                onclick="addCaseNote('${esc(c.id)}')"
              >
                + ثبت یادداشت
              </button>

            </div>

          </div>

          <div
            class="detail-description"
          >

            <span>
              تاریخچه پرونده
            </span>

            <div class="records">

              ${
                history.length

                  ? history
                      .map(h => `

                        <div
                          class="mini-record"
                        >

                          <div class="avatar">
                            ↻
                          </div>

                          <div>

                            <strong>
                              ${esc(
                                statusText(
                                  h.status ||
                                  ''
                                )
                              )}
                            </strong>

                            <small>
                              ${esc(
                                h.note ||
                                ''
                              )}
                              ${esc(
                                h.created_at ||
                                ''
                              )}
                            </small>

                          </div>

                        </div>

                      `)
                      .join('')

                  : `
                    <p>
                      تاریخچه‌ای ثبت نشده است.
                    </p>
                  `
              }

            </div>

          </div>

        </div>

      </section>
    `;

  } catch (err) {

    root.innerHTML = `

      <section class="section">

        <div class="panel">

          <div class="status-result">
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

function statusOptions(current) {

  const options = [

    [
      'OPEN',
      'باز'
    ],

    [
      'IN_PROGRESS',
      'در حال بررسی'
    ],

    [
      'WAITING_APPROVAL',
      'در انتظار تأیید'
    ],

    [
      'APPROVED',
      'تأیید شده'
    ],

    [
      'REPAIRING',
      'در حال تعمیر'
    ],

    [
      'READY_FOR_DELIVERY',
      'آماده تحویل'
    ],

    [
      'DELIVERED',
      'تحویل شده'
    ],

    [
      'CANCELLED',
      'لغو شده'
    ]

  ];

  return options
    .map(
      ([value, label]) => `

        <option
          value="${value}"
          ${
            String(current) ===
            value
              ? 'selected'
              : ''
          }
        >
          ${label}
        </option>

      `
    )
    .join('');
}

function taskStatusText(status) {

  return (
    {
      TODO:
        'در انتظار',

      IN_PROGRESS:
        'در حال انجام',

      DONE:
        'انجام شد',

      CANCELLED:
        'لغو شد'

    }[
      status
    ] ||
    status ||
    'ثبت شده'
  );
}

function paymentMethodText(method) {

  return (
    {
      CASH:
        'نقدی',

      CARD:
        'کارت',

      TRANSFER:
        'انتقال',

      ONLINE:
        'آنلاین'

    }[
      String(
        method ||
        ''
      ).toUpperCase()
    ] ||
    method ||
    'پرداخت'
  );
}

async function saveCase(id) {

  const status =
    $('caseStatus')
      ?.value ||
    'OPEN';

  const complaint =
    $('caseComplaint')
      ?.value
      .trim() ||
    '';

  const diagnosis =
    $('caseDiagnosis')
      ?.value
      .trim() ||
    '';

  const note =
    $('caseStatusNote')
      ?.value
      .trim() ||
    '';

  try {

    await api(
      `/cases/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',

        body:
          JSON.stringify({
            complaint,
            diagnosis
          })
      }
    );

    await api(
      `/cases/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',

        body:
          JSON.stringify({
            status,
            note
          })
      }
    );

    toast(
      'تغییرات پرونده با موفقیت ذخیره شد'
    );

    await loadAdminData();

    await openAdminCase(
      id
    );

  } catch (err) {

    toast(
      err.message ||
      'ذخیره پرونده انجام نشد'
    );
  }
}

/* =========================
   ESTIMATE
   ========================= */

async function saveCaseEstimate(id) {

  const discount =
    Math.max(
      0,
      Number(
        $('caseDiscount')
          ?.value ||
        0
      )
    );

  try {

    await api(
      `/cases/${encodeURIComponent(id)}/estimate`,
      {
        method: 'POST',

        body:
          JSON.stringify({
            discount
          })
      }
    );

    toast(
      'برآورد با موفقیت ذخیره شد'
    );

    await openAdminCase(
      id
    );

  } catch (err) {

    toast(
      err.message ||
      'ذخیره برآورد انجام نشد'
    );
  }
}

async function approveCaseEstimate(id) {

  const discount =
    Math.max(
      0,
      Number(
        $('caseDiscount')
          ?.value ||
        0
      )
    );

  try {

    await api(
      `/cases/${encodeURIComponent(id)}/estimate`,
      {
        method: 'POST',

        body:
          JSON.stringify({
            discount
          })
      }
    );

    await api(
      `/cases/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',

        body:
          JSON.stringify({
            status:
              'APPROVED',

            note:
              'برآورد هزینه تأیید شد'
          })
      }
    );

    toast(
      'برآورد تأیید شد'
    );

    await loadAdminData();

    await openAdminCase(
      id
    );

  } catch (err) {

    toast(
      err.message ||
      'تأیید برآورد انجام نشد'
    );
  }
}

/* =========================
   TASKS
   ========================= */

async function addCaseTask(caseId) {

  const title =
    $('newTaskTitle')
      ?.value
      .trim() ||
    '';

  const description =
    $('newTaskDescription')
      ?.value
      .trim() ||
    '';

  const technician_id =
    $('newTaskTechnician')
      ?.value ||
    null;

  const labor_cost =
    Math.max(
      0,
      Number(
        $('newTaskLabor')
          ?.value ||
        0
      )
    );

  if (!title) {

    toast(
      'عنوان کار را وارد کنید'
    );

    return;
  }

  try {

    await api(
      '/tasks',
      {
        method: 'POST',

        body:
          JSON.stringify({
            case_id:
              caseId,

            title,

            description,

            technician_id,

            labor_cost,

            status:
              'TODO'
          })
      }
    );

    toast(
      'کار ثبت شد'
    );

    await openAdminCase(
      caseId
    );

  } catch (err) {

    toast(
      err.message ||
      'ثبت کار انجام نشد'
    );
  }
}

async function deleteCaseTask(
  taskId,
  caseId
) {

  if (
    !confirm(
      'این کار حذف شود؟'
    )
  ) {

    return;
  }

  try {

    await api(
      `/tasks/${encodeURIComponent(taskId)}`,
      {
        method:
          'DELETE'
      }
    );

    toast(
      'کار حذف شد'
    );

    await openAdminCase(
      caseId
    );

  } catch (err) {

    toast(
      err.message ||
      'حذف کار انجام نشد'
    );
  }
}

/* =========================
   PARTS
   ========================= */

async function addCasePart(caseId) {

  const name =
    $('newPartName')
      ?.value
      .trim() ||
    '';

  const quantity =
    Math.max(
      1,
      Number(
        $('newPartQty')
          ?.value ||
        1
      )
    );

  const unit_price =
    Math.max(
      0,
      Number(
        $('newPartPrice')
          ?.value ||
        0
      )
    );

  if (!name) {

    toast(
      'نام قطعه را وارد کنید'
    );

    return;
  }

  try {

    await api(
      `/cases/${encodeURIComponent(caseId)}/parts`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            name,
            quantity,
            unit_price
          })
      }
    );

    toast(
      'قطعه ثبت شد'
    );

    await openAdminCase(
      caseId
    );

  } catch (err) {

    toast(
      err.message ||
      'ثبت قطعه انجام نشد'
    );
  }
}

async function deleteCasePart(
  partId,
  caseId
) {

  if (
    !confirm(
      'این قطعه از پرونده حذف شود؟'
    )
  ) {

    return;
  }

  try {

    await api(
      `/case-parts/${encodeURIComponent(partId)}`,
      {
        method:
          'DELETE'
      }
    );

    toast(
      'قطعه حذف شد'
    );

    await openAdminCase(
      caseId
    );

  } catch (err) {

    toast(
      err.message ||
      'حذف قطعه انجام نشد'
    );
  }
}

/* =========================
   PAYMENTS
   ========================= */

async function addCasePayment(
  caseId
) {

  const amount =
    Math.max(
      0,
      Number(
        $('newPaymentAmount')
          ?.value ||
        0
      )
    );

  const method =
    $('newPaymentMethod')
      ?.value ||
    'CASH';

  const reference =
    $('newPaymentReference')
      ?.value
      .trim() ||
    '';

  if (!amount) {

    toast(
      'مبلغ پرداخت را وارد کنید'
    );

    return;
  }

  try {

    await api(
      '/payments',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            case_id:
              caseId,

            amount,

            method,

            reference
          })
      }
    );

    toast(
      'پرداخت ثبت شد'
    );

    await loadAdminData();

    await openAdminCase(
      caseId
    );

  } catch (err) {

    toast(
      err.message ||
      'ثبت پرداخت انجام نشد'
    );
  }
}

/* =========================
   NOTES
   ========================= */

async function addCaseNote(
  caseId
) {

  const body =
    $('newCaseNote')
      ?.value
      .trim() ||
    '';

  if (!body) {

    toast(
      'متن یادداشت را وارد کنید'
    );

    return;
  }

  try {

    await api(
      `/cases/${encodeURIComponent(caseId)}/notes`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            body
          })
      }
    );

    toast(
      'یادداشت ثبت شد'
    );

    await openAdminCase(
      caseId
    );

  } catch (err) {

    toast(
      err.message ||
      'ثبت یادداشت انجام نشد'
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
            c.phone ||
            ''
          )
            .replace(
              /\D/g,
              ''
            ) ===
          phone.replace(
            /\D/g,
            ''
          )
      );

    if (!customer) {

      const created =
        await api(
          '/customers',
          {
            method:
              'POST',

            body:
              JSON.stringify({
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
          `/motorcycles?customer_id=${encodeURIComponent(customer.id)}`
        )
      );

    let motorcycle =
      customerBikes.find(
        m =>
          String(
            m.plate ||
            m.plate_number ||
            ''
          ).trim() ===
          plate
      );

    if (!motorcycle) {

      const createdBike =
        await api(
          '/motorcycles',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                customer_id:
                  customer.id,

                plate,

                model,

                brand:
                  '',

                mileage:
                  mileageRaw
                    ? Number(
                        mileageRaw
                      )
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
          method:
            'POST',

          body:
            JSON.stringify({
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

  const groups = [

    [
      'OPEN',
      'باز'
    ],

    [
      'IN_PROGRESS',
      'در حال بررسی'
    ],

    [
      'WAITING_APPROVAL',
      'در انتظار تأیید'
    ],

    [
      'APPROVED',
      'تأیید شده'
    ],

    [
      'REPAIRING',
      'در حال تعمیر'
    ],

    [
      'READY_FOR_DELIVERY',
      'آماده تحویل'
    ]

  ];

  root.innerHTML = `

    <section class="section">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            WORKSHOP CONTROL
          </span>

          <h2>
            تعمیرگاه عملیاتی
          </h2>

          <p>
            مدیریت سریع پرونده‌ها از پذیرش تا تحویل
          </p>

        </div>

        <button
          class="primary-btn"
          onclick="loadAdminData().then(()=>renderAdminPage('workshop'))"
        >
          به‌روزرسانی
        </button>

      </div>

      <div class="stats-grid">

        <div class="stat-card">

          <div class="stat-icon">
            🏍
          </div>

          <strong>
            ${active.length}
          </strong>

          <span>
            پرونده فعال
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            ⏳
          </div>

          <strong>
            ${
              active.filter(
                c =>
                  c.status ===
                  'WAITING_APPROVAL'
              ).length
            }
          </strong>

          <span>
            در انتظار تأیید
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            🔧
          </div>

          <strong>
            ${
              active.filter(
                c =>
                  [
                    'APPROVED',
                    'REPAIRING'
                  ].includes(
                    c.status
                  )
              ).length
            }
          </strong>

          <span>
            در حال تعمیر
          </span>

        </div>

        <div class="stat-card">

          <div class="stat-icon">
            ✓
          </div>

          <strong>
            ${
              active.filter(
                c =>
                  c.status ===
                  'READY_FOR_DELIVERY'
              ).length
            }
          </strong>

          <span>
            آماده تحویل
          </span>

        </div>

      </div>

      <div class="panel">

        ${
          groups
            .map(
              ([
                status,
                label
              ]) => {

                const items =
                  active.filter(
                    c =>
                      c.status ===
                      status
                  );

                return `

                  <div
                    class="detail-description"
                  >

                    <span>
                      ${label}

                      <small>
                        (${items.length})
                      </small>
                    </span>

                    <div
                      class="records"
                    >

                      ${
                        items.length

                          ? renderAdminCaseRows(
                              items
                            )

                          : `
                            <p>
                              پرونده‌ای در این مرحله نیست.
                            </p>
                          `
                      }

                    </div>

                  </div>
                `;
              }
            )
            .join('')
        }

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
          method:
            'POST'
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
      behavior:
        'smooth'
    });
}

/* =========================
   BOOT
   ========================= */

async function boot() {

  loadSession();

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

window.saveCaseEstimate =
  saveCaseEstimate;

window.approveCaseEstimate =
  approveCaseEstimate;

window.addCaseTask =
  addCaseTask;

window.deleteCaseTask =
  deleteCaseTask;

window.addCasePart =
  addCasePart;

window.deleteCasePart =
  deleteCasePart;

window.addCasePayment =
  addCasePayment;

window.addCaseNote =
  addCaseNote;
