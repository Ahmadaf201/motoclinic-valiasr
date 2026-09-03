const API_URL = "http://localhost:4000/api";

const app = document.getElementById("app");

async function loadDashboard() {
  try {
    const response = await fetch(`${API_URL}/health`);

    if (!response.ok) {
      throw new Error("API unavailable");
    }

    const data = await response.json();

    app.innerHTML = `
      <div style="font-family:Tahoma,Arial;direction:rtl;padding:20px">
        <h2>داشبورد موتو کلینیک</h2>
        <p>وضعیت سیستم: 🟢 ${data.ok ? "فعال" : "غیرفعال"}</p>
        <p>نسخه: ${data.version}</p>

        <hr>

        <h3>ماژول‌های سیستم</h3>

        <ul>
          <li>👤 مدیریت مشتریان</li>
          <li>🏍️ مدیریت موتورسیکلت‌ها</li>
          <li>🔧 پذیرش و پرونده تعمیر</li>
          <li>🛠️ مدیریت تعمیرکاران و وظایف</li>
          <li>📋 برآورد هزینه</li>
          <li>✅ تأیید تعمیر</li>
          <li>💳 پرداخت و حسابداری</li>
          <li>📦 قطعات و موجودی</li>
          <li>📊 گزارش‌ها</li>
          <li>🧾 سوابق تعمیرات</li>
        </ul>
      </div>
    `;
  } catch (error) {
    app.innerHTML = `
      <div style="font-family:Tahoma;direction:rtl;padding:20px">
        <h2>موتو کلینیک ولیعصر(عج)</h2>
        <p>🔴 اتصال به سرور برقرار نیست.</p>
      </div>
    `;
  }
}

loadDashboard();
