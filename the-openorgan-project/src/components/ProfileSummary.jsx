import Image from "next/image";
import Link from "next/link";

export default function ProfileSummary({ profile, userId, contact }) {
  if (!profile) return <p className="muted">Profile information is unavailable.</p>;

  const isOrganization = profile.profileType === "organization";
  const photo = isOrganization
    ? profile.administratorPhotoURL || profile.photoURL
    : profile.photoURL;
  const name = isOrganization
    ? profile.administratorName || profile.organizationName || profile.displayName
    : profile.displayName;
  const bio = isOrganization ? profile.administratorBio || profile.bio : profile.bio;
  const context = isOrganization && profile.organizationName && profile.administratorName
    ? `Administrator · ${profile.organizationName}`
    : isOrganization
      ? "Organization account"
      : profile.experienceLevel
        ? profile.experienceLevel.replaceAll("_", " ")
        : "Organist";

  return (
    <div className="profile-summary">
      <div className="profile-avatar" aria-hidden={!photo}>
        {photo ? (
          <Image src={photo} alt={`${name || "OpenOrgan member"} profile`} fill sizes="76px" />
        ) : (
          <span>{String(name || "O").slice(0, 1).toUpperCase()}</span>
        )}
      </div>

      <div className="profile-summary-copy">
        <div className="profile-summary-heading">
          <h3>{name || "OpenOrgan member"}</h3>
          <span className="profile-summary-meta">{context}</span>
        </div>

        {bio && <p className="profile-summary-bio">{bio}</p>}

        <div className="profile-summary-actions">
          {contact?.visible && contact.email && (
            <a href={`mailto:${contact.email}`}>Email</a>
          )}
          {userId && <Link href={`/profiles/${userId}`}>View full profile</Link>}
        </div>
      </div>
    </div>
  );
}
