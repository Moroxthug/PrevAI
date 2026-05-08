import { Feather } from "@expo/vector-icons";
import {
  useGetQuoteStats,
  useListQuotes,
} from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "unlocked": return "Sbloccato";
    case "pending_payment": return "In attesa";
    default: return "Bozza";
  }
}

function statusColor(status: string, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "unlocked": return colors.accent;
    case "pending_payment": return colors.secondary;
    default: return colors.mutedForeground;
  }
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const statsQuery = useGetQuoteStats();
  const quotesQuery = useListQuotes();

  const stats = statsQuery.data;
  const recentQuotes = quotesQuery.data?.slice(0, 5) ?? [];
  const isRefreshing = statsQuery.isRefetching || quotesQuery.isRefetching;

  function onRefresh() {
    void statsQuery.refetch();
    void quotesQuery.refetch();
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 8, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 100 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Ciao, {user?.name?.split(" ")[0] ?? "Freelancer"}
          </Text>
          <LinearGradient
            colors={[colors.gradFrom, colors.gradTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.brandPill}
          >
            <Text style={styles.brandText}>prevAI</Text>
          </LinearGradient>
        </View>

        <Pressable
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/new-quote")}
          testID="new-quote-fab"
        >
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {statsQuery.isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.statsRow}>
          <StatCard
            colors={colors}
            label="Preventivi"
            value={String(stats?.total ?? 0)}
            icon="file-text"
            gradient={[colors.gradFrom, colors.gradMid]}
          />
          <StatCard
            colors={colors}
            label="Questo mese"
            value={String(stats?.thisMonth ?? 0)}
            icon="calendar"
            gradient={[colors.gradMid, colors.gradTo]}
          />
          <StatCard
            colors={colors}
            label="Ricavi"
            value={formatCurrency(stats?.unlockedRevenue ?? 0)}
            icon="trending-up"
            gradient={[colors.gradFrom, colors.gradTo]}
          />
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recenti
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/quotes")}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>Vedi tutti</Text>
          </Pressable>
        </View>

        {quotesQuery.isLoading && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        )}

        {!quotesQuery.isLoading && recentQuotes.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="file-text" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nessun preventivo
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Crea il tuo primo preventivo AI
            </Text>
          </View>
        )}

        {recentQuotes.map((quote) => (
          <Pressable
            key={quote.id}
            style={({ pressed }) => [
              styles.quoteCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push(`/quote/${quote.id}`)}
            testID={`quote-card-${quote.id}`}
          >
            <View style={styles.quoteCardLeft}>
              <Text
                style={[styles.quoteClient, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {quote.clientData.nome || "Cliente"}
              </Text>
              <Text
                style={[styles.quoteDesc, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {quote.descrizioneGenerale || quote.rawInput}
              </Text>
              <Text style={[styles.quoteDate, { color: colors.mutedForeground }]}>
                {formatDate(quote.createdAt)}
              </Text>
            </View>
            <View style={styles.quoteCardRight}>
              <Text style={[styles.quoteAmount, { color: colors.foreground }]}>
                {formatCurrency(quote.totale)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor(quote.status, colors)}20` }]}>
                <Text style={[styles.statusText, { color: statusColor(quote.status, colors) }]}>
                  {statusLabel(quote.status)}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({
  colors,
  label,
  value,
  icon,
  gradient,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  gradient: [string, string];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statIcon}
      >
        <Feather name={icon} size={14} color="#fff" />
      </LinearGradient>
      <Text
        style={[styles.statValue, { color: colors.foreground }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  brandText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  newBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingArea: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  quoteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quoteCardLeft: {
    flex: 1,
    gap: 2,
  },
  quoteClient: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  quoteDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  quoteDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  quoteCardRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  quoteAmount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
