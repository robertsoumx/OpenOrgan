"use client";
export default function StarRating({ value = 0, onChange, readOnly = false }) { return <div className="star-rating" aria-label={`${value} out of 5 stars`}>{[1,2,3,4,5].map((star) => <button key={star} type="button" disabled={readOnly} className={star <= value ? "selected" : ""} onClick={() => onChange?.(star)} aria-label={`${star} star${star === 1 ? "" : "s"}`}>★</button>)}</div>; }
