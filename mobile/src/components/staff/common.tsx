import { Link, router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { Button, styles } from "../ui";

// Operational responses differ between endpoints; keep their adapter in one place.
export type Row = Record<string, any>;
export const human = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export const money = (value: unknown) =>
  `Rs. ${Number(value || 0).toLocaleString()}`;
export const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString() : "—";
export function Back({ home }: { home: "/trainer" | "/admin" }) {
  return (
    <Button
      secondary
      title="Back"
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace(home)
      }
    />
  );
}
export function Nav({ href, title }: { href: Href; title: string }) {
  return (
    <Link href={href} style={[styles.text, { paddingVertical: 10 }]}>
      {title} →
    </Link>
  );
}
export function Details({
  data,
  fields,
}: {
  data?: Row | null;
  fields: string[];
}) {
  return (
    <View style={{ gap: 8 }}>
      {fields.map((key) => {
        const value = key
          .split(".")
          .reduce((current, part) => current?.[part], data);
        if (value === undefined || value === null || typeof value === "object")
          return null;
        const formatted =
          typeof value === "boolean"
            ? value
              ? "Yes"
              : "No"
            : /Date$|At$|^date$/.test(key)
              ? date(value)
              : /amount|balance|fee|collection|dues|cash|revenue|outflow/i.test(
                    key,
                  ) && typeof value === "number"
                ? money(value)
                : String(value);
        return (
          <Text key={key} style={styles.text}>
            {human(key.split(".").at(-1)!)}: {formatted}
          </Text>
        );
      })}
    </View>
  );
}
