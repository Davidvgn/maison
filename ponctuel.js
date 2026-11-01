/* ================================================================
   Page des parents : donner une tâche ponctuelle (ponctuel.html).
   On choisit une tâche (dans la liste des tâches de la maison, ou une nouvelle),
   un ou plusieurs jours (calendrier), un ou plusieurs enfants.
   Données : /extra/<jour>/<enfant>_<id> = "1|libellé" (voir sync.js, chores-core.js).
   La tâche apparaît le jour dit dans « En plus aujourd'hui » chez l'enfant et sur la tablette.
   JavaScript ancien (ES5).
   ================================================================ */
(function(){
  "use strict";

  var S = window.Sync, H = window.Shop, C = window.Chores, K = window.CHILDREN || {};
  var KIDS = ["jeremy", "liam", "nina"];

  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  function qs(name){
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    if(!m) return null;
    try{ return decodeURIComponent(m[1]); }catch(e){ return null; }
  }
  function go(href){ location.href = href; }
  function link(text, href){
    var a = el("a", null, text); a.href = href;
    a.onclick = function(e){ if(e && e.preventDefault) e.preventDefault(); go(href); };
    return a;
  }
  function btn(text, cls, fn){
    var b = el("button", "btn" + (cls ? " " + cls : ""), text); b.type = "button"; b.onclick = fn;
    return b;
  }
  function has(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function cap(s){ s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function kidName(k){ return (K[k] && K[k].name) || cap(k); }

  var backRaw = qs("back") || "";
  var back = /^[A-Za-z0-9_.\-]+\.html(\?[A-Za-z0-9_=&:%.\-]*)?$/.test(backRaw) ? backRaw : "index.html";
  $("back").onclick = function(){ go(back); };

  // ---- Qui a le droit d'être ici ? ----
  var gate = $("gate"), app = $("app");
  function stop(parts){
    var m = el("div", "msg");
    for(var i = 0; i < parts.length; i++) m.appendChild(typeof parts[i] === "string" ? document.createTextNode(parts[i]) : parts[i]);
    gate.innerHTML = ""; gate.appendChild(m); app.style.display = "none";
  }
  if(!S || !H || !C){
    stop([window.LOAD_FAILED ? "La page n'a pas pu se charger entièrement : recharge-la." : "La synchronisation n'a pas pu démarrer."]);
    return;
  }
  if(!S.enabled){
    stop([window.LOAD_FAILED ? "La page n'a pas pu se charger entièrement : recharge-la." : "La synchronisation n'est pas configurée sur ce site."]);
    return;
  }
  if(!S.account()){ stop(["Cet appareil n'est pas connecté. ", link("Connecter cet appareil", "connexion.html")]); return; }
  if(!H.isParent()){ stop(["Cette page est réservée aux parents."]); return; }
  gate.innerHTML = "";
  app.style.display = "block";

  // ---- État de l'écran ----
  var today = new Date(), todayStr = C.ymd(today), startedAt = Date.now();
  var ui = {dates: {}, kids: {}, month: new Date(today.getFullYear(), today.getMonth(), 1), showLib: false, confirm: null, dayTouched: false};
  ui.dates[todayStr] = 1;
  var flashText = "", flashTimer = null, confirmTimer = null, armedAt = 0, addAt = 0, pruned = false;

  function flash(text){
    flashText = text;
    if(flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function(){ flashText = ""; flashTimer = null; renderStatus(); }, 6000);
    renderStatus();
  }
  function renderStatus(){
    var s = flashText || H.status(), box = $("status");
    box.className = s ? "msg show" : "msg";
    box.textContent = s || "";
  }

  // ---- Dates ----
  function parseDay(str){ var p = str.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDaysTo(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayText(str){
    var d = parseDay(str), name = C.DAY_NAMES[d.getDay()] + " " + d.getDate() + " " + C.MONTHS[d.getMonth()];
    if(str === todayStr) return "Aujourd'hui · " + name;
    if(str === C.ymd(addDaysTo(today, 1))) return "Demain · " + name;
    return cap(name);
  }
  function shortDay(str){ var d = parseDay(str); return C.DAY_NAMES[d.getDay()].slice(0, 3) + " " + d.getDate() + "/" + (d.getMonth() + 1); }
  function nextDow(dow){
    for(var i = 0; i < 7; i++){ var d = addDaysTo(today, i); if(d.getDay() === dow) return C.ymd(d); }
    return todayStr;
  }
  function pickedDays(){ var out = [], k; for(k in ui.dates){ if(has(ui.dates, k)) out.push(k); } out.sort(); return out; }
  function pickedKids(){ return KIDS.filter(function(k){ return ui.kids[k]; }); }

  // ---- Tâches : la liste de la maison + celles déjà données ----
  var libCache = null;
  function library(){
    if(libCache) return libCache;
    var seen = {}, all = [], i, d, tm, groups = [];
    for(i = 0; i < 14; i++){
      d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12, 0, 0);
      tm = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12, 0, 0);
      KIDS.forEach(function(k){
        if(!K[k]) return;
        C.buildTasks(K[k], d, tm).forEach(function(t){
          if(t.block === "maison" || t.block === "ponctuel") return;
          if(/manager|retour de|Vérifier la fenêtre de/i.test(t.label)) return;   // tâches propres au duo Jérémy / Liam
          if(seen[t.label]) return;
          seen[t.label] = 1;
          all.push({label: t.label, block: t.block});
        });
      });
    }
    C.BLOCKS.forEach(function(b){
      var items = all.filter(function(x){ return x.block === b.key; });
      if(items.length) groups.push({title: b.emoji + " " + b.title, items: items});
    });
    libCache = groups;
    return groups;
  }
  // Tâches ponctuelles dans la base : jour -> id -> {id, label, must, kids}
  function entries(){
    var days = S.groups("extra"), res = {}, i, g, k, m, v, p, e, day;
    for(i = 0; i < days.length; i++){
      day = days[i];
      if(!/^\d\d\d\d-\d\d-\d\d$/.test(day)) continue;
      g = S.getGroup("extra", day);
      for(k in g){
        if(!has(g, k)) continue;
        m = /^(jeremy|liam|nina)_([a-z0-9]+)$/.exec(k);
        if(!m) continue;
        v = String(g[k]); p = v.indexOf("|");
        if(!res[day]) res[day] = {};
        e = res[day][m[2]];
        if(!e) e = res[day][m[2]] = {id: m[2], label: p === 1 ? v.slice(2) : v, must: !(p === 1 && v.charAt(0) === "0"), kids: []};
        e.kids.push(m[1]);
      }
    }
    return res;
  }
  function pastLabels(){   // les plus récentes d'abord (jour le plus récent, puis dernier créé)
    var res = entries(), seen = {}, out = [], days = [], d, i, ids, id, j;
    for(d in res){ if(has(res, d)) days.push(d); }
    days.sort().reverse();
    for(i = 0; i < days.length; i++){
      ids = [];
      for(id in res[days[i]]){ if(has(res[days[i]], id)) ids.push(id); }
      ids.sort().reverse();
      for(j = 0; j < ids.length; j++){
        var l = res[days[i]][ids[j]].label;
        if(!seen[l]){ seen[l] = 1; out.push(l); }
      }
    }
    return out;
  }
  var MAXLEN = 80;
  function cleanLabel(t){
    var s = String(t).replace(/[|<>\r\n\t]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    return cap(s);   // la longueur est contrôlée par add(), jamais coupée en silence
  }
  function pick(label){
    $("label").value = label;
    ui.showLib = false;
    renderSugg(); renderLib();
  }

  // ---- 1 · La tâche ----
  function renderSugg(){
    var box = $("sugg"), v = H.norm($("label").value).replace(/^\s+|\s+$/g, ""), list = [], seen = {};
    box.innerHTML = "";
    function add(label){ if(!seen[label]){ seen[label] = 1; list.push(label); } }
    if(v){
      pastLabels().forEach(function(l){ if(H.norm(l).indexOf(v) !== -1) add(l); });
      library().forEach(function(g){ g.items.forEach(function(x){ if(H.norm(x.label).indexOf(v) !== -1) add(x.label); }); });
    } else {
      pastLabels().slice(0, 6).forEach(add);
    }
    if(!list.length) return;
    box.appendChild(el("div", "sec", v ? "Ça ressemble à" : "Déjà données récemment"));
    var wrap = el("div", "chips");
    list.slice(0, 8).forEach(function(l){ wrap.appendChild(btn(l, "chip", function(){ pick(l); })); });
    box.appendChild(wrap);
  }
  function renderLib(){
    var box = $("lib");
    box.innerHTML = "";
    $("libBtn").textContent = ui.showLib ? "Fermer la liste" : "📋 Choisir dans la liste des tâches";
    if(!ui.showLib) return;
    var scroll = el("div", "libbox");
    library().forEach(function(g){
      scroll.appendChild(el("div", "sec", g.title));
      g.items.forEach(function(x){
        var r = el("div", "libitem", x.label);
        r.onclick = function(){ pick(x.label); };
        scroll.appendChild(r);
      });
    });
    box.appendChild(scroll);
  }

  // ---- 2 · Le jour (calendrier) ----
  function toggleDay(str){
    if(str < todayStr) return;
    if(!ui.dayTouched){ ui.dayTouched = true; ui.dates = {}; }   // « Aujourd'hui » n'était qu'un choix par défaut : le premier jour choisi le remplace
    if(ui.dates[str]) delete ui.dates[str]; else ui.dates[str] = 1;
    renderQuick(); renderCal(); renderPicked();
  }
  function renderQuick(){
    var box = $("quick"); box.innerHTML = "";
    var seenQ = {};
    [["Aujourd'hui", todayStr], ["Demain", C.ymd(addDaysTo(today, 1))], ["Samedi", nextDow(6)], ["Dimanche", nextDow(0)]].forEach(function(q){
      if(seenQ[q[1]]) return;   // le samedi, « Samedi » serait « Aujourd'hui » : une seule puce par jour
      seenQ[q[1]] = 1;
      var on = !!ui.dates[q[1]];
      box.appendChild(btn(q[0], "chip" + (on ? " on" : ""), function(){
        var d = parseDay(q[1]); ui.month = new Date(d.getFullYear(), d.getMonth(), 1);
        toggleDay(q[1]);
      }));
    });
  }
  function renderCal(){
    var box = $("cal"); box.innerHTML = "";
    var y = ui.month.getFullYear(), mo = ui.month.getMonth();
    var head = el("div", "cal-head");
    var prev = btn("◀", "sm ghost", function(){ ui.month = new Date(y, mo - 1, 1); renderCal(); });
    var curMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if(ui.month.getTime() <= curMonth.getTime()) prev.disabled = true;
    var nextBtn = btn("▶", "sm ghost", function(){ ui.month = new Date(y, mo + 1, 1); renderCal(); });
    if(ui.month.getTime() >= new Date(today.getFullYear(), today.getMonth() + 6, 1).getTime()) nextBtn.disabled = true;
    head.appendChild(prev);
    head.appendChild(el("div", "cal-title", cap(C.MONTHS[mo]) + " " + y));
    head.appendChild(nextBtn);
    box.appendChild(head);
    var grid = el("div", "cal-grid"), i;
    ["L", "M", "M", "J", "V", "S", "D"].forEach(function(n){ grid.appendChild(el("div", "cal-dow", n)); });
    var first = new Date(y, mo, 1), offset = (first.getDay() + 6) % 7, count = new Date(y, mo + 1, 0).getDate();
    for(i = 0; i < offset; i++) grid.appendChild(el("div", "cal-empty", ""));
    for(i = 1; i <= count; i++){
      (function(day){
        var str = C.ymd(new Date(y, mo, day)), past = str < todayStr;
        var cell = el("button", "cal-day" + (ui.dates[str] ? " sel" : "") + (str === todayStr ? " today" : ""), String(day));
        cell.type = "button"; cell.disabled = past;
        cell.onclick = function(){ toggleDay(str); };
        grid.appendChild(cell);
      })(i);
    }
    box.appendChild(grid);
  }
  function renderPicked(){
    var d = pickedDays();
    $("picked").textContent = d.length ? "Jours choisis : " + d.map(shortDay).join(", ") : "Aucun jour choisi : appuie sur un jour du calendrier.";
  }

  // ---- 3 · Les enfants ----
  function renderWho(){
    var box = $("who"); box.innerHTML = "";
    KIDS.forEach(function(k){
      var b = btn(kidName(k), "chip kid" + (ui.kids[k] ? " on" : ""), function(){ if(ui.kids[k]) delete ui.kids[k]; else ui.kids[k] = 1; renderWho(); });
      if(ui.kids[k] && K[k] && K[k].color){ b.style.background = K[k].color; b.style.borderColor = K[k].color; }
      box.appendChild(b);
    });
    var all = pickedKids().length === KIDS.length;
    box.appendChild(btn("Les 3", "chip" + (all ? " on" : ""), function(){
      if(all) ui.kids = {}; else KIDS.forEach(function(k){ ui.kids[k] = 1; });
      renderWho();
    }));
  }

  // ---- Ajout ----
  function newId(){ return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  // Paires (jour, enfant) écrites par cette page puis retirées : elles ne comptent pas dans la vérification
  var removed = {};
  function checkSaved(pairs, id){
    setTimeout(function(){
      var live = pairs.filter(function(p){ return !removed[p[0] + "/" + p[1] + "_" + id]; }), ok = false, i;
      if(!live.length) return;   // tout a été retiré entre-temps : rien à vérifier
      for(i = 0; i < live.length && !ok; i++){ if(has(S.getGroup("extra", live[i][0]), live[i][1] + "_" + id)) ok = true; }
      if(!ok) flash("La base n'a pas gardé la tâche (règle /extra pas publiée ?). Réessaie, ou préviens-moi.");
    }, 5000);
  }
  // Libellés (sans majuscules ni accents) que cet enfant a déjà ce jour-là : sa journée habituelle + les tâches ponctuelles déjà données
  function haveOn(day, kid){
    var set = {}, d = parseDay(day), noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12, 0, 0), res = entries(), id, e;
    if(K[kid]){ C.buildTasks(K[kid], noon, next).forEach(function(t){ set[H.norm(t.label)] = 1; }); }
    if(res[day]){ for(id in res[day]){ if(has(res[day], id)){ e = res[day][id]; if(e.kids.indexOf(kid) !== -1) set[H.norm(e.label)] = 1; } } }
    return set;
  }
  function dayChanged(){ return C.ymd(new Date()) !== todayStr; }
  function add(){
    var n = Date.now();
    if(n - addAt < 1500) return;   // double appui
    if(dayChanged()){ flash("Un nouveau jour a commencé : la page se recharge."); setTimeout(function(){ location.reload(); }, 900); return; }
    var label = cleanLabel($("label").value), days = pickedDays(), kids = pickedKids();
    if(!S.known("extra")){
      flash(Date.now() - startedAt > 8000 ? "Impossible d'enregistrer : pas de réseau, ou règle /extra pas publiée (FIREBASE.md, étape 6)." : "La liste n'est pas encore chargée : réessaie dans un instant.");
      return;
    }
    if(!label){ flash("Écris la tâche, ou choisis-la dans la liste."); return; }
    if(label.length > MAXLEN){ flash("Tâche trop longue (" + MAXLEN + " signes au plus, là " + label.length + ") : raccourcis-la."); return; }
    if(!days.length){ flash("Choisis au moins un jour dans le calendrier."); return; }
    if(!kids.length){ flash("Choisis au moins un enfant."); return; }
    // on n'ajoute pas une tâche que l'enfant a déjà ce jour-là (elle le bloquerait deux fois)
    var pairs = [], skipped = [], norm = H.norm(label);
    days.forEach(function(d){
      kids.forEach(function(k){
        if(haveOn(d, k)[norm]) skipped.push(kidName(k) + " " + shortDay(d)); else pairs.push([d, k]);
      });
    });
    if(!pairs.length){ flash("Déjà prévue pour : " + skipped.join(", ") + ". Rien n'a été ajouté."); return; }
    addAt = n;
    var id = newId(), value = ($("must").checked ? "1" : "0") + "|" + label;
    pairs.forEach(function(p){ S.setExtra(p[0], p[1] + "_" + id, value); });
    checkSaved(pairs, id);
    var who = [], when = [];
    pairs.forEach(function(p){ if(who.indexOf(kidName(p[1])) === -1) who.push(kidName(p[1])); if(when.indexOf(shortDay(p[0])) === -1) when.push(shortDay(p[0])); });
    flash("✓ « " + label + " » ajoutée pour " + who.join(", ") + " · " + when.join(", ") + (skipped.length ? " (déjà prévue, non ajoutée : " + skipped.join(", ") + ")" : ""));
    $("label").value = "";
    renderSugg(); renderUpcoming();
  }

  // ---- À venir ----
  function twoTap(key, fn){
    var n = Date.now();
    if(ui.confirm === key){
      if(n - armedAt < 700) return;
      ui.confirm = null; if(confirmTimer){ clearTimeout(confirmTimer); confirmTimer = null; }
      fn(); renderUpcoming();
      return;
    }
    ui.confirm = key; armedAt = n;
    if(confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(function(){ ui.confirm = null; confirmTimer = null; renderUpcoming(); }, 5000);
    renderUpcoming();
  }
  function renderUpcoming(){
    var box = $("upcoming"), res = entries(), days = [], d, i;
    box.innerHTML = "";
    box.appendChild(el("h2", null, "📅 Déjà données (à venir)"));
    if(!S.known("extra")){
      box.appendChild(el("div", "empty", Date.now() - startedAt > 8000
        ? "Impossible de charger les tâches pour l'instant (pas de réseau, ou règle à publier). Réessaie dans un moment."
        : "Chargement…"));
      return;
    }
    for(d in res){ if(has(res, d) && d >= todayStr) days.push(d); }
    days.sort();
    if(!days.length){ box.appendChild(el("div", "empty", "Aucune tâche ponctuelle à venir.")); return; }
    days.forEach(function(day){
      box.appendChild(el("div", "sec", dayText(day)));
      var ids = [], id;
      for(id in res[day]){ if(has(res[day], id)) ids.push(id); }
      ids.sort();
      ids.forEach(function(idv){
        var e = res[day][idv], row = el("div", "row"), nm = el("div", "nm", e.label);
        e.kids.sort(function(a, b){ return KIDS.indexOf(a) - KIDS.indexOf(b); });
        nm.appendChild(el("small", null, e.kids.map(kidName).join(", ") + (e.must ? "" : " · facultative")));
        row.appendChild(nm);
        var key = day + "|" + idv, armed = ui.confirm === key;
        var x = el("button", "x" + (armed ? " armed" : ""), armed ? "Retirer ?" : "✕"); x.type = "button";
        x.onclick = function(){ twoTap(key, function(){ e.kids.forEach(function(k){ removed[day + "/" + k + "_" + idv] = 1; S.setExtra(day, k + "_" + idv, null); }); }); };
        row.appendChild(x);
        box.appendChild(row);
      });
    });
  }
  // Les jours passés depuis plus de 15 jours sont effacés (la page les ignore déjà)
  function prune(){
    if(pruned || !S.known("extra")) return;
    pruned = true;
    var limit = C.ymd(addDaysTo(today, -15)), days = S.groups("extra");
    days.forEach(function(d){ if(/^\d\d\d\d-\d\d-\d\d$/.test(d) && d < limit) S.clearExtra(d); });
  }

  function render(){
    renderStatus();
    renderSugg(); renderLib(); renderQuick(); renderCal(); renderPicked(); renderWho();
    renderUpcoming();
  }
  function onChange(){
    renderStatus();
    prune();
    renderUpcoming();   // ces deux-là ne touchent pas au champ en cours de saisie
    renderSugg();
  }

  $("label").oninput = renderSugg;
  $("libBtn").onclick = function(){ ui.showLib = !ui.showLib; renderLib(); };
  $("add").onclick = add;

  S.watch([], [], onChange, ["extra"]);
  render();
  // page restée ouverte la nuit : « aujourd'hui » doit changer (on ne recharge pas sous les doigts de quelqu'un qui écrit)
  function reloadIfNewDay(){ if(dayChanged() && !$("label").value){ location.reload(); } }
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) reloadIfNewDay(); });
  setInterval(function(){ reloadIfNewDay(); renderStatus(); if(!S.known("extra")) renderUpcoming(); }, 3000);
})();
