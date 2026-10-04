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
