"use client";

import { CalendarDays } from "lucide-react";
import AccountEmailChange from "@/components/common/AccountEmailChange";
import StaffInviteModal from "@/components/owner/StaffInviteModal";
import OwnerAnnouncementButton from "@/components/owner/OwnerAnnouncementButton";

interface TopHeaderProps {
  gymName?: string;
  userName: string;
}

export default function TopHeader({ gymName = "OXGEN GYM", userName }: TopHeaderProps) {
  // Current date formatted in Asia/Karachi context
  const currentDate = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Karachi",
  });

  return (
    <header className="top-header">
      <div><div className="header-context">{gymName}</div><div className="header-date"><CalendarDays size={13} /><span>{currentDate} · PKT</span></div></div>
      <div className="header-actions">
        <AccountEmailChange />
        <OwnerAnnouncementButton />
        <StaffInviteModal />
        <div className="header-user"><span>{userName}</span><div className="user-avatar">{userName.charAt(0)}</div></div>
      </div>
    </header>
  );
}
