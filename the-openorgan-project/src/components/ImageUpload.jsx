"use client";
import { useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase-client";
export default function ImageUpload({ pathPrefix, value, storagePath, onChange, label="Photo" }) {
  const [working,setWorking]=useState(false);const [message,setMessage]=useState("");
  async function upload(event){const file=event.target.files?.[0];if(!file)return;if(!storage)return setMessage("Firebase Storage is not configured.");if(!file.type.startsWith("image/"))return setMessage("Choose an image file.");if(file.size>5*1024*1024)return setMessage("Images must be smaller than 5 MB.");setWorking(true);setMessage("");try{const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${pathPrefix}/${Date.now()}-${safe}`;const reference=ref(storage,path);await uploadBytes(reference,file,{contentType:file.type});const url=await getDownloadURL(reference);if(storagePath)await deleteObject(ref(storage,storagePath)).catch(()=>{});onChange({url,path});}catch(error){setMessage(error.message||"Unable to upload the image.");}finally{setWorking(false);}}
  return <div className="stack"><label>{label}<input type="file" accept="image/*" onChange={upload} disabled={working}/></label>{working&&<p>Uploading...</p>}{value&&<img className="upload-preview" src={value} alt=""/>}{message&&<div className="message error">{message}</div>}</div>;
}
