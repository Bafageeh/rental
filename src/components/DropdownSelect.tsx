import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type DropdownOption = {
  id: string | number;
  label: string;
};

type Props = {
  label: string;
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
};

export default function DropdownSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  required = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => String(item.id) === String(value));
  const display = selected?.label || placeholder || `اختر ${label}`;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label} {required ? <Text style={styles.required}>*</Text> : null}
      </Text>

      <TouchableOpacity
        style={[styles.button, disabled ? styles.buttonDisabled : null]}
        onPress={() => {
          if (!disabled) setOpen(!open);
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, !selected ? styles.placeholderText : null]}>{display}</Text>
        <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.panel}>
          {options.length === 0 ? (
            <Text style={styles.emptyText}>لا توجد خيارات</Text>
          ) : (
            <ScrollView style={styles.list} nestedScrollEnabled>
              {options.map((item) => {
                const active = String(item.id) === String(value);

                return (
                  <TouchableOpacity
                    key={`${label}-${item.id}`}
                    style={[styles.option, active ? styles.optionActive : null]}
                    onPress={() => {
                      onChange(String(item.id));
                      setOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  label: { color: "#374151", fontWeight: "900", textAlign: "right", marginBottom: 6 },
  required: { color: "#dc2626" },
  button: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { flex: 1, color: "#111827", fontWeight: "900", textAlign: "right" },
  placeholderText: { color: "#9ca3af" },
  arrow: { color: "#111827", fontWeight: "900" },
  panel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    marginTop: 7,
    padding: 6,
  },
  list: { maxHeight: 260 },
  option: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  optionActive: { backgroundColor: "#111827" },
  optionText: { color: "#111827", fontWeight: "900", textAlign: "right" },
  optionTextActive: { color: "#fff" },
  emptyText: { color: "#6b7280", fontWeight: "800", textAlign: "center", padding: 14 },
});
