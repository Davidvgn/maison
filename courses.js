/* ================================================================
   Page des parents : la liste de courses (courses.html).
   Réservée au compte « famille ». Deux vues sur la même liste :
   - « Préparer » : tout (ajouter, quantités, retirer, propositions des
     enfants à classer, gestion des articles) ; les lignes prises y restent,
     en vert et barrées ;
   - « En magasin » : ce qui reste à prendre, rien d'autre ; un appui sur une
     ligne la marque prise et elle disparaît (annulable).
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
            creating: false, create: {section: "autre"}, confirm: null, mode: "prep", showTaken: false};
  // La vue choisie est gardée sur cet appareil (la tablette en « Préparer », le téléphone en « En magasin »)
  var MODE_K = "maison:courses:mode";
  try{ ui.mode = localStorage.getItem(MODE_K) === "shop" ? "shop" : "prep"; }catch(e){}
  var qm = qs("mode");
  if(qm === "magasin" || qm === "shop") ui.mode = "shop";
  else if(qm === "preparer" || qm === "prep") ui.mode = "prep";
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
  // Prise d'une ligne en magasin : elle disparaît, la suivante prend sa place sous le doigt.
  // Un double appui ne doit donc pas prendre aussi la ligne suivante : on ignore tout appui trop proche.
  var takeAt = 0, undoTimer = null, undoId = null;
  function hideUndo(){
    if(undoTimer){ clearTimeout(undoTimer); undoTimer = null; }
    undoId = null;
    var t = $("toast"); t.className = "toast"; t.innerHTML = "";
  }
  function showUndo(id, name){
    hideUndo();
    var t = $("toast");
    undoId = id;
    t.appendChild(el("span", null, "« " + name + " » pris"));
    t.appendChild(btn("↩ Annuler", "sm ghost", function(){
      var n = Date.now();
      if(n - takeAt < 500) return;   // même antirebond qu'une prise : le bandeau arrive sous le doigt qui vient d'appuyer
      takeAt = n;                    // et le suivant est ignoré aussi : la ligne cachée sous le bandeau ne doit pas être prise
      hideUndo(); H.setCart(id, false); render();
    }));
    t.className = "toast show";
    undoTimer = setTimeout(hideUndo, 6000);
  }
  function take(r){
    var n = Date.now();
    if(n - takeAt < 500) return;
    takeAt = n;
    if(H.setCart(r.id, true)) showUndo(r.id, r.name);
    render();
  }
  function untake(id){
    var n = Date.now();
    if(n - takeAt < 500) return;
    takeAt = n;
    H.setCart(id, false);
    render();
  }
  function setMode(m){
    if(ui.mode === m) return;
    ui.mode = m;
    try{ localStorage.setItem(MODE_K, m); }catch(e){}
    ui.confirm = null; hideUndo();
    try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e1){}   // un champ caché ne doit pas geler l'écran
    render();
    try{ window.scrollTo(0, 0); }catch(e2){}
  }

  // Quantité déjà prise d'une ligne (0 si la ligne n'est pas prise ou n'existe pas)
  function takenQty(id){
    var all = H.needs();
    return all.hasOwnProperty(id) && all[id].cart ? all[id].q : 0;
  }
  // Une ligne prise qui reçoit une unité de plus revient avec seulement ce qui manque : on le dit
  function sayTaken(was, name){
    if(was) flash("« " + name + " » : " + was + " déjà pris, il en reste 1 à prendre.");
    else if(flashText){ flashText = ""; renderStatus(); }   // le message d'un appui précédent ne doit pas rester affiché
  }
  function more(id, name){
    var was = takenQty(id);
    if(!H.addOne(id)){ flash("Cet article n'existe plus dans le catalogue : retire la ligne avec ✕."); return; }
    sayTaken(was, name);
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
      var was = takenQty(ui.form.pick), picked = null, k, all = H.items();
      for(k = 0; k < all.length; k++){ if(all[k].id === ui.form.pick) picked = all[k]; }
      if(H.fileInbox(p.id, ui.form.pick, p.by)){ ui.filing = null; sayTaken(was, picked ? picked.name : ui.form.pick); }
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

  // ---- Vue « Préparer » : toute la liste, rangée par rayon ----
  function renderToBuy(lines){
    var box = $("tobuy"), taken = 0, i;
    for(i = 0; i < lines.length; i++){ if(lines[i].cart) taken++; }
    box.innerHTML = "";
    var h = el("h2", null, "📝 La liste à acheter");
    h.appendChild(el("span", "n", String(lines.length)));
    box.appendChild(h);
    if(taken > 0) box.appendChild(el("div", "sh-sub", taken + " déjà pris (en vert, barrés). Ils se prennent dans la vue « En magasin »."));
    if(!lines.length){
      box.appendChild(el("div", "empty", "Rien à acheter pour l'instant. Ajoute un article ci-dessous."));
    }
    H.SECTIONS.forEach(function(sec){
      var rows = lines.filter(function(r){ return r.section === sec.key; });
      if(!rows.length) return;
      var open = rows.filter(function(r){ return !r.cart; }), done = rows.filter(function(r){ return r.cart; });
      box.appendChild(el("div", "sec", sec.emoji + " " + sec.name));
      open.concat(done).forEach(function(r){ box.appendChild(needRow(r)); });
    });
  }
  function needRow(r){
    var row = el("div", "row" + (r.cart ? " cart" : ""));
    var nm = el("div", "nm", r.name);
    if(r.by !== "famille") nm.appendChild(el("small", null, "demandé par " + who(r.by)));
    row.appendChild(nm);
    if(r.cart) row.appendChild(el("span", "tag done", "✓ pris"));
    var ctl = el("div", "ctl"), q = el("div", "qty");   // quantité et ✕ restent ensemble quand l'écran est étroit
    var minus = el("button", "step", "−"); minus.type = "button";
    minus.onclick = function(){ H.bump(r.id, -1); render(); };
    var plus = el("button", "step", "+"); plus.type = "button";
    plus.onclick = function(){ more(r.id, r.name); render(); };
    q.appendChild(minus); q.appendChild(el("b", null, String(r.q))); q.appendChild(plus);
    ctl.appendChild(q);
    var armedX = ui.confirm === "rm:" + r.id;
    var x = el("button", "x" + (armedX ? " armed" : ""), armedX ? "Retirer ?" : "✕"); x.type = "button";
    x.onclick = function(){ twoTap("rm:" + r.id, function(){ H.removeNeed(r.id); }); };
    ctl.appendChild(x);
    row.appendChild(ctl);
    return row;
  }

  // ---- Vue « En magasin » : ce qui reste à prendre ----
  function renderShop(lines){
    var box = $("shopview"), left = [], taken = [], i;
    for(i = 0; i < lines.length; i++){ (lines[i].cart ? taken : left).push(lines[i]); }
    box.innerHTML = "";
    var b = el("div", "box"), h = el("h2", null, "🛒 À prendre");
    h.appendChild(el("span", "n", String(left.length)));
    b.appendChild(h);
    if(!taken.length) ui.showTaken = false;   // l'ouverture ne doit pas survivre à « Terminer » : la prise suivante doit disparaître
    if(!lines.length){
      b.appendChild(el("div", "empty", "La liste est vide. Prépare-la dans la vue « Préparer »."));
    } else if(!left.length){
      b.appendChild(el("div", "empty", "🎉 Tout est pris ! Appuie sur « Terminer les courses » pour vider la liste."));
    } else {
      b.appendChild(el("div", "sh-sub", "Appuie sur un article quand il est dans le chariot."));
    }
    H.SECTIONS.forEach(function(sec){
      var rows = left.filter(function(r){ return r.section === sec.key; });
      if(!rows.length) return;
      b.appendChild(el("div", "sec", sec.emoji + " " + sec.name));
      rows.forEach(function(r){ b.appendChild(takeRow(r, false)); });
    });
    if(taken.length){
      b.appendChild(btn((ui.showTaken ? "Cacher" : "Voir aussi") + " les articles pris (" + taken.length + ")", "ghost", function(){
        ui.showTaken = !ui.showTaken; render();
      }));
      if(ui.showTaken){
        b.appendChild(el("div", "sec", "Déjà pris · appuie sur une ligne pour la remettre dans la liste"));
        taken.forEach(function(r){ b.appendChild(takeRow(r, true)); });
      }
    }
    box.appendChild(b);
  }
  function takeRow(r, done){
    var row = el("div", "row take" + (done ? " cart" : ""));
    var nm = el("div", "nm", r.name);
    if(r.by !== "famille") nm.appendChild(el("small", null, "demandé par " + who(r.by)));
    row.appendChild(nm);
    if(r.q > 1) row.appendChild(el("span", "big", "×" + r.q));
    row.onclick = function(){ if(done) untake(r.id); else take(r); };
    return row;
  }

  // Barre du bas (les deux vues) : « Terminer les courses » retire de la liste ce qui est pris
  function renderFinishBar(lines){
    var cart = 0, i, bar = $("finishBar"), fin = $("finish");
    for(i = 0; i < lines.length; i++){ if(lines[i].cart) cart++; }
    if(cart > 0){
      bar.className = "sticky show";
      fin.textContent = ui.confirm === "finish" ? "Appuie encore pour confirmer (" + cart + " retiré" + (cart > 1 ? "s" : "") + ")"
                                                : "✓ Terminer les courses (" + cart + " pris)";
      fin.onclick = function(){ twoTap("finish", function(){ hideUndo(); H.finishShopping(); }); };
    } else {
      bar.className = "sticky";
      if(ui.confirm === "finish") ui.confirm = null;   // plus rien à terminer : l'armement ne doit pas attendre la prochaine prise
    }
  }
  function renderModes(left, props){
    var shop = ui.mode === "shop";
    $("prep").style.display = shop ? "none" : "block";
    $("shopview").style.display = shop ? "block" : "none";
    $("modePrep").className = shop ? "" : "on";
    $("modeShop").className = shop ? "on" : "";
    $("modeShop").textContent = "🛒 En magasin" + (left > 0 ? " · " + left : "");
    $("modePrep").textContent = "📝 Préparer" + (props > 0 ? " · 💬 " + props : "");   // propositions des enfants à classer
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
      row.appendChild(btn("＋", "sm ok", function(){ more(it.id, it.name); render(); }));
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
        row.appendChild(btn("＋", "sm ok", function(){ more(it.id, it.name); render(); }));
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
      renderModes(0, 0);
      hideUndo();
      var msg = el("div", "empty", Date.now() - startedAt > 8000
        ? "Impossible de charger la liste pour l'instant (pas de réseau, ou droits à publier). Réessaie dans un moment."
        : "Chargement de la liste…");
      var target = ui.mode === "shop" ? $("shopview") : $("tobuy");
      $("inbox").innerHTML = ""; $("tobuy").innerHTML = ""; $("shopview").innerHTML = "";
      target.appendChild(msg);
      $("finishBar").className = "sticky";
      renderResults();
      return;
    }
    lastSig = H.sig();
    var lines = H.lines(), left = 0, i;
    for(i = 0; i < lines.length; i++){ if(!lines[i].cart) left++; }
    renderModes(left, H.inbox().length);
    // le bandeau « Annuler » ne vaut que tant que la ligne est encore prise (remise ou retirée par l'autre parent)
    if(undoId){
      var all = H.needs();
      if(!all.hasOwnProperty(undoId) || !all[undoId].cart) hideUndo();
    }
    if(ui.mode === "shop"){
      renderShop(lines);
    } else {
      renderInbox();
      renderToBuy(lines);
      renderResults();
      renderManage();
    }
    renderFinishBar(lines);
  }
  function typing(){
    if(ui.mode === "shop") return false;
    var a = document.activeElement;
    return !!(a && a.tagName && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.id !== "search" && app.contains(a));
  }
  var touchAt = 0, holdTimer = null;
  function onChange(){
    renderStatus();
    if(typing()){ pendingRender = true; return; }
    if(H.known() && H.sig() === lastSig) return;
    if(ui.mode === "shop" && Date.now() - touchAt < 700){   // un doigt vient de se poser : on ne déplace pas les lignes avant son relevé
      if(!holdTimer) holdTimer = setTimeout(function(){ holdTimer = null; onChange(); }, 750);
      return;
    }
    render();
  }
  app.addEventListener("touchstart", function(){ touchAt = Date.now(); });

  $("modePrep").onclick = function(){ setMode("prep"); };
  $("modeShop").onclick = function(){ setMode("shop"); };
  $("search").oninput = function(){ ui.creating = false; renderResults(); };
  app.addEventListener("focusout", function(){ if(pendingRender) setTimeout(function(){ if(!typing()) render(); }, 150); });

  S.watch([], [], onChange, ["shop"]);
  render();
  setInterval(function(){ renderStatus(); if(!H.known() && !typing()) render(); }, 3000);   // « chargement… » puis message d'erreur
})();
