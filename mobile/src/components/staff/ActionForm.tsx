import { useRef, useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { Button, Card, Field, styles } from "../ui";
import { Toggle } from "../controls";
import { useStaffAction, useStaffQuery } from "../../hooks/staff";
import { type Row, Details } from "./common";
import { useSession } from "../../providers/session";
import { choosePhoto, uploadPhoto, privateImage } from "../../lib/assets";

export type Input = {
  key: string;
  label: string;
  required?: boolean;
  kind?:
    | "number"
    | "number-list"
    | "date"
    | "boolean"
    | "multiline"
    | "email"
    | "password"
    | "photo"
    | "installments";
  when?: { key: string; value: string };
  uploadFolder?: "members" | "expenses" | "branding";
  options?: string[];
  lookup?: { path: string; list: string; label: string };
  initial?: unknown;
};
export type Operation = {
  title: string;
  path: string;
  method?: string;
  fields?: Input[];
  fixed?: Row;
  confirm?: string;
  idempotent?: boolean;
};

function SelectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Input;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  const base = field.lookup?.path || "";
  const query = useStaffQuery<Row>(
    base +
      (base.includes("?") ? "&" : "?") +
      "search=" +
      encodeURIComponent(term),
    open && !!field.lookup,
  );
  const records: Row[] = query.data?.[field.lookup?.list || "data"] || [];
  const selected = records.find((row) => row.id === value);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>
        {field.label}
        {field.required ? " *" : ""}
      </Text>
      <Button
        secondary
        disabled={disabled}
        title={
          selected
            ? String(selected[field.lookup!.label])
            : value
              ? field.options
                ? value.replace(/_/g, " ")
                : "Selected · tap to change"
              : "Choose"
        }
        onPress={() => setOpen(!open)}
      />
      {open && (
        <Card>
          {field.lookup ? (
            <>
              <Field label="Search" value={search} onChangeText={setSearch} />
              <Button
                secondary
                title="Search"
                onPress={() => setTerm(search.trim())}
              />
              <Text style={styles.muted}>
                {query.isPending
                  ? "Loading options…"
                  : query.error
                    ? String(query.error.message)
                    : !records.length
                      ? "No options found."
                      : ""}
              </Text>
              {records.map((row) => (
                <Button
                  key={row.id}
                  secondary
                  title={String(row[field.lookup!.label] || row.name || row.id)}
                  onPress={() => {
                    onChange(row.id);
                    setOpen(false);
                  }}
                />
              ))}
            </>
          ) : (
            field.options?.map((option) => (
              <Button
                key={option}
                secondary
                title={option.replace(/_/g, " ")}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              />
            ))
          )}
          {!field.required && (
            <Button
              secondary
              title="Clear selection"
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
            />
          )}
        </Card>
      )}
    </View>
  );
}

