'use strict';

/* =========================
   MOTO CLINIC CORE
   Reception + Appointments
   Check-in / Check-out
   Roles + Workshop
   ========================= */

const API =
  window.__API_URL__ ||
  localStorage.getItem('motoclinic_api_url') ||
  '';

const TOKEN_KEY = 'motoclinic_token';
const USER_KEY = 'motoclinic_user';

let state = {
  user: null,
  cases: [],
  appointments: [],
  customers: [],
  motorcycles: []
};

/* ---------- Helpers ---------- */

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function authHeaders() {
  const t = token();
  return t
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`
      }
    : {
        'Content-Type': 'application/json'
      };
}

function esc(v) {
  return String(v ?? '').replace(/[&<>'"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[m]));
}

function money(v) {
  return Number(v || 0).toLocaleString('fa-IR');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message) {
  let el = document.getElementById('toast');

  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText =
      'position:fixed;bottom:25px;right:25px;z-index:9999;' +
      'background:#111;color:#fff;padding:13px 18px;' +
      'border-radius:12px;font-size:13px;box-shadow:0 8px 30px #0003';
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.style.display = 'block';

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 2200);
}

async function api(path, options = {}) {
  if (!API) {
    throw new Error('API URL تنظیم نشده است');
  }

  const response = await fetch(API.replace(/\/$/, '') + path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `خطای سرور: ${response.status}`
    );
  }

  return data;
}

/* ---------- Session ---------- */

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
  } catch (_) {
    state.user = null;
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  state.user = null;

  location.reload();
}

/* ---------- Roles ---------- */

function role() {
  const r =
    state.user?.role ||
    state.user?.userRole ||
    state.user?.type ||
    '';

  return String(r).toLowerCase();
}

function isAdmin() {
  return [
    'admin',
    'main_admin',
    'مدیر اصلی',
    'مدیرکل'
  ].includes(role());
}

function isExecutive() {
  return [
    'executive',
    'manager',
    'executive_manager',
    'مدیر اجرایی'
  ].includes(role());
}

function isTechnician() {
  return [
    'technician',
    'tech',
    'تکنسین',
    'تعمیرکار'
  ].includes(role());
}

function canReception() {
  return isAdmin() || isExecutive();
}

function canAppointments() {
  return isAdmin() || isExecutive();
}

function canCheckInOut() {
  return isAdmin() || isExecutive();
}

function canAssignTechnician() {
  return isAdmin() || isExecutive();
}

/* ---------- Login ---------- */

async function login(username, password) {
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password
      })
    });

    saveSession(
      data.user || data.account || data.profile,
      data.token || data.accessToken || data.jwt
    );

    showToast('ورود موفق بود');

    await loadAll();

    renderApp();

    return true;
  } catch (err) {
    showToast(err.message || 'ورود ناموفق بود');
    return false;
  }
}

/* ---------- Data ---------- */

async function loadAll() {
  const requests = [];

  const endpoints = [
    ['/cases', 'cases'],
    ['/appointments', 'appointments'],
    ['/customers', 'customers'],
    ['/motorcycles', 'motorcycles']
  ];

  for (const [endpoint, key] of endpoints) {
    requests.push(
      api(endpoint)
        .then(data => {
          state[key] =
            data?.items ||
            data?.data ||
            data ||
            [];
        })
        .catch(() => {
          state[key] = [];
        })
    );
  }

  await Promise.all(requests);
}

/* ---------- Navigation ---------- */

function navigate(page) {
  document
    .querySelectorAll('[data-page]')
    .forEach(el => {
      el.style.display =
        el.dataset.page === page ? '' : 'none';
    });

  document
    .querySelectorAll('[data-nav]')
    .forEach(el => {
      el.classList.toggle(
        'active',
        el.dataset.nav === page
      );
    });

  const renderers = {
    dashboard: renderDashboard,
    reception: renderReception,
    appointments: renderAppointments,
    workshop: renderWorkshop,
    cases: renderCases,
    technician: renderTechnician
  };

  if (renderers[page]) {
    renderers[page]();
  }
}

/* ---------- Dashboard ---------- */

function renderDashboard() {
  const root =
    document.querySelector('[data-page="dashboard"]');

  if (!root) return;

  const activeCases = state.cases.filter(
    c => c.status !== 'تحویل شده'
  );

  const readyCases = state.cases.filter(
    c => c.status === 'آماده تحویل'
  );

  const todayAppointments =
    state.appointments.filter(a =>
      String(a.date || '').slice(0, 10) === today()
    );

  root.innerHTML = `
    <div class="mc-dashboard">

      <div class="mc-header">
        <div>
          <h1>موتوکلینیک</h1>
          <p>سیستم مدیریت و اتوماسیون تعمیرگاه</p>
        </div>

        <div class="mc-user">
          <b>${esc(
            state.user?.name ||
            state.user?.username ||
            'کاربر'
          )}</b>
          <small>${esc(
            state.user?.role || ''
          )}</small>
          <button onclick="logout()">خروج</button>
        </div>
      </div>

      <div class="mc-stats">

        <div class="mc-stat">
          <b>${activeCases.length}</b>
          <span>داخل تعمیرگاه</span>
        </div>

        <div class="mc-stat">
          <b>${readyCases.length}</b>
          <span>آماده تحویل</span>
        </div>

        <div class="mc-stat">
          <b>${todayAppointments.length}</b>
          <span>نوبت امروز</span>
        </div>

        <div class="mc-stat">
          <b>${state.cases.length}</b>
          <span>کل پرونده‌ها</span>
        </div>

      </div>

      <div class="mc-actions">

        ${
          canReception()
            ? `
              <button onclick="navigate('reception')">
                <strong>＋</strong>
                پذیرش جدید
                <small>ثبت مشتری و موتور</small>
              </button>
            `
            : ''
        }

        ${
          canAppointments()
            ? `
              <button onclick="navigate('appointments')">
                <strong>📅</strong>
                نوبت‌دهی
                <small>مدیریت نوبت‌ها</small>
              </button>
            `
            : ''
        }

        <button onclick="navigate('workshop')">
          <strong>🔧</strong>
          تعمیرگاه
          <small>موتورهای داخل</small>
        </button>

        <button onclick="navigate('cases')">
          <strong>📋</strong>
          پرونده‌ها
          <small>سوابق مشتریان</small>
        </button>

        ${
          isTechnician()
            ? `
              <button onclick="navigate('technician')">
                <strong>🛠</strong>
                کارهای من
                <small>پرونده‌های واگذار شده</small>
              </button>
            `
            : ''
        }

      </div>

      <div class="mc-card">

        <div class="mc-card-title">
          <h2>آخرین پذیرش‌ها</h2>

          ${
            canReception()
              ? `<button onclick="navigate('reception')">
                   پذیرش جدید
                 </button>`
              : ''
          }
        </div>

        <div id="latestCases">
          ${renderCaseRows(state.cases.slice(0, 6))}
        </div>

      </div>

    </div>
  `;
}

/* ---------- Reception ---------- */

function renderReception() {
  const root =
    document.querySelector('[data-page="reception"]');

  if (!root || !canReception()) return;

  root.innerHTML = `
    <div class="mc-page">

      <div class="mc-page-head">
        <div>
          <h1>پذیرش جدید</h1>
          <p>ثبت مشتری، موتورسیکلت و درخواست تعمیر</p>
        </div>

        <button onclick="navigate('dashboard')">
          برگشت
        </button>
      </div>

      <form id="receptionForm" class="mc-form">

        <div class="mc-section">
          <h3>اطلاعات مشتری</h3>

          <label>
            نام و نام خانوادگی *
            <input id="customerName" required>
          </label>

          <label>
            موبایل *
            <input
              id="customerPhone"
              inputmode="tel"
              required
              placeholder="09xxxxxxxxx"
            >
          </label>
        </div>

        <div class="mc-section">
          <h3>موتورسیکلت</h3>

          <label>
            برند / مدل *
            <input id="bikeModel" required>
          </label>

          <label>
            پلاک / شناسه
            <input id="bikePlate">
          </label>

          <label>
            کیلومتر
            <input id="bikeKm" inputmode="numeric">
          </label>
        </div>

        <div class="mc-section">
          <h3>درخواست تعمیر</h3>

          <label>
            شرح مشکل / سرویس *
            <textarea id="problem" required></textarea>
          </label>

          <label>
            نوبت مرتبط
            <select id="appointmentId">
              <option value="">بدون نوبت</option>
              ${state.appointments
                .filter(a =>
                  String(a.date || '').slice(0, 10) >= today()
                )
                .map(a => `
                  <option value="${esc(a.id)}">
                    ${esc(a.date)} -
                    ${esc(a.time || '')} -
                    ${esc(a.customerName || a.name || '')}
                  </option>
                `)
                .join('')}
            </select>
          </label>
        </div>

        <button class="mc-primary" type="submit">
          ثبت پذیرش
        </button>

      </form>

    </div>
  `;

  document
    .getElementById('receptionForm')
    ?.addEventListener('submit', submitReception);
}

async function submitReception(event) {
  event.preventDefault();

  const payload = {
    customer: {
      name: document.getElementById('customerName').value.trim(),
      phone: document.getElementById('customerPhone').value.trim()
    },

    motorcycle: {
      model: document.getElementById('bikeModel').value.trim(),
      plate: document.getElementById('bikePlate').value.trim(),
      km: document.getElementById('bikeKm').value.trim()
    },

    problem:
      document.getElementById('problem').value.trim(),

    appointmentId:
      document.getElementById('appointmentId').value || null,

    status: 'پذیرش شده',

    checkInAt: new Date().toISOString()
  };

  try {
    await api('/cases', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showToast('پذیرش با موفقیت ثبت شد');

    await loadAll();

    navigate('dashboard');

  } catch (err) {
    showToast(err.message || 'ثبت پذیرش انجام نشد');
  }
}

/* ---------- Appointments ---------- */

function renderAppointments() {
  const root =
    document.querySelector('[data-page="appointments"]');

  if (!root || !canAppointments()) return;

  root.innerHTML = `
    <div class="mc-page">

      <div class="mc-page-head">
        <div>
          <h1>نوبت‌دهی</h1>
          <p>برنامه پذیرش مشتریان</p>
        </div>

        <button onclick="openAppointmentForm()">
          + نوبت جدید
        </button>
      </div>

      <div class="mc-card">
        ${renderAppointmentsRows()}
      </div>

    </div>
  `;
}

function renderAppointmentsRows() {
  if (!state.appointments.length) {
    return `
      <div class="mc-empty">
        هنوز نوبتی ثبت نشده است.
      </div>
    `;
  }

  return state.appointments
    .sort((a, b) =>
      String(a.date + a.time)
        .localeCompare(String(b.date + b.time))
    )
    .map(a => `
      <div class="mc-row">

        <div>
          <strong>
            ${esc(
              a.customerName ||
              a.name ||
              'مشتری'
            )}
          </strong>

          <small>
            ${esc(a.date || '')}
            ${esc(a.time || '')}
            ${a.phone ? ' • ' + esc(a.phone) : ''}
          </small>
        </div>

        <span class="mc-badge">
          ${esc(a.status || 'رزرو شده')}
        </span>

        ${
          canCheckInOut()
            ? `
              <button
                onclick="checkInAppointment('${esc(a.id)}')">
                ورود
              </button>
            `
            : ''
        }

      </div>
    `)
    .join('');
}

async function openAppointmentForm() {
  const name =
    prompt('نام مشتری:');

  if (!name) return;

  const phone =
    prompt('شماره موبایل:') || '';

  const date =
    prompt('تاریخ نوبت (YYYY-MM-DD):', today());

  if (!date) return;

  const time =
    prompt('ساعت نوبت (مثلاً 10:30):');

  if (!time) return;

  try {
    await api('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        customerName: name,
        phone,
        date,
        time,
        status: 'رزرو شده'
      })
    });

    showToast('نوبت ثبت شد');

    await loadAll();

    renderAppointments();

  } catch (err) {
    showToast(err.message || 'ثبت نوبت ناموفق بود');
  }
}

/* ---------- Check In ---------- */

async function checkInAppointment(id) {
  if (!canCheckInOut()) {
    showToast('دسترسی ندارید');
    return;
  }

  try {
    await api(`/appointments/${id}/check-in`, {
      method: 'POST'
    });

    showToast('ورود مشتری ثبت شد');

    await loadAll();

    renderAppointments();

  } catch (err) {
    showToast(err.message || 'ثبت ورود انجام نشد');
  }
}

/* ---------- Workshop ---------- */

function renderWorkshop() {
  const root =
    document.querySelector('[data-page="workshop"]');

  if (!root) return;

  const active =
    state.cases.filter(
      c => c.status !== 'تحویل شده'
    );

  root.innerHTML = `
    <div class="mc-page">

      <div class="mc-page-head">
        <div>
          <h1>تعمیرگاه</h1>
          <p>موتورسیکلت‌های داخل تعمیرگاه</p>
        </div>
      </div>

      <div class="mc-card">

        ${
          active.length
            ? renderCaseRows(active)
            : `
              <div class="mc-empty">
                موتوری داخل تعمیرگاه نیست.
              </div>
            `
        }

      </div>

    </div>
  `;
}

/* ---------- Cases ---------- */

function renderCases() {
  const root =
    document.querySelector('[data-page="cases"]');

  if (!root) return;

  root.innerHTML = `
    <div class="mc-page">

      <div class="mc-page-head">
        <div>
          <h1>پرونده‌ها</h1>
          <p>جستجو و مدیریت سوابق</p>
        </div>
      </div>

      <div class="mc-card">

        <input
          id="caseSearch"
          placeholder="نام، موبایل، موتور یا کد پذیرش..."
          oninput="filterCases()"
        >

        <div id="caseList">
          ${renderCaseRows(state.cases)}
        </div>

      </div>

    </div>
  `;
}

function filterCases() {
  const q =
    document.getElementById('caseSearch')
      ?.value
      ?.trim()
      ?.toLowerCase() || '';

  const list =
    state.cases.filter(c =>
      JSON.stringify(c)
        .toLowerCase()
        .includes(q)
    );

  document.getElementById('caseList').innerHTML =
    renderCaseRows(list);
}

function renderCaseRows(list) {
  if (!list.length) {
    return `
      <div class="mc-empty">
        موردی پیدا نشد.
      </div>
    `;
  }

  return list.map(c => `
    <div
      class="mc-row mc-click"
      onclick="openCase('${esc(c.id)}')">

      <div>

        <strong>
          ${esc(
            c.bike ||
            c.motorcycle?.model ||
            c.motorcycleModel ||
            'موتورسیکلت'
          )}
        </strong>

        <small>
          ${esc(
            c.name ||
            c.customer?.name ||
            c.customerName ||
            ''
          )}

          ${c.phone
            ? ' • ' + esc(c.phone)
            : ''}

          ${c.id
            ? ' • ' + esc(c.id)
            : ''}
        </small>

      </div>

      <span class="mc-badge">
        ${esc(c.status || 'پذیرش شده')}
      </span>

    </div>
  `).join('');
}

/* ---------- Case Detail ---------- */

async function openCase(id) {
  const c =
    state.cases.find(x => String(x.id) === String(id));

  if (!c) return;

  const status =
    c.status || 'پذیرش شده';

  const technician =
    c.technician ||
    c.technicianName ||
    '';

  const tasks =
    c.tasks || '';

  const amount =
    c.amount || c.totalAmount || 0;

  const paid =
    c.paid || c.paidAmount || 0;

  const nextStatus =
    prompt(
      `وضعیت جدید:\n\n` +
      `پذیرش شده\n` +
      `در حال بررسی\n` +
      `در حال تعمیر\n` +
      `کنترل کیفیت\n` +
      `آماده تحویل\n` +
      `تحویل شده\n\n` +
      `وضعیت فعلی: ${status}`,
      status
    );

  if (!nextStatus) return;

  let tech = technician;

  if (canAssignTechnician()) {
    tech =
      prompt(
        'نام تکنسین مسئول:',
        technician
      ) || technician;
  }

  const newAmount =
    prompt(
      'هزینه کل:',
      amount
    );

  const newPaid =
    prompt(
      'پرداخت شده:',
      paid
    );

  const newTasks =
    prompt(
      'شرح کار / خدمات:',
      tasks
    ) || tasks;

  try {
    await api(`/cases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: nextStatus,
        technician: tech,
        tasks: newTasks,
        amount: Number(newAmount || 0),
        paid: Number(newPaid || 0)
      })
    });

    showToast('پرونده ذخیره شد');

    await loadAll();

    renderCurrentPage();

  } catch (err) {
    showToast(err.message || 'ذخیره پرونده انجام نشد');
  }
}

