import { Feather } from "@expo/vector-icons";
import { useListQuotes } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    year: "numeric",
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

export default function QuotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: quotes, isLoading, isRefetching, refetch } = useListQuotes();

  const filtered = useMemo(() => {
    if (!quotes) return [];
    const q = search.toLowerCase().trim();
    if (!q) return quotes;
    return quotes.filter(
      (quote) =>
        quote.clientData.nome?.toLowerCase().includes(q) ||
        quote.rawInput.toLowerCase().includes(q) ||
        quote.descrizioneGenerale?.toLowerCase().includes(q),
    );
  }, [quotes, search]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Preventivi</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Cerca preventivi..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-input"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: botPad + 100, paddingTop: 12 },
          ]}
          scrollEnabled={!!filtered.length}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "Nessun risultato" : "Nessun preventivo"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {search
                  ? "Prova con termini diversi"
                  : "Crea il tuo primo preventivo AI"}
              </Text>
            </View>
          )}
          renderItem={({ item: quote }) => (
            <Pressable
              style={({ pressed }) => [
                styles.quoteCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push(`/quote/${quote.id}`)}
              testID={`quote-item-${quote.id}`}
            >
              <View style={styles.cardTop}>
                <Text
                  style={[styles.clientName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {quote.clientData.nome || "Cliente senza nome"}
                </Text>
                <Text style={[styles.amount, { color: colors.foreground }]}>
                  {formatCurrency(quote.totale)}
                </Text>
              </View>
              <Text
                style={[styles.desc, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {quote.descrizioneGenerale || quote.rawInput}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={[styles.date, { color: colors.mutedForeground }]}>
                  {formatDate(quote.createdAt)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColor(quote.status, colors)}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusColor(quote.status, colors) },
                    ]}
                  >
                    {statusLabel(quote.status)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  loadingArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  quoteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  clientName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  date: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
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
