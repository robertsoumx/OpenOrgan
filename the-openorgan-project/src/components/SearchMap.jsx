"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {loadGoogleMaps} from "@/lib/google-maps-client";
import {coordinates,geographicGroups} from "@/lib/directory-core.mjs";
export default function SearchMap({organs,selectedId,onSelect,userLocation}) {
  const node=useRef(null),map=useRef(null),mapsRef=useRef(null),markers=useRef([]),callback=useRef(onSelect),data=useRef(organs),previousScope=useRef("");
  const [ready,setReady]=useState(false),[zoom,setZoom]=useState(10),[error,setError]=useState("");
  callback.current=onSelect;data.current=organs;
  const scope=useMemo(()=>organs.map(o=>`${o.id}:${o.location.latitude},${o.location.longitude}`).sort().join("|"),[organs]);
  useEffect(()=>{
    let cancelled=false,listener,resize;let wasHidden=true;
    (async()=>{try{const maps=await loadGoogleMaps();await Promise.all([maps.importLibrary("maps"),maps.importLibrary("marker")]);if(cancelled)return;mapsRef.current=maps;map.current=new maps.Map(node.current,{center:{lat:42.3601,lng:-71.0589},zoom:10,mapId:process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID||"DEMO_MAP_ID",mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:"cooperative"});listener=map.current.addListener("idle",()=>setZoom(Math.floor(map.current.getZoom() || 10)));resize=new ResizeObserver(()=>{const visible=node.current?.getBoundingClientRect().width>0;if(visible){maps.event.trigger(map.current,"resize");if(wasHidden)fitAll();}wasHidden=!visible;});resize.observe(node.current);setReady(true);}catch{if(!cancelled)setError("The map is unavailable; the full directory is still shown in the list.");}})();
    return ()=>{cancelled=true;listener?.remove();resize?.disconnect();markers.current.forEach(({marker})=>{marker.map=null;});markers.current=[];};
  },[]);
  function fitAll() {
    if(!map.current||!node.current?.getBoundingClientRect().width)return;const bounds=new mapsRef.current.LatLngBounds();data.current.forEach(o=>{const p=coordinates(o.location);if(p)bounds.extend(p);});
    if(data.current.length>1)map.current.fitBounds(bounds,52);else if(data.current.length===1){map.current.setCenter(coordinates(data.current[0].location));map.current.setZoom(15);}
  }
  useEffect(()=>{if(ready&&scope!==previousScope.current){previousScope.current=scope;fitAll();}},[ready,scope]);
  useEffect(()=>{
    if(!ready)return;
    const maps=mapsRef.current;markers.current.forEach(({marker})=>{marker.map=null;});markers.current=[];
    for(const group of geographicGroups(data.current,zoom)) {
      const points=group.map(o=>coordinates(o.location)),position={lat:points.reduce((n,p)=>n+p.lat,0)/points.length,lng:points.reduce((n,p)=>n+p.lng,0)/points.length};
      const button=document.createElement("div");button.className=`map-marker ${group.length>1?"map-cluster":"map-organ-pin"}`;
      button.textContent=group.length>1?String(group.length):"";button.setAttribute("aria-label",group.length>1?`Zoom to ${group.length} organs`:`Select ${group[0].organizationName || group[0].name}`);
      if(group.length===1){const icon=document.createElement("span");icon.className="marker-pipes";icon.setAttribute("aria-hidden","true");for(let i=0;i<3;i++)icon.appendChild(document.createElement("i"));button.appendChild(icon);}
      const activate=()=>{if(group.length===1)callback.current(group[0].id);else{const bounds=new maps.LatLngBounds();points.forEach(p=>bounds.extend(p));map.current.fitBounds(bounds,70);}};
      const marker=new maps.marker.AdvancedMarkerElement({map:map.current,position,content:button,gmpClickable:true,title:group.length>1?`${group.length} organs; zoom to expand`:[group[0].name,group[0].location?.city].filter(Boolean).join(", ")});marker.addEventListener("gmp-click",activate);markers.current.push({marker,button,ids:group.map(o=>o.id)});
    }
    if(userLocation){const button=document.createElement("span");button.className="map-origin-pin";button.textContent="Start";const marker=new maps.marker.AdvancedMarkerElement({map:map.current,position:userLocation,content:button,title:"Route starting place"});markers.current.push({marker,button,ids:[]});}
    return ()=>{markers.current.forEach(({marker})=>{marker.map=null;});markers.current=[];};
  },[ready,scope,zoom,userLocation?.lat,userLocation?.lng]);
  useEffect(()=>{markers.current.forEach(({button,ids})=>button.classList.toggle("selected",ids.includes(selectedId)));},[selectedId,ready,scope,zoom,userLocation?.lat,userLocation?.lng]);
  return <div className="map-container"><div className="map-toolbar"><span>{organs.length} organs on map</span><button className="button-secondary" onClick={fitAll} disabled={!ready}>Fit all results</button></div>{error?<div className="map-fallback" role="status"><p>{error}</p></div>:<div ref={node} className="search-map" aria-label="Map of all matching organs"/>}<div className="map-legend"><span className="legend-pipe" aria-hidden="true"/>Organ<span className="legend-group-note">Numbers group nearby organs</span></div></div>;
}
