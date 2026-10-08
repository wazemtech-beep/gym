"use client";

import React, { useState } from "react";
import { Megaphone } from "lucide-react";
import AnnouncementManagerModal from "./AnnouncementManagerModal";

export default function OwnerAnnouncementButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn btn-secondary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 13px",
          fontSize: "0.82rem",
          fontWeight: 600,
        }}
        title="Announcements & Reminders"
      >
        <Megaphone size={15} style={{ color: "var(--accent-primary)" }} />
        <span>Announcements</span>
      </button>

      {showModal && <AnnouncementManagerModal onClose={() => setShowModal(false)} />}
    </>
  );
}
