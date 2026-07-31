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
    <section className="section">
      <div className="container narrow">
        <form className="card stack-lg" onSubmit={save}>
          <div>
            <span className="eyebrow">Your profile</span>
            <h1>{organization ? "Organization and administrator" : "Organist profile"}</h1>
          </div>

          {organization ? (
            <>
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

              <label>
                Organization description
                <textarea
                  value={form.bio || ""}
                  onChange={(event) => patch({ bio: event.target.value })}
                />
              </label>

              <ImageUpload
                label="Organization photo"
                pathPrefix={`profiles/${user.uid}/organization`}
                value={form.photoURL}
                storagePath={form.photoPath}
                onChange={({ url, path }) => patch({ photoURL: url, photoPath: path })}
              />

              <hr />
              <h2>Account administrator</h2>

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
                  placeholder="The person who manages access and responds to requests."
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
            </>
          ) : (
            <>
              <label>
                Name
                <input
                  value={form.displayName || ""}
                  onChange={(event) => patch({ displayName: event.target.value })}
                  required
                />
              </label>

              <ImageUpload
                label="Profile photo"
                pathPrefix={`profiles/${user.uid}/organist`}
                value={form.photoURL}
                storagePath={form.photoPath}
                onChange={({ url, path }) => patch({ photoURL: url, photoPath: path })}
              />

              <label>
                Bio
                <textarea
                  value={form.bio || ""}
                  onChange={(event) => patch({ bio: event.target.value })}
                  placeholder="Tell organizations who you are and what you study."
                />
              </label>

              <div className="form-grid">
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
                  Years of experience
                  <input
                    type="number"
                    min="0"
                    max="80"
                    value={form.yearsExperience ?? 0}
                    onChange={(event) => patch({ yearsExperience: Number(event.target.value) })}
                  />
                </label>
              </div>

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

              <div className="form-grid">
                <label>
                  City
                  <input
                    value={form.city || ""}
                    onChange={(event) => patch({ city: event.target.value })}
                  />
                </label>
                <label>
                  State / region
                  <input
                    value={form.region || ""}
                    onChange={(event) => patch({ region: event.target.value })}
                  />
                </label>
              </div>
            </>
          )}

          <fieldset className="fieldset stack">
            <legend>Contact email</legend>
            <label>
              Email
              <input
                type="email"
                value={contact.email || ""}
                onChange={(event) => setContact((current) => ({
                  ...current,
                  email: event.target.value
                }))}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(contact.visible)}
                onChange={(event) => setContact((current) => ({
                  ...current,
                  visible: event.target.checked
                }))}
              />
              Allow other OpenOrgan members to see this email
            </label>
            <p className="muted small">
              When hidden, the email remains private during reservations and event signups.
            </p>
          </fieldset>

          <button className="button" disabled={working}>
            {working ? "Saving..." : "Save Profile"}
          </button>

          {notice.text && (
            <div className={`message ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
              {notice.text}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

export default function ProfileEditor() {
  return <AuthGate><Editor /></AuthGate>;
}
