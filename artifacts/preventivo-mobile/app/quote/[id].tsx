import { Feather } from "@expo/vector-icons";
import {
  useGenerateQuotePdf,
  useGetQuote,
} from "@workspace/api-client-react";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
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

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [showPaywall, setShowPaywall] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: quote, isLoading, error, refetch } = useGetQuote(id ?? "");
  const generatePdf = useGenerateQuotePdf();

  async function handleGeneratePdf() {
    if (!id) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await generatePdf.mutateAsync({ id });
      if (result.isDraft) {
        // Quote not unlocked — show paywall
        setShowPaywall(true);
        return;
      }
      // Open PDF in browser
      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      if (result.pdfUrl) {
        await WebBrowser.openBrowserAsync(`${baseUrl}${result.pdfUrl}`);
      } else if (result.htmlContent) {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(result.htmlContent)}`;
        await WebBrowser.openBrowserAsync(dataUrl);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore generazione PDF";
      Alert.alert("Errore", msg);
    }
  }

  async function handleShare() {
    if (!quote) return;
    const lines: string[] = [
      `PREVENTIVO - ${quote.companySnapshot?.companyName ?? "prevAI"}`,
      `Data: ${formatDate(quote.createdAt)}`,
      ``,
      `Cliente: ${quote.clientData.nome || "—"}`,
      quote.clientData.citta ? `Città: ${quote.clientData.citta}` : "",
      ``,
      quote.descrizioneGenerale ?? quote.rawInput,
      ``,
    ];

    if (quote.capitoli && quote.capitoli.length > 0) {
      quote.capitoli.forEach((cap) => {
        lines.push(`${cap.lettera}. ${cap.titolo}`);
        cap.voci.forEach((voce) => {
          lines.push(`  - ${voce.descrizione}: ${formatCurrency(voce.totale)}`);
        });
        lines.push(`  Subtotale: ${formatCurrency(cap.subtotale)}`);
        lines.push("");
      });
    } else {
      quote.items.forEach((item) => {
        lines.push(
          `${item.descrizione} (${item.quantita} ${item.unita}) × ${formatCurrency(item.prezzoUnitario)} = ${formatCurrency(item.totale)}`,
        );
      });
      lines.push("");
    }

    lines.push(`Subtotale: ${formatCurrency(quote.subtotale)}`);
    lines.push(`IVA ${quote.ivaPercentuale}%: ${formatCurrency(quote.ivaValore)}`);
    lines.push(`TOTALE: ${formatCurrency(quote.totale)}`);

    const shareText = lines.filter((l) => l !== undefined && l !== null).join("\n");

    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({ text: shareText, title: "Preventivo" });
        } else {
          await navigator.clipboard.writeText(shareText);
          alert("Preventivo copiato negli appunti!");
        }
      } else {
        await Share.share({ message: shareText, title: "Preventivo" });
      }
    } catch {
      // user dismissed
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !quote) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.errorMsg, { color: colors.foreground }]}>
          Preventivo non trovato
        </Text>
        <Pressable
          style={[styles.retryBtn, { borderColor: colors.border }]}
          onPress={() => void refetch()}
        >
          <Text style={[styles.retryText, { color: colors.primary }]}>Riprova</Text>
        </Pressable>
      </View>
    );
  }

  const hasCapitoli = quote.capitoli && quote.capitoli.length > 0;
  const isUnlocked = quote.status === "unlocked";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Nav bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>
          Preventivo
        </Text>
        <Pressable style={styles.shareBtn} onPress={handleShare} hitSlop={8} testID="share-button">
          <Feather name="share-2" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={[styles.companyName, { color: colors.foreground }]}>
                {quote.companySnapshot?.companyName ?? "—"}
              </Text>
              <Text style={[styles.quoteDate, { color: colors.mutedForeground }]}>
                {formatDate(quote.createdAt)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor(quote.status, colors)}20` }]}>
              <Text style={[styles.statusText, { color: statusColor(quote.status, colors) }]}>
                {statusLabel(quote.status)}
              </Text>
            </View>
          </View>

          {quote.clientData.nome && (
            <View style={[styles.clientSection, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="user" size={13} color={colors.mutedForeground} />
              <View style={styles.clientInfo}>
                <Text style={[styles.clientLabel, { color: colors.mutedForeground }]}>Cliente</Text>
                <Text style={[styles.clientName, { color: colors.foreground }]}>
                  {quote.clientData.nome}
                  {quote.clientData.citta ? `, ${quote.clientData.citta}` : ""}
                </Text>
              </View>
            </View>
          )}

          {quote.descrizioneGenerale && (
            <Text style={[styles.descText, { color: colors.mutedForeground }]} numberOfLines={3}>
              {quote.descrizioneGenerale}
            </Text>
          )}
        </View>

        {/* Capitoli or items */}
        {hasCapitoli ? (
          quote.capitoli!.map((cap) => (
            <View key={cap.lettera} style={[styles.chapterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.chapterHeader}>
                <LinearGradient
                  colors={[colors.gradFrom, colors.gradTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chapterLetter}
                >
                  <Text style={styles.chapterLetterText}>{cap.lettera}</Text>
                </LinearGradient>
                <Text style={[styles.chapterTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {cap.titolo}
                </Text>
              </View>

              {cap.voci.map((voce, idx) => (
                <View key={idx} style={styles.voceRow}>
                  <View style={styles.voceLeft}>
                    <Text style={[styles.voceDesc, { color: colors.foreground }]} numberOfLines={2}>
                      {voce.descrizione}
                    </Text>
                    <Text style={[styles.voceMeta, { color: colors.mutedForeground }]}>
                      {voce.quantita} {voce.um} × {formatCurrency(voce.prezzoUnitario)}
                    </Text>
                  </View>
                  <Text style={[styles.voceTotal, { color: colors.foreground }]}>
                    {formatCurrency(voce.totale)}
                  </Text>
                </View>
              ))}

              <View style={[styles.subtotaleRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.subtotaleLabel, { color: colors.mutedForeground }]}>
                  Subtotale {cap.lettera}
                </Text>
                <Text style={[styles.subtotaleValue, { color: colors.foreground }]}>
                  {formatCurrency(cap.subtotale)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.chapterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {quote.items.map((item, idx) => (
              <View key={idx} style={styles.voceRow}>
                <View style={styles.voceLeft}>
                  <Text style={[styles.voceDesc, { color: colors.foreground }]} numberOfLines={2}>
                    {item.descrizione}
                  </Text>
                  <Text style={[styles.voceMeta, { color: colors.mutedForeground }]}>
                    {item.quantita} {item.unita} × {formatCurrency(item.prezzoUnitario)}
                  </Text>
                </View>
                <Text style={[styles.voceTotal, { color: colors.foreground }]}>
                  {formatCurrency(item.totale)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <LinearGradient
          colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.totalCard}
        >
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotale</Text>
            <Text style={styles.totalValueLight}>{formatCurrency(quote.subtotale)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA {quote.ivaPercentuale}%</Text>
            <Text style={styles.totalValueLight}>{formatCurrency(quote.ivaValore)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>TOTALE</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(quote.totale)}</Text>
          </View>
        </LinearGradient>

        {/* Payment conditions */}
        {quote.condizioniPagamento && quote.condizioniPagamento.length > 0 && (
          <View style={[styles.conditionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.conditionsTitle, { color: colors.mutedForeground }]}>
              CONDIZIONI DI PAGAMENTO
            </Text>
            {quote.condizioniPagamento.map((cond, idx) => (
              <View key={idx} style={styles.conditionRow}>
                <View style={[styles.conditionDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.conditionText, { color: colors.foreground }]}>{cond}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <Pressable
          style={({ pressed }) => [
            styles.pdfBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleGeneratePdf}
          disabled={generatePdf.isPending}
          testID="generate-pdf-button"
        >
          <LinearGradient
            colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pdfGradient}
          >
            {generatePdf.isPending ? (
              <View style={styles.btnRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.pdfBtnText}>Generazione PDF...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Feather name="file-text" size={18} color="#fff" />
                <Text style={styles.pdfBtnText}>
                  {isUnlocked ? "Apri PDF" : "Anteprima PDF"}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.shareFullBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleShare}
          testID="share-full-button"
        >
          <Feather name="share-2" size={16} color={colors.primary} />
          <Text style={[styles.shareFullText, { color: colors.primary }]}>
            Condividi come testo
          </Text>
        </Pressable>
      </ScrollView>

      {/* Paywall modal */}
      <Modal
        visible={showPaywall}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaywall(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinearGradient
              colors={[colors.gradFrom, colors.gradMid, colors.gradTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalGradientHeader}
            >
              <Feather name="lock" size={28} color="#fff" />
            </LinearGradient>

            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              PDF disponibile con un piano a pagamento
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Sblocca il download PDF senza filigrana acquistando un preventivo singolo o abbonandoti a un piano mensile.
            </Text>

            <View style={styles.modalFeatures}>
              {[
                "PDF professionale senza filigrana",
                "Logo aziendale nel documento",
                "Preventivo pronto per il cliente",
              ].map((feat) => (
                <View key={feat} style={styles.featureRow}>
                  <View style={[styles.featureCheck, { backgroundColor: `${colors.accent}20` }]}>
                    <Feather name="check" size={12} color={colors.accent} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>{feat}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.modalNote, { color: colors.mutedForeground }]}>
              Vai su prevAI.it dal browser per acquistare un piano e sbloccare il PDF di questo preventivo.
            </Text>

            <Pressable
              style={[styles.closeModalBtn, { borderColor: colors.border }]}
              onPress={() => setShowPaywall(false)}
            >
              <Text style={[styles.closeModalText, { color: colors.mutedForeground }]}>Chiudi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorMsg: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  retryBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  retryText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 12 },
  navTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  shareBtn: { marginLeft: 12 },
  content: {
    padding: 16,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  quoteDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  clientSection: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  clientInfo: { flex: 1, gap: 1 },
  clientLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  clientName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  descText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  chapterCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chapterLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterLetterText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  chapterTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  voceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  voceLeft: { flex: 1, gap: 2 },
  voceDesc: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  voceMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  voceTotal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 70,
    textAlign: "right",
  },
  subtotaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  subtotaleLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  subtotaleValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  totalCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  totalValueLight: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
  },
  grandTotalRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.3)",
  },
  grandTotalLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  conditionsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  conditionsTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  conditionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  conditionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
  },
  conditionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  pdfBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  pdfGradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pdfBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  shareFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  shareFullText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  // Paywall modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    alignItems: "center",
  },
  modalGradientHeader: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  modalFeatures: {
    width: "100%",
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  modalNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  closeModalBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  closeModalText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
