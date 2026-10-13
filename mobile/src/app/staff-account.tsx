import { useRef, useState } from "react";
import { Alert, Text } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Heading,
  Screen,
  styles,
} from "../components/ui";
import { Back } from "../components/staff/common";
import { useSession } from "../providers/session";
import { request } from "../lib/api";

export default function StaffAccount() {
  const { user, token, expire, signOut } = useSession();
  const [email, setEmail] = useState(""),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const logout = (all: boolean) =>
    Alert.alert(
      all ? "Sign out everywhere?" : "Sign out?",
      "End your selected sessions?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", onPress: () => void run(() => signOut(all)) },
      ],
    );
  return (
    <Screen>
      <Back home={user?.role === "TRAINER" ? "/trainer" : "/admin"} />
      <Heading>Your account</Heading>
      <Card title={user?.name}>
        <Text style={styles.text}>{user?.email}</Text>
        <Text style={styles.muted}>{user?.role}</Text>
      </Card>
      <ErrorNotice error={error} />
      {!!notice && <Text style={styles.text}>{notice}</Text>}
      <Card title="Account security">
        <Field
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          editable={!busy}
        />
        <Field
          label="New login email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
        />
        <Button
          secondary
          title="Send email verification"
          busy={busy}
          onPress={() =>
            void run(async () => {
              await request("/api/auth/change-email", {
                token,
                method: "POST",
                body: { email, password: current },
              });
              setNotice("Check your new email for the verification link.");
            })
          }
        />
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!busy}
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          editable={!busy}
        />
        <Button
          title="Change password"
          busy={busy}
          onPress={() =>
            void run(async () => {
              if (password.length < 8 || password !== confirm)
                throw new Error(
                  "Use matching passwords of at least 8 characters.",
                );
              await request("/api/auth/change-password", {
                token,
                method: "POST",
                body: { currentPassword: current, newPassword: password },
              });
              await expire();
            })
          }
        />
      </Card>
      <Card title="Sessions">
        <Button
          secondary
          title="Logout"
          busy={busy}
          onPress={() => logout(false)}
        />
        <Button
          secondary
          title="Logout all devices"
          busy={busy}
          onPress={() => logout(true)}
        />
      </Card>
    </Screen>
  );
}
