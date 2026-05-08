import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleSignIn() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accesso fallito");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const isValid = email.trim().length > 0 && password.length >= 6;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 32, paddingBottom: botPad + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <LinearGradient
              colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoText}>P</Text>
            </LinearGradient>
            <Text style={[styles.brand, { color: colors.foreground }]}>prevAI</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Preventivi professionali in secondi
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {error && (
              <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}15`, borderColor: colors.destructive }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tuaemail@esempio.it"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="email-input"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  testID="password-input"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.btn, !isValid && styles.btnDisabled, pressed && styles.btnPressed]}
              onPress={handleSignIn}
              disabled={!isValid || loading}
              testID="sign-in-button"
            >
              <LinearGradient
                colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnGradient, !isValid && { opacity: 0.5 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Accedi</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/sign-up")}
            style={styles.signUpLink}
          >
            <Text style={[styles.signUpText, { color: colors.mutedForeground }]}>
              Non hai un account?{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                Registrati
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  brand: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
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
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  inputIcon: {},
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.7 },
  btnPressed: { opacity: 0.85 },
  btnGradient: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  signUpLink: {
    alignItems: "center",
    marginTop: 24,
  },
  signUpText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
