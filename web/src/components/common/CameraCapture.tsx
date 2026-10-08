"use client";
import { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture }: { onCapture: (file: File) => Promise<void> }) {
  const [open, setOpen] = useState(false), [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true, stream: MediaStream | undefined;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(async media => {
      if (!alive) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    }).catch(() => setError("Camera unavailable. Allow camera access or upload a photo."));
    if (!navigator.mediaDevices) setError("Camera is available on HTTPS or localhost. You can upload a photo instead.");
    return () => { alive = false; stream?.getTracks().forEach(track => track.stop()); };
  }, [open]);
  return <div><button type="button" className="btn-secondary" onClick={() => { setError(""); setOpen(!open); }}>{open ? "Close camera" : "Take photo"}</button>{open && <div><video ref={video} muted playsInline style={{ width: "100%", maxHeight: 300 }} />{error && <p role="alert">{error}</p>}<button type="button" className="btn-primary" onClick={() => {
    const source = video.current;
    if (!source?.videoWidth) return;
    const canvas = document.createElement("canvas"); canvas.width = source.videoWidth; canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    canvas.toBlob(async blob => { if (!blob) return; setOpen(false); await onCapture(new File([blob], "member-photo.jpg", { type: "image/jpeg" })); }, "image/jpeg", .9);
  }}>Capture and upload</button></div>}</div>;
}
