"use client";
export default function StarRating({ value = 0, onChange, readOnly = false }) {
  return <div className="star-rating" aria-label={`${value} out of 5 stars`}>{[1,2,3,4,5].map(star => <button key={star} type="button" disabled={readOnly} className={star <= value ? "selected" : ""} onClick={() => onChange?.(star)} aria-label={`${star} star${star === 1 ? "" : "s"}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7L2.3 9.1l6.7-1z"/></svg></button>)}</div>;
}