/* ---------- Technician ---------- */

function renderTechnician() {
  const root =
    document.querySelector('[data-page="technician"]');

  if (!root) return;

  let list = state.cases;

  if (isTechnician()) {
    const name =
      state.user?.name ||
      state.user?.username ||
      '';

    list =
      list.filter(c =>
        String(
          c.technician ||
          c.technicianName ||
          ''
        ).includes(name)
      );
  }

  list =
    list.filter(c =>
      [
        'در حال بررسی',
        'در حال تعمیر',
        'کنترل کیفیت'
      ].includes(c.status)
    );

  root.innerHTML = `
    <div class="mc-page">

      <div class="mc-page-head">
        <div>
          <h1>کارهای تعمیرکار</h1>
          <p>پرونده‌های در حال تعمیر</p>
        </div>
      </div>

      <div class="mc-card">

        ${
          list.length
            ? renderCaseRows(list)
            : `
              <div class="mc-empty">
                کاری برای نمایش وجود ندارد.
              </div>
            `
        }

      </div>

    </div>
  `;
}

/* ---------- Check Out ---------- */

async function checkOutCase(id) {
  if (!canCheckInOut()) {
    showToast('دسترسی خروج فقط برای مدیران است');
    return;
  }

  if (!confirm('خروج و تحویل موتور ثبت شود؟')) {
    return;
  }

  try {
    await api(`/cases/${encodeURIComponent(id)}/check-out`, {
      method: 'POST'
    });

    showToast('خروج موتور ثبت شد');

    await loadAll();

    renderCurrentPage();

  } catch (err) {
    showToast(err.message || 'ثبت خروج انجام نشد');
  }
}

