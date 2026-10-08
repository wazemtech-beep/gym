"use client";
import { useState } from "react";
import { UserRound, Shield, Activity } from "lucide-react";
import MemberProfileForm from "./MemberProfileForm";
import MemberPrivacyFitnessSection from "./MemberPrivacyFitnessSection";
import FitnessActivitySection from "./FitnessActivitySection";
import styles from "./MemberPage.module.css";

const sections = [{ id: "details", label: "Personal details", icon: UserRound }, { id: "privacy", label: "Privacy", icon: Shield }, { id: "activity", label: "Fitness activity", icon: Activity }];
export default function MemberProfileSections() {
  const [selected, setSelected] = useState("details");
  return <><nav className={styles.sectionNav} aria-label="Profile sections">{sections.map(({ id, label, icon: Icon }) => <button key={id} id={`profile-tab-${id}`} type="button" aria-pressed={selected === id} aria-controls={`profile-section-${id}`} onClick={() => setSelected(id)}><Icon size={16} />{label}</button>)}</nav>
    <section className={styles.tabPanel} id="profile-section-details" aria-labelledby="profile-tab-details" hidden={selected !== "details"}><MemberProfileForm /></section>
    <section className={styles.tabPanel} id="profile-section-privacy" aria-labelledby="profile-tab-privacy" hidden={selected !== "privacy"}><MemberPrivacyFitnessSection /></section>
    <section className={styles.tabPanel} id="profile-section-activity" aria-labelledby="profile-tab-activity" hidden={selected !== "activity"}><FitnessActivitySection /></section>
  </>;
}
