/* ================================================================
   Cœur commun (pages enfant + tablette) : calendrier, liste des
   tâches du jour, mémorisation des coches (Firebase via sync.js si
   l'appareil est connecté, sinon sur l'appareil).
   Écrit en JavaScript ancien (ES5) pour tourner sur un vieil iPad
   (pas de fetch, padStart, URLSearchParams, AbortController...).
   ================================================================ */
(function(){
  "use strict";

  var VERSION = "v2";   // v2 : identifiants de tâche stables (ne dépendent plus de la position)
  var DAY_NAMES = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  var MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  // ---- Règles de la maison (communes à tous) ----
  var RULES = [
    {b:"📵", t:"À 19 h, plus d'écran.", hard:true},
    {b:"🛏️", t:"Au lit à 20h30 (lecture 30 min). À 21h, lumière éteinte — même si on a pris du retard.", hard:true},
    {b:"🚰", t:"Je vérifie si le lave-vaisselle est sale avant de mettre quelque chose dans l'évier."},
    {b:"🍽️", t:"Je nettoie bien la table quand j'ai fini de manger."},
    {b:"🧺", t:"Je mets mes affaires sales dans la panière à linge sale."},
    {b:"👟", t:"Quand je rentre, je range mes chaussures dans le meuble à chaussures."}
  ];

  // gate = les tâches du bloc doivent être faites avant d'avoir droit aux écrans
  // (sauf « Avant 19 h » le mercredi et le week-end, jours de repos : voir buildTasks)
  var BLOCKS = [
    // État de la maison (lave-vaisselle, sèche-linge, étendage) : voir house.js ; n'apparaît que s'il y a quelque chose à faire
    {key:"maison",    emoji:"🏡", title:"Pour la maison", sub:"",                     gate:false},
    {key:"matin",    emoji:"☀️", title:"Le matin",       sub:"",                     gate:true},
    {key:"rentrant", emoji:"🏠", title:"En rentrant",    sub:"après l'école",        gate:true},
    {key:"apprendre",emoji:"📖", title:"Apprendre et lire", sub:"",                     gate:true},
    {key:"menage",   emoji:"🧹", title:"Ménage chambre", sub:"",                     gate:true},
    {key:"sport",    emoji:"💪", title:"Sport",          sub:"",                     gate:true},
    {key:"avant19",  emoji:"🚿", title:"Avant 19 h",     sub:"entre 18 h et 19 h", gate:true},
    {key:"soir",     emoji:"🌙", title:"Le soir",        sub:"",                     gate:false}
  ];
  function blockInfo(key){ for(var i=0;i<BLOCKS.length;i++){ if(BLOCKS[i].key===key) return BLOCKS[i]; } return null; }

  // ---- Vacances zone A (Grenoble) : repli si l'open data est injoignable ----
  var VAC_FALLBACK = [
    ["2025-10-18","2025-11-02"],["2025-12-20","2026-01-04"],["2026-02-07","2026-02-22"],
    ["2026-04-04","2026-04-19"],["2026-07-04","2026-08-31"],["2026-10-17","2026-11-01"],
    ["2026-12-19","2027-01-03"],["2027-02-13","2027-02-28"],["2027-04-10","2027-04-25"],
    ["2027-07-03","2027-08-31"]
  ];
  var VAC = VAC_FALLBACK.slice();

  function pad2(n){ return (n<10?"0":"")+n; }
  function ymd(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
  function addDays(d,n){ var x=new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }
  function dateKey(d){ return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }

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
  function holidayName(d){
    var Y=d.getFullYear(), key=pad2(d.getMonth()+1)+"-"+pad2(d.getDate());
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

  function dayState(d, cfg){
    var weekdays=(cfg&&cfg.schoolWeekdays)||[1,2,4,5];
    if(inVacances(d)) return {key:"vac", val:"Vacances 🏖️", school:false};
    var hn=holidayName(d);
    if(hn) return {key:"ferie", val:"Férié 🎉", school:false, name:hn};
    var dow=d.getDay();
    if(weekdays.indexOf(dow)!==-1) return {key:"school", val:"École ✏️", school:true};
    if(dow===0||dow===6) return {key:"weekend", val:"Week-end 🏠", school:false};
    return {key:"off", val:"Pas d'école 🏠", school:false};
  }

  // ---- Date « maintenant » (?date=2026-10-07&time=17:30 pour tester) ----
  function qs(name){
    var m=new RegExp("[?&]"+name+"=([^&]*)").exec(location.search);
    return m?decodeURIComponent(m[1]):null;
  }
  function now(){
    var ds=qs("date");
    if(ds){
      var p=ds.split("-");
      if(p.length===3){
        var h=8, mi=0, tm=qs("time");
        if(tm){ var q=tm.split(":"); h=parseInt(q[0],10)||0; mi=parseInt(q[1],10)||0; }
        var d=new Date(+p[0], +p[1]-1, +p[2], h, mi, 0);
        if(!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  }
  function isoWeekKey(d){
    var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    var day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
    var ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));
    var w=Math.ceil((((t-ys)/86400000)+1)/7);
    return t.getUTCFullYear()+"-W"+w;
  }

  // Jours de repos (mercredi, samedi, dimanche) : « Avant 19 h » ne conditionne pas les écrans
  function isRestDay(d){ var w=d.getDay(); return w===3||w===0||w===6; }

  // ---- Construction des tâches du jour ----
  function buildTasks(cfg, today, tomorrow){
    var dow=today.getDay();
    var st=dayState(today,cfg), stm=dayState(tomorrow,cfg);
    var school=st.school, schoolT=stm.school;
    var isWed=(dow===3), isWeekend=(dow===0||dow===6);
    var restDay=isRestDay(today);   // jours de repos : « Avant 19 h » ne conditionne pas les écrans
    var hairDays=cfg.hairDays||[3,0];
    var t=[];

    function visExtra(x){
      if(x.days && x.days.indexOf(dow)===-1) return false;
      if(x.schoolOnly && !school) return false;
      if((x.weekendOnly || x.scope==="weekend") && !isWeekend) return false;   // scope "weekend" = 1 fois samedi OU dimanche
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
    t.push({block:"matin", emoji:"🧼", label:"Faire ma toilette", note: cfg.toiletteNote || "Me laver les mains et le visage + mettre du déo"});
    t.push({block:"matin", emoji:"👕", label:"M'habiller"});
    t.push({block:"matin", emoji:"🥣", label:"Préparer mon petit-déj"});
    t.push({block:"matin", emoji:"🍞", label:"Manger mon petit-déj"});
    t.push({block:"matin", emoji:"🍽️", label:"Débarrasser mon petit-déj"});
    t.push({block:"matin", emoji:"🧽", label:"Nettoyer ma place à table"});
    t.push({block:"matin", emoji:"🪥", label:"Me brosser les dents", note:"3 minutes, avec le chrono", href:"guide.html?g=dents_matin&kid="+cfg.key, linkLabel:"▶ Lancer le chrono 3 min"});
    t.push({block:"matin", emoji:"💇", label:"Me coiffer"});
    if(school) t.push({block:"matin", emoji:"🎒", label:"Prendre mon sac d'école"});

    // EN RENTRANT (jours d'école)
    if(school){
      t.push({block:"rentrant", emoji:"📚", label:"Faire mes devoirs"});
      pushExtras(cfg.afterSchoolExtra, "rentrant");
    }

    // APPRENDRE ET LIRE (tous les jours) — le week-end, révisions + dictée avec Papa
    if(isWeekend){
      t.push({block:"apprendre", emoji:"📖", label:cfg.poetry?"Réviser mes leçons et/ou ma poésie":"Réviser mes leçons",
        note:cfg.poetry?"Poésie : je relis ce que je sais + j'apprends au moins 2 lignes de plus":undefined});
      t.push({block:"apprendre", emoji:"✍️", label:"Faire ma dictée avec Papa"});
    } else if(cfg.poetry){
      t.push({block:"apprendre", emoji:"📖", label:"Réviser ma poésie (ou, s'il n'y en a pas, une de mes leçons)", note:"Poésie : je relis ce que je sais + j'apprends au moins 2 lignes de plus"});
    }
    t.push({block:"apprendre", emoji:"📚", label:"Lire au moins une page de mon livre"});

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
      t.push({block:"menage", emoji:"🗑️", label:"Vider la corbeille de ma chambre", note:"1 fois ce week-end", scope:"weekend"});
      t.push({block:"menage", emoji:"🪟", label:"Nettoyer ma fenêtre (à l'intérieur seulement)", note:"1 fois ce week-end · jamais l'extérieur", scope:"weekend", href:"guide.html?g=fenetre&kid="+cfg.key, linkLabel:"▶ Voir comment faire"});
      if(cfg.managedBy) t.push({block:"menage", emoji:"💬", label:"Écouter le retour de "+cfg.managedBy.name+" sur ma fenêtre", note:"Il est mon manager : je corrige ce qu'il me montre", scope:"weekend"});
      if(cfg.manages) t.push({block:"menage", emoji:"🧑‍🏫", label:"Vérifier la fenêtre de "+cfg.manages.name+" (je suis son manager)", note:"Après que "+cfg.manages.name+" a fini : je contrôle, puis je lui fais mon retour", scope:"weekend", href:"guide.html?g=verif&kid="+cfg.key+"&of="+cfg.manages.key, linkLabel:"▶ Voir quoi vérifier"});
    }

    // SPORT : circuit du jour (ouvre la page d'exercices de l'enfant)
    var sp=cfg.sport||{};
    var sportMust=(dow===3||dow===0);   // obligatoire : mercredi et dimanche
    t.push({block:"sport", emoji:"🏋️", label:"Mon circuit sport du jour",
      note:(sp.rounds||5)+" tours × "+(sp.reps||10)+" de chaque exercice · planche "+(sp.plankSets||3)+" × "+(sp.plankSec||45)+" s · "+(sp.jjSets||3)+" × "+(sp.jjReps||10)+" jumping jacks"+(sportMust?"":" · si j'en ai envie"),
      optional:!sportMust,
      href:"sport.html?kid="+cfg.key, linkLabel:"▶ Voir les exercices"});
    if(isWeekend) t.push({block:"sport", emoji:"🏃", label:"Bouger dehors en plus", note:"Bouger pour de vrai (vélo, foot, balade active...) · si j'en ai envie", optional:true});
    pushExtras(cfg.sportExtra, "sport");

    // AVANT 19 H : douche (+ cheveux), entre 18 h et 19 h
    if(cfg.showerLead) t.push({block:"avant19", emoji:"📋", label:"Choisir l'ordre de passage à la douche", note:"Je décide qui passe en premier, en deuxième et en troisième"});
    t.push({block:"avant19", emoji:"🚿", label:"Prendre ma douche", note:"Avant 19 h · quand j'ai fini, je préviens le suivant"});
    if(cfg.showerLead) t.push({block:"avant19", emoji:"👀", label:"Vérifier que tout le monde suit le passage", note:"Chacun prévient le suivant, personne ne traîne : tout fini avant 19 h"});
    if(hairDays.indexOf(dow)!==-1) t.push({block:"avant19", emoji:"🧴", label:"Me laver les cheveux"});
    if(cfg.keepClothes){
      t.push({block:"avant19", emoji:"🛌", label:"Me mettre en pyjama", note:"T-shirt, sous-vêtements et chaussettes dans le linge sale. Je GARDE mon pull et mon pantalon pour demain."});
      t.push({block:"avant19", emoji:"👚", label:"Préparer mes vêtements pour demain", note:"Pull et pantalon d'aujourd'hui + t-shirt, sous-vêtements et chaussettes propres"});
    } else {
      t.push({block:"avant19", emoji:"🛌", label:"Me mettre en pyjama", note:"Mes vêtements du jour dans le linge sale"});
      t.push({block:"avant19", emoji:"👚", label:"Préparer mes vêtements pour demain"});
    }

    // Tant que l'état de la maison n'est pas branché, la tâche habituelle reste ; ensuite c'est le bouton « Lancé » des parents qui la déclenche
    if(!houseLive(cfg.key)) t.push({block:"avant19", emoji:"🍽️", label:"Vider le lave-vaisselle", note:"D'abord je vérifie qu'il est propre. Si je ne sais pas, j'envoie un SMS pour demander si je dois le faire."});

    t.push({block:"avant19", emoji:"👟", label:"Je vérifie que mes chaussures sont bien rangées dans le meuble à chaussures"});

    // LE SOIR (tous les jours) — cuisine/tâches d'abord, puis coucher
    pushExtras(cfg.eveningExtra, "soir");
    t.push({block:"soir", emoji:"✨", label:"Ranger ma chambre"});
    t.push({block:"soir", emoji:"⏱️", label:"Me brosser les dents en grand", note:"3 min à la main + 2 min à la brosse électrique", href:"guide.html?g=dents_soir&kid="+cfg.key, linkLabel:"▶ Lancer le chrono 3 + 2 min"});
    t.push({block:"soir", emoji:"🫧", label:"Faire mon bain de bouche", note:"Après le brossage"});
    t.push({block:"soir", emoji:"📱", label:"Brancher mon téléphone en charge"});
    t.push({block:"soir", emoji:"🔌", label:"Brancher mon ordi, ma souris et mes consoles en charge"});
    if(schoolT) t.push({block:"soir", emoji:"⏰", label:"Mettre mon réveil à 6h45 (au plus tard)"}); // veille d'école seulement
    if(schoolT) t.push({block:"soir", emoji:"🎒", label:"Préparer mon sac pour demain"});
    t.push({block:"soir", emoji:"🚻", label:"Aller aux toilettes avant de me coucher"});

    // Identifiant stable : bloc + libellé (le même samedi et dimanche, sur tous les appareils)
    var seen={};
    t.forEach(function(task){
      task.scope=task.scope||"daily";
      task.gate=!!blockInfo(task.block).gate && !task.optional && !(restDay && task.block==="avant19");
      var id=task.block+"_"+task.label.replace(/[^a-zA-Z0-9]/g,"").slice(0,40);
      seen[id]=(seen[id]||0)+1;
      task.id=seen[id]>1?id+"_"+seen[id]:id;
    });
    return t;
  }

  // ---- Mémorisation des coches ----
  // Valeur d'une coche = "AAAA-MM-JJ HH:MM" (jour et heure où elle a été cochée).
  // Période : le jour, ou le week-end entier pour les tâches « 1 fois ce week-end ».
  function periodKey(task, today){ return task.scope==="weekend" ? weekendKey(today) : ymd(today); }
  function weekendKey(d){ return "WE-"+isoWeekKey(d); }
  function stamp(today, real){ var n=real?new Date():now(); return ymd(today)+" "+pad2(n.getHours())+":"+pad2(n.getMinutes()); }
  // En mode test (?date=…), version "v2t" : jamais envoyées à la base, effacées au chargement normal suivant
  function storageKey(child, task, today){ return "chores:"+child+":"+VERSION+(qs("date")?"t":"")+":"+periodKey(task,today)+":"+task.id; }
  // Mode test (?date=…) : coches gardées sur l'appareil, pour ne pas écrire de fausses dates dans la base
  // (sauf &sync=1 sur un serveur local, pour tester la synchro elle-même).
  var LOCALHOST=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function testSync(){ return LOCALHOST && qs("sync")==="1"; }
  function synced(child){ return !!(window.Sync && window.Sync.active(child)) && (!qs("date") || testSync()); }

  // L'état de la maison est branché pour cet enfant (connecté + déjà reçu au moins une fois)
  function houseLive(child){
    return !!(child && window.House && synced(child) && window.House.live(child));
  }

  function doneValue(child, task, today){
    if(task.house) return null;   // tâche de la maison : « à faire » tant que l'état le demande, elle disparaît ensuite
    if(synced(child)) return window.Sync.get(periodKey(task,today), child, task.id);
    try{ return localStorage.getItem(storageKey(child,task,today)); }catch(e){ return null; }
  }
  function isDone(child, task, today){ return !!doneValue(child,task,today); }
  function setDone(child, task, today, v){
    if(task.house){ if(v && window.House) window.House.complete(task); return; }
    if(synced(child)){ window.Sync.set(periodKey(task,today), child, task.id, v?stamp(today,!qs("date")):null); return; }
    var val=v?stamp(today):null;
    try{ if(val) localStorage.setItem(storageKey(child,task,today),val); else localStorage.removeItem(storageKey(child,task,today)); }catch(e){}
  }

  // Tâches à afficher : une tâche « 1 fois ce week-end » faite samedi disparaît dimanche.
  function visibleTasks(child, cfg, today, tomorrow){
    var td=ymd(today);
    var list=buildTasks(cfg,today,tomorrow).filter(function(t){
      if(t.scope!=="weekend") return true;
      var v=doneValue(child,t,today);
      return !(v && String(v).slice(0,10)<td);
    });
    if(houseLive(child)) list=window.House.tasks(child, isRestDay(today)).concat(list);
    return list;
  }

  // La page déclare les enfants qu'elle affiche : reçoit les coches des autres appareils en direct.
  function watch(kids, today, onChange){
    var dow=today.getDay(), ps=[ymd(today)];
    if(dow===0||dow===6) ps.push(weekendKey(today));
    var test=!!qs("date"), uploaded=!!test;
    if(window.Sync && (!test || testSync())){
      window.Sync.watch(ps, kids, function(){
        if(!uploaded && window.Sync.ready()){ uploaded=true; uploadLocal(ps, kids); }
        if(onChange) onChange();
      });
    }
    if(!test) pruneLocal(ps);   // mode test : on ne fait pas le ménage du vrai jour
  }
  // Coches faites sur l'appareil avant sa connexion : envoyées à la base, puis retirées de l'appareil
  function uploadLocal(ps, kids){
    try{
      var moves=[], i, k, p;
      for(i=0;i<localStorage.length;i++){
        k=localStorage.key(i);
        if(!k || k.indexOf("chores:")!==0) continue;
        p=k.split(":");   // chores:<enfant>:<version>:<période>:<tâche>
        if(p.length===5 && p[2]===VERSION && ps.indexOf(p[3])!==-1 && kids.indexOf(p[1])!==-1 && synced(p[1])) moves.push(p.concat([k]));
      }
      for(i=0;i<moves.length;i++){
        var m=moves[i], v=localStorage.getItem(m[5]);
        if(v && !window.Sync.get(m[3], m[1], m[4])) window.Sync.set(m[3], m[1], m[4], v);
        localStorage.removeItem(m[5]);
      }
    }catch(e){}
  }
  // Ménage du stockage de l'appareil : on ne garde que les coches du jour / du week-end en cours
  function pruneLocal(ps){
    try{
      var drop=[], i, k, p;
      for(i=0;i<localStorage.length;i++){
        k=localStorage.key(i);
        if(!k || k.indexOf("chores:")!==0) continue;
        p=k.split(":");
        if(p[2]!==VERSION || ps.indexOf(p[3])===-1) drop.push(k);
      }
      for(i=0;i<drop.length;i++) localStorage.removeItem(drop[i]);
    }catch(e){}
  }

  // Petit message d'état de la synchro (null = rien à signaler)
  function syncBadge(child){
    if(window.LOAD_FAILED && (!window.Sync || !window.Sync.enabled)) return {k:"warn", t:"⚠️ La synchro n'a pas pu se charger : recharge la page.", link:location.pathname.split("/").pop()+location.search, lt:"Recharger"};
    if(!window.Sync) return null;
    var st=window.Sync.state(child), n=st.n;
    var who=st.role==="famille"?"toute la famille":((window.CHILDREN||{})[st.role]||{}).name||st.role;
    if(st.k==="out") return {k:"warn", t:"🔒 Appareil pas connecté : les coches restent sur cet appareil.", link:"connexion.html", lt:"Connecter"};
    if(st.k==="other") return {k:"warn", t:"🔒 Cet appareil est connecté pour "+who+" : cette page n'est pas partagée.", link:"connexion.html", lt:"Changer"};
    if(st.k==="denied") return {k:"warn", t:"⛔ La base refuse l'accès à cet appareil.", link:"connexion.html", lt:"Reconnecter"};
    if(st.k==="config") return {k:"warn", t:"⚙️ Réglage Firebase à revoir (clé API) : les coches attendent sur l'appareil."+(n?" ("+n+")":"")};
    if(st.k==="offline") return {k:"info", t:"📴 Pas de réseau"+(n?" : "+(n>1?n+" coches partiront":"1 coche partira")+" dès que possible.":".")};
    return null;
  }

  // ---- Petit GET JSON sans fetch ----
  function getJSON(url, ms, ok, ko){
    try{
      var x=new XMLHttpRequest();
      x.open("GET",url,true);
      x.timeout=ms;
      x.onload=function(){ var j; try{ j=JSON.parse(x.responseText); }catch(e){ if(ko) ko(); return; } ok(j); };
      x.onerror=function(){ if(ko) ko(); };
      x.ontimeout=function(){ if(ko) ko(); };
      x.send();
    }catch(e){ if(ko) ko(); }
  }

  // ---- Mise à jour auto des vacances via open data officiel (Grenoble) ----
  var VAC_CACHE_KEY="vacCacheGrenoble";
  function localYMD(dt){
    try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(dt); }
    catch(e){ return ymd(dt); }
  }
  function rangesFromRecords(recs){
    var out=[];
    recs.forEach(function(r){
      if(!r.description) return;
      if(!(/vacances/i.test(r.description) || /pont/i.test(r.description))) return;
      if(r.population==="Enseignants") return;
      if(!r.start_date || !r.end_date) return;
      var s=new Date(r.start_date), e=new Date(r.end_date);
      if(isNaN(s.getTime())||isNaN(e.getTime())) return;
      if(e-s <= 0) return;
      out.push([localYMD(s), localYMD(addDays(e,-1))]);
    });
    return out;
  }
  function useVac(ranges, onUpdate){
    if(ranges && ranges.length>=4){ VAC=VAC_FALLBACK.concat(ranges); if(onUpdate) onUpdate(); }
  }
  function refreshVac(onUpdate){
    var cached=null;
    try{ cached=JSON.parse(localStorage.getItem(VAC_CACHE_KEY)||"null"); }catch(e){}
    if(cached && cached.ranges){ useVac(cached.ranges,onUpdate); }
    if(cached && (Date.now()-cached.ts < 45*86400000)) return;
    var url="https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=80&order_by="+encodeURIComponent("start_date desc")+"&where="+encodeURIComponent('location="Grenoble"');
    getJSON(url,6000,function(j){
      var ranges=rangesFromRecords(j.results||[]);
      if(ranges.length>=4){
        try{ localStorage.setItem(VAC_CACHE_KEY, JSON.stringify({ts:Date.now(), ranges:ranges})); }catch(e){}
        useVac(ranges,onUpdate);
      }
    });
  }


  // ---- Météo (Chindrieux 73310) via Open-Meteo, sans clé API ----
  var WX_LAT=45.81948, WX_LON=5.85024, WX_CACHE="wxChindrieux3";
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
  function wxHint(d){
    if(wxSnow(d.code)) return "Neige ❄️ — habille-toi très chaud + bottes.";
    var tmax=d.tmax, h;
    if(tmax<5) h="Très froid 🥶 — gros manteau, bonnet, gants.";
    else if(tmax<12) h="Froid 🧥 — manteau + pull.";
    else if(tmax<18) h="Frais — pull ou veste.";
    else if(tmax<25) h="Doux 👕 — t-shirt + une petite veste.";
    else h="Chaud ☀️ — t-shirt, short, pense à boire.";
    if(d.am!=null && d.pm!=null && Math.abs(d.pm-d.am)>=8) h+=" Grosse différence entre le matin et l'après-midi : habille-toi en couches.";
    if(wxRainy(d.code,d.p,d.sum)) h+=" ☔ Et prends un k-way, il peut pleuvoir.";
    return h;
  }
  function num(x){ var n=parseFloat(x); return isNaN(n)?null:Math.round(n*10)/10; }
  // transforme la réponse Open-Meteo en une liste de jours (aujourd'hui, demain)
  function wxDays(j){
    var d=j.daily, hr=j.hourly||{}, out=[], i;
    for(i=0;i<d.time.length;i++){
      var t=hr.temperature_2m;
      out.push({
        code:+d.weather_code[i],
        tmax:Math.round(d.temperature_2m_max[i]), tmin:Math.round(d.temperature_2m_min[i]),
        p:num(d.precipitation_probability_max&&d.precipitation_probability_max[i]),
        sum:num(d.precipitation_sum&&d.precipitation_sum[i]),
        am:(t&&t[i*24+8]!=null)?Math.round(t[i*24+8]):null,
        pm:(t&&t[i*24+15]!=null)?Math.round(t[i*24+15]):null
      });
    }
    return out;
  }
  function loadWeather(dayKey, cb){
    try{ var cc=JSON.parse(localStorage.getItem(WX_CACHE)||"null");
      if(cc && cc.day===dayKey && (Date.now()-cc.ts<3*3600000)){ cb(cc.days); return; } }catch(e){}
    var url="https://api.open-meteo.com/v1/forecast?latitude="+WX_LAT+"&longitude="+WX_LON+
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum"+
      "&hourly=temperature_2m&timezone=Europe%2FParis&forecast_days=2";
    getJSON(url,7000,function(j){
      if(j&&j.daily&&j.daily.time&&j.daily.time.length){
        var days=wxDays(j);
        try{ localStorage.setItem(WX_CACHE, JSON.stringify({ts:Date.now(), day:dayKey, days:days})); }catch(e){}
        cb(days);
      } else { cb(null); }
    },function(){ cb(null); });
  }
  // HTML de la carte météo (aujourd'hui + demain, matin / après-midi, conseil pour demain)
  function renderWeather(days){
    function cell(d,when){
      var w=wxInfo(d.code);
      var rain=wxRainy(d.code,d.p,d.sum)?(' · ☔ '+(d.p!=null?d.p+'%':'pluie')):'';
      var split=(d.am!=null&&d.pm!=null)?('<span class="wx-split">Matin <b>'+d.am+'°</b> · Après-midi <b>'+d.pm+'°</b></span>'):('<span class="wx-temp">'+d.tmax+'° / '+d.tmin+'°</span>');
      return '<div class="wx-cell"><span class="wx-when">'+when+'</span><span class="wx-emoji">'+w.e+'</span>'+split+
        '<span class="wx-extra">'+w.l+rain+'</span></div>';
    }
    var hasTom=days.length>1, tom=hasTom?days[1]:days[0];
    return '<div class="wx-title">🌤️ La météo pour s\'habiller</div>'+
      '<div class="wx-row">'+cell(days[0],"Aujourd'hui")+(hasTom?cell(days[1],"Demain"):'')+'</div>'+
      '<div class="wx-hint">👕 <b>Demain</b> : '+wxHint(tom)+'</div>';
  }

  // ---- Feu écran + bandeau horaire (communs tablette et téléphone) ----
  function screenStatus(h, gateLeft){
    if(h>=19) return {k:"off", t:"📵 Plus d'écran", s:"Il est 19 h passées"+(gateLeft>0?" — il restait "+gateLeft+" tâche"+(gateLeft>1?"s":""):"")};
    if(gateLeft>0){
      var s="Encore "+gateLeft+" tâche"+(gateLeft>1?"s":"")+" à faire";
      if(h>=18) s+=" — fin à 19 h (encore "+Math.round((19-h)*60)+" min)";
      return {k:"red", t:"⛔ Pas encore d'écran", s:s};
    }
    return {k:"green", t:"✅ Écran OK", s:"Jusqu'à 19 h"};
  }
  function timeBanner(h, rest){
    if(h>=21) return {k:"warn", t:"🌙 Lumière éteinte"};
    if(h>=20.5) return {k:"warn", t:"🛏️ Au lit — lecture 30 min"};
    if(h>=19) return {k:"warn", t:"📵 Plus d'écran"};
    if(h>=18) return {k:"info", t:rest?"🚿 18 h-19 h : douche, pyjama et vêtements avant 19 h":"🚿 18 h-19 h : douche, pyjama et vêtements, puis écran jusqu'à 19 h"};
    return null;
  }

  // ---- Lien vers une page d'exercices, avec retour automatique ----
  function dateParams(){
    var d=qs("date"), t=qs("time"), sy=qs("sync"), x="";
    if(d) x+="&date="+encodeURIComponent(d);
    if(t) x+="&time="+encodeURIComponent(t);
    if(sy) x+="&sync="+encodeURIComponent(sy);
    return x;
  }
  function linkTo(href, back){
    var page=location.pathname.split("/").pop()||"index.html";
    return href+"&back="+encodeURIComponent(back||(page+location.search))+dateParams();
  }

  window.Chores = {
    DAY_NAMES:DAY_NAMES, MONTHS:MONTHS, RULES:RULES, BLOCKS:BLOCKS,
    now:now, addDays:addDays, dateKey:dateKey, pad2:pad2, ymd:ymd,
    dayState:dayState, vacName:vacName, buildTasks:buildTasks, visibleTasks:visibleTasks, isRestDay:isRestDay, houseLive:houseLive,
    isDone:isDone, setDone:setDone, doneValue:doneValue, watch:watch, syncBadge:syncBadge,
    getJSON:getJSON, refreshVac:refreshVac,
    loadWeather:loadWeather, renderWeather:renderWeather,
    screenStatus:screenStatus, timeBanner:timeBanner,
    linkTo:linkTo, dateParams:dateParams, qs:qs, storageKey:storageKey
  };
})();
