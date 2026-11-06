const navItems = [
  ["index.html","الرئيسية"],["about.html","من نحن"],["services.html","خدماتنا"],
  ["creators.html","للمبدعين"],["faq.html","الأسئلة الشائعة"],["contact.html","اتصل بنا"]
];
const current = location.pathname.split("/").pop() || "index.html";
const header = document.getElementById("site-header");
if (header) header.innerHTML = `
<header class="site-header"><div class="container nav-wrap">
 <a class="brand" href="index.html"><span class="brand-crown">♛</span><span><b>GLOBALHOLMES LTD</b><small>TikTok LIVE Agency</small></span></a>
 <button class="menu-toggle" aria-label="فتح القائمة" aria-expanded="false">☰</button>
 <nav class="main-nav">${navItems.map(([url,label])=>`<a href="${url}" class="${current===url?'active':''}">${label}</a>`).join("")}</nav>
 <a class="nav-cta" href="https://wa.me/447577351132" target="_blank" rel="noopener">تواصل معنا ↗</a>
</div></header>`;
const footer = document.getElementById("site-footer");
if (footer) footer.innerHTML = `
<footer class="site-footer"><div class="container footer-top">
 <div class="footer-brand"><a class="brand" href="index.html"><span class="brand-crown">♛</span><span><b>GLOBALHOLMES LTD</b><small>TikTok LIVE Agency</small></span></a><p>شريكك لتطوير تجربة البث المباشر ودعم المبدعين.</p></div>
 <div><h4>روابط سريعة</h4><a href="about.html">من نحن</a><a href="services.html">خدماتنا</a><a href="creators.html">للمبدعين</a></div>
 <div><h4>تواصل</h4><a href="https://wa.me/447577351132" target="_blank" rel="noopener">+44 7577 351132</a><a href="mailto:info@krar.live">info@krar.live</a><span>المملكة المتحدة 🇬🇧</span></div>
</div><div class="container footer-bottom"><span>© <span id="year"></span> GLOBALHOLMES LTD. جميع الحقوق محفوظة.</span><div><a href="privacy.html">سياسة الخصوصية</a><span>·</span><span>موقع تعريفي مستقل</span></div></div></footer>
<a class="floating-whatsapp" href="https://wa.me/447577351132" target="_blank" rel="noopener" aria-label="تواصل عبر واتساب">◉</a>`;
const toggle = document.querySelector(".menu-toggle");
if (toggle) toggle.addEventListener("click",()=>{const nav=document.querySelector(".main-nav");const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));toggle.textContent=open?"×":"☰";});
const year=document.getElementById("year"); if(year) year.textContent=new Date().getFullYear();