/* ---------- Current Page ---------- */

function renderCurrentPage() {
  const active =
    document.querySelector('[data-page]:not([style*="display: none"])');

  if (!active) {
    renderDashboard();
    return;
  }

  const page =
    active.dataset.page;

  const renderers = {
    dashboard: renderDashboard,
    reception: renderReception,
    appointments: renderAppointments,
    workshop: renderWorkshop,
    cases: renderCases,
    technician: renderTechnician
  };

  if (renderers[page]) {
    renderers[page]();
  }
}

/* ---------- App Boot ---------- */

function bindNavigation() {
  document
    .querySelectorAll('[data-nav]')
    .forEach(button => {
      button.addEventListener('click', () => {
        navigate(button.dataset.nav);
      });
    });
}

function applyRoleUI() {
  document
    .querySelectorAll('[data-role]')
    .forEach(el => {
      const allowed =
        el.dataset.role
          .split(',')
          .map(x => x.trim())
          .some(r =>
            String(role()).includes(
              String(r).toLowerCase()
            )
          );

      el.style.display =
        allowed ? '' : 'none';
    });
}

function renderApp() {
  bindNavigation();
  applyRoleUI();

  const loginPage =
    document.querySelector('[data-page="login"]');

  if (loginPage) {
    loginPage.style.display = 'none';
  }

  navigate('dashboard');
}

async function boot() {
  loadSession();

  if (!state.user && token()) {
    try {
      const me = await api('/auth/me');

      saveSession(
        me.user || me,
        token()
      );
    } catch (_) {}
  }

  if (state.user || token()) {
    await loadAll();
    renderApp();
    return;
  }

  const loginForm =
    document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const username =
          document.getElementById('username')
            ?.value
            ?.trim();

        const password =
          document.getElementById('password')
            ?.value || '';

        if (!username || !password) {
          showToast('نام کاربری و رمز عبور را وارد کنید');
          return;
        }

        await login(username, password);
      }
    );
  }
}

document.addEventListener(
  'DOMContentLoaded',
  boot
);
