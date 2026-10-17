"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-client";

export function useRouteRanking(kind,items) {
  const [routes,setRoutes]=useState({}),[origin,setOrigin]=useState(null),[loading,setLoading]=useState(false),[notice,setNotice]=useState("");
  const itemsRef=useRef(items),controller=useRef(null),alive=useRef(true);itemsRef.current=items;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  const rank=useCallback(async point=>{
    if(!alive.current)return;
    controller.current?.abort();const current=new AbortController();controller.current=current;
    setLoading(true);setNotice("");setRoutes({});setOrigin(point);
    try {
      const response=await fetch("/api/routes",{method:"POST",headers:{"Content-Type":"application/json"},signal:current.signal,body:JSON.stringify({kind,origin:point,ids:itemsRef.current.map(i=>i.id)})});
      const data=await response.json();if(!response.ok)throw new Error(data.message || "Driving routes are unavailable.");
      if(current.signal.aborted)return;
      setRoutes(Object.fromEntries(data.results.map(row=>[row.id,row])));
      setNotice(data.unavailable.length ? `${data.results.length} destinations ranked; unavailable routes appear last.` : "Driving routes calculated from your starting place.");
    }catch(error){if(!current.signal.aborted)setNotice(error.message || "Driving routes are unavailable.");}
    finally{if(!current.signal.aborted)setLoading(false);}
  },[kind]);
  function locate() {
    if(!navigator.geolocation){setNotice("Choose a starting address to calculate driving routes.");return;}
    setLoading(true);setNotice("Finding your location...");
    navigator.geolocation.getCurrentPosition(position=>rank({latitude:position.coords.latitude,longitude:position.coords.longitude,name:"Your location"}),()=>{setLoading(false);setNotice("Location access is unavailable; choose a starting address.");},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  }
  return {routes,origin,loading,notice,rank,locate,ready:Object.keys(routes).length>0};
}
function StartingPlace({onSelect}) {
  const node=useRef(null),callback=useRef(onSelect);callback.current=onSelect;
  const [error,setError]=useState("");
  useEffect(()=>{
    let cancelled=false,element,handler;
    (async()=>{try {
      const maps=await loadGoogleMaps(),places=await maps.importLibrary("places");if(cancelled)return;
      element=new places.PlaceAutocompleteElement();element.placeholder="Enter a starting address or place";element.setAttribute("aria-label","Starting address");
      handler=async event=>{try{const place=event.placePrediction?.toPlace();if(!place)return;await place.fetchFields({fields:["location","displayName","formattedAddress"]});if(cancelled||!place.location)return;callback.current({latitude:place.location.lat(),longitude:place.location.lng(),name:place.displayName || place.formattedAddress});}catch{setError("Select a specific place from the search results.");}};
      element.addEventListener("gmp-select",handler);node.current?.appendChild(element);
    }catch{if(!cancelled)setError("Address search is unavailable; try using your location.");}})();
    return ()=>{cancelled=true;if(element&&handler)element.removeEventListener("gmp-select",handler);element?.remove();};
  },[]);
  return <div className="starting-place"><div ref={node}/>{error&&<p role="alert">{error}</p>}</div>;
}
export default function RouteSearch({ranking}) {
  const [addressOpen,setAddressOpen]=useState(false);
  return <section className="route-search" aria-label="Starting place for driving routes"><div className="route-search-actions"><span className="route-label">Nearest by route</span><button className="button-secondary" disabled={ranking.loading} onClick={ranking.locate}>{ranking.loading?"Calculating...":"Use my location"}</button><button className="button-secondary" disabled={ranking.loading} aria-expanded={addressOpen} onClick={()=>setAddressOpen(!addressOpen)}>{addressOpen?"Hide address search":"Choose starting address"}</button></div>{addressOpen&&<StartingPlace onSelect={ranking.rank}/>}<p className="small route-status" role="status" aria-live="polite">{ranking.notice || "Choose a starting place to compare driving distances."}{ranking.ready&&ranking.origin?.name?` From: ${ranking.origin.name}`:""}</p></section>;
}
