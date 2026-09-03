const API="http://localhost:4000/api";
async function load(){
  try{
    const h=await fetch(API+"/health"); const health=await h.json();
    document.querySelector("#status").textContent=health.ok?"متصل":"خطا در اتصال";
    const d=await (await fetch(API+"/dashboard")).json();
    for(const k of ["customers","motorcycles","active_cases","ready"]) document.querySelector("#"+k).textContent=d[k]??0;
    const cases=await (await fetch(API+"/cases")).json();
    document.querySelector("#cases").innerHTML=cases.length?cases.map(x=>`
      <div class="case"><b>${x.customer_name}</b> — ${x.brand||""} ${x.model||""} (${x.plate})
      <span class="badge">${x.status}</span><div>${x.complaint}</div></div>`).join(""):"هنوز پرونده‌ای ثبت نشده است.";
  }catch(e){document.querySelector("#status").textContent="API در دسترس نیست"}
}
load(); setInterval(load,15000);
