"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import AuthGate from "@/components/AuthGate";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase-client";
import ImageUpload from "@/components/ImageUpload";
import { toUserMessage } from "@/lib/user-error";

function Editor() {
  const { user, account, profile, refresh } = useAuth();
  const [form, setForm] = useState({});
  const [contact, setContact] = useState({ email: "", visible: false });
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  useEffect(() => {
    if (!db || !user) return;
    getDoc(doc(db, "publicContacts", user.uid))
      .then((snapshot) => {
        setContact(snapshot.exists()
          ? snapshot.data()
          : { email: user.email || "", visible: false });
      })
      .catch(() => setContact({ email: user.email || "", visible: false }));
  }, [user?.uid]);

  function patch(changes) {
    setForm((current) => ({ ...current, ...changes }));
  }

  async function save(event) {
    event.preventDefault();
    setWorking(true);
    setNotice({ type: "", text: "" });

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "profiles", user.uid), {
        ...form,
        userId: user.uid,
        profileType: account.role,
        updatedAt: serverTimestamp()
      }, { merge: true });
      batch.set(doc(db, "publicContacts", user.uid), {
        userId: user.uid,
        email: contact.email.trim().toLowerCase(),
        visible: Boolean(contact.visible),
        updatedAt: serverTimestamp()
      }, { merge: true });
      batch.update(doc(db, "users", user.uid), { updatedAt: serverTimestamp() });
      await batch.commit();
      await refresh();
      setNotice({ type: "success", text: "Profile saved." });
    } catch (error) {
      setNotice({
        type: "error",
        text: toUserMessage(error, "We could not save the profile. Try again.")
      });
    } finally {
      setWorking(false);
    }
  }

  const organization = account?.role === "organization";

  return (
    <section className="section profile-page">
      <div className="container profile-editor-shell">
        <header className="profile-editor-header">
          <div>
            <span className="eyebrow">Your profile</span>
            <h1>{organization ? "Organization profile" : "Organist profile"}</h1>
            <p>{organization
              ? "Keep the public organization and administrator details current."
              : "Give hosts enough context to understand who is requesting access."}</p>
          </div>
          <div className="profile-header-mark" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </header>

        <form className="profile-editor-form" onSubmit={save}>
          {organization ? (
            <>
              <section className="profile-section profile-section-primary">
                <div className="profile-section-heading">
                  <span className="profile-section-number">01</span>
                  <div>
                    <h2>Organization</h2>
                    <p>Public information shown on listings and events.</p>
                  </div>
                </div>

                <div className="profile-section-content">
                  <div className="form-grid">
                    <label>
                      Organization name
                      <input
                        value={form.organizationName || ""}
                        onChange={(event) => patch({
                          organizationName: event.target.value,
                          displayName: event.target.value
                        })}
                        required
                      />
                    </label>
                    <label>
                      Official website
                      <input
                        type="url"
                        value={form.website || ""}
                        onChange={(event) => patch({ website: event.target.value })}
                        placeholder="https://example.org"
                      />
                    </label>
                  </div>

                  <label>
                    Short description
                    <textarea
                      value={form.bio || ""}
                      onChange={(event) => patch({ bio: event.target.value })}
                      placeholder="A short public description of the organization."
                    />
                  </label>

                  <ImageUpload
                    label="Organization photo"
                    pathPrefix={`profiles/${user.uid}/organization`}
                    value={form.photoURL}
                    storagePath={form.photoPath}
                    onChange={({ url, path }) => patch({ photoURL: url, photoPath: path })}
                  />
                </div>
              </section>

              <section className="profile-section profile-section-rose">
                <div className="profile-section-heading">
                  <span className="profile-section-number">02</span>
                  <div>
                    <h2>Administrator</h2>
                    <p>The person who manages requests and access.</p>
                  </div>
                </div>

                <div className="profile-section-content">
                  <label>
                    Administrator name
                    <input
                      value={form.administratorName || ""}
                      onChange={(event) => patch({ administratorName: event.target.value })}
                    />
                  </label>

                  <label>
                    Administrator description
                    <textarea
                      value={form.administratorBio || ""}
                      onChange={(event) => patch({ administratorBio: event.target.value })}
                      placeholder="Role, music program, or anything useful for visiting organists."
                    />
                  </label>

                  <ImageUpload
                    label="Administrator photo"
                    pathPrefix={`profiles/${user.uid}/administrator`}
                    value={form.administratorPhotoURL}
                    storagePath={form.administratorPhotoPath}
                    onChange={({ url, path }) => patch({
                      administratorPhotoURL: url,
                      administratorPhotoPath: path
                    })}
                  />
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="profile-section profile-section-primary">
                <div className="profile-section-heading">
                  <span className="profile-section-number">01</span>
                  <div>
                    <h2>Identity</h2>
                    <p>Your public introduction to host organizations.</p>
                  </div>
                </div>

                <div className="profile-section-content profile-identity-grid">
                  <div className="stack">
                    <label>
                      Name
                      <input
                        value={form.displayName || ""}
                        onChange={(event) => patch({ displayName: event.target.value })}
                        required
                      />
                    </label>

                    <label>
                      Bio
                      <textarea
                        value={form.bio || ""}
                        onChange={(event) => patch({ bio: event.target.value })}
                        placeholder="What do you study, play, or hope to practice?"
                      />
                    </label>
                  </div>

                  <ImageUpload
                    label="Profile photo"
                    pathPrefix={`profiles/${user.uid}/organist`}
                    value={form.photoURL}
                    storagePath={form.photoPath}
                    onChange={({ url, path }) => patch({ photoURL: url, photoPath: path })}
                  />
                </div>
              </section>

              <section className="profile-section profile-section-blush">
                <div className="profile-section-heading">
                  <span className="profile-section-number">02</span>
                  <div>
                    <h2>Experience</h2>
                    <p>Simple context for hosts reviewing a request.</p>
                  </div>
                </div>

                <div className="profile-section-content">
                  <div className="form-grid form-grid-3">
                    <label>
                      Level
                      <select
                        value={form.experienceLevel || "student"}
                        onChange={(event) => patch({ experienceLevel: event.target.value })}
                      >
                        <option value="beginner">Beginner</option>
                        <option value="student">Student</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="professional">Professional</option>
                      </select>
                    </label>

                    <label>
                      Years playing
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={form.yearsExperience ?? 0}
                        onChange={(event) => patch({ yearsExperience: Number(event.target.value) })}
                      />
                    </label>

                    <label>
                      Age range
                      <select
                        value={form.ageRange || "prefer_not_to_say"}
                        onChange={(event) => patch({ ageRange: event.target.value })}
                      >
                        <option value="under_18">Under 18</option>
                        <option value="18_24">18–24</option>
                        <option value="25_34">25–34</option>
                        <option value="35_49">35–49</option>
                        <option value="50_plus">50+</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label>
                      City
                      <input value={form.city || ""} onChange={(event) => patch({ city: event.target.value })} />
                    </label>
                    <label>
                      State / region
                      <input value={form.region || ""} onChange={(event) => patch({ region: event.target.value })} />
                    </label>
                  </div>
                </div>
              </section>
            </>
          )}

          <section className="profile-section profile-section-contact">
            <div className="profile-section-heading">
              <span className="profile-section-number">03</span>
              <div>
                <h2>Contact</h2>
                <p>You control whether signed-in members can see this address.</p>
              </div>
            </div>

            <div className="profile-section-content contact-setting-grid">
              <label>
                Contact email
                <input
                  type="email"
                  value={contact.email || ""}
                  onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
                />
              </label>

              <label className="visibility-toggle">
                <input
                  className="visibility-toggle-input"
                  type="checkbox"
                  checked={Boolean(contact.visible)}
                  onChange={(event) => setContact((current) => ({ ...current, visible: event.target.checked }))}
                />
                <span className="visibility-toggle-control" aria-hidden="true" />
                <strong>Show contact email to signed-in members</strong>
              </label>
            </div>
          </section>

          <div className="profile-save-bar">
            <div>
              {notice.text && (
                <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
                  {notice.text}
                </div>
              )}
            </div>
            <button className="button" disabled={working}>
              {working ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default function ProfileEditor() {
  return <AuthGate><Editor /></AuthGate>;
}
