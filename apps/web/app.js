'use strict';

/* =========================================================
   MOTO CLINIC VALIASR
   Premium Frontend
   Public Website + Admin Panel
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
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
}

function authHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token()) {
    headers.Authorization = `Bearer ${token()}`;
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
  el.className = `toast ${type}`;
  el.style.display = 'block';

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 2800);
}

function statusClass(status) {
  const map = {
    'پذیرش شده': 'status-received',
    RECEIVED: 'status-received',
    'در حال بررسی': 'status-diagnosis',
    DIAGNOSIS: 'status-diagnosis',
    'در حال تعمیر': 'status-progress',
    IN_PROGRESS: 'status-progress',
    'در انتظار قطعه': 'status-parts',
    WAITING_PARTS: 'status-parts',
    'کنترل کیفیت': 'status-quality',
    QUALITY_CHECK: 'status-quality',
    'آماده تحویل': 'status-ready',
    READY: 'status-ready',
    READY_FOR_DELIVERY: 'status-ready',
    'تحویل شده': 'status-completed',
    COMPLETED: 'status-completed'
  };

  return map[status] || 'status-default';
}

function statusText(status) {
  const map = {
    RECEIVED: 'پذیرش شده',
    OPEN: 'باز',
    DIAGNOSIS: 'در حال بررسی',
    WAITING_APPROVAL: 'در انتظار تأیید',
    IN_PROGRESS: 'در حال تعمیر',
    WAITING_PARTS: 'در انتظار قطعه',
    QUALITY_CHECK: 'کنترل کیفیت',
    READY_FOR_DELIVERY: 'آماده تحویل',
    READY: 'آماده تحویل',
    COMPLETED: 'تحویل شده',
    CLOSED: 'بسته شده'
  };

  return map[status] || status || 'ثبت شده';
}

/* =========================
   DATA
   ========================= */

async function loadPublicCases() {
  try {
    const data = await api('/cases');
    state.cases =
      data?.items ||
      data?.data ||
      data ||
      [];
  } catch {
    state.cases = [];
  }
}

