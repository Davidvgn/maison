/* ================================================================
   Pages "Comment faire" : tâches expliquées pas à pas, avec dessins.
   Ouvertes par un lien depuis la liste (champ href d'une tâche).
   Pour ajouter un guide : ajouter une entrée dans GUIDES (en bas du fichier
   des scènes), puis mettre href:"guide.html?g=<nom>&kid=..." sur la tâche.
   JavaScript ancien (ES5) pour les vieux appareils.
   ================================================================ */
(function(){
  "use strict";

  var C=window.Chores;
  var kid=C.qs("kid")||"", g=C.qs("g")||"", of=C.qs("of")||"";
  var cfg=window.CHILDREN[kid];
  var other=window.CHILDREN[of];
  if(!cfg){ document.getElementById("steps").innerHTML="<p>Enfant inconnu.</p>"; return; }

  var today=C.now(), DAY=C.dateKey(today), COLOR=cfg.color||"#5b8def";

  var backRaw=C.qs("back")||"";
  var back=/^[A-Za-z0-9_.\-]+\.html(\?[A-Za-z0-9_=&:%.\-]*)?$/.test(backRaw)?backRaw:"index.html";
  document.getElementById("back").onclick=function(){ location.href=back; };
  document.getElementById("head").style.background=cfg.gradient;

  // ---- Dessins : une fenêtre, un radiateur, un marche-pied, un bonhomme ----
  function win(o){
    var fc=o.frame?"#2f6fd0":"#8793a8", fw=o.frame?8:5, s="";
    if(o.open){
      s+='<rect x="50" y="8" width="100" height="70" rx="3" fill="#d9e7f5" stroke="'+fc+'" stroke-width="'+fw+'"/>';
      s+='<polygon points="50,8 86,18 86,70 50,78" fill="#eef5fc" stroke="#8793a8" stroke-width="4" stroke-linejoin="round"/>';
    } else {
      s+='<rect x="50" y="8" width="100" height="70" rx="3" fill="'+(o.glass?'#e3f2ff':'#d9e7f5')+'" stroke="'+fc+'" stroke-width="'+fw+'"/>';
      s+='<line x1="100" y1="8" x2="100" y2="78" stroke="'+fc+'" stroke-width="'+(fw-1)+'"/>';
      s+='<rect x="104" y="40" width="4" height="12" rx="2" fill="#5b6b86"/>';
    }
    s+='<rect x="44" y="78" width="112" height="5" rx="2" fill="#8793a8"/>';
    if(o.rad){
      var i, rc=o.radHi?"#2f6fd0":"#c9d3e3";
      for(i=0;i<8;i++) s+='<rect x="'+(62+i*10)+'" y="88" width="7" height="26" rx="3" fill="'+rc+'" stroke="#8793a8" stroke-width="1.5"/>';
    }
    if(o.sparkle){
      s+='<text x="62" y="36" font-size="18">✨</text><text x="118" y="62" font-size="18">✨</text>';
      s+='<line x1="58" y1="64" x2="78" y2="48" stroke="#fff" stroke-width="4" stroke-linecap="round"/><line x1="124" y1="30" x2="140" y2="18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
    }
    return s;
  }
  function svg(inner){ return '<svg viewBox="0 0 200 120">'+inner+'</svg>'; }
  function person(x,footY,upArms){
    var s='', h=footY-60;
    s+='<circle cx="'+x+'" cy="'+(h-8)+'" r="7" fill="'+COLOR+'"/>';
    s+='<path d="M'+x+' '+h+' L'+x+' '+(h+26)+' M'+x+' '+(h+26)+' L'+(x-6)+' '+footY+' M'+x+' '+(h+26)+' L'+(x+6)+' '+footY+
       (upArms?' M'+x+' '+(h+6)+' L'+(x-12)+' '+(h-8)+' M'+x+' '+(h+6)+' L'+(x+12)+' '+(h-8):' M'+x+' '+(h+6)+' L'+(x-10)+' '+(h+20)+' M'+x+' '+(h+6)+' L'+(x+10)+' '+(h+20))+
       '" fill="none" stroke="'+COLOR+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  var SCENES={
    close:function(){
      return svg('<g transform="translate(-12,18) scale(.56)">'+win({open:true})+'</g><text x="86" y="62" font-size="24" fill="#6b7a90">→</text>'+
        '<g transform="translate(76,18) scale(.56)">'+win({})+'</g><text x="150" y="70" font-size="30">✅</text>');
    },
    stool:function(){
      return svg(win({})+'<rect x="78" y="100" width="44" height="6" rx="2" fill="#8793a8"/><rect x="82" y="106" width="5" height="12" fill="#8793a8"/><rect x="113" y="106" width="5" height="12" fill="#8793a8"/>'+person(100,100,true));
    },
    frame:function(){
      return svg(win({frame:true})+'<text x="20" y="46" font-size="26">🧴</text><text x="158" y="46" font-size="26">🧽</text>');
    },
    rad:function(){
      return svg(win({rad:true,radHi:true})+'<text x="158" y="108" font-size="26">🧽</text>');
    },
    glass:function(){
      return svg(win({glass:true,sparkle:true})+'<text x="6" y="108" font-size="13" fill="#2fa968" font-weight="bold">✓ dedans</text><text x="130" y="108" font-size="13" fill="#d6392d" font-weight="bold">✗ dehors</text>');
    },
    teeth:function(electric){
      return svg('<path d="M70 26 C52 14 40 34 46 58 C50 78 56 96 64 100 C70 104 72 82 78 80 C84 82 86 104 92 100 C100 96 106 78 108 58 C114 34 100 14 82 26 C78 28 74 28 70 26 Z" fill="#fff" stroke="#8793a8" stroke-width="4" stroke-linejoin="round"/>'+
        '<g transform="rotate(-35 150 70)"><rect x="120" y="62" width="60" height="14" rx="7" fill="'+(electric?'#2f6fd0':'#e08a1e')+'"/><rect x="112" y="55" width="10" height="28" rx="3" fill="#cfd9e8"/></g>'+
        (electric?'<text x="150" y="30" font-size="26">⚡</text>':'<text x="150" y="30" font-size="26">🪥</text>')+'<text x="20" y="112" font-size="16">✨</text>');
    },
    feedback:function(){
      return svg('<rect x="8" y="14" width="86" height="48" rx="12" fill="#e9f7ef" stroke="#34c77b" stroke-width="3"/><text x="22" y="46" font-size="22">👍 Bien</text>'+
        '<rect x="106" y="58" width="88" height="48" rx="12" fill="#fff4d6" stroke="#e08a1e" stroke-width="3"/><text x="116" y="90" font-size="19">👉 À mieux</text>');
    }
  };

  // ---- Les guides ----
  var GUIDES={
    fenetre:{
      title:"Nettoyer ma fenêtre",
      intro:"À l'intérieur seulement. Je ne nettoie JAMAIS l'extérieur de la fenêtre.",
      steps:[
        {scene:"close", title:"1 · Je ferme la fenêtre", text:"Je ferme complètement la fenêtre avant de commencer.", ck:"J'ai fermé la fenêtre"},
        {scene:"stool", title:"2 · Je monte sur mon marche-pied", text:"Je mets le marche-pied devant la fenêtre et je monte dessus, doucement. Je reste bien droit.", ck:"Je suis sur mon marche-pied"},
        {scene:"frame", title:"3 · Les contours, avec une lingette à la javel", text:"Je passe une lingette à la javel sur tous les contours de la fenêtre (le cadre).", warn:"La javel pique les yeux : je ne me frotte pas les yeux, et je me lave les mains après.", ck:"Les contours sont nettoyés"},
        {scene:"rad", title:"4 · Le radiateur, avec une lingette à la javel", text:"Je passe une lingette à la javel sur le radiateur.", ck:"Le radiateur est nettoyé"},
        {scene:"glass", title:"5 · Les vitres", text:"Je nettoie les vitres, à l'intérieur seulement. Pas l'extérieur !", ck:"Les vitres sont nettoyées"}
      ]
    },
    verif:{
      title:function(){ return "Vérifier la fenêtre de "+(other?other.name:"…"); },
      intro:function(){ var n=other?other.name:"…"; return "Tu es le manager de "+n+". Tu contrôles son travail, puis tu lui fais ton retour : il apprend de toi, et toi tu apprends à guider quelqu'un."; },
      steps:[
        {scene:"frame", title:"1 · Les contours", text:"Le cadre de la fenêtre est propre, sans saleté.", ck:"Les contours sont propres"},
        {scene:"rad", title:"2 · Le radiateur", text:"Le radiateur est propre.", ck:"Le radiateur est propre"},
        {scene:"glass", title:"3 · Les vitres", text:"Les vitres sont propres, sans traces, à l'intérieur.", ck:"Les vitres sont propres"},
        {scene:"feedback", title:"4 · Mon retour", text:function(){ var n=other?other.name:"lui"; return "Je dis à "+n+" une chose bien faite, et une chose à améliorer. S'il reste du travail, "+n+" le refait avant la fin du week-end."; }, ck:"J'ai donné mon retour"}
      ]
    }
  };

  GUIDES.dents_matin={
    title:"Me brosser les dents (3 min)",
    intro:"3 minutes, pas moins. Je lance le chrono et je brosse toutes mes dents.",
    timer:[{label:"Je me brosse les dents",sec:180,tick:0}],
    steps:[{scene:"teeth", title:"Me brosser les dents, 3 minutes", text:"Je brosse toutes les dents, en haut et en bas, devant et derrière. J'arrête quand le chrono sonne.", ck:"J'ai brossé 3 minutes"}]
  };
  GUIDES.dents_soir={
    title:"Me brosser les dents en grand",
    intro:"5 minutes en tout : 3 minutes à la main, puis 2 minutes à la brosse électrique. Ensuite, le bain de bouche.",
    timer:[{label:"Brosse à la main",sec:180,tick:0},{label:"Brosse électrique",sec:120,tick:1}],
    steps:[
      {scene:"teeth", title:"1 · À la main, 3 minutes", text:"Je brosse toutes mes dents à la main.", ck:"3 minutes à la main : fait"},
      {scene:"teethE", title:"2 · À la brosse électrique, 2 minutes", text:"Je passe la brosse électrique sur toutes mes dents. Ensuite, je fais mon bain de bouche.", ck:"2 minutes à la brosse électrique : fait"}
    ]
  };
  SCENES.teethE=function(){ return SCENES.teeth(true); };

  var gd=GUIDES[g];
  if(!gd){ document.getElementById("steps").innerHTML="<p>Guide inconnu.</p>"; return; }
  function val(x){ return typeof x==="function"?x():x; }

  var title=val(gd.title);
  document.getElementById("title").textContent=title;
  document.title=title;

  var baseHref="guide.html?g="+g+"&kid="+kid+(of?"&of="+of:"");
  function key(i){ return "guide:"+kid+":"+g+":"+of+":"+DAY+":"+i; }
  function get(i){ try{ return localStorage.getItem(key(i))==="1"; }catch(e){ return false; } }
  function set(i,v){ try{ if(v) localStorage.setItem(key(i),"1"); else localStorage.removeItem(key(i)); }catch(e){} }

  var html='<div class="intro">'+val(gd.intro)+'</div>', i;
  for(i=0;i<gd.steps.length;i++){
    var st=gd.steps[i];
    html+='<div class="gstep"><h2>'+st.title+'</h2>'+SCENES[st.scene]()+
      '<p>'+val(st.text)+'</p>'+(st.warn?'<p class="warn">⚠️ '+st.warn+'</p>':'')+
      '<div class="gck'+(get(i)?' on':'')+'" data-i="'+i+'">'+(get(i)?'✓ ':'')+st.ck+'</div></div>';
  }
  document.getElementById("steps").innerHTML=html;

  // ---- Chrono enchaîné (guides qui ont un champ timer) ----
  var tick=null, audio=null;
  function beep(){
    try{
      var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      if(!audio) audio=new AC();
      var o=audio.createOscillator(), gn=audio.createGain();
      o.connect(gn); gn.connect(audio.destination); o.frequency.value=880; gn.gain.value=0.2;
      o.start(0); o.stop(audio.currentTime+0.4);
    }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate(300); }catch(e2){}
  }
  function mmss(n){ var m=Math.floor(n/60), s=n%60; return m+":"+(s<10?"0":"")+s; }
  function setCk(idx,on){
    set(idx,on);
    var el=document.querySelector('.gck[data-i="'+idx+'"]');
    if(el){ el.className="gck"+(on?" on":""); el.textContent=(on?"✓ ":"")+gd.steps[idx].ck; }
    refresh();
  }
  if(gd.timer){
    var tbox=document.createElement("div"); tbox.className="gstep";
    tbox.innerHTML='<h2>⏱️ Chrono</h2><button class="gbtn" id="tGo">▶ Lancer le chrono</button>'+
      '<div class="gtimer" id="tBox"><div class="lbl"></div><div class="big"></div><div class="nx"></div><button class="gstop">■ Arrêter</button></div>';
    var stepsEl=document.getElementById("steps");
    stepsEl.insertBefore(tbox, stepsEl.children[1]);
    var box=document.getElementById("tBox");
    function stopT(){ if(tick){ clearInterval(tick); tick=null; } box.className="gtimer"; }
    box.querySelector(".gstop").onclick=stopT;
    document.getElementById("tGo").onclick=function(){
      stopT();
      try{ var AC=window.AudioContext||window.webkitAudioContext; if(AC && !audio) audio=new AC(); }catch(e){}
      var list=gd.timer, idx=0, big=box.querySelector(".big"), lbl=box.querySelector(".lbl"), nx=box.querySelector(".nx");
      function begin(){
        if(idx>=list.length){ box.className="gtimer show end"; lbl.textContent="Terminé !"; big.textContent="✓"; nx.textContent=""; tick=null; return; }
        var it=list[idx], left=it.sec;
        box.className="gtimer show"; lbl.textContent=it.label; big.textContent=mmss(left);
        nx.textContent=(idx+1<list.length)?"Ensuite : "+list[idx+1].label:"";
        tick=setInterval(function(){
          left--; big.textContent=mmss(left);
          if(left<=0){ clearInterval(tick); tick=null; beep(); setCk(it.tick,true); idx++; begin(); }
        },1000);
      }
      begin();
    };
  }

  function refresh(){
    var left=0, j;
    for(j=0;j<gd.steps.length;j++){ if(!get(j)) left++; }
    document.getElementById("finish").className=left===0?"ready":"";
    document.getElementById("left").textContent=left===0?"Bravo, tout est coché !":"Il reste "+left+" case"+(left>1?"s":"")+" à cocher.";
  }
  var cks=document.querySelectorAll(".gck");
  for(var k=0;k<cks.length;k++){
    cks[k].onclick=function(){
      var idx=parseInt(this.getAttribute("data-i"),10), on=!get(idx);
      set(idx,on);
      this.className="gck"+(on?" on":"");
      this.textContent=(on?"✓ ":"")+gd.steps[idx].ck;
      refresh();
    };
  }
  document.getElementById("finish").onclick=function(){
    var left=0, j;
    for(j=0;j<gd.steps.length;j++){ if(!get(j)) left++; }
    if(left>0) return;
    var tasks=C.buildTasks(cfg,today,C.addDays(today,1));
    tasks.forEach(function(t){ if(t.href===baseHref) C.setDone(kid,t,today,true); });
    location.href=back;
  };
  refresh();
})();
