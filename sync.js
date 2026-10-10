/* ================================================================
   Synchronisation des coches entre appareils (Firebase Realtime Database)
   - Sans SDK Firebase : appels REST en XMLHttpRequest + EventSource,
     en JavaScript ancien (ES5) pour le vieil iPad (pas de fetch ni Promise).
   - Aucun mot de passe stocké : l'appareil ne garde que son jeton de
     renouvellement (localStorage de l'appareil, jamais dans le dépôt).
   - Chaque coche est mise en file d'attente sur l'appareil puis envoyée :
     hors connexion, elle part dès que le réseau revient.
   - Sans configuration (firebase-config.js vide) : Sync.enabled = false
     et chores-core.js garde les coches sur l'appareil, comme avant.
   Données : /done/<période>/<enfant>/<tâche> = "AAAA-MM-JJ HH:MM"
             (période = "AAAA-MM-JJ" ou "WE-AAAA-Wnn" pour le week-end)
   Maison  : /house/<machine>/<champ> = "AAAA-MM-JJ HH:MM" (lave-vaisselle, sèche-linge,
             étendage) : état partagé, lisible par tous les comptes (voir house.js)
   Droits  : /members/<uid> = "jeremy" | "liam" | "nina" | "famille"
             (écrit à la main dans la console Firebase, jamais par l'appli)
   ================================================================ */
