import Image from "next/image";
export default function Logo({ compact = false }) { return <span className={`logo-lockup ${compact ? "compact" : ""}`}><Image src="/openorgan-logo.svg" width={compact ? 34 : 46} height={compact ? 34 : 46} alt="" priority /><span>{compact ? "OpenOrgan" : "The OpenOrgan Project"}</span></span>; }