async function loadAdminData() {
  const results = await Promise.allSettled([
    api('/dashboard'),
    api('/cases'),
    api('/customers'),
    api('/motorcycles')
  ]);

  if (results[0].status === 'fulfilled') {
    state.dashboard = results[0].value;
  }

  if (results[1].status === 'fulfilled') {
    const data = results[1].value;
    state.cases =
      data?.items ||
      data?.data ||
      data ||
      [];
  }

  if (results[2].status === 'fulfilled') {
    const data = results[2].value;
    state.customers =
      data?.items ||
      data?.data ||
      data ||
      [];
  }

  if (results[3].status === 'fulfilled') {
    const data = results[3].value;
    state.motorcycles =
      data?.items ||
      data?.data ||
      data ||
      [];
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
          <div class="brand-icon">🏍</div>
          <div>
            <h1>موتو کلینیک</h1>
            <span>ولیعصر (عج)</span>
          </div>
        </div>

        <nav class="nav">
          <a href="#home">خانه</a>
          <a href="#services">خدمات</a>
          <a href="#tracking">پیگیری تعمیر</a>
          <a href="#request">درخواست پذیرش</a>
        </nav>

        <button class="outline-btn" onclick="showLogin()">
          ورود مدیریت
        </button>
      </header>

      <main>

        <section class="hero" id="home">
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

        <section class="section" id="services">

          <div class="section-heading">
            <div>
              <span class="eyebrow">OUR SERVICES</span>
              <h2>خدمات موتو کلینیک</h2>
            </div>
            <p>
              از سرویس دوره‌ای تا عیب‌یابی و تعمیرات تخصصی.
            </p>
          </div>

          <div class="services-grid">

            <article class="service-card">
              <div class="service-icon">🔧</div>
              <h3>تعمیرات تخصصی</h3>
              <p>
                بررسی و تعمیر سیستم‌های فنی و مکانیکی
                موتورسیکلت.
              </p>
            </article>

            <article class="service-card">
              <div class="service-icon">⚙️</div>
              <h3>سرویس دوره‌ای</h3>
              <p>
                سرویس‌های پیشگیرانه برای عملکرد بهتر
                و عمر بیشتر موتور.
              </p>
            </article>

            <article class="service-card">
              <div class="service-icon">🩺</div>
              <h3>عیب‌یابی</h3>
              <p>
                بررسی دقیق مشکل قبل از شروع تعمیر.
              </p>
            </article>

            <article class="service-card">
              <div class="service-icon">🏁</div>
              <h3>سرویس سریع</h3>
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
              <span class="eyebrow">HOW IT WORKS</span>
              <h2>فرآیند کار</h2>
            </div>
          </div>

          <div class="process-grid">

            <div class="process-step">
              <div class="process-number">01</div>
              <h3>پذیرش</h3>
              <p>ثبت اطلاعات مشتری و موتورسیکلت.</p>
            </div>

            <div class="process-step">
              <div class="process-number">02</div>
              <h3>بررسی</h3>
              <p>تشخیص مشکل و تعیین خدمات موردنیاز.</p>
            </div>

            <div class="process-step">
              <div class="process-number">03</div>
              <h3>تعمیر</h3>
              <p>اجرای کار و ثبت مراحل تعمیر.</p>
            </div>

            <div class="process-step">
              <div class="process-number">04</div>
              <h3>تحویل</h3>
              <p>کنترل نهایی و آماده‌سازی برای تحویل.</p>
            </div>

          </div>
        </section>

        <section class="tracking-section" id="tracking">

          <div class="tracking-card">

            <span class="eyebrow">
              TRACK YOUR MOTORCYCLE
            </span>

            <h2>پیگیری وضعیت تعمیر</h2>

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

        <section class="section" id="request">

          <div class="section-heading">
            <div>
              <span class="eyebrow">BOOK SERVICE</span>
              <h2>درخواست پذیرش</h2>
            </div>

            <p>
              اطلاعات خود را ارسال کنید تا با شما تماس بگیریم.
            </p>
          </div>

          <div class="workspace">

            <div class="panel">

              <div class="panel-title">
                <h3>اطلاعات درخواست</h3>
                <span class="section-number">01</span>
              </div>

              <form
                class="case-form"
                onsubmit="submitRequest(event)"
              >

                <div class="field">
                  <label>نام و نام خانوادگی</label>
                  <input
                    id="requestName"
                    required
                  >
                </div>

                <div class="field">
                  <label>شماره موبایل</label>
                  <input
                    id="requestPhone"
                    inputmode="tel"
                    placeholder="09xxxxxxxxx"
                    required
                  >
                </div>

                <div class="field">
                  <label>مدل موتورسیکلت</label>
                  <input
                    id="requestBike"
                    placeholder="مثلاً هوندا کلیک"
                    required
                  >
                </div>

                <div class="field">
                  <label>شرح مشکل</label>
                  <textarea
                    id="requestProblem"
                    rows="5"
                    placeholder="مشکل یا سرویس موردنیاز..."
                    required
                  ></textarea>
                </div>

                <button class="primary-btn" type="submit">
                  ارسال درخواست
                </button>

              </form>

            </div>

          </div>
        </section>

      </main>

      <footer>
        <div>
          <strong>موتو کلینیک ولیعصر (عج)</strong>
          <span>
            مرکز تخصصی تعمیر و سرویس موتورسیکلت
          </span>
        </div>

        <div>
          <strong>تماس</strong>
          <span>09195805965</span>
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

  const code = $('trackingCode')?.value.trim();

  if (!code) return;

  const result = $('trackingResult');

  result.innerHTML = `
    <div class="status-result">
      در حال بررسی...
    </div>
  `;

  try {
    const data = await api(
      `/cases?code=${encodeURIComponent(code)}`
    );

    const cases =
      data?.items ||
      data?.data ||
      data ||
      [];

    const found = Array.isArray(cases)
      ? cases[0]
      : cases;

    if (!found || !found.id) {
      result.innerHTML = `
        <div class="status-result">
          پرونده‌ای با این کد پیدا نشد.
        </div>
      `;
      return;
    }

    const customer =
      found.customer?.name ||
      found.customerName ||
      found.name ||
      'مشتری';

    const bike =
      found.motorcycle?.model ||
      found.motorcycleModel ||
      found.bike ||
      'موتورسیکلت';

    result.innerHTML = `
      <div class="tracking-result-card">

        <div>
          <small>مشتری</small>
          <strong>${esc(customer)}</strong>
        </div>

        <div>
          <small>موتورسیکلت</small>
          <strong>${esc(bike)}</strong>
        </div>

        <div>
          <small>وضعیت</small>
          <span class="badge ${statusClass(found.status)}">
            ${esc(statusText(found.status))}
          </span>
        </div>

      </div>
    `;

  } catch (err) {
    result.innerHTML = `
      <div class="status-result">
        ${esc(err.message)}
      </div>
    `;
  }
}

/* =========================
   REQUEST
   ========================= */

async function submitRequest(event) {
  event.preventDefault();

  const payload = {
    name: $('requestName').value.trim(),
    phone: $('requestPhone').value.trim(),
    motorcycleModel: $('requestBike').value.trim(),
    problem: $('requestProblem').value.trim()
  };

  try {
    await api('/customer-requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    toast('درخواست شما با موفقیت ارسال شد');

    event.target.reset();

  } catch (err) {
    toast(
      err.message || 'ارسال درخواست انجام نشد'
    );
  }
}

/* =========================
   LOGIN
   ========================= */

function showLogin() {
  const modal = document.createElement('div');

  modal.id = 'loginModal';

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

        <h2>ورود مدیریت</h2>

        <p>
          برای ورود به پنل مدیریت اطلاعات خود را وارد کنید.
        </p>

        <form onsubmit="submitLogin(event)">

          <div class="field">
            <label>نام کاربری</label>
            <input
              id="loginUsername"
              autocomplete="username"
              required
            >
          </div>

          <div class="field">
            <label>رمز عبور</label>
            <input
              id="loginPassword"
              type="password"
              autocomplete="current-password"
              required
            >
          </div>

          <button class="primary-btn" type="submit">
            ورود به پنل
          </button>

        </form>

      </div>

    </div>
  `;

  document.body.appendChild(modal);
}

async function submitLogin(event) {
  event.preventDefault();

  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password
      })
    });

    saveSession(
      data.user ||
      data.account ||
      data.profile,
      data.token ||
      data.accessToken ||
      data.jwt
    );

    $('loginModal')?.remove();

    toast('ورود موفق بود');

    await loadAdminData();

    renderAdmin();

  } catch (err) {
    toast(
      err.message ||
      'نام کاربری یا رمز عبور اشتباه است'
    );
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
          <div class="brand-icon">🏍</div>
          <div>
            <h1>موتو کلینیک</h1>
            <span>پنل مدیریت</span>
          </div>
        </div>

        <nav class="nav">
          <button data-admin-nav="dashboard">
            داشبورد
          </button>

          <button data-admin-nav="cases">
            پرونده‌ها
          </button>

          <button data-admin-nav="reception">
            پذیرش جدید
          </button>

          <button data-admin-nav="workshop">
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

      <main id="adminMain"></main>

      <footer>
        <div>
          <strong>موتو کلینیک ولیعصر (عج)</strong>
          <span>پنل مدیریت تعمیرگاه</span>
        </div>
      </footer>

    </div>
  `;

  document
    .querySelectorAll('[data-admin-nav]')
    .forEach(button => {
      button.addEventListener('click', () => {
        renderAdminPage(
          button.dataset.adminNav
        );
      });
    });

  renderAdminPage('dashboard');
}

function renderAdminPage(page) {
  const root = $('adminMain');

  if (!root) return;

  if (page === 'dashboard') {
    renderAdminDashboard(root);
  }

  if (page === 'cases') {
    renderAdminCases(root);
  }

  if (page === 'reception') {
    renderAdminReception(root);
  }

  if (page === 'workshop') {
    renderAdminWorkshop(root);
  }
}

/* =========================
   ADMIN DASHBOARD
   ========================= */

function renderAdminDashboard(root) {
  const active = state.cases.filter(
    c =>
      ![
        'تحویل شده',
        'COMPLETED',
        'CLOSED'
      ].includes(c.status)
  );

  const ready = state.cases.filter(
    c =>
      [
        'آماده تحویل',
        'READY',
        'READY_FOR_DELIVERY'
      ].includes(c.status)
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
          <div class="stat-icon">🏍</div>
          <strong>${active.length}</strong>
          <span>داخل تعمیرگاه</span>
        </div>

        <div class="stat-card">
          <div class="stat-icon">✓</div>
          <strong>${ready.length}</strong>
          <span>آماده تحویل</span>
        </div>

        <div class="stat-card">
          <div class="stat-icon">👤</div>
          <strong>${state.customers.length}</strong>
          <span>مشتریان</span>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <strong>${state.cases.length}</strong>
          <span>کل پرونده‌ها</span>
        </div>

      </div>

      <div class="panel">

        <div class="panel-title">
          <h3>آخرین پرونده‌ها</h3>

          <button
            class="secondary-btn"
            onclick="renderAdminPage('cases')"
          >
            مشاهده همه
          </button>
        </div>

        <div class="records">
          ${renderAdminCaseRows(
            state.cases.slice(0, 8)
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

          <h2>پرونده‌های تعمیر</h2>
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
          ${renderAdminCaseRows(state.cases)}
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
      ?.toLowerCase() || '';

  const list = state.cases.filter(c =>
    JSON.stringify(c)
      .toLowerCase()
      .includes(query)
  );

  $('adminCaseList').innerHTML =
    renderAdminCaseRows(list);
}

function renderAdminCaseRows(list) {
  if (!list.length) {
    return `
      <div class="mini-record">
        موردی برای نمایش وجود ندارد.
      </div>
    `;
  }

  return list.map(c => {

    const customer =
      c.customer?.name ||
      c.customerName ||
      c.name ||
      'مشتری';

    const phone =
      c.customer?.phone ||
      c.phone ||
      '';

    const bike =
      c.motorcycle?.model ||
      c.motorcycleModel ||
      c.bike ||
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
            ${phone ? ' • ' + esc(phone) : ''}
          </span>

          <small>
            کد: ${esc(c.id || '-')}
          </small>
        </div>

        <span class="badge ${statusClass(c.status)}">
          ${esc(statusText(c.status))}
        </span>

      </div>
    `;
  }).join('');
}

/* =========================
   CASE DETAIL
   ========================= */

async function openAdminCase(id) {
  let c =
    state.cases.find(
      item => String(item.id) === String(id)
    );

  if (!c) return;

  try {
    const fresh = await api(
      `/cases/${encodeURIComponent(id)}`
    );

    c =
      fresh?.item ||
      fresh?.data ||
      fresh;
  } catch {}

  const customer =
    c.customer?.name ||
    c.customerName ||
    c.name ||
    'مشتری';

  const phone =
    c.customer?.phone ||
    c.phone ||
    '';

  const bike =
    c.motorcycle?.model ||
    c.motorcycleModel ||
    c.bike ||
    'موتورسیکلت';

  const status =
    c.status || 'RECEIVED';

  const technician =
    c.technician ||
    c.technicianName ||
    '';

  const tasks =
    c.tasks ||
    c.problem ||
    '';

  const amount =
    c.amount ||
    c.totalAmount ||
    0;

  const paid =
    c.paid ||
    c.paidAmount ||
    0;

  const root = $('adminMain');

  root.innerHTML = `
    <section class="section">

      <div class="section-heading">

        <div>
          <span class="eyebrow">
            CASE #${esc(c.id)}
          </span>

          <h2>
            جزئیات پرونده
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
            <span>مشتری</span>
            <strong>${esc(customer)}</strong>
          </div>

          <span class="badge ${statusClass(status)}">
            ${esc(statusText(status))}
          </span>

        </div>

        <div class="detail-grid">

          <div class="detail-item">
            <span>موبایل</span>
            <strong>${esc(phone || '-')}</strong>
          </div>

          <div class="detail-item">
            <span>موتورسیکلت</span>
            <strong>${esc(bike)}</strong>
          </div>

          <div class="detail-item">
            <span>تکنسین</span>
            <strong>${esc(technician || '-')}</strong>
          </div>

          <div class="detail-item">
            <span>هزینه</span>
            <strong>${money(amount)} تومان</strong>
          </div>

          <div class="detail-item">
            <span>پرداخت شده</span>
            <strong>${money(paid)} تومان</strong>
          </div>

        </div>

        <div class="detail-description">
          <span>شرح کار / مشکل</span>
          <p>${esc(tasks || '-')}</p>
        </div>

        <div class="status-editor">

          <div class="field">
            <label>وضعیت پرونده</label>

            <select id="caseStatus">
              ${statusOptions(status)}
            </select>
          </div>

          <div class="field">
            <label>تکنسین</label>

            <input
              id="caseTechnician"
              value="${esc(technician)}"
            >
          </div>

          <div class="field">
            <label>هزینه کل</label>

            <input
              id="caseAmount"
              type="number"
              value="${Number(amount || 0)}"
            >
          </div>

          <div class="field">
            <label>پرداخت شده</label>

            <input
              id="casePaid"
              type="number"
              value="${Number(paid || 0)}"
            >
          </div>

          <div class="field">
            <label>شرح کار</label>

            <textarea id="caseTasks">${esc(tasks)}</textarea>
          </div>

          <button
            class="primary-btn"
            onclick="saveCase('${esc(c.id)}')"
          >
            ذخیره تغییرات
          </button>

        </div>

      </div>

    </section>
  `;
}

function statusOptions(current) {
  const options = [
    ['RECEIVED', 'پذیرش شده'],
    ['DIAGNOSIS', 'در حال بررسی'],
    ['WAITING_APPROVAL', 'در انتظار تأیید'],
    ['IN_PROGRESS', 'در حال تعمیر'],
    ['WAITING_PARTS', 'در انتظار قطعه'],
    ['QUALITY_CHECK', 'کنترل کیفیت'],
    ['READY_FOR_DELIVERY', 'آماده تحویل'],
    ['COMPLETED', 'تحویل شده']
  ];

  return options.map(
    ([value, label]) => `
      <option
        value="${value}"
        ${String(current) === value ? 'selected' : ''}
      >
        ${label}
      </option>
    `
  ).join('');
}

async function saveCase(id) {
  const payload = {
    status: $('caseStatus').value,
    technician:
      $('caseTechnician').value.trim(),
    amount:
      Number($('caseAmount').value || 0),
    paid:
      Number($('casePaid').value || 0),
    tasks:
      $('caseTasks').value.trim()
  };

  try {
    await api(
      `/cases/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );

    toast('پرونده با موفقیت ذخیره شد');

    await loadAdminData();

    renderAdminPage('cases');

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

          <h2>پذیرش جدید</h2>

          <p>
            ثبت مشتری، موتورسیکلت و درخواست تعمیر
          </p>
        </div>

      </div>

      <div class="workspace">

        <div class="panel">

          <div class="panel-title">
            <h3>اطلاعات مشتری</h3>
            <span class="section-number">01</span>
          </div>

          <form
            class="case-form"
            onsubmit="submitReception(event)"
          >

            <div class="field">
              <label>نام و نام خانوادگی</label>
              <input id="adminCustomerName" required>
            </div>

            <div class="field">
              <label>موبایل</label>
              <input
                id="adminCustomerPhone"
                inputmode="tel"
                required
              >
            </div>

            <div class="panel-title">
              <h3>موتورسیکلت</h3>
              <span class="section-number">02</span>
            </div>

            <div class="field">
              <label>برند / مدل</label>
              <input id="adminBikeModel" required>
            </div>

            <div class="field">
              <label>پلاک / شناسه</label>
              <input id="adminBikePlate">
            </div>

            <div class="field">
              <label>کیلومتر</label>
              <input
                id="adminBikeKm"
                inputmode="numeric"
              >
            </div>

            <div class="panel-title">
              <h3>درخواست تعمیر</h3>
              <span class="section-number">03</span>
            </div>

            <div class="field">
              <label>شرح مشکل</label>
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

  const payload = {
    customer: {
      name:
        $('adminCustomerName').value.trim(),
      phone:
        $('adminCustomerPhone').value.trim()
    },

    motorcycle: {
      model:
        $('adminBikeModel').value.trim(),
      plate:
        $('adminBikePlate').value.trim(),
      km:
        $('adminBikeKm').value.trim()
    },

    problem:
      $('adminProblem').value.trim(),

    status: 'RECEIVED',

    checkInAt:
      new Date().toISOString()
  };

  try {
    await api('/cases', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    toast('پذیرش با موفقیت ثبت شد');

    await loadAdminData();

    renderAdminPage('dashboard');

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
  const active = state.cases.filter(
    c =>
      ![
        'COMPLETED',
        'CLOSED',
        'تحویل شده'
      ].includes(c.status)
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
          ${renderAdminCaseRows(active)}
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
      await api('/auth/logout', {
        method: 'POST'
      });
    }
  } catch {}

  clearSession();

  renderPublic();

  window.scrollTo(0, 0);

  toast('از حساب مدیریت خارج شدید');
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

  if (state.user && token()) {
    try {
      const me = await api('/auth/me');

      state.user =
        me.user ||
        me.account ||
        me;

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(state.user)
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

window.showLogin = showLogin;
window.submitLogin = submitLogin;
window.trackCase = trackCase;
window.submitRequest = submitRequest;
window.scrollToId = scrollToId;
window.logout = logout;
window.renderAdminPage = renderAdminPage;
window.filterAdminCases = filterAdminCases;
window.openAdminCase = openAdminCase;
window.saveCase = saveCase;
window.submitReception = submitReception;
