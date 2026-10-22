export function PipeMark({ className = "" }) {
  return <svg className={`pipe-mark ${className}`} viewBox="0 0 40 46" aria-hidden="true" focusable="false"><path d="M3 25h6v17H3zM12 12h6v30h-6zM22 3h6v39h-6zM31 18h6v24h-6z" fill="currentColor"/><path d="M1 44h38" stroke="currentColor" strokeWidth="2"/></svg>;
}

export function KeyboardRule({ className = "" }) {
  return <div className={`keyboard-rule ${className}`} aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <span key={i} className={[0, 1, 3, 4, 5].includes(i % 7) ? "has-sharp" : ""}/>)}</div>;
}

// Musical linework stays behind the content.
export function HeroPattern() {
  return <svg className="hero-pattern" viewBox="0 0 480 420" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="1.2">
      {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${52 + i * 30} -20v108c0 ${192 - i * 18} ${154 - i * 12} ${192 - i * 18} ${308 - i * 30} ${192 - i * 18}h160`}/>)}
    </g>
    <path d="M22 -20v108c0 210 166 210 338 210h160" stroke="#9a682f" strokeWidth="1.2"/>
  </svg>;
}
