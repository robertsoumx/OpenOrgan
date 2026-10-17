import Link from "next/link";
const heights=[117,147,179,211,236,260,282,296,306,296,282,260,236,211,179,147,117];
export function PipeMark({className=""}) {
  return <svg className={`pipe-mark ${className}`} viewBox="0 0 40 46" aria-hidden="true"><path d="M3 25h6v17H3zM12 12h6v30h-6zM22 3h6v39h-6zM31 18h6v24h-6z" fill="currentColor"/><path d="M1 44h38" stroke="currentColor" strokeWidth="2"/></svg>;
}
export function KeyboardRule({className=""}) {
  return <div className={`keyboard-rule ${className}`} aria-hidden="true">{Array.from({length:42},(_,i)=><span key={i} className={[0,1,3,4,5].includes(i%7)?"has-sharp":""}/>)}</div>;
}
export default function OrganShowcase() {
  return <aside className="organ-showcase" aria-label="Explore OpenOrgan"><div className="organ-facade">
    <div className="facade-heading"><span>OpenOrgan</span><span>Organs · Events · Practice</span></div>
    <svg className="facade-drawing" viewBox="0 0 500 420" aria-hidden="true">
      <defs><linearGradient id="oo-pipe-metal"><stop offset="0" stopColor="#a67e59"/><stop offset=".22" stopColor="#efdfb9"/><stop offset=".48" stopColor="#fff5d9"/><stop offset=".7" stopColor="#d7b982"/><stop offset="1" stopColor="#8f6549"/></linearGradient><linearGradient id="oo-case-wood" x2="0" y2="1"><stop stopColor="#753347"/><stop offset="1" stopColor="#35101f"/></linearGradient><radialGradient id="oo-organ-light"><stop stopColor="#b26575" stopOpacity=".4"/><stop offset="1" stopColor="#451022" stopOpacity="0"/></radialGradient></defs>
      <ellipse cx="250" cy="190" rx="250" ry="210" fill="url(#oo-organ-light)"/>
      <path d="M44 311V60Q140 21 250 14Q360 21 456 60V311" fill="none" stroke="#d0a66c" strokeWidth="2"/>
      <path d="M54 311V66Q150 29 250 24Q350 29 446 66V311" fill="none" stroke="#a77e65" strokeWidth=".6"/>
      {heights.map((height,i)=>{const x=70+i*21,y=318-height;return <g className="facade-pipe" key={i} style={{"--pipe-delay":`${i*24}ms`}}><rect x={x} y={y} width="17" height={height} rx="8.5" fill="url(#oo-pipe-metal)"/><path d={`M${x+2} ${y+height*.7}h13v7l-6.5 3-6.5-3z`} fill="#633241"/><path d={`M${x+5} ${y+13}v${height*.6-10}`} stroke="#fff5d9" strokeOpacity=".5" strokeWidth=".8"/></g>;})}
      <rect x="39" y="307" width="422" height="12" fill="#b99065"/><path d="M42 319h416v79H42z" fill="url(#oo-case-wood)" stroke="#af7b63"/>
      {[0,1].map(row=><g key={row} transform={`translate(100 ${331+row*25})`}>{Array.from({length:28},(_,i)=><rect key={`w${i}`} x={i*10.7} width="10.2" height="21" rx=".6" fill="#f9efda" stroke="#b9a78d" strokeWidth=".5"/>)}{Array.from({length:27},(_,i)=>[0,1,3,4,5].includes(i%7)?<rect className="facade-key" key={`b${i}`} x={i*10.7+7.5} width="6" height="13.5" fill="#281821"/>:null)}</g>)}
      {[62,78,422,438].map(x=>[337,357,377].map(y=><g key={`${x}-${y}`}><circle cx={x} cy={y} r="5" fill="#efdfb9"/><circle cx={x} cy={y} r="2" fill="#6b3343"/></g>))}
      <rect x="86" y="385" width="328" height="6" fill="#d1ac78"/><path d="M48 402h404" stroke="#be946c"/>
    </svg>
    <div className="facade-caption"><PipeMark/><span><strong>Explore pipe organs</strong></span><span className="facade-stop">8′ · 4′ · 2′</span></div>
  </div><nav className="console-links" aria-label="OpenOrgan shortcuts"><Link href="/search"><span>01</span>Find organs<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5"/></svg></Link><Link href="/events"><span>02</span>Browse events<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5"/></svg></Link><Link href="/guide"><span>03</span>User guide<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5"/></svg></Link></nav></aside>;
}
