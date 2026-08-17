"use client";

import { useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase-client";
import { toUserMessage } from "@/lib/user-error";

export default function ImageUpload({ pathPrefix, value, storagePath, onChange, label = "Photo" }) {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!storage) return setMessage("Image uploads are temporarily unavailable.");
    if (!file.type.startsWith("image/")) return setMessage("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setMessage("Images must be smaller than 5 MB.");

    setWorking(true);
    setMessage("");
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${pathPrefix}/${Date.now()}-${safe}`;
      const reference = ref(storage, path);
      await uploadBytes(reference, file, { contentType: file.type });
      const url = await getDownloadURL(reference);
      if (storagePath) await deleteObject(ref(storage, storagePath)).catch(() => {});
      onChange({ url, path });
    } catch (error) {
      setMessage(toUserMessage(error, "Unable to upload the image."));
    } finally {
      setWorking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="image-upload">
      <div className={`image-upload-preview ${value ? "has-image" : ""}`}>
        {value ? <img src={value} alt="" /> : <span aria-hidden="true">+</span>}
      </div>
      <div className="image-upload-copy">
        <strong>{label}</strong>
        <button
          type="button"
          className="button-ghost"
          onClick={() => inputRef.current?.click()}
          disabled={working}
        >
          {working ? "Uploading…" : value ? "Change photo" : "Choose photo"}
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={upload}
          disabled={working}
        />
        {message && <div className="message error">{message}</div>}
      </div>
    </div>
  );
}
