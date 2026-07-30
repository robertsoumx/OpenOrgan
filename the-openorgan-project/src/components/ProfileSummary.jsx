import Image from "next/image";
import Link from "next/link";
export default function ProfileSummary({ profile, userId, contact }) {
  if (!profile) return <p className="muted">Profile information is unavailable.</p>;
  const isOrganization = profile.profileType === "organization";
  const photo = isOrganization ? profile.administratorPhotoURL || profile.photoURL : profile.photoURL;
  const name = isOrganization ? profile.administratorName || profile.organizationName || profile.displayName : profile.displayName;
  return <div className="profile-summary"><div className="profile-avatar">{photo ? <Image src={photo} alt="" fill sizes="64px" /> : <span>{String(name || "O").slice(0,1).toUpperCase()}</span>}</div><div><h3>{name || "OpenOrgan member"}</h3>{isOrganization && profile.organizationName && profile.administratorName && <p className="muted">Administrator for {profile.organizationName}</p>}<p>{isOrganization ? profile.administratorBio || profile.bio : profile.bio}</p>{contact?.visible && contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{userId && <div><Link href={`/profiles/${userId}`}>View full profile</Link></div>}</div></div>;
}
