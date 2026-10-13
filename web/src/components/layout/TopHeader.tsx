"use client";

import { CalendarDays } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatKarachiDate } from "@/lib/displayDates";
import AccountEmailChange from "@/components/common/AccountEmailChange";
import StaffInviteModal from "@/components/owner/StaffInviteModal";
import OwnerAnnouncementButton from "@/components/owner/OwnerAnnouncementButton";

interface TopHeaderProps {
  gymName?: string;
  userName: string;
}

const subscribe = () => () => {};
const currentDateSnapshot = () => formatKarachiDate(new Date());
const serverDateSnapshot = () => "";

export default function TopHeader({ gymName = "OXGEN GYM", userName }: TopHeaderProps) {
  // SSR and the first hydration render agree, including around PKT midnight.
  const currentDate = useSyncExternalStore(subscribe, currentDateSnapshot, serverDateSnapshot);

  return (
    <header className="top-header">
      <div><div className="header-context">{gymName}</div><div className="header-date"><CalendarDays size={13} /><span>{currentDate ? `${currentDate} · PKT` : "PKT"}</span></div></div>
      <div className="header-actions">
        <AccountEmailChange />
        <OwnerAnnouncementButton />
        <StaffInviteModal />
        <div className="header-user"><span>{userName}</span><div className="user-avatar">{userName.charAt(0)}</div></div>
      </div>
    </header>
  );
}
