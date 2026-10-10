/* ================================================================
   Liste de courses partagée : données et actions (pages courses.html et liste.html).
   Données (voir sync.js et database.rules.json) :
     /shop/items/<id> = "Nom|rayon"        catalogue des articles (parents seulement)
     /shop/need/<id>  = "quantité|qui|0/1"  à acheter ; 1 = dans le panier
     /shop/inbox/<id> = "texte|qui"         « autre chose » proposé par un enfant
   Les enfants peuvent AJOUTER un article du catalogue (jamais modifier ni supprimer)
   et proposer du texte libre ; seuls les parents gèrent la liste finale.
   JavaScript ancien (ES5).
   ================================================================ */
(function(){
  "use strict";

  var S = window.Sync;
  if(!S) return;

  // Rayons, dans l'ordre où on les parcourt pour se retrouver (pas d'ordre propre à un magasin)
  var SECTIONS = [
    {key: "fruits",      emoji: "🥬", name: "Fruits et légumes"},
    {key: "boulangerie", emoji: "🥖", name: "Boulangerie, pâtisserie"},
    {key: "viande",      emoji: "🥩", name: "Boucherie, poisson, charcuterie"},
    {key: "frais",       emoji: "🧀", name: "Frais, crèmerie"},
    {key: "epicerie",    emoji: "🥫", name: "Épicerie salée, conserves"},
    {key: "sucre",       emoji: "🍫", name: "Épicerie sucrée, petit-déjeuner"},
    {key: "boissons",    emoji: "🥤", name: "Boissons"},
    {key: "surgeles",    emoji: "❄️", name: "Surgelés"},
    {key: "hygiene",     emoji: "🧴", name: "Hygiène, santé"},
    {key: "entretien",   emoji: "🧽", name: "Entretien, maison"},
    {key: "autre",       emoji: "📦", name: "Autre"}
  ];
  var WHO = {jeremy: "Jérémy", liam: "Liam", nina: "Nina", famille: "les parents"};

  function section(key){
    for(var i = 0; i < SECTIONS.length; i++){ if(SECTIONS[i].key === key) return SECTIONS[i]; }
    return SECTIONS[SECTIONS.length - 1];
  }

  // ---- Petits outils ----
  var ACCENTS = {"à": "a", "â": "a", "ä": "a", "é": "e", "è": "e", "ê": "e", "ë": "e", "î": "i", "ï": "i",
                 "ô": "o", "ö": "o", "ù": "u", "û": "u", "ü": "u", "ç": "c", "œ": "oe", "æ": "ae", "ÿ": "y"};
  // minuscules sans accents (pour chercher)
  function norm(text){
    var s = String(text).toLowerCase(), out = "", i, c;
    for(i = 0; i < s.length; i++){ c = s.charAt(i); out += ACCENTS[c] || c; }
    return out;
  }
  // identifiant d'article : lettres et chiffres seulement
  function slug(name){
    var s = norm(name).replace(/[^a-z0-9]/g, "");
    if(s === "constructor") s += "x";   // « constructor » est aussi un nom d'objet JavaScript
    return s.slice(0, 24) || "article";
  }
  // texte propre : sans « | » (séparateur), sans retours à la ligne, longueur limitée
  function clean(text, max){
    return String(text).replace(/[|\r\n\t]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").slice(0, max);
  }
  function role(){ var a = S.account(); return a ? a.role : null; }
  function isParent(){ return role() === "famille"; }

  // ---- Lecture ----
  function parseItem(id, v){
    var s = String(v), i = s.lastIndexOf("|");
    return {id: id, name: i > 0 ? s.slice(0, i) : s, section: i > 0 ? s.slice(i + 1) : "autre"};
  }
  function parseNeed(v){
    var p = String(v).split("|"), q = parseInt(p[0], 10);
    return {q: q > 0 ? Math.min(q, 99) : 1, by: p[1] || "famille", cart: p[2] === "1"};
  }
  function packNeed(n){ return n.q + "|" + n.by + "|" + (n.cart ? "1" : "0"); }
  function parseInbox(id, v){
    var s = String(v), i = s.lastIndexOf("|");
    return {id: id, text: i > 0 ? s.slice(0, i) : s, by: i > 0 ? s.slice(i + 1) : "famille"};
  }
  function byName(a, b){ var x = norm(a.name), y = norm(b.name); return x < y ? -1 : (x > y ? 1 : 0); }

  function items(){
    var g = S.getGroup("shop", "items"), out = [], k;
    for(k in g){ if(g.hasOwnProperty(k)) out.push(parseItem(k, g[k])); }
    out.sort(byName);
    return out;
  }
  function needs(){
    var g = S.getGroup("shop", "need"), out = {}, k;
    for(k in g){ if(g.hasOwnProperty(k)) out[k] = parseNeed(g[k]); }
    return out;
  }
  function inbox(){
    var g = S.getGroup("shop", "inbox"), out = [], k;
    for(k in g){ if(g.hasOwnProperty(k)) out.push(parseInbox(k, g[k])); }
    out.sort(function(a, b){ return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    return out;
  }
  // Empreinte de tout ce qui s'affiche (pour ne redessiner que si quelque chose a changé)
  function sig(){
    var g = ["items", "need", "inbox"], out = [], i, k, grp;
    for(i = 0; i < g.length; i++){
      grp = S.getGroup("shop", g[i]);
      var keys = [];
      for(k in grp){ if(grp.hasOwnProperty(k)) keys.push(k + "=" + grp[k]); }
      keys.sort();
      out.push(keys.join(";"));
    }
    return out.join("#");
  }

  // ---- Écriture : parents ----
  function exists(id){ return S.getGroup("shop", "items").hasOwnProperty(id); }
  // +1 : une unité en plus est à acheter, donc la ligne sort du panier
  function addOne(id, by){
    if(!exists(id)) return false;
    var cur = needs()[id];
    var n = cur ? {q: Math.min(cur.q + 1, 99), by: cur.by, cart: false} : {q: 1, by: by || "famille", cart: false};
    S.setShop("need", id, packNeed(n));
    return true;
  }
  // Change la quantité d'un delta, à partir de ce que l'appareil voit à l'instant du geste
  function bump(id, delta){
    var cur = needs()[id];
    if(!cur) return;
    var q = cur.q + delta;
    if(q < 1) return;
    S.setShop("need", id, packNeed({q: Math.min(q, 99), by: cur.by, cart: delta > 0 ? false : cur.cart}));
  }
  function toggleCart(id){
    var cur = needs()[id];
    if(!cur) return;
    S.setShop("need", id, packNeed({q: cur.q, by: cur.by, cart: !cur.cart}));
  }
  function removeNeed(id){ S.setShop("need", id, null); }
  function finishShopping(){
    var n = needs(), k, count = 0;
    for(k in n){ if(n.hasOwnProperty(k) && n[k].cart){ S.setShop("need", k, null); count++; } }
    return count;
  }
  function uniqueId(base){
    var have = S.getGroup("shop", "items"), id = base, n = 2;
    while(have.hasOwnProperty(id) && n < 100){ id = base.slice(0, 24) + n; n++; }
    return id;
  }
  function findByName(nm){
    var t = norm(nm), all = items(), i;
    for(i = 0; i < all.length; i++){ if(norm(all[i].name) === t) return all[i].id; }
    return null;
  }
  function createItem(name, sectionKey){
    var nm = clean(name, 40);
    if(!nm) return null;
    var same = findByName(nm);
    if(same) return same;   // un article du même nom existe déjà : on le réutilise
    var id = uniqueId(slug(nm));
    S.setShop("items", id, nm + "|" + section(sectionKey).key);
    return id;
  }
  function editItem(id, name, sectionKey){
    var nm = clean(name, 40);
    if(!nm || !exists(id)) return;
    S.setShop("items", id, nm + "|" + section(sectionKey).key);
  }
  function deleteItem(id){
    S.setShop("items", id, null);
    S.setShop("need", id, null);
  }
  function dropInbox(id){ S.setShop("inbox", id, null); }
  function clearInbox(){ S.clearShop("inbox"); }
  function clearNeeds(){ S.clearShop("need"); }
  function fileInbox(inboxId, itemId, by){
    if(!addOne(itemId, by)) return false;
    dropInbox(inboxId);
    return true;
  }

  // ---- Écriture : enfants (ajout seulement) ----
  function kidAdd(id, q){
    var r = role();
    if(!r || needs()[id]) return false;   // déjà demandé : on ne touche à rien
    var n = Math.max(1, Math.min(99, parseInt(q, 10) || 1));
    S.setShop("need", id, n + "|" + r + "|0");
    return true;
  }
  function suggest(text){
    var r = role(), t = clean(text, 40);
    if(!r || !t) return false;
    var id = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    S.setShop("inbox", id, t + "|" + r);
    return true;
  }

  // Message d'état de la synchro pour les pages de courses (null = rien à signaler)
  function status(){
    var st = S.state(null), n = st.n || 0, s = n > 1 ? "s" : "";
    if(st.k === "out") return "🔒 Cet appareil n'est pas connecté";
    if(st.k === "denied") return "⛔ La base refuse l'accès à cet appareil";
    if(st.k === "config") return "⚙️ Réglage Firebase à revoir : les changements attendent sur l'appareil";
    if(st.k === "offline") return "📴 Pas de réseau" + (n ? " · " + n + " changement" + s + " en attente d'envoi" : "");
    if(n > 0) return "⏳ " + n + " changement" + s + " en cours d'envoi";
    return null;
  }

  window.Shop = {
    status: status,
    SECTIONS: SECTIONS, WHO: WHO, section: section,
    norm: norm, clean: clean, role: role, isParent: isParent,
    items: items, needs: needs, inbox: inbox, sig: sig,
    known: function(){ return S.known("shop"); },
    addOne: addOne, bump: bump, toggleCart: toggleCart, removeNeed: removeNeed, finishShopping: finishShopping,
    createItem: createItem, editItem: editItem, deleteItem: deleteItem,
    dropInbox: dropInbox, clearInbox: clearInbox, clearNeeds: clearNeeds, fileInbox: fileInbox, exists: exists,
    kidAdd: kidAdd, suggest: suggest
  };
})();
