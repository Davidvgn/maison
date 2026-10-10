/* ================================================================
   Page des parents : la liste de courses (courses.html).
   Réservée au compte « famille » : liste à acheter par rayon, panier,
   propositions des enfants à classer, ajout et gestion des articles.
   JavaScript ancien (ES5).
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
  function link(text, href){
    var a = el("a", null, text); a.href = href;
    a.onclick = function(e){ if(e && e.preventDefault) e.preventDefault(); go(href); };   // reste dans l'appli d'écran d'accueil
    return a;
  }
  function btn(text, cls, fn){
    var b = el("button", "btn" + (cls ? " " + cls : ""), text); b.type = "button"; b.onclick = fn;
    return b;
  }

  // retour : seulement une page .html du site
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
  if(!S || !H){
    stop([window.LOAD_FAILED ? "La page n'a pas pu se charger entièrement : recharge-la." : "La synchronisation n'a pas pu démarrer."]);
    return;
  }
  if(!S.enabled){
    stop([window.LOAD_FAILED ? "La page n'a pas pu se charger entièrement : recharge-la." : "La synchronisation n'est pas configurée sur ce site."]);
    return;
  }
  if(!S.account()){ stop(["Cet appareil n'est pas connecté. ", link("Connecter cet appareil", "connexion.html")]); return; }
  if(!H.isParent()){ stop(["Cette page est réservée aux parents. ", link("Ajouter à la liste", "liste.html")]); return; }
  gate.innerHTML = "";
  app.style.display = "block";

  // ---- État de l'écran ----
  var ui = {filing: null, form: {pick: "", name: "", section: "autre"}, editing: null, edit: {name: "", section: "autre"},
            creating: false, create: {section: "autre"}, confirm: null};
  var lastSig = "", pendingRender = false, startedAt = Date.now(), confirmTimer = null, armedAt = 0;

  // Action à deux appuis (retirer, supprimer, vider) : le premier arme, le second (après 0,7 s) exécute ; elle expire après 5 s
  function twoTap(key, fn){
    var n = Date.now();
    if(ui.confirm === key){
      if(n - armedAt < 700) return;
      ui.confirm = null; if(confirmTimer){ clearTimeout(confirmTimer); confirmTimer = null; }
      fn(); render();
      return;
    }
    ui.confirm = key; armedAt = n;
    if(confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(expire, 5000);
    render();
  }
  function expire(){
    confirmTimer = null;
    if(typing()){ confirmTimer = setTimeout(expire, 2000); return; }   // on ne change pas un libellé sous les doigts de quelqu'un qui écrit
    ui.confirm = null; render();
  }
  // Petit message qui disparaît seul (action refusée ou sans effet)
  var flashText = "", flashTimer = null;
  function flash(text){
    flashText = text;
    if(flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function(){ flashText = ""; flashTimer = null; renderStatus(); }, 4000);
    renderStatus();
  }
  // Coche : un double appui ne doit pas cocher aussi la ligne qui vient prendre la place
  var tickAt = 0;
  function tick(id){
    var n = Date.now();
    if(n - tickAt < 450) return;
    tickAt = n;
    H.toggleCart(id); render();
  }

  function sectionSelect(value, onchange){
    var s = el("select"), i, o;
    for(i = 0; i < H.SECTIONS.length; i++){
      o = el("option", null, H.SECTIONS[i].emoji + " " + H.SECTIONS[i].name); o.value = H.SECTIONS[i].key;
      if(H.SECTIONS[i].key === value) o.selected = true;
      s.appendChild(o);
    }
    s.onchange = function(){ onchange(s.value); };
    return s;
  }
  function textInput(value, placeholder, oninput){
    var i = el("input"); i.type = "text"; i.value = value || ""; i.placeholder = placeholder || "";
    i.setAttribute("autocomplete", "off");
    i.oninput = function(){ oninput(i.value); };
    return i;
  }
  function who(by){ return H.WHO[by] || by; }

  // ---- Propositions des enfants ----
  function renderInbox(){
    var box = $("inbox"), list = H.inbox();
    box.innerHTML = "";
    if(!list.length) return;
    var b = el("div", "box warn"), h = el("h2", null, "💬 Propositions des enfants");
    h.appendChild(el("span", "n", String(list.length)));
    b.appendChild(h);
    if(list.length >= 3){
      b.appendChild(btn(ui.confirm === "inbox" ? "Appuie encore pour tout ignorer" : "Tout ignorer", "sm bad", function(){
        twoTap("inbox", function(){ H.clearInbox(); });
      }));
    }
    var more = list.length - 50;
    list.slice(0, 50).forEach(function(p){
      var row = el("div", "row"), nm = el("div", "nm", p.text);
      nm.appendChild(el("small", null, "proposé par " + who(p.by)));
      row.appendChild(nm);
      row.appendChild(btn("Classer…", "sm", function(){
        ui.filing = ui.filing === p.id ? null : p.id;
        ui.form = {pick: "", name: p.text, section: "autre"};
        render();
      }));
      row.appendChild(btn(ui.confirm === "ign:" + p.id ? "Ignorer ?" : "Ignorer", "sm ghost", function(){
        twoTap("ign:" + p.id, function(){ H.dropInbox(p.id); });
      }));
      b.appendChild(row);
      if(ui.filing === p.id) b.appendChild(fileForm(p));
    });
    if(more > 0) b.appendChild(el("div", "empty", "… et " + more + " autres. Classe ou ignore celles-ci, les suivantes arriveront après."));
    box.appendChild(b);
  }
  function fileForm(p){
    var f = el("div", "inline"), its = H.items(), sel = el("select"), o, i;
    f.appendChild(el("div", "sec", "C'est un article qu'on a déjà ?"));
    o = el("option", null, "— choisir un article existant —"); o.value = ""; sel.appendChild(o);
    for(i = 0; i < its.length; i++){
      o = el("option", null, H.section(its[i].section).emoji + " " + its[i].name); o.value = its[i].id;
      if(its[i].id === ui.form.pick) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = function(){ ui.form.pick = sel.value; };
    f.appendChild(sel);
    f.appendChild(btn("Ajouter celui-là à la liste", "ok", function(){
      if(!ui.form.pick){ flash("Choisis d'abord un article dans la liste."); return; }
      if(H.fileInbox(p.id, ui.form.pick, p.by)) ui.filing = null;
      else flash("Cet article n'existe plus : choisis-en un autre.");
      render();
    }));
    f.appendChild(el("div", "sec", "Ou un nouvel article"));
    f.appendChild(textInput(ui.form.name, "Nom de l'article", function(v){ ui.form.name = v; }));
    f.appendChild(sectionSelect(ui.form.section, function(v){ ui.form.section = v; }));
    f.appendChild(btn("Créer l'article et l'ajouter", "ok", function(){
      var id = H.createItem(ui.form.name, ui.form.section);
      if(!id){ flash("Écris le nom de l'article."); return; }
      H.fileInbox(p.id, id, p.by);
      ui.filing = null; render();
    }));
    return f;
  }

  // ---- À acheter ----
  function renderToBuy(){
    var box = $("tobuy"), n = H.needs(), its = H.items(), byId = {}, i, k;
    for(i = 0; i < its.length; i++) byId[its[i].id] = its[i];
    var list = [], cart = 0;
    for(k in n){
      if(!n.hasOwnProperty(k)) continue;
      var it = byId.hasOwnProperty(k) ? byId[k] : {id: k, name: k, section: "autre"};
      list.push({id: k, name: it.name, section: it.section, need: n[k]});
      if(n[k].cart) cart++;
    }
    box.innerHTML = "";
    var h = el("h2", null, "🛒 À acheter");
    h.appendChild(el("span", "n", String(list.length)));
    box.appendChild(h);
    if(!list.length){
      box.appendChild(el("div", "empty", "Rien à acheter pour l'instant. Ajoute un article ci-dessous."));
    }
    H.SECTIONS.forEach(function(sec){
      var rows = list.filter(function(r){ return H.section(r.section).key === sec.key; });
      if(!rows.length) return;
      rows.sort(function(a, b){
        if(a.need.cart !== b.need.cart) return a.need.cart ? 1 : -1;
        var x = H.norm(a.name), y = H.norm(b.name); return x < y ? -1 : (x > y ? 1 : 0);
      });
      box.appendChild(el("div", "sec", sec.emoji + " " + sec.name));
      rows.forEach(function(r){ box.appendChild(needRow(r)); });
    });

    var bar = $("finishBar"), fin = $("finish");
    if(cart > 0){
      bar.className = "sticky show";
      fin.textContent = ui.confirm === "finish" ? "Appuie encore pour confirmer (" + cart + " retiré" + (cart > 1 ? "s" : "") + ")"
                                                : "✓ Terminer les courses (" + cart + " dans le panier)";
      fin.onclick = function(){ twoTap("finish", function(){ H.finishShopping(); }); };
    } else {
      bar.className = "sticky";
    }
  }
  function needRow(r){
    var row = el("div", "row" + (r.need.cart ? " cart" : ""));
    var chk = el("button", "chk", "✓"); chk.type = "button";
    chk.onclick = function(){ tick(r.id); };
    row.appendChild(chk);
    var nm = el("div", "nm", r.name);
    if(r.need.by !== "famille") nm.appendChild(el("small", null, "demandé par " + who(r.need.by)));
    nm.onclick = function(){ tick(r.id); };
    row.appendChild(nm);
    var q = el("div", "qty");
    var minus = el("button", "step", "−"); minus.type = "button";
    minus.onclick = function(){ H.bump(r.id, -1); render(); };
    var plus = el("button", "step", "+"); plus.type = "button";
    plus.onclick = function(){ H.bump(r.id, 1); render(); };
    q.appendChild(minus); q.appendChild(el("b", null, String(r.need.q))); q.appendChild(plus);
    row.appendChild(q);
    var armedX = ui.confirm === "rm:" + r.id;
    var x = el("button", "x" + (armedX ? " armed" : ""), armedX ? "Retirer ?" : "✕"); x.type = "button";
    x.onclick = function(){ twoTap("rm:" + r.id, function(){ H.removeNeed(r.id); }); };
    row.appendChild(x);
    return row;
  }

  // ---- Ajouter un article ----
  function renderResults(){
    var box = $("results"), text = $("search").value, tn = H.norm(text).replace(/^\s+|\s+$/g, "");
    box.innerHTML = "";
    if(!H.known()){
      box.appendChild(el("div", "empty", "Chargement de la liste…"));
      return;
    }
    if(!tn){
      box.appendChild(el("div", "empty", "Tape le début du nom d'un article."));
      return;
    }
    var n = H.needs(), found = H.items().filter(function(it){ return H.norm(it.name).indexOf(tn) !== -1; }), exact = false;
    found.slice(0, 30).forEach(function(it){
      if(H.norm(it.name) === tn) exact = true;
      var row = el("div", "row"), nm = el("div", "nm", it.name);
      nm.appendChild(el("small", null, H.section(it.section).emoji + " " + H.section(it.section).name));
      row.appendChild(nm);
      if(n.hasOwnProperty(it.id)) row.appendChild(el("span", "tag", "×" + n[it.id].q));
      row.appendChild(btn("＋", "sm ok", function(){ H.addOne(it.id); render(); }));
      box.appendChild(row);
    });
    if(!found.length) box.appendChild(el("div", "empty", "Aucun article de ce nom."));
    if(!exact && tn.length >= 2){
      if(!ui.creating){
        box.appendChild(btn("➕ Créer « " + H.clean(text, 40) + " »", "ghost", function(){ ui.creating = true; ui.create = {section: "autre"}; render(); }));
      } else {
        var f = el("div", "inline");
        f.appendChild(el("div", "sec", "Nouvel article « " + H.clean(text, 40) + " » : dans quel rayon ?"));
        f.appendChild(sectionSelect(ui.create.section, function(v){ ui.create.section = v; }));
        f.appendChild(btn("Créer et ajouter à la liste", "ok", function(){
          var id = H.createItem(text, ui.create.section);
          if(!id) return;
          H.addOne(id);
          ui.creating = false; $("search").value = ""; render();
        }));
        f.appendChild(btn("Annuler", "ghost", function(){ ui.creating = false; render(); }));
        box.appendChild(f);
      }
    }
  }

  // ---- Tous les articles ----
  function renderManage(){
    var box = $("manageBody"), its = H.items(), n = H.needs();
    box.innerHTML = "";
    if(!its.length){ box.appendChild(el("div", "empty", "Le catalogue est vide : il se remplit au fur et à mesure.")); }
    H.SECTIONS.forEach(function(sec){
      var rows = its.filter(function(it){ return H.section(it.section).key === sec.key; });
      if(!rows.length) return;
      box.appendChild(el("div", "sec", sec.emoji + " " + sec.name + " (" + rows.length + ")"));
      rows.forEach(function(it){
        var row = el("div", "row"), nm = el("div", "nm", it.name);
        row.appendChild(nm);
        if(n.hasOwnProperty(it.id)) row.appendChild(el("span", "tag", "×" + n[it.id].q));
        row.appendChild(btn("＋", "sm ok", function(){ H.addOne(it.id); render(); }));
        row.appendChild(btn("✎", "sm ghost", function(){
          ui.editing = ui.editing === it.id ? null : it.id; ui.edit = {name: it.name, section: it.section}; render();
        }));
        row.appendChild(btn(ui.confirm === "del:" + it.id ? "Supprimer ?" : "🗑", "sm bad", function(){
          twoTap("del:" + it.id, function(){ H.deleteItem(it.id); });
        }));
        box.appendChild(row);
        if(ui.editing === it.id){
          var f = el("div", "inline");
          f.appendChild(textInput(ui.edit.name, "Nom", function(v){ ui.edit.name = v; }));
          f.appendChild(sectionSelect(ui.edit.section, function(v){ ui.edit.section = v; }));
          f.appendChild(btn("Enregistrer", "ok", function(){
            if(!H.clean(ui.edit.name, 40)){ flash("Écris le nom de l'article."); return; }
            H.editItem(it.id, ui.edit.name, ui.edit.section); ui.editing = null; render();
          }));
          f.appendChild(btn("Annuler", "ghost", function(){ ui.editing = null; render(); }));
          box.appendChild(f);
        }
      });
    });
    var all = Object.keys(n).length;
    if(all > 0){
      box.appendChild(el("div", "sec", "Liste à acheter"));
      box.appendChild(btn(ui.confirm === "clear" ? "Appuie encore pour vider (" + all + " lignes)" : "Vider toute la liste à acheter", "bad", function(){
        twoTap("clear", function(){ H.clearNeeds(); });
      }));
    }
  }

  // ---- Affichage ----
  function renderStatus(){
    var s = flashText || H.status(), box = $("status");
    box.className = s ? "msg show" : "msg";
    box.textContent = s || "";
  }
  function render(){
    pendingRender = false;
    renderStatus();
    if(!H.known()){
      lastSig = "";   // au retour des données, on redessine même si elles sont identiques à celles d'avant
      $("inbox").innerHTML = "";
      var b = $("tobuy"); b.innerHTML = "";
      b.appendChild(el("div", "empty", Date.now() - startedAt > 8000
        ? "Impossible de charger la liste pour l'instant (pas de réseau, ou droits à publier). Réessaie dans un moment."
        : "Chargement de la liste…"));
      $("finishBar").className = "sticky";
      renderResults();
      return;
    }
    lastSig = H.sig();
    renderInbox();
    renderToBuy();
    renderResults();
    renderManage();
  }
  function typing(){
    var a = document.activeElement;
    return !!(a && a.tagName && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.id !== "search" && app.contains(a));
  }
  function onChange(){
    renderStatus();
    if(typing()){ pendingRender = true; return; }
    if(H.known() && H.sig() === lastSig) return;
    render();
  }

  $("search").oninput = function(){ ui.creating = false; renderResults(); };
  app.addEventListener("focusout", function(){ if(pendingRender) setTimeout(function(){ if(!typing()) render(); }, 150); });

  S.watch([], [], onChange, ["shop"]);
  render();
  setInterval(function(){ renderStatus(); if(!H.known() && !typing()) render(); }, 3000);   // « chargement… » puis message d'erreur
})();
