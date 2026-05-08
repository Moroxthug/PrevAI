import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const EXAMPLE_CHIPS = [
  "Imbiancatura 3 vani",
  "Impianto elettrico civile",
  "Ristrutturazione bagno",
  "Posa pavimento 60 mq",
  "Tinteggiatura facciata",
  "Installazione infissi",
];

type Quote = {
  id: string;
  totale: number;
  clientData: { nome: string };
};

export default function NewQuoteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [showClient, setShowClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleGenerate() {
    const trimmed = description.trim();
    if (!trimmed || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const formData = new FormData();
      formData.append("rawInput", trimmed);
      if (clientName.trim() || clientCity.trim()) {
        formData.append(
          "clientData",
          JSON.stringify({
            nome: clientName.trim(),
            citta: clientCity.trim(),
            indirizzo: "",
          }),
        );
      }

      const quote = await customFetch<Quote>("/api/quotes", {
        method: "POST",
        body: formData,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDescription("");
      setClientName("");
      setClientCity("");
      setShowClient(false);
      router.push(`/quote/${quote.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Generazione fallita. Riprova.",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = description.trim().length >= 10 && !loading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 16, paddingBottom: botPad + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <View>
              <Text style={[styles.pageTitle, { color: colors.foreground }]}>
                Nuovo preventivo
              </Text>
              <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
                Descrivi il lavoro, l'AI fa il resto
              </Text>
            </View>
            <LinearGradient
              colors={[colors.gradFrom, colors.gradTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiBadge}
            >
              <Feather name="zap" size={12} color="#fff" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </LinearGradient>
          </View>

          {error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: `${colors.destructive}15`,
                  borderColor: colors.destructive,
                },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          )}

          <Pressable
            style={[
              styles.textAreaCard,
              {
                backgroundColor: colors.card,
                borderColor: description.length > 0 ? colors.primary : colors.border,
              },
            ]}
            onPress={() => inputRef.current?.focus()}
          >
            <TextInput
              ref={inputRef}
              style={[styles.textArea, { color: colors.foreground }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Es: Ristrutturazione bagno 8mq con sostituzione sanitari, piastrelle 30x60, nuovo impianto idraulico..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={6}
              maxLength={2000}
              textAlignVertical="top"
              autoFocus={false}
              testID="description-input"
            />
            {description.length > 0 && (
              <Text
                style={[
                  styles.charCount,
                  { color: colors.mutedForeground },
                ]}
              >
                {description.length} / 2000
              </Text>
            )}
          </Pressable>

          <View style={styles.chipsRow}>
            {EXAMPLE_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      description === chip
                        ? `${colors.primary}20`
                        : colors.muted,
                    borderColor:
                      description === chip ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setDescription(chip);
                  inputRef.current?.focus();
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        description === chip
                          ? colors.primary
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {chip}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.clientToggle}
            onPress={() => setShowClient(!showClient)}
          >
            <Feather
              name={showClient ? "chevron-down" : "chevron-right"}
              size={16}
              color={colors.mutedForeground}
            />
            <Text style={[styles.clientToggleText, { color: colors.mutedForeground }]}>
              Dati cliente (opzionale)
            </Text>
          </Pressable>

          {showClient && (
            <View
              style={[
                styles.clientCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.clientInput,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Feather name="user" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.clientTextInput, { color: colors.foreground }]}
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Nome cliente"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  testID="client-name-input"
                />
              </View>
              <View
                style={[
                  styles.clientInput,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Feather name="map-pin" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.clientTextInput, { color: colors.foreground }]}
                  value={clientCity}
                  onChangeText={setClientCity}
                  placeholder="Città"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  testID="client-city-input"
                />
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.generateBtn,
              !canGenerate && styles.generateBtnDisabled,
              pressed && canGenerate && styles.generateBtnPressed,
            ]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            testID="generate-button"
          >
            <LinearGradient
              colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.generateGradient,
                !canGenerate && { opacity: 0.5 },
              ]}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.generateText}>Generazione in corso...</Text>
                </View>
              ) : (
                <View style={styles.generateRow}>
                  <Feather name="zap" size={18} color="#fff" />
                  <Text style={styles.generateText}>Genera Preventivo</Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>

          {description.trim().length > 0 && description.trim().length < 10 && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Aggiungi più dettagli per risultati migliori
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    gap: 16,
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 4,
  },
  aiBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  textAreaCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    minHeight: 140,
  },
  textArea: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 110,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  clientToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clientToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  clientCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  clientInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 42,
    gap: 8,
  },
  clientTextInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  generateBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  generateBtnDisabled: { opacity: 0.8 },
  generateBtnPressed: { opacity: 0.9 },
  generateGradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  generateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  generateText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
