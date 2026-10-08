"use client";
import { apiFetch } from "@/lib/apiFetch";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload, CheckCircle2, FileImage, X } from "lucide-react";
import CameraCapture from "./CameraCapture";
import styles from "./AccountForms.module.css";
type UploadData = { url: string; publicId: string; format: string; bytes: number };
interface Props {
  folder?: "members" | "progress" | "expenses" | "transfers" | "branding";
  onUploadSuccess: (data: UploadData) => void;
  currentUrl?: string; label?: string; accept?: string; className?: string;
}
export default function CloudinaryUploadButton({ folder = "members", onUploadSuccess, currentUrl, label = "Upload image or document", accept = "image/*,application/pdf", className = "" }: Props) {
  const [uploading, setUploading] = useState(false), [preview, setPreview] = useState(currentUrl || ""), [error, setError] = useState(""), [imageFailed, setImageFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null), uploadingRef = useRef(false);
  useEffect(() => { setPreview(currentUrl || ""); setImageFailed(false); }, [currentUrl]);
  async function uploadFile(file: File) {
    if (uploadingRef.current) return;
    uploadingRef.current = true; setError(""); setUploading(true);
    try {
      const body = new FormData(); body.append("file", file); body.append("folder", folder);
      const response = await apiFetch("/api/v1/uploads/cloudinary", { method: "POST", body });
      const data = await response.json();
      if (!response.ok || !data.success || !data.data?.url) throw new Error(data.error || "Upload failed. Please try again.");
      setPreview(data.data.url); setImageFailed(false); onUploadSuccess(data.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setUploading(false); uploadingRef.current = false; if (input.current) input.current.value = ""; }
  }
  const change = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); };
  return <div className={`${styles.upload} ${className}`} aria-busy={uploading}>
    {folder === "members" && !uploading && <CameraCapture onCapture={uploadFile} />}
    <input ref={input} type="file" accept={accept} onChange={change} hidden disabled={uploading} />
    {preview ? <div className={styles.preview}>
      {imageFailed ? <FileImage size={32} aria-hidden="true" /> : <img className={styles.image} src={preview} alt="Uploaded preview" onError={() => setImageFailed(true)} />}
      <span className={styles.caption}><CheckCircle2 size={16} />{uploading ? "Uploading…" : "Uploaded"}</span>
      <div className={styles.actions}><button type="button" className="btn-secondary" disabled={uploading} onClick={() => input.current?.click()}>Change</button><button type="button" className="btn-secondary" disabled={uploading} aria-label="Remove upload" onClick={() => { setPreview(""); setError(""); onUploadSuccess({ url: "", publicId: "", format: "", bytes: 0 }); }}><X size={16} /></button></div>
    </div> : <button type="button" className={styles.choose} disabled={uploading} onClick={() => input.current?.click()}><Upload size={18} />{uploading ? "Uploading…" : label}</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
