"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="fatal-error-page">
          <section className="empty-state">
            <h1>The OpenOrgan Project is temporarily unavailable.</h1>
            <p>Try again. Your account and saved information have not been removed.</p>
            <button className="button" onClick={() => reset()}>Reload</button>
          </section>
        </main>
      </body>
    </html>
  );
}
