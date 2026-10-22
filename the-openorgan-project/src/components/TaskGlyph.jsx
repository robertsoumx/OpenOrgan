export default function TaskGlyph({ kind = "organ", className = "" }) {
  return <svg className={"task-glyph " + className} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === "event" ? <><rect x="6" y="9" width="28" height="26" rx="2"/><path d="M6 17h28M13 5v8M27 5v8M24 21v9m0-9 5-1v4"/><ellipse cx="20.5" cy="30.5" rx="3.5" ry="2.5"/></> : kind === "access" ? <><circle cx="14" cy="15" r="8"/><path d="m20 21 14 14m-5-5 4-4m-9-1 4-4"/><circle cx="12" cy="13" r="1"/></> : kind === "place" ? <><path d="M31 16c0 9-11 20-11 20S9 25 9 16a11 11 0 0 1 22 0Z"/><circle cx="20" cy="16" r="4"/></> : <><path d="M6 35V18h5v17m4 0V8h5v27m4 0V4h5v31m4 0V13h4v22M3 36h35M6 23h5M15 13h5M24 9h5M33 18h4"/></>}
  </svg>;
}
