(function(){
  var parts=window.__travelRuntimeParts||[];
  var source=parts.join("");
  var node=document.createElement("script");
  node.text=source+"\n//# sourceURL=travel-app-runtime.js";
  document.currentScript.before(node);
  try{delete window.__travelRuntimeParts;}catch(_){window.__travelRuntimeParts=[];}
})();
