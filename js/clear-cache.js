(async function(){
try{
if("serviceWorker" in navigator){var rs=await navigator.serviceWorker.getRegistrations();for(var i=0;i<rs.length;i++)await rs[i].unregister();}
if("caches" in window){var ks=await caches.keys();for(var j=0;j<ks.length;j++)await caches.delete(ks[j]);}try{localStorage.removeItem("br_session");sessionStorage.removeItem("br_session");document.cookie="br_session=; Max-Age=0; Path=/; Secure; SameSite=Lax";}catch(e){}
}catch(e){}
setTimeout(function(){location.replace("./?br_refresh="+Date.now());},300);
})();
