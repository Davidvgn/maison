/* ================================================================
   Liste de courses partagée : données et actions (pages courses.html et liste.html).
   Données (voir sync.js et database.rules.json) :
     /shop/items/<id> = "Nom|rayon"        catalogue des articles (parents seulement)
     /shop/need/<id>  = "quantité|qui|0/1"  à acheter ; 1 = dans le panier
     /shop/inbox/<id> = "texte|qui"         « autre chose » proposé par un enfant
     /shop/note/<id>  = "précision"         texte libre sur une ligne à acheter (ex. « Jérémy »), parents seulement
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
  // minuscules sans accents, trait d'union et apostrophe = espace (pour chercher et comparer)
  function norm(text){
    var s = String(text).toLowerCase(), out = "", i, c;
    for(i = 0; i < s.length; i++){ c = s.charAt(i); out += ACCENTS[c] || c; }
    return out.replace(/[-'’]/g, " ");
  }
  // première lettre en majuscule (le reste est laissé tel qu'écrit : « Coca-Cola », « Kinder Cards »)
  function cap(text){
    var s = String(text);
    return s.charAt(0).toUpperCase() + s.slice(1);
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
  // précisions (texte libre) des lignes à acheter : id -> texte
  function notes(){
    var g = S.getGroup("shop", "note"), out = {}, k;
    for(k in g){ if(g.hasOwnProperty(k)) out[k] = String(g[k]); }
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
    var g = ["items", "need", "inbox", "note"], out = [], i, k, grp;
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
  // +1 : une unité en plus est à acheter. Sur une ligne déjà prise, ce qui est pris est acquis : la ligne revient
  // dans « À prendre » avec seulement ce qui manque (3 pris + 1 = « ×1 »), pour ne pas racheter ce qui est dans le chariot.
  function addOne(id, by){
    if(!exists(id)) return false;
    var all = needs(), cur = all.hasOwnProperty(id) ? all[id] : null;
    var n = cur ? {q: cur.cart ? 1 : Math.min(cur.q + 1, 99), by: cur.by, cart: false} : {q: 1, by: by || "famille", cart: false};
    S.setShop("need", id, packNeed(n));
    return true;
  }
  // Change la quantité d'un delta, à partir de ce que l'appareil voit à l'instant du geste
  function bump(id, delta){
    var all = needs();
    if(!all.hasOwnProperty(id)) return;
    var cur = all[id];
    var q = delta > 0 && cur.cart ? delta : cur.q + delta;   // ligne prise : « + » = ce qui manque (voir addOne)
    if(q < 1) return;
    S.setShop("need", id, packNeed({q: Math.min(q, 99), by: cur.by, cart: delta > 0 ? false : cur.cart}));
  }
  // Marque une ligne prise (ou la remet dans la liste) ; sans effet si elle est déjà dans cet état,
  // pour que deux parents qui appuient en même temps ne s'annulent pas l'un l'autre.
  function setCart(id, on){
    var all = needs();
    if(!all.hasOwnProperty(id)) return false;
    var cur = all[id], want = !!on;
    if(cur.cart === want) return false;
    S.setShop("need", id, packNeed({q: cur.q, by: cur.by, cart: want}));
    return true;
  }
  // Les lignes de la liste à acheter avec le nom et le rayon de l'article, triées par nom
  function lines(){
    var n = needs(), its = items(), nt = notes(), byId = {}, out = [], i, k, it;
    for(i = 0; i < its.length; i++) byId[its[i].id] = its[i];
    for(k in n){
      if(!n.hasOwnProperty(k)) continue;
      it = byId.hasOwnProperty(k) ? byId[k] : null;
      out.push({id: k, name: it ? it.name : "(article supprimé) " + k, section: section(it ? it.section : "autre").key, q: n[k].q, by: n[k].by, cart: n[k].cart,
                note: nt.hasOwnProperty(k) ? nt[k] : ""});
    }
    out.sort(byName);
    return out;
  }
  // Précision d'une ligne (« Jérémy » sur une brosse à dents) : texte libre, vide = effacée
  function setNote(id, text){
    var t = clean(text, 60);
    if(t) S.setShop("note", id, t);
    else if(notes().hasOwnProperty(id)) S.setShop("note", id, null);
  }
  // Ajoute une précision à celle qui existe déjà (« Jérémy » puis « Nina » = « Jérémy, Nina »)
  function addNote(id, text){
    var t = clean(text, 60);
    if(!t) return;
    var cur = notes().hasOwnProperty(id) ? notes()[id] : "";
    if(cur){
      if((", " + norm(cur) + ",").indexOf(", " + norm(t) + ",") !== -1) return;   // déjà dedans
      t = cur + ", " + t;
    }
    S.setShop("note", id, t.slice(0, 60));
  }
  function dropNote(id){ if(notes().hasOwnProperty(id)) S.setShop("note", id, null); }
  function removeNeed(id){ S.setShop("need", id, null); dropNote(id); }
  function finishShopping(){
    var n = needs(), k, count = 0;
    for(k in n){ if(n.hasOwnProperty(k) && n[k].cart){ S.setShop("need", k, null); dropNote(k); count++; } }
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
    var nm = cap(clean(name, 40));
    if(!nm) return null;
    var same = findByName(nm);
    if(same) return same;   // un article du même nom existe déjà : on le réutilise
    var id = uniqueId(slug(nm));
    S.setShop("items", id, nm + "|" + section(sectionKey).key);
    return id;
  }
  function editItem(id, name, sectionKey){
    var nm = cap(clean(name, 40));
    if(!nm || !exists(id)) return;
    S.setShop("items", id, nm + "|" + section(sectionKey).key);
  }
  function deleteItem(id){
    S.setShop("items", id, null);
    S.setShop("need", id, null);
    dropNote(id);
  }
  function dropInbox(id){ S.setShop("inbox", id, null); }
  function clearInbox(){ S.clearShop("inbox"); }
  function clearNeeds(){
    S.clearShop("need");
    for(var k in notes()){ S.clearShop("note"); break; }   // les précisions partent avec les lignes
  }
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
    var r = role(), t = cap(clean(text, 40));
    if(!r || !t) return false;
    var id = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    S.setShop("inbox", id, t + "|" + r);
    return true;
  }

  // Message d'état de la synchro pour les pages de courses (null = rien à signaler).
  // Un envoi normal dure moins d'une seconde : on n'affiche « en cours d'envoi » que s'il traîne,
  // sinon un bandeau entrerait et sortirait de la page à chaque appui et ferait sauter les lignes.
  var sendingSince = 0;
  function status(){
    var st = S.state(null), n = st.n || 0, s = n > 1 ? "s" : "";
    if(st.k === "out"){ sendingSince = 0; return "🔒 Cet appareil n'est pas connecté"; }
    if(st.k === "denied") return "⛔ La base refuse l'accès à cet appareil";
    if(st.k === "config") return "⚙️ Réglage Firebase à revoir : les changements attendent sur l'appareil";
    if(st.k === "offline") return "📴 Pas de réseau" + (n ? " · " + n + " changement" + s + " en attente d'envoi" : "");
    if(n > 0){
      if(!sendingSince) sendingSince = Date.now();
      if(Date.now() - sendingSince < 2500) return null;
      return "⏳ " + n + " changement" + s + " en cours d'envoi";
    }
    sendingSince = 0;
    return null;
  }

  window.Shop = {
    status: status,
    SECTIONS: SECTIONS, WHO: WHO, section: section,
    norm: norm, clean: clean, role: role, isParent: isParent,
    items: items, needs: needs, inbox: inbox, notes: notes, sig: sig,
    setNote: setNote, addNote: addNote,
    known: function(){ return S.known("shop"); },
    addOne: addOne, bump: bump, setCart: setCart, lines: lines, removeNeed: removeNeed, finishShopping: finishShopping,
    createItem: createItem, editItem: editItem, deleteItem: deleteItem,
    dropInbox: dropInbox, clearInbox: clearInbox, clearNeeds: clearNeeds, fileInbox: fileInbox, exists: exists,
    kidAdd: kidAdd, suggest: suggest
  };
})();
