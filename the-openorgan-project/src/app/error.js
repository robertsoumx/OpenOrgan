"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="section">
      <div className="container empty-state">
        <span className="eyebrow">Temporary problem</span>
        <h1>This page could not finish loading.</h1>
        <p>Nothing you entered has been changed. Try loading the page again.</p>
        <button className="button" onClick={() => reset()}>Try Again</button>
      </div>
    </section>
  );
}
