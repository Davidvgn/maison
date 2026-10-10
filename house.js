/* ================================================================
   La maison : états partagés entre tous les appareils.
   - Lave-vaisselle : les parents appuient sur « Lancé » ; les enfants voient
     « Vider le lave-vaisselle » jusqu'à ce que l'un d'eux le valide.
   - Sèche-linge : les parents appuient sur « Lancé » ; les enfants peuvent sortir
     les serviettes, puis les plier et les ranger (tâches facultatives).
   - Étendage : les parents appuient sur « Linge étendu » ; chaque enfant voit
     « Récupérer mon linge sec » jusqu'à ce qu'il l'ait coché.
   Données : /house/<machine>/<champ> = "AAAA-MM-JJ HH:MM" (voir sync.js).
   Un déclencheur (parents) porte une valeur unique ; une validation (enfant)
   doit être EXACTEMENT égale au déclencheur en cours : la base le vérifie
   (database.rules.json). Une étape est « à faire » tant que la validation
   n'est pas égale au déclencheur : aucune comparaison d'horloges.
   Sans connexion à la base, rien de tout ça n'apparaît (les pages gardent
   leurs tâches habituelles). JavaScript ancien (ES5).
   ================================================================ */
(function(){
  "use strict";

  var C = window.Chores, S = window.Sync;
  if(!C || !S) return;

  var KIDS = ["jeremy", "liam", "nina"];
  var NAMES = {jeremy: "Jérémy", liam: "Liam", nina: "Nina"};

  function pad2(n){ return (n < 10 ? "0" : "") + n; }
  function fmt(d){
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function stampNow(){ return fmt(new Date()); }
  function plusMinute(st){
    var m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)$/.exec(st || "");
    if(!m) return stampNow();
    return fmt(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5] + 1));
  }
  function has(arr, x){ for(var i = 0; i < arr.length; i++){ if(arr[i] === x) return true; } return false; }
  // Un nouveau déclencheur ne doit jamais être égal à une valeur déjà utilisée (sinon l'étape paraîtrait déjà faite)
  function freshStamp(used){
    var n = stampNow(), guard = 0;
    while(guard++ < 10 && has(used, n)) n = plusMinute(n);
    return n;
  }
  // Une étape est à faire tant que sa validation n'est pas égale à son déclencheur
  function pending(trigger, ack){ return !!trigger && trigger !== ack; }

  function g(machine, field){ return S.get("house", machine, field) || null; }

  // « à 21:05 », « hier à 21:05 », « le 08/10 à 21:05 »
  function when(st){
    if(!st) return "";
    var d = st.slice(0, 10), hm = st.slice(11, 16), t = new Date(), y = new Date(t.getTime() - 86400000);
    if(d === fmt(t).slice(0, 10)) return "à " + hm;
    if(d === fmt(y).slice(0, 10)) return "hier à " + hm;
    return "le " + st.slice(8, 10) + "/" + st.slice(5, 7) + " à " + hm;
  }

  // ---- États ----
  function dishwasher(){
    var l = g("dishwasher", "launched"), e = g("dishwasher", "emptied");
    return {launched: l, emptied: e, active: pending(l, e)};
  }
  function dryer(){
    var l = g("dryer", "launched"), o = g("dryer", "out"), f = g("dryer", "folded");
    return {launched: l, out: o, folded: f, step1: pending(l, o), step2: pending(o, f)};
  }
  function rack(){
    var h = g("rack", "hung"), r = {hung: h, kids: {}, left: []}, i, v;
    for(i = 0; i < KIDS.length; i++){
      v = g("rack", KIDS[i]);
      r.kids[KIDS[i]] = {done: v, todo: pending(h, v)};
      if(r.kids[KIDS[i]].todo) r.left.push(KIDS[i]);
    }
    return r;
  }

  // La maison est « branchée » pour cet enfant : connecté, et l'état a déjà été reçu au moins une fois
  function live(child){ return !!(S.enabled && S.active(child) && S.houseKnown()); }

  function hid(m, f, ref){ return "maison_" + m + "_" + f + "_" + String(ref || "").replace(/\D/g, ""); }

  // ---- Tâches affichées aux enfants (bloc « Pour la maison ») ----
  // Aucune ne compte dans la barre de progression (house:true) ; seul le lave-vaisselle peut bloquer l'écran,
  // et seulement s'il a été lancé un jour précédent (la durée d'un cycle est inconnue).
  function tasks(child, restDay){
    var out = [], d = dishwasher(), y = dryer(), r = rack(), me = r.kids[child];
    if(d.active){
      out.push({block: "maison", emoji: "🍽️", label: "Vider le lave-vaisselle",
        note: "Lancé " + when(d.launched) + " · je le vide quand il est fini",
        gate: !restDay && d.launched.slice(0, 10) < stampNow().slice(0, 10),
        house: {m: "dishwasher", f: "emptied", ref: d.launched},
        id: hid("dishwasher", "emptied", d.launched)});
    }
    if(y.step1){
      out.push({block: "maison", emoji: "🧺", label: "Sortir les serviettes du sèche-linge",
        note: "Lancé " + when(y.launched) + " · quand il est arrêté",
        optional: true, gate: false, house: {m: "dryer", f: "out", ref: y.launched},
        id: hid("dryer", "out", y.launched)});
    }
    if(y.step2){
      out.push({block: "maison", emoji: "🗄️", label: "Plier les serviettes et les torchons, et les ranger",
        note: "Sortis du sèche-linge",
        optional: true, gate: false, house: {m: "dryer", f: "folded", ref: y.out},
        id: hid("dryer", "folded", y.out)});
    }
    if(me && me.todo){
      out.push({block: "maison", emoji: "🧦", label: "Récupérer mon linge sec sur l'étendage et le ranger",
        note: "Chaussettes, sous-vêtements, vêtements sur cintres · seulement ce qui est sec · étendu " + when(r.hung),
        gate: false, house: {m: "rack", f: child, ref: r.hung},
        id: hid("rack", child, r.hung)});
    }
    return out;
  }

  // Un enfant (ou un parent pour lui) a fait l'étape : la validation reprend la valeur du déclencheur
  function complete(task){
    var h = task && task.house;
    if(!h || !h.ref) return;
    S.setHouse(h.m, h.f, h.ref);
  }

  // ---- Tuiles des parents (page tablette / téléphone parent) ----
  function isParent(){
    var a = S.account();
    return !!(a && a.role === "famille");
  }
  function nameList(ids){
    var out = [], i;
    for(i = 0; i < ids.length; i++) out.push(NAMES[ids[i]]);
    return out.join(", ");
  }
  function tiles(){
    var d = dishwasher(), y = dryer(), r = rack(), out = [], i, done = [];

    var dtext = "Rien en cours";
    if(d.active) dtext = "Lancé " + when(d.launched) + " · à vider";
    else if(d.launched) dtext = "Vidé · lancé " + when(d.launched);
    out.push({key: "dishwasher", emoji: "🍽️", name: "Lave-vaisselle", busy: d.active, canGo: !d.active,
      text: dtext, label: "Lancé",
      go: function(){ S.setHouse("dishwasher", "launched", freshStamp([d.launched, d.emptied])); },
      fin: d.active ? {label: "✓ Vidé", fn: function(){ S.setHouse("dishwasher", "emptied", d.launched); }} : null,
      undo: d.active ? function(){ S.setHouse("dishwasher", "launched", null); } : null});

    var ytext = "Rien en cours", yfin = null;
    if(y.step1){
      ytext = "Lancé " + when(y.launched) + " · serviettes à sortir";
      yfin = {label: "✓ Sorties", fn: function(){ S.setHouse("dryer", "out", y.launched); }};
    } else if(y.step2){
      ytext = "Serviettes sorties · à plier et ranger";
      yfin = {label: "✓ Rangées", fn: function(){ S.setHouse("dryer", "folded", y.out); }};
    } else if(y.launched){
      ytext = "Tout rangé · lancé " + when(y.launched);
    }
    out.push({key: "dryer", emoji: "🧺", name: "Sèche-linge", busy: y.step1 || y.step2, canGo: !y.step1,
      text: ytext, label: "Lancé",
      go: function(){ S.setHouse("dryer", "launched", freshStamp([y.launched, y.out, y.folded])); },
      fin: yfin,
      undo: y.step1 ? function(){ S.setHouse("dryer", "launched", null); } : null});

    var rtext = "Rien à l'étendage", used = [r.hung];
    for(i = 0; i < KIDS.length; i++){
      used.push(r.kids[KIDS[i]].done);
      if(r.hung && !r.kids[KIDS[i]].todo) done.push(KIDS[i]);
    }
    if(r.hung){
      if(r.left.length === 0) rtext = "Étendu " + when(r.hung) + " · tout le monde a récupéré";
      else rtext = "Étendu " + when(r.hung) + " · à récupérer : " + nameList(r.left) + (done.length ? " · fait : " + nameList(done) : "");
    }
    out.push({key: "rack", emoji: "👕", name: "Étendage", busy: r.left.length > 0, canGo: true,
      text: rtext, label: "Linge étendu",
      go: function(){ S.setHouse("rack", "hung", freshStamp(used)); },
      fin: null,
      undo: r.left.length > 0 ? function(){ S.setHouse("rack", "hung", null); } : null});
    return out;
  }

  // Empreinte de tout l'état (pour ne redessiner que si quelque chose a changé)
  function sig(){
    var out = [], m = {dishwasher: ["launched", "emptied"], dryer: ["launched", "out", "folded"], rack: ["hung", "jeremy", "liam", "nina"]}, k, i;
    for(k in m){ if(m.hasOwnProperty(k)){ for(i = 0; i < m[k].length; i++) out.push(g(k, m[k][i]) || ""); } }
    return out.join("|");
  }

  window.House = {
    live: live,
    tasks: tasks,
    complete: complete,
    tiles: tiles,
    isParent: isParent,
    known: function(){ return S.houseKnown(); },
    sig: sig
  };
})();
