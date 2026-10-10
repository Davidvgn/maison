/* ================================================================
   Page des enfants : ajouter un article à la liste de courses (liste.html).
   Un enfant peut ajouter un article du catalogue (quantité au choix) ou proposer
   « autre chose » ; ce qui est déjà demandé s'affiche avec sa quantité, sans
   bouton : la liste finale reste aux parents. JavaScript ancien (ES5).
   ================================================================ */
(function(){
  "use strict";

  var S = window.Sync, H = window.Shop;

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
  function btn(text, cls, fn){
    var b = el("button", "btn" + (cls ? " " + cls : ""), text); b.type = "button"; b.onclick = fn;
    return b;
  }

  var backRaw = qs("back") || "";
  var back = /^[A-Za-z0-9_.\-]+\.html(\?[A-Za-z0-9_=&:%.\-]*)?$/.test(backRaw) ? backRaw : "index.html";
  $("back").onclick = function(){ go(back); };

  // couleur de l'enfant (si la page est ouverte depuis sa page)
  var kid = qs("kid"), cfg = (window.CHILDREN || {})[kid];
  if(cfg && cfg.gradient) $("head").style.background = cfg.gradient;

  // ---- Qui a le droit d'être ici ? ----
  var gate = $("gate"), app = $("app");
  function stop(text, linkText, href){
    var m = el("div", "msg");
    m.appendChild(document.createTextNode(text));
    if(linkText){
      var a = el("a", null, linkText); a.href = href;
      a.onclick = function(e){ if(e && e.preventDefault) e.preventDefault(); go(href); };
      m.appendChild(document.createTextNode(" ")); m.appendChild(a);
    }
    gate.innerHTML = ""; gate.appendChild(m); app.style.display = "none";
  }
  if(!S || !H){ stop(window.LOAD_FAILED ? "La page n'a pas pu se charger entièrement : recharge-la." : "La synchronisation n'a pas pu démarrer."); return; }
  if(!S.enabled){ stop(window.LOAD_FAILED ? "La page n'a pas pu se charger entièrement : recharge-la." : "La synchronisation n'est pas configurée sur ce site."); return; }
  if(!S.account()){ stop("Cet appareil n'est pas connecté.", "Connecter cet appareil", "connexion.html"); return; }
  gate.innerHTML = "";
  app.style.display = "block";

  // les parents qui arrivent ici ont leur propre page
  if(H.isParent()){
    var pl = el("div", "parentlink"), pa = el("a", null, "→ Ouvrir la liste des parents (préparer, en magasin)");
    pa.href = "courses.html";
    pa.onclick = function(e){ if(e && e.preventDefault) e.preventDefault(); go("courses.html?back=liste.html"); };
    pl.appendChild(pa); $("parentlink").appendChild(pl);
  }

  // ---- État de l'écran ----
  var ui = {qty: {}, sentMsg: "", justSent: false, notice: ""};
  var lastSig = "", startedAt = Date.now();
  function who(by){ return H.WHO[by] || by; }

  function itemRow(it, need){
    var row = el("div", "row" + (need ? " req" : ""));
    var nm = el("div", "nm", it.name);
    row.appendChild(nm);
    if(need){
      // déjà demandé : on ne touche à rien. Si c'est déjà pris au magasin, on le dit (une nouvelle demande passe par « autre chose »)
      nm.appendChild(el("small", null, need.cart
        ? "déjà pris au magasin · s'il en faut encore, écris-le plus bas (« Il manque autre chose ? »)"
        : "déjà demandé par " + who(need.by)));
      row.appendChild(el("span", "tag done", need.cart ? "✓ pris ×" + need.q : "✓ ×" + need.q));
      return row;
    }
    var q = ui.qty[it.id] || 1;
    var box = el("div", "qty");
    var minus = el("button", "step", "−"); minus.type = "button";
    minus.onclick = function(){ if((ui.qty[it.id] || 1) > 1){ ui.qty[it.id] = (ui.qty[it.id] || 1) - 1; render(); } };
    var plus = el("button", "step", "+"); plus.type = "button";
    plus.onclick = function(){ if((ui.qty[it.id] || 1) < 20){ ui.qty[it.id] = (ui.qty[it.id] || 1) + 1; render(); } };
    box.appendChild(minus); box.appendChild(el("b", null, String(q))); box.appendChild(plus);
    row.appendChild(box);
    row.appendChild(btn("Ajouter", "sm ok", function(){ add(it); }));
    return row;
  }

  // Ajout d'un article ; on revérifie un peu plus tard qu'il a bien été gardé par la base
  function add(it){
    var ok = H.kidAdd(it.id, ui.qty[it.id] || 1);
    delete ui.qty[it.id];
    ui.notice = "";
    if(ok){
      var check = function(){
        if(!H.needs()[it.id]){ ui.notice = "« " + it.name + " » n'a pas été pris en compte. Réessaie."; render(); }
      };
      setTimeout(check, 5000);
      setTimeout(check, 12000);
    }
    render();
  }

  function renderStatus(){
    var s = H.status(), box = $("status");
    box.className = s ? "msg show" : "msg";
    box.textContent = s || "";
  }
  function renderSent(){
    var sent = $("sent"), me = H.role(), mine = H.known() ? H.inbox().filter(function(p){ return p.by === me; }) : [];
    sent.innerHTML = "";
    if(ui.sentMsg) sent.appendChild(el("div", "sh-sub", ui.sentMsg));
    mine.forEach(function(p){
      var r = el("div", "row"); r.appendChild(el("div", "nm", p.text)); r.appendChild(el("span", "tag", "en attente des parents"));
      sent.appendChild(r);
    });
  }

  function render(){
    renderStatus();
    var box = $("catalog");
    box.innerHTML = "";
    if(ui.notice) box.appendChild(el("div", "msg", ui.notice));
    if(!H.known()){
      lastSig = "";   // au retour des données, on redessine même si elles sont identiques à celles d'avant
      box.appendChild(el("div", "empty", Date.now() - startedAt > 8000
        ? "Impossible de charger la liste pour l'instant (pas de réseau ?). Réessaie dans un moment."
        : "Chargement de la liste…"));
      renderSent();
      return;
    }
    lastSig = H.sig();
    var tn = H.norm($("search").value).replace(/^\s+|\s+$/g, "");
    var its = H.items(), n = H.needs(), shown = 0;
    if(!its.length){
      box.appendChild(el("div", "box", "Le catalogue est vide pour l'instant. Propose ce qu'il faut ci-dessous : papa ou maman le rangera."));
    }
    H.SECTIONS.forEach(function(sec){
      var rows = its.filter(function(it){
        return H.section(it.section).key === sec.key && (!tn || H.norm(it.name).indexOf(tn) !== -1);
      });
      if(!rows.length) return;
      var b = el("div", "box");
      b.appendChild(el("h2", null, sec.emoji + " " + sec.name));
      rows.forEach(function(it){ b.appendChild(itemRow(it, n.hasOwnProperty(it.id) ? n[it.id] : null)); shown++; });
      box.appendChild(b);
    });
    if(its.length && !shown) box.appendChild(el("div", "empty", "Aucun article de ce nom. Propose-le avec « Il manque autre chose ? »."));
    renderSent();
  }
  // render() ne reconstruit aucun champ de saisie : on peut redessiner même pendant qu'on écrit
  function onChange(){
    renderStatus();
    if(H.known() && H.sig() === lastSig){ renderSent(); return; }
    render();
  }

  $("search").oninput = render;
  $("other").oninput = function(){
    if(ui.sentMsg){ ui.sentMsg = ""; ui.justSent = false; renderSent(); }
  };
  $("send").onclick = function(){
    var input = $("other");
    if(!H.known()){ ui.sentMsg = "La liste n'est pas encore chargée, réessaie dans un instant."; renderSent(); return; }
    if(H.suggest(input.value)){ ui.sentMsg = "Merci ! C'est envoyé aux parents."; ui.justSent = true; input.value = ""; }
    else if(!ui.justSent) ui.sentMsg = "Écris d'abord ce qu'il faut acheter.";   // un second appui sur un champ vidé ne remplace pas le « Merci »
    render();
  };
  S.watch([], [], onChange, ["shop"]);
  render();
  setInterval(function(){ renderStatus(); if(!H.known()) render(); }, 3000);
})();