export function ActionForm({
  operation,
  initial = {},
  onSaved,
}: {
  operation: Operation;
  initial?: Row;
  onSaved?: () => void;
}) {
  const send = useStaffAction(),
    lock = useRef(false),
    requestKey = useRef(Crypto.randomUUID());
  const { token } = useSession();
  const [values, setValues] = useState<Row>(() =>
    Object.fromEntries(
      (operation.fields || []).map((field) => {
        const value =
          field.key.split(".").reduce((item, key) => item?.[key], initial) ??
          field.initial ??
          (field.kind === "boolean"
            ? false
            : field.kind === "installments"
              ? []
              : "");
        return [
          field.key,
          field.kind === "date"
            ? String(value).slice(0, 10)
            : field.kind === "number-list" && Array.isArray(value)
              ? value.join(", ")
              : value,
        ];
      }),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Row | null>(null);
  async function save() {
    if (lock.current || result) return;
    setError("");
    const body: Row = { ...operation.fixed };
    for (const field of operation.fields || []) {
      if (field.when && values[field.when.key] !== field.when.value) continue;
      const value = values[field.key];
      if (
        field.required &&
        (value === "" || value === undefined || value === null)
      ) {
        setError(`${field.label} is required.`);
        return;
      }
      if (
        field.kind === "number" &&
        value !== "" &&
        (!Number.isFinite(Number(value)) || Number(value) < 0)
      ) {
        setError(`Enter a valid ${field.label.toLowerCase()}.`);
        return;
      }
      if (
        field.kind === "date" &&
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(new Date(value).getTime()))
      ) {
        setError("Use a valid YYYY-MM-DD date.");
        return;
      }
      if (
        field.kind === "number-list" &&
        value &&
        String(value)
          .split(",")
          .some(
            (item) =>
              !Number.isInteger(Number(item.trim())) || Number(item.trim()) < 0,
          )
      ) {
        setError("Enter whole days separated by commas.");
        return;
      }
      if (
        field.kind === "installments" &&
        (!value.length ||
          value.some(
            (row: Row) =>
              !Number.isFinite(Number(row.amount)) ||
              Number(row.amount) <= 0 ||
              !/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate) ||
              !Number.isFinite(new Date(row.dueDate).getTime()),
          ))
      ) {
        setError("Add each installment’s positive amount and valid due date.");
        return;
      }
      if (value !== "" || initial[field.key] !== undefined) {
        const parsed =
          field.kind === "number"
            ? Number(value)
            : field.kind === "number-list"
              ? String(value)
                  .split(",")
                  .filter((item) => item.trim())
                  .map(Number)
              : value;
        const parts = field.key.split(".");
        if (parts.length === 2) {
          body[parts[0]] ||= {};
          body[parts[0]][parts[1]] = parsed;
        } else body[field.key] = parsed;
      }
    }
    if (operation.idempotent) {
      body.idempotencyKey = requestKey.current;
      body.requestKey = requestKey.current;
    }
    lock.current = true;
    setBusy(true);
    setResult(null);
    try {
      const response = await send<Row>(operation.path, body, operation.method);
      setResult(response);
      requestKey.current = Crypto.randomUUID();
      onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function submit() {
    if (operation.confirm)
      Alert.alert(operation.title, operation.confirm, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => void save() },
      ]);
    else void save();
  }
  async function photo(field: Input) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const asset = await choosePhoto();
      if (asset) {
        const uploaded = await uploadPhoto(
          asset,
          field.uploadFolder || "members",
          token,
        );
        setValues((current) => ({ ...current, [field.key]: uploaded.url }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card title={operation.title}>
      {(operation.fields || []).map((field) => {
        if (field.when && values[field.when.key] !== field.when.value)
          return null;
        const update = (value: unknown) =>
          setValues((current) => ({ ...current, [field.key]: value }));
        if (field.kind === "installments")
          return (
            <Card key={field.key} title={field.label}>
              {values[field.key].map((row: Row, index: number) => (
                <View key={index} style={{ gap: 10 }}>
                  <Field
                    label={`Installment ${index + 1} amount`}
                    value={String(row.amount)}
                    keyboardType="decimal-pad"
                    editable={!busy && !result}
                    onChangeText={(amount) =>
                      update(
                        values[field.key].map((item: Row, i: number) =>
                          i === index ? { ...item, amount } : item,
                        ),
                      )
                    }
                  />
                  <Field
                    label="Due date (YYYY-MM-DD)"
                    value={row.dueDate}
                    editable={!busy && !result}
                    onChangeText={(dueDate) =>
                      update(
                        values[field.key].map((item: Row, i: number) =>
                          i === index ? { ...item, dueDate } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    secondary
                    title="Remove installment"
                    disabled={busy || !!result}
                    onPress={() =>
                      update(
                        values[field.key].filter(
                          (_: Row, i: number) => i !== index,
                        ),
                      )
                    }
                  />
                </View>
              ))}
              <Button
                secondary
                title="Add installment"
                disabled={busy || !!result || values[field.key].length >= 24}
                onPress={() =>
                  update([...values[field.key], { amount: "", dueDate: "" }])
                }
              />
            </Card>
          );
        return field.kind === "photo" ? (
          <View key={field.key} style={{ gap: 10 }}>
            {values[field.key] && (
              <Image
                source={privateImage(values[field.key], token)}
                style={{ width: 88, height: 88, borderRadius: 16 }}
              />
            )}
            <Button
              secondary
              title={field.label}
              disabled={busy || !!result}
              onPress={() => void photo(field)}
            />
          </View>
        ) : field.kind === "boolean" ? (
          <Toggle
            key={field.key}
            label={field.label}
            value={!!values[field.key]}
            onChange={update}
            disabled={busy || !!result}
          />
        ) : field.options || field.lookup ? (
          <SelectField
            key={field.key}
            field={field}
            value={String(values[field.key])}
            onChange={update}
            disabled={busy || !!result}
          />
        ) : (
          <Field
            key={field.key}
            label={
              field.label +
              (field.required ? " *" : "") +
              (field.kind === "date" ? " (YYYY-MM-DD)" : "")
            }
            value={String(values[field.key] ?? "")}
            onChangeText={update}
            editable={!busy && !result}
            multiline={field.kind === "multiline"}
            secureTextEntry={field.kind === "password"}
            autoCapitalize={field.kind === "email" ? "none" : "sentences"}
            keyboardType={
              field.kind === "number"
                ? "decimal-pad"
                : field.kind === "email"
                  ? "email-address"
                  : "default"
            }
          />
        );
      })}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {result && (
        <>
          <Text accessibilityRole="alert" style={styles.text}>
            {result.message || "Saved."}
          </Text>
          <Details
            data={result}
            fields={[
              "activationCode",
              "activationUrl",
              "resetCode",
              "receiptNumber",
              "refundVoucherNumber",
            ]}
          />
          {operation.path === "/api/v1/settings/reauth" && (
            <Button
              secondary
              title="Verify again"
              onPress={() => {
                setResult(null);
                setValues((current) => ({ ...current, password: "" }));
              }}
            />
          )}
        </>
      )}
      <Button
        title={operation.title}
        busy={busy}
        disabled={!!result}
        onPress={submit}
      />
    </Card>
  );
}
