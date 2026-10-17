"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
export default function InterfaceMotion() {
  const pathname=usePathname();
  useEffect(()=>{
    const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(preference.matches||!("IntersectionObserver" in window))return;
    const selector=".home-events-heading,.event-card,.organ-card,.about-page .grid-3 > .card,.guide-step,.dashboard-shortcuts > button",seen=new WeakSet();
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("arrive");observer.unobserve(entry.target);}}),{threshold:.06});
    function register(root){const nodes=[...(root.matches?.(selector)?[root]:[]),...(root.querySelectorAll?.(selector)||[])];nodes.forEach(node=>{if(!seen.has(node)){seen.add(node);observer.observe(node);}});}
    const main=document.getElementById("main-content");if(!main)return;register(main);
    const changes=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)register(node);})));
    changes.observe(main,{childList:true,subtree:true});
    return ()=>{observer.disconnect();changes.disconnect();};
  },[pathname]);
  return null;
}
