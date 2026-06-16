/* ================================================================
   Moteur commun des pages "Ma journée" (Jérémy / Liam / Nina)
   - Lit window.CHILD_CONFIG (défini dans chaque page enfant)
   - Calendrier réel : fériés calculés + vacances zone A (Grenoble)
     récupérées automatiquement via l'open data officiel, repli local.
   - Réinitialisation auto chaque jour ; avancement mémorisé par appareil.
   ================================================================ */
(function(){
  "use strict";

  var cfg = window.CHILD_CONFIG || {};
  var CHILD = cfg.key || "enfant";
  var NAME  = cfg.name || "";
  var VERSION = "v1";
  var SCHOOL_WEEKDAYS = cfg.schoolWeekdays || [1,2,4,5]; // 0=dim..6=sam
  var HAIR_DAYS = cfg.hairDays || [3,0];                 // mercredi + dimanche

  var DAY_NAMES = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  var MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  // ---- Règles de la maison (communes à tous) ----
  var RULES = [
    {b:"📵", t:"À 19 h, plus d'écran.", hard:true},
    {b:"🛏️", t:"Au lit à 20h30 (lecture 30 min). À 21h, lumière éteinte — même si on a pris du retard.", hard:true},
    {b:"🚰", t:"Je vérifie si le lave-vaisselle est sale avant de mettre quelque chose dans l'évier."},
    {b:"🍽️", t:"Je nettoie bien la table quand j'ai fini de manger."},
    {b:"🧺", t:"Je mets mes affaires sales dans la panière à linge sale."}
  ];

  // ---- Vacances zone A (Grenoble) : repli si l'open data est injoignable ----
  var VAC_FALLBACK = [
    ["2025-10-18","2025-11-02"],["2025-12-20","2026-01-04"],["2026-02-07","2026-02-22"],
    ["2026-04-04","2026-04-19"],["2026-07-04","2026-08-31"],["2026-10-17","2026-11-01"],
    ["2026-12-19","2027-01-03"],["2027-02-13","2027-02-28"],["2027-04-10","2027-04-25"],
    ["2027-07-03","2027-08-31"]
  ];
  var VAC = VAC_FALLBACK.slice();

  function vacName(d){
    var m=d.getMonth();
    if(m===6||m===7) return "Vacances d'été";
    if(m===9||m===10) return "Vacances de la Toussaint";
    if(m===11||m===0) return "Vacances de Noël";
    if(m===1||m===2) return "Vacances d'hiver";
    if(m===3) return "Vacances de printemps";
    return "Vacances";
  }

  // ---- Fériés français (calculés, toutes années) ----
  function easterSunday(Y){
    var a=Y%19,b=Math.floor(Y/100),c=Y%100,d=Math.floor(b/4),e=b%4,
        f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
    return new Date(Y,month-1,day);
  }
  function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }

  function holidayName(d){
    var Y=d.getFullYear(), key=String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    var FIXED={"01-01":"Jour de l'An","05-01":"Fête du Travail","05-08":"Victoire 1945",
      "07-14":"Fête nationale","08-15":"Assomption","11-01":"Toussaint","11-11":"Armistice","12-25":"Noël"};
    if(FIXED[key]) return FIXED[key];
    var e=easterSunday(Y), s=ymd(d);
    if(s===ymd(addDays(e,1))) return "Lundi de Pâques";
    if(s===ymd(addDays(e,39))) return "Ascension";
    if(s===ymd(addDays(e,50))) return "Lundi de Pentecôte";
    return null;
  }

  function inVacances(d){
    var s=ymd(d);
    for(var i=0;i<VAC.length;i++){ if(s>=VAC[i][0] && s<=VAC[i][1]) return true; }
    return false;
  }

  function dayState(d){
    if(inVacances(d)) return {key:"vac", val:"Vacances 🏖️", school:false};
    var hn=holidayName(d);
    if(hn) return {key:"ferie", val:"Férié 🎉", school:false, name:hn};
    var dow=d.getDay();
    if(SCHOOL_WEEKDAYS.indexOf(dow)!==-1) return {key:"school", val:"École ✏️", school:true};
    if(dow===0||dow===6) return {key:"weekend", val:"Week-end 🏠", school:false};
    return {key:"off", val:"Pas d'école 🏠", school:false};
  }

  function getToday(){
    var p=new URLSearchParams(location.search);
    if(p.has("date")){ var d=new Date(p.get("date")+"T08:00:00"); if(!isNaN(d)) return d; }
    return new Date();
  }
  function isoWeekKey(d){
    var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    var day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
    var ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));
    var w=Math.ceil((((t-ys)/86400000)+1)/7);
    return t.getUTCFullYear()+"-W"+w;
  }
  function dateKey(d){ return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }

  // ---- Construction des tâches du jour ----
  function buildTasks(today, tomorrow){
    var dow=today.getDay();
    var st=dayState(today), stm=dayState(tomorrow);
    var school=st.school, schoolT=stm.school;
    var isWed=(dow===3), isWeekend=(dow===0||dow===6);
    var t=[];

    function visExtra(x){
      if(x.days && x.days.indexOf(dow)===-1) return false;
      if(x.schoolOnly && !school) return false;
      if(x.weekendOnly && !isWeekend) return false;
      return true;
    }
    function pushExtras(arr, block){
      (arr||[]).forEach(function(x){
        if(!visExtra(x)) return;
        t.push({block:block, emoji:x.emoji, label:x.label, note:x.note, scope:x.scope||"daily"});
      });
    }

    // MATIN (tous les jours)
    if(cfg.veilleuse!==false) t.push({block:"matin", emoji:"💡", label:"Éteindre ma veilleuse"});
    t.push({block:"matin", emoji:"🚻", label:"Aller aux toilettes"});
    t.push({block:"matin", emoji:"🛏️", label:"Faire mon lit"});
    pushExtras(cfg.morningExtra, "matin");
    t.push({block:"matin", emoji:"🤸", label:"Mes exercices du matin", note:"10 jumping jacks · 10 squats · 1 min de gainage"});
    t.push({block:"matin", emoji:"🧼", label:"Faire ma toilette", note: cfg.toiletteNote || "Me laver les mains et le visage + mettre du déo"});
    t.push({block:"matin", emoji:"👕", label:"M'habiller"});
    t.push({block:"matin", emoji:"🥣", label:"Préparer mon petit-déj"});
    t.push({block:"matin", emoji:"🍞", label:"Manger mon petit-déj"});
    t.push({block:"matin", emoji:"🍽️", label:"Débarrasser mon petit-déj"});
    t.push({block:"matin", emoji:"🧽", label:"Nettoyer ma place à table"});
    t.push({block:"matin", emoji:"🪥", label:"Me brosser les dents"});
    t.push({block:"matin", emoji:"💇", label:"Me coiffer"});
    if(school) t.push({block:"matin", emoji:"🎒", label:"Prendre mon sac d'école"});

    // EN RENTRANT (jours d'école)
    if(school){
      t.push({block:"rentrant", emoji:"📚", label:"Faire mes devoirs"});
    }

    // MÉNAGE CHAMBRE : mercredi + 1 fois le week-end
    if(isWed){
      t.push({block:"menage", emoji:"🧹", label:"Passer l'aspirateur dans ma chambre", scope:"daily"});
      t.push({block:"menage", emoji:"🌬️", label:"Faire la poussière", scope:"daily"});
      t.push({block:"menage", emoji:"🧽", label:"Passer la lingette", scope:"daily"});
    }
    if(isWeekend){
      t.push({block:"menage", emoji:"🧹", label:"Passer l'aspirateur dans ma chambre", note:"1 fois ce week-end (samedi ou dimanche)", scope:"weekend"});
      t.push({block:"menage", emoji:"🌬️", label:"Faire la poussière", note:"1 fois ce week-end", scope:"weekend"});
      t.push({block:"menage", emoji:"🧽", label:"Passer la lingette", note:"1 fois ce week-end", scope:"weekend"});
    }

    // SPORT
    if(isWeekend) t.push({block:"sport", emoji:"🏃", label:"Faire du sport", note:"Bouger pour de vrai (vélo, foot, balade active...)"});
    pushExtras(cfg.sportExtra, "sport");

    // LE SOIR (tous les jours) — cuisine/tâches d'abord, puis toilette, puis coucher
    t.push({block:"soir", emoji:"🍽️", label:"Vider le lave-vaisselle s'il est propre", note:"On le fait tous les 3 ensemble"});
    pushExtras(cfg.eveningExtra, "soir");
    t.push({block:"soir", emoji:"🚿", label:"Prendre ma douche"});
    if(HAIR_DAYS.indexOf(dow)!==-1) t.push({block:"soir", emoji:"🧴", label:"Me laver les cheveux"});
    t.push({block:"soir", emoji:"🧺", label:"Mettre mon linge à laver"});
    t.push({block:"soir", emoji:"✨", label:"Ranger ma chambre"});
    t.push({block:"soir", emoji:"⏱️", label:"Me brosser les dents en grand", note:"3 min brosse + 2 min électrique (timer)"});
    t.push({block:"soir", emoji:"🔌", label:"Brancher tél, ordi, souris et consoles en charge"});
    t.push({block:"soir", emoji:"👚", label:"Préparer mes vêtements pour demain"});
    if(schoolT) t.push({block:"soir", emoji:"⏰", label:"Mettre mon réveil à 6h45 (au plus tard)"}); // veille d'école seulement
    if(schoolT) t.push({block:"soir", emoji:"🎒", label:"Préparer mon sac pour demain"});
    t.push({block:"soir", emoji:"🚻", label:"Aller aux toilettes avant de me coucher"});

    t.forEach(function(task,i){
      task.scope=task.scope||"daily";
      task.id=task.block+"_"+i+"_"+task.label.replace(/[^a-zA-Z]/g,"").slice(0,10);
    });
    return t;
  }

  var BLOCKS=[
    {key:"matin",    emoji:"☀️", title:"Le matin",       sub:""},
    {key:"rentrant", emoji:"🏠", title:"En rentrant",    sub:"après l'école"},
    {key:"menage",   emoji:"🧹", title:"Ménage chambre", sub:""},
    {key:"sport",    emoji:"💪", title:"Sport",          sub:""},
    {key:"soir",     emoji:"🌙", title:"Le soir",        sub:""}
  ];

  // ---- État + stockage ----
  var today=getToday(), tomorrow=addDays(today,1);
  var DAILY_K=dateKey(today), WEEK_K=isoWeekKey(today);

  function storageKey(task){
    var scopeK=(task.scope==="weekend")?("WE-"+WEEK_K):DAILY_K;
    return "chores:"+CHILD+":"+VERSION+":"+scopeK+":"+task.id;
  }
  function isDone(task){ try{ return localStorage.getItem(storageKey(task))==="1"; }catch(e){ return false; } }
  function setDone(task,v){ try{ v?localStorage.setItem(storageKey(task),"1"):localStorage.removeItem(storageKey(task)); }catch(e){} }

  var container=document.getElementById("blocks");
  var banner=document.getElementById("vacBanner");
  var tasks=[];

  function updateProgress(){
    var total=tasks.length, done=tasks.filter(isDone).length;
    var pct=total?Math.round(done/total*100):0;
    document.getElementById("progressText").textContent=done+" / "+total+" fait";
    document.getElementById("progressPct").textContent=pct+"%";
    document.getElementById("progressBar").style.width=pct+"%";
    document.getElementById("celebrate").classList.toggle("show", total>0 && done===total);
  }

  function renderRules(){
    var box=document.getElementById("rules");
    if(!box) return;
    var html='<h2>📋 Les règles de la maison</h2><ul>';
    RULES.forEach(function(r){
      if(r.hard){ html+='<li class="hard"><span class="b">'+r.b+'</span><span>'+r.t+'<span class="tag">Non négociable</span></span></li>'; }
      else { html+='<li><span class="b">'+r.b+'</span><span>'+r.t+'</span></li>'; }
    });
    html+='</ul>';
    box.innerHTML=html;
  }

  function applyDay(){
    var dow=today.getDay(), tdow=tomorrow.getDay();
    var st=dayState(today), stm=dayState(tomorrow);

    var hello=document.getElementById("hello"); if(hello) hello.textContent=cfg.hello || ("Salut "+NAME+" 👋");
    var cmsg=document.getElementById("celebrateMsg"); if(cmsg) cmsg.textContent=cfg.celebrate || ("Bravo "+NAME+", tout est fait !");
    var hdr=document.querySelector("header"); if(hdr && cfg.gradient) hdr.style.background=cfg.gradient;

    document.getElementById("dayName").textContent=DAY_NAMES[dow];
    document.getElementById("dateLine").textContent=today.getDate()+" "+MONTHS[today.getMonth()];

    document.getElementById("schoolToday").textContent=st.val;
    document.getElementById("chipToday").className="chip s-"+st.key;

    var tName=DAY_NAMES[tdow].charAt(0).toUpperCase()+DAY_NAMES[tdow].slice(1);
    document.getElementById("schoolTomorrow").textContent=tName+" · "+stm.val;
    document.getElementById("chipTomorrow").className="chip s-"+stm.key;

    banner.className="vac-banner";
    if(st.key==="vac"){ banner.textContent="🏖️ "+vacName(today)+" — pas d'école ! (les tâches maison continuent)"; banner.classList.add("show"); }
    else if(st.key==="ferie"){ banner.textContent="🎉 Jour férié : "+(st.name||"")+" — pas d'école !"; banner.classList.add("show"); }

    tasks=buildTasks(today, tomorrow);

    container.innerHTML="";
    BLOCKS.forEach(function(b){
      var items=tasks.filter(function(t){return t.block===b.key;});
      if(items.length===0) return;
      var block=document.createElement("section"); block.className="block";
      var head=document.createElement("div"); head.className="block-head";
      head.innerHTML='<span class="block-emoji">'+b.emoji+'</span><h2 class="block-title">'+b.title+'</h2>'+(b.sub?'<span class="block-sub">'+b.sub+'</span>':'');
      block.appendChild(head);
      items.forEach(function(task){
        var done=isDone(task);
        var el=document.createElement("div");
        el.className="task"+(done?" done":"");
        el.innerHTML='<div class="emoji">'+task.emoji+'</div>'+
          '<div class="label">'+task.label+(task.note?'<span class="note">'+task.note+'</span>':'')+'</div>'+
          '<div class="check">✓</div>';
        el.addEventListener("click",function(){
          var now=!el.classList.contains("done");
          el.classList.toggle("done",now);
          setDone(task,now);
          updateProgress();
        });
        block.appendChild(el);
      });
      container.appendChild(block);
    });

    updateProgress();
  }

  // ---- Mise à jour auto des vacances via open data officiel (Grenoble) ----
  var VAC_CACHE_KEY="vacCacheGrenoble";
  function localYMD(dt){
    try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(dt); }
    catch(e){ return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0"); }
  }
  function rangesFromRecords(recs){
    var out=[];
    recs.forEach(function(r){
      if(!r.description) return;
      if(!(/vacances/i.test(r.description) || /pont/i.test(r.description))) return;
      if(r.population==="Enseignants") return;
      if(!r.start_date || !r.end_date) return;
      var s=new Date(r.start_date), e=new Date(r.end_date);
      if(isNaN(s)||isNaN(e)) return;
      if(e-s <= 0) return;
      out.push([localYMD(s), localYMD(addDays(e,-1))]);
    });
    return out;
  }
  function useVac(ranges){ if(ranges && ranges.length>=4){ VAC=VAC_FALLBACK.concat(ranges); applyDay(); } }
  function refreshVac(){
    var cached=null;
    try{ cached=JSON.parse(localStorage.getItem(VAC_CACHE_KEY)||"null"); }catch(e){}
    if(cached && cached.ranges){ useVac(cached.ranges); }
    if(cached && (Date.now()-cached.ts < 45*86400000)) return;
    try{
      var url="https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=80&order_by="+encodeURIComponent("start_date desc")+"&where="+encodeURIComponent('location="Grenoble"');
      var ctrl=new AbortController(); var to=setTimeout(function(){ctrl.abort();},6000);
      fetch(url,{signal:ctrl.signal}).then(function(r){return r.json();}).then(function(j){
        clearTimeout(to);
        var ranges=rangesFromRecords(j.results||[]);
        if(ranges.length>=4){
          try{ localStorage.setItem(VAC_CACHE_KEY, JSON.stringify({ts:Date.now(), ranges:ranges})); }catch(e){}
          useVac(ranges);
        }
      }).catch(function(){ clearTimeout(to); });
    }catch(e){}
  }

  // ---- Météo (Chindrieux 73310) via Open-Meteo, sans clé API ----
  var WX_LAT=45.81948, WX_LON=5.85024, WX_CACHE="wxChindrieux";
  function wxInfo(c){
    if(c===0) return {e:"☀️",l:"Ensoleillé"};
    if(c===1) return {e:"🌤️",l:"Plutôt ensoleillé"};
    if(c===2) return {e:"⛅",l:"Variable"};
    if(c===3) return {e:"☁️",l:"Couvert"};
    if(c===45||c===48) return {e:"🌫️",l:"Brouillard"};
    if(c>=51&&c<=57) return {e:"🌦️",l:"Bruine"};
    if(c>=61&&c<=67) return {e:"🌧️",l:"Pluie"};
    if(c>=71&&c<=77) return {e:"🌨️",l:"Neige"};
    if(c>=80&&c<=82) return {e:"🌦️",l:"Averses"};
    if(c>=85&&c<=86) return {e:"🌨️",l:"Averses de neige"};
    if(c>=95) return {e:"⛈️",l:"Orage"};
    return {e:"🌡️",l:""};
  }
  function wxRainy(c,p,sum){ return (p!=null && p>=30) || (sum!=null && sum>=1) || (c>=51 && c<=99); }
  function wxSnow(c){ return (c>=71&&c<=77)||(c>=85&&c<=86); }
  function wxHint(tmax,p,c,sum){
    if(wxSnow(c)) return "Neige ❄️ — habille-toi très chaud + bottes.";
    var h;
    if(tmax<5) h="Très froid 🥶 — gros manteau, bonnet, gants.";
    else if(tmax<12) h="Froid 🧥 — manteau + pull.";
    else if(tmax<18) h="Frais — pull ou veste.";
    else if(tmax<25) h="Doux 👕 — t-shirt + une petite veste.";
    else h="Chaud ☀️ — t-shirt, short, pense à boire.";
    if(wxRainy(c,p,sum)) h+=" ☔ Et prends un k-way, il peut pleuvoir.";
    return h;
  }
  function wxRender(daily){
    var card=document.getElementById("weather"); if(!card) return;
    function cell(i,when){
      var c=daily.weather_code[i], tmax=Math.round(daily.temperature_2m_max[i]), tmin=Math.round(daily.temperature_2m_min[i]);
      var p=daily.precipitation_probability_max?daily.precipitation_probability_max[i]:null;
      var sum=daily.precipitation_sum?daily.precipitation_sum[i]:null;
      var w=wxInfo(c);
      var rain=wxRainy(c,p,sum)?(' · ☔ '+(p!=null?p+'%':'pluie')):'';
      return '<div class="wx-cell"><span class="wx-when">'+when+'</span><span class="wx-emoji">'+w.e+'</span>'+
        '<span class="wx-temp">'+tmax+'° / '+tmin+'°</span>'+
        '<span class="wx-extra">'+w.l+rain+'</span></div>';
    }
    var hasTom=daily.time.length>1, ti=hasTom?1:0;
    card.innerHTML='<div class="wx-title">🌤️ La météo pour s\'habiller</div>'+
      '<div class="wx-row">'+cell(0,"Aujourd'hui")+(hasTom?cell(1,"Demain"):'')+'</div>'+
      '<div class="wx-hint">👕 <b>Demain</b> : '+wxHint(daily.temperature_2m_max[ti], daily.precipitation_probability_max?daily.precipitation_probability_max[ti]:null, daily.weather_code[ti], daily.precipitation_sum?daily.precipitation_sum[ti]:null)+'</div>';
    card.style.display="block";
  }
  function loadWeather(){
    var card=document.getElementById("weather"); if(!card) return;
    try{ var cc=JSON.parse(localStorage.getItem(WX_CACHE)||"null");
      if(cc && cc.day===DAILY_K && (Date.now()-cc.ts<3*3600000)){ wxRender(cc.daily); return; } }catch(e){}
    var url="https://api.open-meteo.com/v1/forecast?latitude="+WX_LAT+"&longitude="+WX_LON+"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=Europe%2FParis&forecast_days=2";
    var ctrl=new AbortController(); var to=setTimeout(function(){ctrl.abort();},7000);
    fetch(url,{signal:ctrl.signal}).then(function(r){return r.json();}).then(function(j){
      clearTimeout(to);
      if(j&&j.daily&&j.daily.time&&j.daily.time.length){
        try{ localStorage.setItem(WX_CACHE, JSON.stringify({ts:Date.now(), day:DAILY_K, daily:j.daily})); }catch(e){}
        wxRender(j.daily);
      } else { card.style.display="none"; }
    }).catch(function(){ clearTimeout(to); card.style.display="none"; });
  }

  // Carte météo insérée juste sous l'en-tête
  var wxCard=document.createElement("div"); wxCard.id="weather"; wxCard.className="weather"; wxCard.style.display="none";
  var hdrEl=document.querySelector("header"); if(hdrEl){ hdrEl.insertAdjacentElement("afterend", wxCard); }

  renderRules();
  applyDay();
  refreshVac();
  loadWeather();
})();
