"use client";
import dynamic from "next/dynamic";
import {useCallback,useEffect,useMemo,useState} from "react";
import {collection,getDocs} from "firebase/firestore";
import {db} from "@/lib/firebase-client";
import OrganCard from "@/components/OrganCard";
import RouteSearch,{useRouteRanking} from "@/components/RouteSearch";
import {toDate} from "@/lib/format";
import {coordinates} from "@/lib/directory-core.mjs";
const SearchMap=dynamic(()=>import("@/components/SearchMap"),{ssr:false,loading:()=> <div className="skeleton map-shell"/>});
export default function SearchExperience({initialOrgans=[]}) {
  const [organs,setOrgans]=useState(initialOrgans),[loading,setLoading]=useState(!initialOrgans.length),[notice,setNotice]=useState("");
  const [search,setSearch]=useState(""),[sort,setSort]=useState("name"),[limit,setLimit]=useState(20),[selectedId,setSelectedId]=useState(""),[view,setView]=useState("list");
  const ranking=useRouteRanking("organs",organs);
  useEffect(()=>{
    let cancelled=false;
    Promise.all([fetch("/api/directory").then(r=>{if(!r.ok)throw new Error();return r.json();}),db?getDocs(collection(db,"organReviews")).catch(()=>({docs:[]})):Promise.resolve({docs:[]})]).then(([data,reviews])=>{
      if(cancelled)return;
      const grouped=new Map();reviews.docs.forEach(d=>{const r=d.data();if(!grouped.has(r.organId))grouped.set(r.organId,[]);grouped.get(r.organId).push(Number(r.rating));});
      setOrgans(data.organs.map(organ=>{const values=grouped.get(organ.id)||[];return {...organ,ratingAverage:values.length?values.reduce((n,x)=>n+x,0)/values.length:0,ratingCount:values.length};}));
    }).catch(()=>{if(!cancelled)setNotice(initialOrgans.length?"Showing the last loaded directory while updates are unavailable.":"The directory is temporarily unavailable.");}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[]);
  const filtered=useMemo(()=>organs.filter(o=>[o.name,o.organizationName,o.builder,o.location?.city,o.location?.formattedAddress].join(" ").toLowerCase().includes(search.trim().toLowerCase())).map(o=>({...o,...ranking.routes[o.id]})).sort((a,b)=>{
    if(sort==="distance"&&ranking.ready)return (a.routeDistanceMeters??Infinity)-(b.routeDistanceMeters??Infinity)||a.name.localeCompare(b.name);
    if(sort==="rating")return (b.ratingAverage||0)-(a.ratingAverage||0)||a.name.localeCompare(b.name);
    if(sort==="newest")return (toDate(b.createdAt)?.getTime()||0)-(toDate(a.createdAt)?.getTime()||0);
    return a.name.localeCompare(b.name);
  }),[organs,search,sort,ranking.routes,ranking.ready]);
  useEffect(()=>{if(ranking.ready)setSort("distance");},[ranking.ready,ranking.origin]);
  const displayed=limit==="all"?filtered:filtered.slice(0,Number(limit));
  const mapped=useMemo(()=>filtered.filter(o=>coordinates(o.location)),[filtered]);
  const selectFromMap=useCallback(id=>{setSelectedId(id);setLimit("all");setView("list");requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById(`organ-card-${id}`)?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"})));},[]);
  return <div className="search-layout">
    <section className={`search-list-panel ${view==="map"?"mobile-hidden":""}`}>
      <header className="page-header compact directory-heading"><span className="eyebrow">Organ directory</span><h1>Find organs</h1><p>Compare instruments, locations, practice costs, and availability.</p></header>
      <div className="mobile-view-toggle"><button className="button" aria-pressed={view==="list"} onClick={()=>setView("list")}>List</button><button className="button-secondary" aria-pressed={view==="map"} onClick={()=>setView("map")}>Map</button></div>
      <div className="search-toolbar search-toolbar-extended"><input type="search" aria-label="Search organs" placeholder="Church, city, address, or builder" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Order organs" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Church name</option><option value="distance" disabled={!ranking.ready}>Nearest by driving route</option><option value="rating">Highest rated</option><option value="newest">Newest listing</option></select><select aria-label="Number of list results" value={limit} onChange={e=>setLimit(e.target.value==="all"?"all":Number(e.target.value))}>{[20,50,100].map(n=><option key={n} value={n}>List {n}</option>)}<option value="all">List all</option></select></div>
      <RouteSearch ranking={ranking}/>
      <p className="small directory-results-count" role="status">{filtered.length} matching organs · {mapped.length} on map · {displayed.length} shown in list</p>
      {notice&&<div className="message warning" role="status">{notice}</div>}
      {loading?<div className="stack"><div className="skeleton"/><div className="skeleton"/></div>:displayed.length?<div className="stack search-results">{displayed.map(organ=><OrganCard key={organ.id} organ={organ} selected={selectedId===organ.id} onHover={setSelectedId}/>)}</div>:<div className="empty-state"><h2>No organs found</h2><p>Try another church, place, or builder.</p><button className="button-secondary" onClick={()=>setSearch("")}>Clear search</button></div>}
      {displayed.length<filtered.length&&<button className="button-secondary load-results" onClick={()=>setLimit(limit==="all"?"all":Number(limit)+50)}>Show more results</button>}
    </section>
    <aside className={`search-map-panel ${view==="list"?"mobile-hidden":""}`}><div className="mobile-view-toggle"><button className="button-secondary" onClick={()=>setView("list")}>List</button><button className="button" onClick={()=>setView("map")}>Map</button></div><SearchMap organs={mapped} selectedId={selectedId} onSelect={selectFromMap} userLocation={ranking.origin?{lat:ranking.origin.latitude,lng:ranking.origin.longitude}:null}/></aside>
  </div>;
}
