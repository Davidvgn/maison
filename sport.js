/* ================================================================
   Page "Mon sport" : circuit du jour, illustré, adapté à chaque enfant.
   Réglages dans children.js (champ "sport"). JavaScript ancien (ES5).
   ================================================================ */
(function(){
  "use strict";

  var C=window.Chores;
  var kid=(C.qs("kid")||"");
  var cfg=window.CHILDREN[kid];
  if(!cfg){ document.getElementById("steps").innerHTML="<p>Enfant inconnu.</p>"; return; }
  var sp=cfg.sport||{};
  var today=C.now();
  var DAY=C.dateKey(today);
  var COLOR=cfg.color||"#5b8def";

  // retour : seulement une page .html du site
  var backRaw=C.qs("back")||"";
  var back=/^[A-Za-z0-9_.\-]+\.html(\?[A-Za-z0-9_=&:%.\-]*)?$/.test(backRaw)?backRaw:"index.html";
  document.getElementById("back").onclick=function(){ location.href=back; };
  document.getElementById("head").style.background=cfg.gradient;
  document.getElementById("title").textContent="Mon sport — "+cfg.name;
  document.title="Mon sport — "+cfg.name;

  // ---- Dessins (bonshommes) : chaque pose = tête + lignes ----
  var POSES={
    abdos:[
      {head:[22,62], lines:[[[30,70],[62,84]],[[30,70],[30,87],[46,87]],[[62,84],[95,90]]]},
      {head:[22,62], lines:[[[30,70],[62,84]],[[30,70],[30,87],[46,87]],[[62,84],[88,48]]]}
    ],
    biceps:[
      {head:[50,20], lines:[[[50,30],[50,62]],[[48,62],[46,92]],[[52,62],[54,92]],[[50,34],[50,48],[50,60]]], w:[[50,63]]},
      {head:[50,20], lines:[[[50,30],[50,62]],[[48,62],[46,92]],[[52,62],[54,92]],[[50,34],[50,48],[64,40]]], w:[[66,38]]}
    ],
    squats:[
      {head:[50,20], lines:[[[50,30],[50,62]],[[48,62],[46,92]],[[52,62],[54,92]],[[50,34],[66,36]]], w:[[68,36]]},
      {head:[40,36], lines:[[[44,44],[30,66]],[[30,66],[56,66],[56,92]],[[44,46],[66,48]]], w:[[68,48]]}
    ],
    epaules:[
      {head:[50,22], lines:[[[50,31],[50,62]],[[50,62],[40,92]],[[50,62],[60,92]],[[50,34],[40,62]],[[50,34],[60,62]]], w:[[40,64],[60,64]]},
      {head:[50,22], lines:[[[50,31],[50,62]],[[50,62],[40,92]],[[50,62],[60,92]],[[50,34],[20,34]],[[50,34],[80,34]]], w:[[18,34],[82,34]]}
    ],
    planche:[
      {head:[14,62], lines:[[[22,66],[56,76],[90,88]],[[24,68],[24,88],[40,88]]]}
    ],
    jumping:[
      {head:[50,22], lines:[[[50,31],[50,62]],[[50,62],[46,92]],[[50,62],[54,92]],[[50,34],[42,50],[42,62]],[[50,34],[58,50],[58,62]]]},
      {head:[50,22], lines:[[[50,31],[50,62]],[[50,62],[30,92]],[[50,62],[70,92]],[[50,34],[36,20],[28,6]],[[50,34],[64,20],[72,6]]]}
    ]
  };
  function path(pts){
    var d="", i;
    for(i=0;i<pts.length;i++) d+=(i?"L":"M")+pts[i][0]+" "+pts[i][1];
    return '<path d="'+d+'" fill="none" stroke="'+COLOR+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function frame(p,wt){
    var s='<svg viewBox="0 0 100 100"><line x1="4" y1="95" x2="96" y2="95" stroke="#cfd9e8" stroke-width="3" stroke-linecap="round"/>', i;
    for(i=0;i<p.lines.length;i++) s+=path(p.lines[i]);
    s+='<circle cx="'+p.head[0]+'" cy="'+p.head[1]+'" r="8" fill="'+COLOR+'"/>';
    if(wt && p.w){
      var r=/kettlebell|boule/i.test(wt)?8:6;
      for(i=0;i<p.w.length;i++) s+='<circle cx="'+p.w[i][0]+'" cy="'+p.w[i][1]+'" r="'+r+'" fill="#5b6b86" stroke="#fff" stroke-width="1.5"/>';
    }
    return s+'</svg>';
  }
  function frames(key,wt){
    var arr=POSES[key], html='<div class="frames'+(arr.length===1?' single':'')+'">', i;
    for(i=0;i<arr.length;i++){ if(i>0) html+='<span class="arrow">⇄</span>'; html+=frame(arr[i],wt); }
    return html+'</div>';
  }

  // ---- Mémorisation des étapes cochées (par enfant et par jour) ----
  function key(k){ return "sport:"+kid+":"+DAY+":"+k; }
  function get(k){ try{ return localStorage.getItem(key(k))==="1"; }catch(e){ return false; } }
  function set(k,v){ try{ if(v) localStorage.setItem(key(k),"1"); else localStorage.removeItem(key(k)); }catch(e){} }

  var ids=[];
  function chips(prefix,count,label){
    var h='<div class="chips">', i;
    for(i=1;i<=count;i++){
      var id=prefix+i; ids.push(id);
      h+='<div class="chip2'+(get(id)?' on':'')+'" data-id="'+id+'">'+label+' '+i+'</div>';
    }
    return h+'</div>';
  }
  var DESC={abdos:"Allongé sur les coudes, je lève les jambes tendues", epaules:"Bras tendus, je les lève sur les côtés jusqu'à hauteur des épaules"};
  var WT=sp.sportWeights||cfg.sportWeights||{}, WN=cfg.sportNotes||{};
  function exo(name,k,nb){
    var w=WT[k]||"";
    return '<div class="exo"><div class="in">'+frames(k,w)+'<div class="nm">'+name+'</div><div class="nb">'+nb+'</div>'+
      (DESC[k]?'<div class="wn">'+DESC[k]+'</div>':'')+(w?'<div class="wt">🏋️ '+w+'</div>':(DESC[k]?'':'<div class="wt">Sans poids</div>'))+(WN[k]?'<div class="wn">'+WN[k]+'</div>':'')+'</div></div>';
  }

  // ---- Page ----
  var reps=sp.reps||10, rounds=sp.rounds||5;
  var pSets=sp.plankSets||3, pSec=sp.plankSec||45, pPause=sp.plankPause||30;
  var jSets=sp.jjSets||3, jReps=sp.jjReps||10, jPause=sp.jjPause||60;
  function fois(n){ return n+" fois"; }
  function dur(sec){ return sec>=60?(sec/60)+" min":sec+" s"; }

  var html='';
  html+='<div class="step"><h2>1 · Le circuit : '+rounds+' tours</h2>'+
    '<p class="what">Chaque exercice '+fois(reps)+', puis je recommence. Je coche chaque tour terminé.</p>'+
    '<div class="exos">'+exo("Abdos","abdos",fois(reps))+exo("Biceps","biceps",fois(reps))+exo("Squats","squats",fois(reps))+exo("Épaules","epaules",fois(reps))+'</div>'+
    chips("round",rounds,"Tour")+'</div>';

  html+='<div class="rest">😮‍💨 Pause · je bois un peu d\'eau</div>';

  html+='<div class="step"><h2>2 · La planche : '+pSets+' × '+dur(pSec)+'</h2>'+
    '<p class="what">'+pSets+' planches de '+dur(pSec)+', avec '+dur(pPause)+' de pause entre chaque. Je lance, le chrono enchaîne tout seul.</p>'+
    frames("planche","")+
    '<div class="btns"><button class="tbtn" id="plankGo">▶ Lancer les '+pSets+' planches</button></div>'+
    '<div class="timer" id="timerPlank"><div class="lbl"></div><div class="big"></div><div class="nx"></div><button class="stop">■ Arrêter</button></div>'+
    chips("plank",pSets,"Planche")+'</div>';

  html+='<div class="step"><h2>3 · Jumping jacks : '+jSets+' × '+jReps+'</h2>'+
    '<p class="what">'+jSets+' séries de '+jReps+' jumping jacks, avec '+dur(jPause)+' de pause entre chaque. Quand je coche une série, la pause se lance toute seule.</p>'+
    frames("jumping","")+
    '<div class="timer" id="timerJJ"><div class="lbl"></div><div class="big"></div><div class="nx"></div><button class="stop">■ Arrêter</button></div>'+
    chips("jj",jSets,"Série")+'</div>';

  document.getElementById("steps").innerHTML=html;

  // ---- Cases à cocher ----
  function refresh(){
    var left=0, i;
    for(i=0;i<ids.length;i++){ if(!get(ids[i])) left++; }
    var btn=document.getElementById("finish");
    btn.className=left===0?"ready":"";
    document.getElementById("left").textContent=left===0?"Bravo, tout est coché !":"Il reste "+left+" case"+(left>1?"s":"")+" à cocher.";
  }
  function setChip(id,on){
    set(id,on);
    var el=document.querySelector('.chip2[data-id="'+id+'"]');
    if(el) el.className="chip2"+(on?" on":"");
    refresh();
  }

  // ---- Chronomètre : enchaîne une liste d'étapes (temps, puis pause, puis temps...) ----
  var tick=null, audio=null;
  function beep(){
    try{
      var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      if(!audio) audio=new AC();
      var o=audio.createOscillator(), g=audio.createGain();
      o.connect(g); g.connect(audio.destination); o.frequency.value=880; g.gain.value=0.2;
      o.start(0); o.stop(audio.currentTime+0.4);
    }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate(300); }catch(e2){}
  }
  function stopTimer(){
    if(tick){ clearInterval(tick); tick=null; }
    var all=document.querySelectorAll(".timer"), i;
    for(i=0;i<all.length;i++) all[i].className="timer";
  }
  function runList(box,list){
    stopTimer();
    try{ var AC=window.AudioContext||window.webkitAudioContext; if(AC && !audio) audio=new AC(); }catch(e){}
    var idx=0, big=box.querySelector(".big"), lbl=box.querySelector(".lbl"), nx=box.querySelector(".nx");
    box.querySelector(".stop").onclick=stopTimer;
    function begin(){
      if(idx>=list.length){ box.className="timer show end"; lbl.textContent="Terminé !"; big.textContent="✓"; nx.textContent=""; tick=null; return; }
      var it=list[idx], left=it.sec;
      box.className="timer show"+(it.kind==="pause"?" resting":"");
      lbl.textContent=it.label; big.textContent=left;
      nx.textContent=(idx+1<list.length)?"Ensuite : "+list[idx+1].label:"";
      tick=setInterval(function(){
        left--; big.textContent=left;
        if(left<=0){
          clearInterval(tick); tick=null; beep();
          if(it.onEnd) it.onEnd();
          idx++; begin();
        }
      },1000);
    }
    begin();
  }

  var chipEls=document.querySelectorAll(".chip2");
  for(var ci=0;ci<chipEls.length;ci++){
    chipEls[ci].onclick=function(){
      var id=this.getAttribute("data-id"), on=!get(id);
      setChip(id,on);
      // jumping jacks : la pause se lance toute seule après une série cochée (sauf la dernière)
      var m=/^jj(\d+)$/.exec(id);
      if(on && m && parseInt(m[1],10)<jSets){
        runList(document.getElementById("timerJJ"),[{label:"Pause avant la série "+(parseInt(m[1],10)+1),sec:jPause,kind:"pause"}]);
      }
    };
  }
  document.getElementById("plankGo").onclick=function(){
    var list=[{label:"Prépare-toi",sec:3,kind:"pause"}], i;
    function mk(n){ return function(){ setChip("plank"+n,true); }; }
    for(i=1;i<=pSets;i++){
      list.push({label:"Planche "+i+" / "+pSets,sec:pSec,onEnd:mk(i)});
      if(i<pSets) list.push({label:"Pause "+dur(pPause),sec:pPause,kind:"pause"});
    }
    runList(document.getElementById("timerPlank"),list);
  };

  // ---- Terminé : coche la tâche sport du jour et retourne à la liste ----
  document.getElementById("finish").onclick=function(){
    var left=0, i;
    for(i=0;i<ids.length;i++){ if(!get(ids[i])) left++; }
    if(left>0) return;
    var tomorrow=C.addDays(today,1), tasks=C.buildTasks(cfg,today,tomorrow);
    tasks.forEach(function(t){ if(t.block==="sport" && t.href) C.setDone(kid,t,today,true); });
    location.href=back;
  };
  refresh();
})();
