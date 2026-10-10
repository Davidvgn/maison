/* ================================================================
   Page "Ma journée" d'un enfant (Jérémy / Liam / Nina)
   - Lit window.CHILDREN[window.CHILD_KEY] (children.js)
   - Calendrier et liste des tâches : chores-core.js
   - Réinitialisation auto chaque jour.
   - Coches partagées entre appareils (sync.js) si l'appareil est connecté.
   ================================================================ */
(function(){
  "use strict";

  var C = window.Chores;
  var cfg = (window.CHILDREN||{})[window.CHILD_KEY] || {};
  var CHILD = cfg.key || "enfant";
  var NAME  = cfg.name || "";

  var today=C.now(), tomorrow=C.addDays(today,1);
  var DAILY_K=C.dateKey(today);
  var tasks=[];
  var container=document.getElementById("blocks");
  var banner=document.getElementById("vacBanner");

  function isDone(task){ return C.isDone(CHILD,task,today); }

  // ---- Feu écran + bandeau horaire (même logique que la tablette) ----
  var lightEl=document.createElement("div"); lightEl.id="screenLight"; lightEl.className="screen-light";
  var tbEl=document.createElement("div"); tbEl.id="timeBanner"; tbEl.className="time-banner";
  var syncEl=document.createElement("div"); syncEl.id="syncBanner"; syncEl.className="sync-banner";
  banner.parentNode.insertBefore(syncEl, banner);
  banner.parentNode.insertBefore(tbEl, banner);
  banner.parentNode.insertBefore(lightEl, banner);

  // ---- État de la synchro (rien d'affiché quand tout va bien) ----
  function updateSync(){
    var b=C.syncBadge(CHILD);
    syncEl.className="sync-banner"+(b?" show "+b.k:"");
    syncEl.innerHTML="";
    if(!b) return;
    var t=document.createElement("span"); t.textContent=b.t; syncEl.appendChild(t);
    if(b.link){
      var a=document.createElement("a"); a.href=b.link; a.textContent=b.lt;
      a.onclick=function(e){ if(e&&e.preventDefault) e.preventDefault(); location.href=b.link; };   // reste dans l'appli d'écran d'accueil (vieux iOS)
      syncEl.appendChild(a);
    }
  }

  // Reçu d'un autre appareil : on ne redessine que si une coche a vraiment changé
  // (redessiner sous le doigt fait perdre le toucher sur iPhone/iPad)
  var lastSig="";
  function signature(){ return C.visibleTasks(CHILD, cfg, today, tomorrow).map(function(t){ return t.id+(isDone(t)?"1":"0"); }).join(","); }
  function onRemote(){ if(signature()!==lastSig) applyDay(); else updateSync(); }

  // ---- Nouveau jour (page restée ouverte la nuit) : on recharge avant toute coche ----
  var testDate=!!C.qs("date");
  function dayChanged(){ return !testDate && C.dateKey(C.now())!==DAILY_K; }
  function reloadIfNewDay(){
    if(!dayChanged()) return false;
    if(navigator.onLine===false){ rollDay(); return true; }   // sans réseau, un rechargement afficherait une page d'erreur
    location.reload(); return true;
  }
  function rollDay(){
    today=C.now(); tomorrow=C.addDays(today,1); DAILY_K=C.dateKey(today);
    C.watch([CHILD], today, null);
    applyDay(); loadWeather();
  }
  function updateLight(){
    var n=C.now(), h=n.getHours()+n.getMinutes()/60;
    var gateLeft=tasks.filter(function(t){return t.gate && !isDone(t);}).length;
    var st=C.screenStatus(h,gateLeft);
    lightEl.className="screen-light "+st.k;
    lightEl.innerHTML="<div class='t'>"+st.t+"</div><div class='s'>"+st.s+(st.k==="green"?" · à valider sur la tablette":"")+"</div>";
    var tb=C.timeBanner(h, C.isRestDay(n));
    tbEl.className="time-banner"+(tb?" show "+tb.k:"");
    tbEl.textContent=tb?tb.t:"";
  }

  function updateProgress(){
    var req=tasks.filter(function(t){return !t.optional && (!t.house || t.gate);});   // facultatives : non ; maison : seulement si elle bloque l'écran
    var total=req.length, done=req.filter(isDone).length;
    var pct=total?Math.round(done/total*100):0;
    document.getElementById("progressText").textContent=done+" / "+total+" fait";
    document.getElementById("progressPct").textContent=pct+"%";
    document.getElementById("progressBar").style.width=pct+"%";
    document.getElementById("celebrate").classList.toggle("show", total>0 && done===total);
    updateLight();
  }

  function renderRules(){
    var box=document.getElementById("rules");
    if(!box) return;
    var html='<h2>📋 Les règles de la maison</h2><ul>';
    C.RULES.forEach(function(r){
      if(r.hard){ html+='<li class="hard"><span class="b">'+r.b+'</span><span>'+r.t+'<span class="tag">Non négociable</span></span></li>'; }
      else { html+='<li><span class="b">'+r.b+'</span><span>'+r.t+'</span></li>'; }
    });
    html+='</ul>';
    box.innerHTML=html;
  }

  function applyDay(){
    var dow=today.getDay(), tdow=tomorrow.getDay();
    var st=C.dayState(today,cfg), stm=C.dayState(tomorrow,cfg);

    var hello=document.getElementById("hello"); if(hello) hello.textContent=cfg.hello || ("Salut "+NAME+" 👋");
    var cmsg=document.getElementById("celebrateMsg"); if(cmsg) cmsg.textContent=cfg.celebrate || ("Bravo "+NAME+", tout est fait !");
    var hdr=document.querySelector("header"); if(hdr && cfg.gradient) hdr.style.background=cfg.gradient;

    document.getElementById("dayName").textContent=C.DAY_NAMES[dow];
    document.getElementById("dateLine").textContent=today.getDate()+" "+C.MONTHS[today.getMonth()];

    document.getElementById("schoolToday").textContent=st.val;
    document.getElementById("chipToday").className="chip s-"+st.key;

    var tName=C.DAY_NAMES[tdow].charAt(0).toUpperCase()+C.DAY_NAMES[tdow].slice(1);
    document.getElementById("schoolTomorrow").textContent=tName+" · "+stm.val;
    document.getElementById("chipTomorrow").className="chip s-"+stm.key;

    banner.className="vac-banner";
    if(st.key==="vac"){ banner.textContent="🏖️ "+C.vacName(today)+" — pas d'école ! (les tâches maison continuent)"; banner.classList.add("show"); }
    else if(st.key==="ferie"){ banner.textContent="🎉 Jour férié : "+(st.name||"")+" — pas d'école !"; banner.classList.add("show"); }

    tasks=C.visibleTasks(CHILD, cfg, today, tomorrow);

    container.innerHTML="";
    C.BLOCKS.forEach(function(b){
      var items=tasks.filter(function(t){return t.block===b.key;});
      if(items.length===0) return;
      var block=document.createElement("section"); block.className="block";
      var head=document.createElement("div"); head.className="block-head";
      head.innerHTML='<span class="block-emoji">'+b.emoji+'</span><h2 class="block-title">'+b.title+'</h2>'+(b.sub?'<span class="block-sub">'+b.sub+'</span>':'');
      block.appendChild(head);
      items.forEach(function(task){
        var done=isDone(task);
        var el=document.createElement("div");
        el.className="task"+(done?" done":"")+(task.href?" has-link":"")+(task.optional?" optional":"");
        el.innerHTML='<div class="emoji">'+task.emoji+'</div>'+
          '<div class="label">'+task.label+(task.optional?'<span class="opt">Facultatif</span>':'')+(task.note?'<span class="note">'+task.note+'</span>':'')+(task.href?'<span class="go">'+(task.linkLabel||'▶ Voir')+'</span>':'')+'</div>'+
          '<div class="check">✓</div>';
        function toggle(){
          if(reloadIfNewDay()) return;
          if(task.house){   // tâche de la maison : cochée tout de suite, puis retirée de la liste un instant après (pas de saut sous le doigt)
            el.classList.add("done");
            C.setDone(CHILD,task,today,true);
            lastSig=signature();
            setTimeout(applyDay, 700);
            return;
          }
          var now=!el.classList.contains("done");
          el.classList.toggle("done",now);
          C.setDone(CHILD,task,today,now);
          lastSig=signature();
          updateProgress();
        }
        if(task.href){
          el.addEventListener("click",function(){ location.href=C.linkTo(task.href); });
          el.querySelector(".check").addEventListener("click",function(e){ e.stopPropagation(); toggle(); });
        } else {
          el.addEventListener("click",toggle);
        }
        block.appendChild(el);
      });
      container.appendChild(block);
    });

    lastSig=signature();
    updateProgress();
    updateSync();
  }

  // ---- Météo : carte sous l'en-tête (données et rendu dans chores-core.js) ----
  function loadWeather(){
    var card=document.getElementById("weather"); if(!card) return;
    C.loadWeather(DAILY_K,function(days){
      if(days){ card.innerHTML=C.renderWeather(days); card.style.display="block"; }
      else { card.style.display="none"; }
    });
  }

  // Carte météo insérée juste sous l'en-tête
  var wxCard=document.createElement("div"); wxCard.id="weather"; wxCard.className="weather"; wxCard.style.display="none";
  var hdrEl=document.querySelector("header"); if(hdrEl){ hdrEl.insertAdjacentElement("afterend", wxCard); }

  renderRules();
  C.watch([CHILD], today, onRemote);   // coches faites sur un autre appareil (tablette, téléphone)
  applyDay();
  setInterval(function(){ if(!reloadIfNewDay()){ updateLight(); updateSync(); } }, 30000);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) reloadIfNewDay(); });
  C.refreshVac(applyDay);
  loadWeather();
})();
