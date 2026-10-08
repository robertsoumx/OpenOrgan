"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import AuthGate from "@/components/AuthGate";
import ProfileSummary from "@/components/ProfileSummary";
import StarRating from "@/components/StarRating";
import { db } from "@/lib/firebase-client";
import { toUserMessage } from "@/lib/user-error";

function humanize(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Stat({ label, value }) {
  return (
    <div className="trust-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Profile({ userId }) {
  const [profile, setProfile] = useState(null);
  const [contact, setContact] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!db || !userId) {
      setLoading(false);
      return;
    }

    Promise.all([
      getDoc(doc(db, "profiles", userId)),
      getDoc(doc(db, "publicContacts", userId)).catch(() => null),
      getDocs(query(collection(db, "userReviews"), where("userId", "==", userId))),
      getDoc(doc(db, "trustProfiles", userId))
    ])
      .then(([profileSnapshot, contactSnapshot, reviewSnapshot, trustSnapshot]) => {
        setProfile(profileSnapshot.exists() ? profileSnapshot.data() : null);
        setContact(contactSnapshot?.exists() ? contactSnapshot.data() : null);
        setReviews(reviewSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setCompleted(Number(trustSnapshot.exists() ? trustSnapshot.data().completedSessions || 0 : 0));
      })
      .catch((error) => setMessage(toUserMessage(error, "Unable to load this profile.")))
      .finally(() => setLoading(false));
  }, [userId]);

  const average = useMemo(
    () => reviews.length
      ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
      : 0,
    [reviews]
  );

  if (loading) {
    return <section className="section"><div className="container"><div className="skeleton" /></div></section>;
  }

  if (!profile) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Profile not found</h1>
          <p>{message || "This profile is unavailable."}</p>
        </div>
      </section>
    );
  }

  const organist = profile.profileType === "organist";

  return (
    <section className="section public-profile-page">
      <div className="container public-profile-layout">
        <div className="public-profile-main">
          <article className="card public-profile-identity">
            <span className="eyebrow">{organist ? "Trust profile" : "Organization profile"}</span>
            <ProfileSummary profile={profile} contact={contact} />
            {!organist && profile.website && (
              <a className="text-link" href={profile.website} target="_blank" rel="noreferrer">
                Official website
              </a>
            )}
          </article>

          {organist && (
            <>
              <article className="card trust-overview">
                <div className="trust-overview-heading">
                  <span className="eyebrow">Verified activity</span>
                  <h1>{reviews.length ? `${average.toFixed(1)} / 5` : "New profile"}</h1>
                  <p>{reviews.length ? `${reviews.length} verified host review${reviews.length === 1 ? "" : "s"}` : "No host reviews yet"}</p>
                </div>

                <dl className="trust-stat-grid">
                  <Stat label="Level" value={humanize(profile.experienceLevel) || "Not stated"} />
                  <Stat label="Experience" value={`${Number(profile.yearsExperience || 0)} year${Number(profile.yearsExperience || 0) === 1 ? "" : "s"}`} />
                  <Stat label="Age range" value={humanize(profile.ageRange) || "Not stated"} />
                  <Stat label="Completed sessions" value={String(completed)} />
                </dl>
              </article>

              <section className="card trust-reviews-section">
                <div className="section-heading-row">
                  <div>
                    <span className="eyebrow">Host feedback</span>
                    <h2>Verified reviews</h2>
                  </div>
                  <span className="review-count">{reviews.length}</span>
                </div>

                {reviews.length ? (
                  <div className="review-list">
                    {reviews.map((review) => (
                      <article key={review.id} className="review-card trust-review-card">
                        <div className="review-card-topline">
                          <StarRating value={review.rating} readOnly />
                          <span className="review-host-again">
                            {review.wouldHostAgain ? "Would host again" : "Would not host again"}
                          </span>
                        </div>
                        <p>{review.comment || "No written comment."}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Verified host reviews appear here after completed practice sessions.</p>
                )}
              </section>
            </>
          )}
        </div>

        <aside className="public-profile-aside">
          <article className="card profile-context-card">
            <span className="eyebrow">How trust works</span>
            <h2>{organist ? "Session-based feedback" : "Verified organization"}</h2>
            <p className="muted">
              {organist
                ? "Host reviews can only be created after a completed OpenOrgan reservation. Ratings are tied to verified sessions."
                : "Organization identity, publishing permissions, and listing claims are reviewed separately by The OpenOrgan Project."}
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default function PublicProfileClient({ userId }) {
  return <AuthGate><Profile userId={userId} /></AuthGate>;
}
