import { Feather } from "@expo/vector-icons";
import {
  useGetBusinessProfile,
  useGetSubscription,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const profileQuery = useGetBusinessProfile();
  const subscriptionQuery = useGetSubscription();

  const profile = profileQuery.data;
  const subscription = subscriptionQuery.data;

  async function handleSignOut() {
    Alert.alert("Esci", "Sei sicuro di voler uscire?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: botPad + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>
        Impostazioni
      </Text>

      <View
        style={[
          styles.profileCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <LinearGradient
          colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarLetter}>
            {(user?.name?.[0] ?? "U").toUpperCase()}
          </Text>
        </LinearGradient>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {user?.name ?? "—"}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
            {user?.email ?? "—"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          AZIENDA
        </Text>

        {profileQuery.isLoading ? (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border, justifyContent: "center" },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <InfoRow
              colors={colors}
              icon="briefcase"
              label="Ragione sociale"
              value={profile?.companyName ?? "—"}
            />
            <Divider colors={colors} />
            <InfoRow
              colors={colors}
              icon="hash"
              label="P.IVA"
              value={profile?.vatNumber ?? "—"}
            />
            <Divider colors={colors} />
            <InfoRow
              colors={colors}
              icon="map-pin"
              label="Indirizzo"
              value={profile?.address ?? "—"}
            />
            <Divider colors={colors} />
            <InfoRow
              colors={colors}
              icon="phone"
              label="Telefono"
              value={profile?.phone ?? "—"}
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          PIANO
        </Text>

        {subscriptionQuery.isLoading ? (
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border, justifyContent: "center" },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View
            style={[
              styles.planCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.planLeft}>
              <LinearGradient
                colors={
                  subscription?.isActive
                    ? [colors.gradFrom, colors.gradTo]
                    : [colors.mutedForeground, colors.mutedForeground]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.planBadge}
              >
                <Feather
                  name={subscription?.isActive ? "star" : "file-text"}
                  size={12}
                  color="#fff"
                />
                <Text style={styles.planBadgeText}>
                  {subscription?.isActive ? "Pro" : "Free"}
                </Text>
              </LinearGradient>
              <Text style={[styles.planName, { color: colors.foreground }]}>
                {subscription?.plan ?? "Piano gratuito"}
              </Text>
              <Text style={[styles.planStatus, { color: colors.mutedForeground }]}>
                {subscription?.isActive
                  ? "Abbonamento attivo"
                  : "Aggiorna per sbloccare tutto"}
              </Text>
            </View>
            {!subscription?.isActive && (
              <View
                style={[
                  styles.upgradeBadge,
                  { backgroundColor: `${colors.primary}15` },
                ]}
              >
                <Text style={[styles.upgradeText, { color: colors.primary }]}>
                  Upgrade
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          ACCOUNT
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
            onPress={handleSignOut}
            testID="sign-out-button"
          >
            <Feather name="log-out" size={16} color={colors.destructive} />
            <Text style={[styles.actionText, { color: colors.destructive }]}>
              Esci dall'account
            </Text>
            <Feather name="chevron-right" size={16} color={colors.destructive} style={styles.chevron} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  colors,
  icon,
  label,
  value,
}: {
  colors: ReturnType<typeof useColors>;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={14} color={colors.mutedForeground} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 52,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  infoIcon: {
    width: 18,
  },
  infoContent: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  divider: {
    height: 1,
    marginLeft: 42,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  planLeft: {
    flex: 1,
    gap: 4,
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 2,
  },
  planBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  planStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  upgradeBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upgradeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  chevron: {},
});
