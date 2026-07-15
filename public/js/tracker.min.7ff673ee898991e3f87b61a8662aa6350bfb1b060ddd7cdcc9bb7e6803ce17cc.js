(function(){"use strict";const g="agb_expenses",F=["January","February","March","April","May","June","July","August","September","October","November","December"],m={Health:"🩺",Beauty:"💄","Food / Groceries":"🛒","Vacation / Relaxation / Eating Out":"🌴",House:"🏠","Self Improvement":"📚",Gadgets:"💻",Clothing:"👗",Transportation:"🚗",Gifts:"🎁","Government Savings":"🏛️"},l=new Date;let i=l.getFullYear(),t=l.getMonth(),a=v();const e=e=>document.getElementById(e),j=e("month-label"),x=e("prev-month"),_=e("next-month"),O=e("total-spent"),w=e("entry-count"),b=e("top-cat"),n=e("amt"),s=e("cat"),u=e("notes"),y=e("add-btn"),c=e("form-error"),d=e("expense-list"),h=e("chart-section"),p=e("cat-chart");function v(){try{return JSON.parse(localStorage.getItem(g))||[]}catch{return[]}}function f(){try{localStorage.setItem(g,JSON.stringify(a))}catch(e){console.warn("Could not save expenses:",e)}}function r(e){return"₱"+Number(e).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}function C(e){const t=new Date(e);return t.toLocaleDateString("en-PH",{month:"short",day:"numeric"})}function E(){return a.filter(e=>{const n=new Date(e.date);return n.getFullYear()===i&&n.getMonth()===t})}function k(e){c.textContent=e,c.hidden=!1}function A(){c.textContent="",c.hidden=!0}function S(){A();const e=n.value.trim(),c=s.value,d=u.value.trim();let r=!0;if(!e||isNaN(e)||parseFloat(e)<=0?(n.classList.add("is-error"),r=!1):n.classList.remove("is-error"),c?s.classList.remove("is-error"):(s.classList.add("is-error"),r=!1),!r){k("Amount and category are required.");return}const h={id:Date.now(),amount:parseFloat(parseFloat(e).toFixed(2)),category:c,notes:d,date:new Date(i,t,l.getDate()).toISOString()};a.push(h),f(),n.value="",s.value="",u.value="",n.focus(),o()}function M(e){a=a.filter(t=>t.id!==e),f(),o()}function o(){j.textContent=`${F[t]} ${i}`;const e=E(),o=e.reduce((e,t)=>e+t.amount,0);O.textContent=r(o),w.textContent=e.length;const s={};e.forEach(e=>{s[e.category]=(s[e.category]||0)+e.amount});const n=Object.entries(s).sort((e,t)=>t[1]-e[1]);if(b.textContent=n.length?n[0][0].split("/")[0].trim():"~",n.length>0){h.hidden=!1;const t=n[0][1],e=["","--alt","--faint"];p.innerHTML=n.map(([n,s],o)=>{const a=(s/t*100).toFixed(1),i=e[o%e.length],c=n.split("/")[0].trim();return`
            <div class="cat-chart__row">
              <span class="cat-chart__label" title="${n}">${m[n]||""} ${c}</span>
              <div class="cat-chart__track" role="presentation">
                <div class="cat-chart__fill${i?" cat-chart__fill"+i:""}" style="width: ${a}%"></div>
              </div>
              <span class="cat-chart__value">${r(s)}</span>
            </div>
          `}).join("")}else h.hidden=!0,p.innerHTML="";if(e.length===0){d.innerHTML='<p class="expense-list__empty">No expenses logged yet.</p>';return}const a=[...e].sort((e,t)=>new Date(t.date)-new Date(e.date));d.innerHTML=a.map(e=>{const t=m[e.category]||"•";return`
          <article class="expense-item" data-id="${e.id}">
            <div class="expense-item__icon" aria-hidden="true">${t}</div>
            <div class="expense-item__body">
              <div class="expense-item__cat">${e.category}</div>
              ${e.notes?`<div class="expense-item__note">${T(e.notes)}</div>`:""}
              <div class="expense-item__date">${C(e.date)}</div>
            </div>
            <div class="expense-item__right">
              <span class="expense-item__amount">${r(e.amount)}</span>
              <button
                class="expense-item__delete"
                data-id="${e.id}"
                aria-label="Delete ${e.category} expense of ${r(e.amount)}"
              >&#x2715;</button>
            </div>
          </article>
        `}).join("")}function T(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}x.addEventListener("click",()=>{t-=1,t<0&&(t=11,i-=1),o()}),_.addEventListener("click",()=>{t+=1,t>11&&(t=0,i+=1),o()}),y.addEventListener("click",S),n.addEventListener("keydown",e=>{e.key==="Enter"&&s.focus()}),d.addEventListener("click",e=>{const t=e.target.closest("[data-id]");t&&t.classList.contains("expense-item__delete")&&M(Number(t.dataset.id))}),n.addEventListener("input",()=>n.classList.remove("is-error")),s.addEventListener("change",()=>s.classList.remove("is-error")),o()})()