(function(){
  "use strict";

  var CFG = window.FIREBASE_CONFIG || {};
  var ENABLED = !!(CFG.apiKey && CFG.databaseURL);
  var API_KEY = CFG.apiKey || "";
  var DB = String(CFG.databaseURL || "").replace(/\/+$/, "");
  // authBase / tokenBase : faux serveur de test, pris en compte seulement en local
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var AUTH_BASE = (LOCAL && CFG.authBase) || "https://identitytoolkit.googleapis.com/v1";
  var TOKEN_BASE = (LOCAL && CFG.tokenBase) || "https://securetoken.googleapis.com/v1";
  var ROLES = ["jeremy", "liam", "nina", "famille"];

  var AUTH_K = "maison:auth", PENDING_K = "maison:pending", CACHE_K = "maison:cache:",
      POLL_K = "maison:poll", EMAIL_K = "maison:lastEmail";

  // ---- Petits outils ----
  function load(k){ try{ return JSON.parse(localStorage.getItem(k) || "null"); }catch(e){ return null; } }
  function save(k, v){
    try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e){ return false; }
  }
  function has(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function copy(v){ return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function indexOf(arr, x){ for(var i = 0; i < arr.length; i++){ if(arr[i] === x) return i; } return -1; }
  function isEmpty(o){ for(var k in o){ if(has(o, k)) return false; } return true; }
  function hidden(){ return !!document.hidden; }

  // Requête HTTP : cb(status, json, texte) — status 0 = réseau injoignable
  function req(method, url, body, type, ms, cb){
    var done = false;
    function end(st, j, t){ if(done) return; done = true; cb(st, j, t || ""); }
    try{
      var x = new XMLHttpRequest();
      x.open(method, url, true);
      x.timeout = ms || 15000;
      if(body != null) x.setRequestHeader("Content-Type", type || "application/json");
      x.onload = function(){
        var j = null, t = x.responseText || "", st = x.status;
        try{ j = t ? JSON.parse(t) : null; }catch(e){ if(st >= 200 && st < 300) st = 0; }   // page HTML d'un portail Wi-Fi : pas la base
        end(st, j, t);
      };
      x.onerror = function(){ end(0, null); };
      x.ontimeout = function(){ end(0, null); };
      x.send(body == null ? null : body);
    }catch(e){ end(0, null); }
  }
  // Code d'erreur Google (« INVALID_LOGIN_CREDENTIALS », « API key not valid… »)
  function errText(j, t){
    var e = j && j.error, out = String((e && (e.message || e)) || t || "");
    if(e && e.status) out += " " + e.status;
    if(e && e.details instanceof Array){ for(var i = 0; i < e.details.length; i++){ if(e.details[i] && e.details[i].reason) out += " " + e.details[i].reason; } }
    return out;
  }

  // ---- Compte de l'appareil ----
  function roleOk(r){ return indexOf(ROLES, r) !== -1; }
  function readAuth(){ var a = ENABLED ? load(AUTH_K) : null; return (a && a.refresh && a.uid) ? a : null; }
  var auth = readAuth();          // {uid, email, refresh, token, exp, role}
  var denied = false, netDown = false, configErr = false, connSince = 0;
  // Jeton refusé par la base : gardé à part (le stockage, relu souvent, contient encore l'ancien)
  var badToken = null;
  function dropToken(){ if(auth && auth.token) badToken = auth.token; }

  // Le stockage fait foi : un autre onglet a pu déconnecter l'appareil ou changer de compte.
  function syncAuth(){
    var s = readAuth();
    if(!s){ if(auth){ auth = null; stopStreams(); notify(); } return; }
    if(!auth || s.uid !== auth.uid || s.role !== auth.role){ location.reload(); return; }
    auth = s;
  }
  function signedIn(){ return !!(ENABLED && auth && roleOk(auth.role)); }
  function canAccess(kid){ return signedIn() && (auth.role === "famille" || auth.role === kid); }

  // Réponses du renouvellement qui veulent dire « ce compte n'a plus accès »
  var REVOKED = /TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN|MISSING_REFRESH_TOKEN|INVALID_GRANT_TYPE/;
  // Réglage Firebase à revoir (clé API restreinte, autre projet…) : on garde tout et on réessaie
  var CONFIG = /API key|API_KEY|referer|PERMISSION_DENIED|PROJECT_NUMBER_MISMATCH|CONFIGURATION_NOT_FOUND|are blocked|has not been used|SERVICE_DISABLED/i;

  function forget(){
    auth = null; inflight = null; tree = {}; knownHouse = false;
    save(AUTH_K, null); writeQ([]); pruneCache([]);
    stopStreams(); notify();
  }

  // Jeton valide (renouvelé si besoin) : cb(erreur, jeton) — erreur "out", "net" ou "config"
  var waiting = [], refreshing = false;
  function withToken(cb, force){
    syncAuth();
    if(!auth){ cb("out"); return; }
    if(!force && auth.token && auth.token !== badToken && auth.exp - Date.now() > 120000){ cb(null, auth.token); return; }
    waiting.push(cb);
    if(refreshing) return;
    refreshing = true;
    var ref = auth.refresh, uid = auth.uid;
    req("POST", TOKEN_BASE + "/token?key=" + encodeURIComponent(API_KEY),
      "grant_type=refresh_token&refresh_token=" + encodeURIComponent(ref),
      "application/x-www-form-urlencoded", 15000, function(st, j, t){
        refreshing = false;
        var err = null, msg = errText(j, t);
        syncAuth();
        if(!auth || auth.uid !== uid){ err = "out"; }
        else if(st === 200 && j && (j.id_token || j.access_token)){
          auth.token = j.id_token || j.access_token;
          auth.refresh = j.refresh_token || ref;
          auth.exp = Date.now() + (parseInt(j.expires_in, 10) || 3600) * 1000;
          save(AUTH_K, auth);
          netDown = false; configErr = false;
        }
        else if(st >= 400 && st < 500 && REVOKED.test(msg)){
          if(auth.refresh === ref){ err = "out"; forget(); }   // compte désactivé, supprimé ou jeton révoqué
          else err = "net";                                   // un autre onglet a déjà un jeton neuf : on réessaiera avec
        }
        else if((st === 400 || st === 403) && CONFIG.test(msg)){ err = "config"; configErr = true; }
        else { err = "net"; netDown = true; }
        var q = waiting; waiting = [];
        for(var i = 0; i < q.length; i++){ try{ q[i](err, err ? null : auth.token); }catch(e){} }
        if(err) notify();
      });
  }

  // Rôle du compte : cb(erreur, rôle) — erreur "net", "rules" (lecture refusée), "url" (mauvaise adresse)
  function fetchRole(token, uid, cb){
    req("GET", DB + "/members/" + encodeURIComponent(uid) + ".json?auth=" + encodeURIComponent(token), null, null, 15000, function(st, j){
      if(st === 200) cb(null, roleOk(j) ? j : null);
      else if(st === 401 || st === 403) cb("rules");
      else if(st === 0) cb("net");
      else cb("url");
    });
  }

  var AUTH_ERRORS = {
    INVALID_LOGIN_CREDENTIALS: "E-mail ou mot de passe incorrect.",
    INVALID_PASSWORD: "E-mail ou mot de passe incorrect.",
    EMAIL_NOT_FOUND: "E-mail ou mot de passe incorrect.",
    INVALID_EMAIL: "Cette adresse e-mail n'est pas valide.",
    MISSING_PASSWORD: "Il manque le mot de passe.",
    USER_DISABLED: "Ce compte est désactivé dans Firebase.",
    OPERATION_NOT_ALLOWED: "La connexion par e-mail n'est pas activée dans Firebase (FIREBASE.md, étape 3).",
    PASSWORD_LOGIN_DISABLED: "La connexion par e-mail n'est pas activée dans Firebase (FIREBASE.md, étape 3).",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Trop d'essais : réessaie dans quelques minutes."
  };
  var NO_NET = "Pas de réseau : réessaie quand l'appareil est connecté à Internet.";

  // Connexion : cb(messageErreur | null, rôle)
  function signIn(email, password, cb){
    if(!ENABLED){ cb("Firebase n'est pas encore configuré (firebase-config.js)."); return; }
    email = String(email || "").replace(/^\s+|\s+$/g, "");
    req("POST", AUTH_BASE + "/accounts:signInWithPassword?key=" + encodeURIComponent(API_KEY),
      JSON.stringify({email: email, password: String(password || ""), returnSecureToken: true}),
      "application/json", 20000, function(st, j, t){
        if(st === 0){ cb(NO_NET); return; }
        if(st !== 200 || !j || !j.idToken){
          var msg = errText(j, t), code = msg.split(" ")[0];
          if(AUTH_ERRORS[code]) cb(AUTH_ERRORS[code]);
          else if(CONFIG.test(msg)) cb("Clé API refusée : vérifie firebase-config.js et les restrictions de la clé (FIREBASE.md, étapes 7 et 8).");
          else cb("Connexion refusée" + (code ? " (" + code.slice(0, 40) + ")" : "") + ".");
          return;
        }
        var a = {uid: j.localId, email: j.email || email, refresh: j.refreshToken, token: j.idToken,
                 exp: Date.now() + (parseInt(j.expiresIn, 10) || 3600) * 1000, role: null};
        fetchRole(a.token, a.uid, function(err, role){
          if(err === "net"){ cb(NO_NET); return; }
          if(err === "url"){ cb("Adresse de la base incorrecte dans firebase-config.js (FIREBASE.md, étape 9)."); return; }
          if(err === "rules"){ cb("La base refuse la lecture : vérifie que les règles sont publiées (étape 6) et que l'UID du compte est dans members (étape 5)."); return; }
          if(!role){ cb("Ce compte n'est pas encore dans members : ajoute son UID (FIREBASE.md, étape 5)."); return; }
          a.role = role;
          var same = auth && auth.uid === a.uid;
          if(!save(AUTH_K, a)){ cb("Cet appareil n'enregistre rien (navigation privée ?) : ouvre la page en navigation normale."); return; }
          auth = a; denied = false; netDown = false; configErr = false;
          if(!same){ writeQ([]); tree = {}; knownHouse = false; pruneCache([]); }
          save(EMAIL_K, a.email);
          restart();
          cb(null, role);
        });
      });
  }

  // Le compte a-t-il toujours ses droits ? (retrait dans members = accès coupé)
  var roleChecking = false;
  function checkRole(again){
    if(roleChecking && !again) return;
    roleChecking = true;
    withToken(function(err, tok){
      if(err){ roleChecking = false; return; }
      fetchRole(tok, auth.uid, function(e2, role){
        if(e2 === "rules" && !again){ dropToken(); checkRole(true); return; }   // jeton expiré ? on retente avec un neuf
        roleChecking = false;
        if(!auth || e2 === "net" || e2 === "url") return;
        if(e2 === "rules" || !role){ denied = true; stopStreams(); notify(); return; }
        if(role !== auth.role){ auth.role = role; save(AUTH_K, auth); denied = false; restart(); return; }
        if(denied){ denied = false; restart(); }
      });
    });
  }

  // ---- File d'attente des coches (le stockage fait foi : plusieurs onglets peuvent la toucher) ----
  function readQ(){ var q = ENABLED ? load(PENDING_K) : null; return (q instanceof Array) ? q : []; }
  function writeQ(q){ pending = q; save(PENDING_K, q.length ? q : null); }
  var pending = readQ(), inflight = null;

  // ---- Coches reçues de la base : tree[période][enfant][tâche] = valeur ----
  var tree = {}, periods = [], watchedKids = [], streams = [], listeners = [];
  var knownHouse = false;        // l'état de la maison a été reçu au moins une fois (ou lu dans le cache)
  var remoteSeq = {}, seq = 0;   // chemin -> n° du dernier changement reçu de la base
  var localAt = {};              // chemin -> dernière écriture confirmée par la base {t, v}

  function loadCache(p){ var c = load(CACHE_K + p); tree[p] = (c && typeof c === "object") ? c : {}; }
  function saveCache(p){ save(CACHE_K + p, tree[p] || {}); }
  function pruneCache(keep){
    try{
      var drop = [], i, k;
      for(i = 0; i < localStorage.length; i++){
        k = localStorage.key(i);
        if(k && k.indexOf(CACHE_K) === 0 && indexOf(keep, k.slice(CACHE_K.length)) === -1) drop.push(k);
      }
      for(i = 0; i < drop.length; i++) localStorage.removeItem(drop[i]);
    }catch(e){}
  }

  var notifyTimer = null;
  function notify(){
    if(notifyTimer) return;
    notifyTimer = setTimeout(function(){
      notifyTimer = null;
      for(var i = 0; i < listeners.length; i++){ try{ listeners[i](); }catch(e){} }
    }, 60);
  }

  // Lecture : ce que l'appareil vient de cocher (file) d'abord, puis la base
  function get(p, kid, task){
    var path = p + "/" + kid + "/" + task;
    for(var i = pending.length - 1; i >= 0; i--){ if(pending[i].p === path) return pending[i].v; }
    var a = tree[p], b = a && a[kid];
    return (b && has(b, task)) ? b[task] : null;
  }

  // Écriture : mise en file + envoi
  function enqueue(path, v){
    var q = readQ(), out = [];
    for(var i = 0; i < q.length; i++){ if(q[i].p !== path) out.push(q[i]); }
    out.push({p: path, v: v == null ? null : v, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8)});
    writeQ(out);
    notify();
    flush();
  }
  function set(p, kid, task, v){
    if(!canAccess(kid)) return;
    enqueue(p + "/" + kid + "/" + task, v);
  }
  // État de la maison : /house/<machine>/<champ> (la base décide qui a le droit d'écrire quoi)
  function setHouse(machine, field, v){
    if(!signedIn()) return;
    enqueue("house/" + machine + "/" + field, v);
  }

  function treeSet(segs, v){
    var p = segs[0], kid = segs[1], task = segs[2];
    if(!tree[p]) loadCache(p);   // période pas suivie par cette page (sport, guide) : on part du cache enregistré
    if(!tree[p][kid]) tree[p][kid] = {};
    if(v == null){ delete tree[p][kid][task]; if(isEmpty(tree[p][kid])) delete tree[p][kid]; }
    else tree[p][kid][task] = v;
    saveCache(p);
  }

  var retryTimer = null, retryDelay = 3000;
  function scheduleRetry(){
    if(retryTimer) return;
    retryTimer = setTimeout(function(){ retryTimer = null; flush(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60000);
  }
  function flush(){
    if(inflight || !auth) return;
    pending = readQ();
    if(!pending.length) return;
    var h = pending[0];
    inflight = {p: h.p, v: h.v, id: h.id, retried: false, seq: remoteSeq[h.p] || 0};
    send(inflight);
  }
  // Coche envoyée (ou refusée) : on retire CETTE entrée de la file (si elle n'a pas été remplacée entre-temps)
  function sent(op, applied){
    var q = readQ();
    for(var i = 0; i < q.length; i++){ if(q[i].id ? q[i].id === op.id : (q[i].p === op.p && q[i].v === op.v)){ q.splice(i, 1); break; } }
    writeQ(q);
    if(!applied) return;
    // On l'affiche tout de suite, sauf si la base a déjà renvoyé plus récent pour cette tâche pendant l'envoi
    if((remoteSeq[op.p] || 0) === op.seq) treeSet(op.p.split("/"), op.v);
    localAt[op.p] = {t: Date.now(), v: op.v};
  }
  function send(op){
    withToken(function(err, tok){
      if(inflight !== op) return;
      if(err){ inflight = null; if(err !== "out") scheduleRetry(); notify(); return; }
      var del = op.v == null;
      var root = op.p.indexOf("house/") === 0 ? "/" : "/done/";
      var url = DB + root + op.p + ".json?" + (del ? "" : "print=silent&") + "auth=" + encodeURIComponent(tok);
      req(del ? "DELETE" : "PUT", url, del ? null : JSON.stringify(op.v), "application/json", 15000, function(st){
        if(inflight !== op) return;
        if(st >= 200 && st < 300){
          inflight = null; sent(op, true);
          netDown = false; retryDelay = 3000;
          notify(); flush();
        } else if((st === 400 || st === 401 || st === 403) && !op.retried){
          // jeton expiré ou refus : un seul nouvel essai, avec un jeton neuf
          op.retried = true;
          if(st !== 400) dropToken();
          send(op);
        } else if(st === 400 || st === 401 || st === 403){
          inflight = null; sent(op, false);   // refusé par la base même avec un jeton neuf : inutile d'insister
          notify(); checkRole(); flush();
        } else {
          inflight = null; netDown = true;
          notify(); scheduleRetry();
        }
      });
    });
  }

  // ---- Réception : flux en direct (EventSource), sinon interrogation toutes les 20 s ----
  function touch(path){ remoteSeq[path] = ++seq; }
  function touchNode(p, kidObj, kid){ if(kidObj){ for(var t in kidObj){ if(has(kidObj, t)) touch(p + "/" + kid + "/" + t); } } }
  function applyAt(base, relPath, data, merge){
    var segs = base.slice(), parts = String(relPath || "/").split("/"), i;
    for(i = 0; i < parts.length; i++){ if(parts[i]) segs.push(parts[i]); }
    if(merge && data && typeof data === "object"){
      for(var k in data){ if(has(data, k)) applyAt(segs, k, data[k], false); }
      return;
    }
    if(segs.length >= 3){
      touch(segs.slice(0, 3).join("/"));
      treeSet(segs.slice(0, 3), (data == null || typeof data === "object") ? null : data);
      return;
    }
    var p = segs[0], kid;   // nœud entier remplacé (période, ou période/enfant)
    if(!tree[p]) tree[p] = {};
    if(segs.length === 1){
      for(kid in tree[p]){ if(has(tree[p], kid)) touchNode(p, tree[p][kid], kid); }
      tree[p] = {};
      if(data && typeof data === "object"){
        for(kid in data){ if(has(data, kid) && data[kid] && typeof data[kid] === "object"){ tree[p][kid] = copy(data[kid]); touchNode(p, data[kid], kid); } }
      }
    } else {
      touchNode(p, tree[p][segs[1]], segs[1]);
      if(data && typeof data === "object"){ tree[p][segs[1]] = copy(data); touchNode(p, data, segs[1]); }
      else delete tree[p][segs[1]];
    }
    saveCache(p);
  }
  // Instantané (interrogation) demandé avant une écriture confirmée ensuite : on garde l'écriture
  function keepLocalSince(t0, base){
    var pre = base.join("/") + "/";
    for(var path in localAt){
      if(has(localAt, path) && localAt[path].t > t0 && path.indexOf(pre) === 0) treeSet(path.split("/"), localAt[path].v);
    }
  }

  // Appareil où EventSource ne marche pas alors que le réseau marche (ancien iPad) : on s'en souvient 24 h
  function pollRemembered(){ var t = load(POLL_K); return !!(t && Date.now() - t < 86400000); }
  function rememberPoll(on){ save(POLL_K, on ? Date.now() : null); }

  // La maison n'a jamais répondu dans cette session et échoue : on retombe sur les tâches habituelles
  function houseFailed(s){
    if(!s.gotData && s.fails >= 2 && knownHouse){ knownHouse = false; notify(); }
  }

  function Stream(base){
    this.base = base;                       // ["2026-10-10"] ou ["2026-10-10","liam"]
    this.path = base[0] === "house" ? "/house" : "/done/" + base.join("/");
    this.es = null; this.timer = null; this.renew = null;
    this.gen = 0; this.fails = 0; this.gotData = false; this.lastSeen = 0;
    this.usePoll = !window.EventSource || pollRemembered();
    this.stopped = false; this.cancelled = false;
  }
  Stream.prototype.start = function(){
    var s = this;
    if(s.stopped || s.cancelled) return;
    s.clear();
    if(hidden()) return;                    // écran masqué : wake() rouvrira
    var g = s.gen;                          // tout appel plus récent à start()/clear() rend celui-ci caduc
    withToken(function(err, tok){
      if(s.stopped || g !== s.gen) return;
      if(err){ if(err !== "out"){ s.fails = Math.min(s.fails + 1, 4); s.later(); } return; }
      if(s.usePoll){ s.pollNow(tok, g); return; }
      var es;
      try{ es = new window.EventSource(DB + s.path + ".json?auth=" + encodeURIComponent(tok)); }
      catch(e){ s.usePoll = true; s.pollNow(tok, g); return; }
      s.es = es; s.lastSeen = Date.now();
      function mine(){ if(s.es === es) return true; try{ es.close(); }catch(e){} return false; }
      function onData(merge){
        return function(ev){
          if(!mine()) return;
          s.lastSeen = Date.now();
          var m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
          if(!m) return;
          if(!s.gotData){ s.gotData = true; rememberPoll(false); }
          s.fails = 0; netDown = false;
          if(s.base[0] === "house") knownHouse = true;
          applyAt(s.base, m.path, m.data, merge);
          notify();
        };
      }
      es.addEventListener("put", onData(false));
      es.addEventListener("patch", onData(true));
      es.addEventListener("keep-alive", function(){ if(mine()) s.lastSeen = Date.now(); });
      es.addEventListener("cancel", function(){   // la base ne permet plus de lire : droits retirés ?
        if(!mine()) return;
        if(s.base[0] === "house"){   // seule la maison est refusée : on réessaie plus tard, sans bannière « accès refusé »
          s.clear(); s.fails++; houseFailed(s); s.later(); notify();
          return;
        }
        s.clear(); s.cancelled = true; denied = true; notify();
        setTimeout(checkRole, 3000);
      });
      es.addEventListener("auth_revoked", function(){ if(!mine()) return; dropToken(); s.start(); });
      es.onerror = function(){
        if(!mine()) return;
        if(es.readyState === 2){            // refusé ou fermé pour de bon : on relance nous-mêmes
          s.clear(); s.fails++;
          if(s.base[0] === "house"){        // la maison seule en erreur : ce n'est pas un problème de jeton ni de droits du compte
            houseFailed(s);
            if(!s.gotData && s.fails >= 3){ s.usePoll = true; s.start(); return; }
            s.later();
            notify();
            return;
          }
          dropToken();
          if(!s.gotData && s.fails >= 3){ s.usePoll = true; s.esFailed = true; s.start(); return; }
          if(s.fails >= 2) checkRole();
          s.later();
        }
        notify();
      };
      // Renouvelle le flux avant que le jeton (1 h) n'expire
      var ms = Math.max(60000, (auth ? auth.exp : 0) - Date.now() - 90000);
      s.renew = setTimeout(function(){ s.start(); }, ms);
    });
  };
  Stream.prototype.pollNow = function(tok, g){
    var s = this, t0 = Date.now();
    req("GET", DB + s.path + ".json?auth=" + encodeURIComponent(tok), null, null, 15000, function(st, j){
      if(s.stopped || g !== s.gen) return;
      if(st === 200){
        s.fails = 0; s.gotData = true; s.lastSeen = Date.now(); netDown = false;
        if(s.esFailed && s.base[0] !== "house"){ rememberPoll(true); s.esFailed = false; }   // le réseau marche mais pas EventSource : on s'en souvient
        if(s.base[0] === "house") knownHouse = true;
        applyAt(s.base, "/", j, false); keepLocalSince(t0, s.base); notify();
      }
      else if(st === 401 || st === 403){
        s.esFailed = false;   // un refus de la base prouve que le souci n'est pas EventSource
        s.fails++;
        if(s.base[0] === "house"){ houseFailed(s); notify(); }
        else { dropToken(); if(s.fails >= 2) checkRole(); }
      }
      else { s.fails++; if(s.base[0] !== "house") netDown = true; notify(); }
      s.timer = setTimeout(function(){ s.timer = null; s.start(); }, st === 200 ? 20000 : s.delay());
    });
  };
  Stream.prototype.delay = function(){
    if(this.base[0] === "house" && this.fails >= 3 && !this.gotData) return 300000;
    return Math.min(5000 * Math.pow(2, this.fails), 60000);
  };
  Stream.prototype.later = function(){
    var s = this;
    s.timer = setTimeout(function(){ s.timer = null; s.start(); }, s.delay());
  };
  Stream.prototype.clear = function(){
    this.gen++;
    if(this.es){ try{ this.es.close(); }catch(e){} this.es = null; }
    if(this.timer){ clearTimeout(this.timer); this.timer = null; }
    if(this.renew){ clearTimeout(this.renew); this.renew = null; }
  };
  Stream.prototype.stop = function(){ this.stopped = true; this.clear(); };
  Stream.prototype.alive = function(){
    return this.usePoll ? !!this.timer : !!((this.es && this.es.readyState !== 2) || this.timer);
  };
  Stream.prototype.live = function(){
    return this.gotData && (this.usePoll ? !!this.timer : !!(this.es && this.es.readyState === 1 && Date.now() - this.lastSeen < 95000));
  };

  // Flux muet (Wi-Fi coupé sans que le navigateur le voie) : la base envoie un signe de vie toutes les 30 s
  var ticks = 0;
  function watchdog(){
    if(hidden()) return;
    ticks++;
    if(denied && signedIn() && ticks % 4 === 0) checkRole();   // droits remis dans la console : on repart tout seul
    for(var i = 0; i < streams.length; i++){
      var s = streams[i];
      if(s.es && Date.now() - s.lastSeen > 95000){ s.fails = Math.min(s.fails + 1, 4); s.start(); }   // muet : on rouvre (sans conclure)
      else if(!s.es && !s.timer && !s.cancelled && !s.stopped && signedIn() && !denied) s.start();      // ni ouvert ni en attente : on relance
    }
  }

  function stopStreams(){
    for(var i = 0; i < streams.length; i++) streams[i].stop();
    streams = [];
  }
  function restart(){
    stopStreams();
    if(!signedIn() || denied){ notify(); return; }
    for(var i = 0; i < periods.length; i++){
      if(auth.role === "famille") streams.push(new Stream([periods[i]]));
      else if(indexOf(watchedKids, auth.role) !== -1) streams.push(new Stream([periods[i], auth.role]));
    }
    if(streams.length) streams.push(new Stream(["house"]));   // la maison suit les pages qui affichent une liste
    for(var j = 0; j < streams.length; j++) streams[j].start();
    flush();
    notify();
  }

  // Une page déclare ce qu'elle affiche : périodes (jour, week-end) et enfants concernés.
  function watch(ps, kids, onChange){
    if(onChange) listeners.push(onChange);
    if(!ENABLED) return;
    periods = ps.slice();
    watchedKids = kids.slice();
    pruneCache(periods.concat(["house"]));
    tree = {};
    for(var i = 0; i < periods.length; i++) loadCache(periods[i]);
    knownHouse = load(CACHE_K + "house") !== null;
    loadCache("house");
    restart();
    checkRole();
  }

  // ---- Écran masqué / rallumé, réseau revenu, autre onglet ----
  function sleep(){ for(var i = 0; i < streams.length; i++) streams[i].clear(); }
  var lastRoleCheck = 0;
  function recheckIfDenied(){
    if(denied && signedIn() && Date.now() - lastRoleCheck > 20000){ lastRoleCheck = Date.now(); checkRole(); }
  }
  function wake(){
    syncAuth();
    if(!signedIn()) return;
    connSince = 0;
    flush();
    if(denied){ recheckIfDenied(); return; }
    var stale = !auth.token || auth.token === badToken || auth.exp - Date.now() < 120000;   // jeton refusé, ou appareil endormi plus d'une heure
    for(var i = 0; i < streams.length; i++){ if(stale || !streams[i].alive()) streams[i].start(); }
  }
  if(ENABLED){
    try{
      // le plan gratuit limite à 100 connexions ouvertes : on ferme les flux quand l'écran est masqué
      document.addEventListener("visibilitychange", function(){ if(hidden()) sleep(); else wake(); });
      window.addEventListener("pagehide", sleep);
      window.addEventListener("pageshow", function(e){ if(e && e.persisted){ location.reload(); return; } wake(); });
      window.addEventListener("online", function(){
        netDown = false; retryDelay = 3000; flush(); recheckIfDenied();
        if(signedIn() && !denied){ for(var i = 0; i < streams.length; i++) streams[i].start(); }
      });
      window.addEventListener("storage", function(e){
        if(!e || !e.key) return;
        if(e.key === AUTH_K) syncAuth();
        else if(e.key === PENDING_K){ pending = readQ(); notify(); }   // l'onglet qui a coché l'envoie lui-même
      });
    }catch(e){}
    setInterval(watchdog, 30000);
    if(auth && pending.length) setTimeout(flush, 0);   // coches restées en attente (page quittée trop vite)
  }

  // ---- État à afficher : local | out | other | denied | config | offline | connecting | sending | ok ----
  function state(kid){
    var n = pending.length;
    if(!ENABLED) return {k: "local", n: 0};
    if(!auth) return {k: "out", n: n};
    if(kid && !canAccess(kid)) return {k: "other", n: n, role: auth.role};
    if(denied) return {k: "denied", n: n};
    if(configErr) return {k: "config", n: n};
    if(netDown || navigator.onLine === false) return {k: "offline", n: n};
    if(streams.length){
      var any = false;
      for(var i = 0; i < streams.length; i++){ if(streams[i].base[0] !== "house" && streams[i].live()) any = true; }
      if(!any){
        if(!connSince) connSince = Date.now();
        return {k: Date.now() - connSince > 60000 ? "offline" : "connecting", n: n};
      }
    }
    connSince = 0;
    return {k: n ? "sending" : "ok", n: n};
  }

  window.Sync = {
    enabled: ENABLED,
    signIn: signIn,
    signOut: forget,
    account: function(){ return auth ? {email: auth.email, role: auth.role} : null; },
    lastEmail: function(){ return load(EMAIL_K) || ""; },
    active: canAccess,
    get: get,
    set: set,
    setHouse: setHouse,
    houseKnown: function(){ return knownHouse; },
    watch: watch,
    state: state,
    // Toutes les périodes suivies ont reçu au moins une fois l'état de la base
    ready: function(){
      var n = 0;
      for(var i = 0; i < streams.length; i++){
        if(streams[i].base[0] === "house") continue;
        n++;
        if(!streams[i].gotData) return false;
      }
      return n > 0;
    },
    pendingCount: function(){ return pending.length; }
  };
})();
