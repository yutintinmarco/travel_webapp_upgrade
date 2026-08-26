
  // v7.7.5.0 · Performance Lite. Memory only: no Firebase reads/writes, no
  // persistent diagnostic log and no scroll-frame instrumentation.
  (function(){
    var startedAt=performance.now();
    var marks=Object.create(null),counters=Object.create(null);
    var navigationType="navigate";
    try{var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(nav&&nav.type)navigationType=nav.type;}catch(e){}
    // v7.8.0.5 · Fast Resume applies to both a Home Screen PWA launch and an
    // in-app reload whenever this device remembers a user-bound active Trip.
    var entryWarmRefresh=false;
    try{
      var rememberedUid=String(localStorage.getItem("travel_last_auth_uid")||"").trim();
      var rememberedTrip=String(localStorage.getItem("travel_active_trip_id")||"").trim();
      entryWarmRefresh=!!rememberedUid&&!!rememberedTrip;
    }catch(e){}
    window.__entryWarmRefreshCandidate=entryWarmRefresh;
    document.documentElement.classList.toggle("app-entry-refresh-warm",entryWarmRefresh);
    function notify(){try{if(typeof window.__refreshPerfLiteDiagnostics==="function")window.__refreshPerfLiteDiagnostics();}catch(e){}}
    window.__perfLite={
      navigationType:navigationType,
      marks:marks,
      counters:counters,
      mark:function(name){if(!name||marks[name]!=null)return marks[name];var value=Math.max(0,performance.now()-startedAt);marks[name]=value;notify();return value;},
      inc:function(name,amount){if(!name)return 0;var step=Number(amount);if(!Number.isFinite(step))step=1;counters[name]=(Number(counters[name])||0)+step;notify();return counters[name];},
      snapshot:function(){return{navigationType:navigationType,marks:Object.assign({},marks),counters:Object.assign({},counters)};}
    };
    marks.appStart=0;
  })();

  // v7.7.5.0 · Native warm boot + temporal header harmony. Apply synchronous user / Trip appearance
  // state before the first body paint, then let IndexedDB + Firestore reconcile
  // silently. This prevents the default palette / background / font size from
  // flashing for a frame before the remembered Firebase Trip is available.
  (function(){
    var root=document.documentElement;
    try{
      var standalone=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone===true;
      root.classList.toggle("is-standalone",!!standalone);
      var savedTheme=localStorage.getItem("trip_theme")||"auto";
      root.classList.remove("theme-light","theme-dark");
      if(savedTheme==="dark")root.classList.add("theme-dark");
      else if(savedTheme==="light")root.classList.add("theme-light");
      else{
        var sun=null;
        try{sun=JSON.parse(localStorage.getItem("trip_sun")||"null");}catch(e){}
        var today=new Date().toISOString().slice(0,10);
        if(sun&&sun.date===today&&sun.rise&&sun.set){
          var now=new Date(),rise=new Date(sun.rise),set=new Date(sun.set);
          root.classList.add((now>=rise&&now<set)?"theme-light":"theme-dark");
        }else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)root.classList.add("theme-dark");
        else root.classList.add("theme-light");
      }
      var savedFont=parseFloat(localStorage.getItem("trip_font_scale")||"1");
      if(Number.isFinite(savedFont)&&savedFont>=0.85&&savedFont<=1.25)root.style.setProperty("--font-scale",String(savedFont));
    }catch(e){}
    try{
      var preferred="";
      try{var u=new URL(location.href);preferred=String(u.searchParams.get("trip")||u.searchParams.get("expensesTrip")||"").trim();}catch(e){}
      if(!preferred)preferred=String(localStorage.getItem("travel_active_trip_id")||"").trim();
      var snapshot=JSON.parse(localStorage.getItem("travel_boot_visual_v1")||"null");
      if(snapshot&&preferred&&String(snapshot.tripId||"")===preferred){
        if(snapshot.accentColor)root.style.setProperty("--accent-color",String(snapshot.accentColor));
        var featureColours=snapshot.featureColors&&typeof snapshot.featureColors==="object"?snapshot.featureColors:{};
        root.style.setProperty("--saved-accent",String(featureColours.savedPlaces||snapshot.accentColor||"#0a84ff"));
        root.style.setProperty("--expense-accent",String(featureColours.expenses||snapshot.accentColor||"#0a84ff"));
        if(snapshot.backgroundCss)root.style.setProperty("--trip-bg-source",String(snapshot.backgroundCss));
        var colours=snapshot.teamColors&&typeof snapshot.teamColors==="object"?snapshot.teamColors:{};
        Object.keys(colours).forEach(function(key){
          if(!/^[A-Za-z0-9_-]+$/.test(key))return;
          var value=String(colours[key]||"").trim();if(!value)return;
          root.style.setProperty("--"+key+"-color",value);
          if(key==="team1")root.style.setProperty("--team1-color",value);
          if(key==="team2")root.style.setProperty("--team2-color",value);
        });
        root.dataset.warmTripId=preferred;
        window.__tripBootVisualSnapshot=snapshot;
      }
    }catch(e){}
    try{window.__perfLite&&window.__perfLite.mark("visualBootApplied");}catch(e){}
  })();
  