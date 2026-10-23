// VideoPlayer.dc.html. A short video for first-time screens and Help (`?video=quotes&from=quotes`): the dark stage with the video, captions that follow the chapter, a
// scrub bar of chapters, back and forward 10 seconds, play and pause, speed and captions, then the chapters and a button to try it. States: loading, playing, paused,
// offline (the file did not load: no connection, or the site is unreachable). POCKET-7: the videos are real MP4s from the website (lib/videos.ts), silent, so
// they start muted and play with the sound off; the captions are ours (one per chapter, the same text as the site's subtitles), drawn over the video.
// A video with no file yet goes back to Help's Coming soon. Started and finished go to /api/app/events with the screen it was opened from.
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEvent, useEventListener } from "expo";
import { useVideoPlayer } from "expo-video";
import { useTranslation } from "react-i18next";
import { board } from "@/theme/board";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Glyph } from "@/ui/Icon";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { SectionHeader } from "@/ui/Row";
import { SetRow } from "@/ui/Settings";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { BigPlay, ChapterRow, Frame, FrameVideo, Overlay, OverlayText, Pill, PillText, Scrub, SettingsCard, SpeedLine, Stage, StageHeader, Times, Transport, VideoInfo } from "@/ui/Video";
import { chapterAt, clampPos, clock, knobX, playable, SPEEDS, segmentFill, VIDEO_FROM, videoEvents, videoOf, videoUrl, type Chapter, type VideoDef, type VideoFrom } from "@/lib/videos";
import { sendAppEvent } from "@/lib/appEvents";
import { comingSoonHref, screenHref, type ScreenName } from "@/lib/nav";
import { useSession } from "@/lib/useSession";

const BAR = 350;
/** Where "Provalo adesso" goes for each video. */
const TRY: Record<VideoDef["id"], ScreenName> = { quotes: "NewQuote", overview: "SmartHome", jobs: "Jobs", crew: "Team", bonifico: "Invoices", app: "Integrations" };

type Info = { head: string; title: string; topic: string; sub: string; cta: string; ch: string[][] };

export default function VideoPlayer() {
  const { t: tr } = useTranslation();
  const { status } = useSession();
  const params = useLocalSearchParams<{ video?: string; from?: string }>();
  const video = videoOf(params.video);
  if (status === "out") return <Redirect href="/" />;
  if (!playable(video)) {
    const title = video ? (tr(`vp.v.${video.id}.title`) as string) : "";
    return <Redirect href={comingSoonHref(title)} />;
  }
  const from = (VIDEO_FROM as readonly string[]).includes(params.from ?? "") ? (params.from as VideoFrom) : "help";
  return <Player video={video} from={from} />;
}

function Player({ video, from }: { video: VideoDef & { file: string }; from: VideoFrom }) {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`vp.${k}`, o) as string;
  const total = video.secs;
  const info = tr(`vp.v.${video.id}`, { returnObjects: true }) as unknown as Info;
  const chapters: Chapter[] = info.ch.map((c, i) => ({ at: video.at[i] ?? 0, title: c[0]!, caption: c[1]! }));
  const [cc, setCc] = useState(true);
  const [speed, setSpeed] = useState<number>(1);

  const player = useVideoPlayer(videoUrl(video.file), (p) => {
    p.muted = true;
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.play();
  });
  const { currentTime } = useEvent(player, "timeUpdate", { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing, oldIsPlaying: false });
  const { status: state } = useEvent(player, "statusChange", { status: player.status });
  const [ended, setEnded] = useState(false);
  useEventListener(player, "playToEnd", () => setEnded(true));
  useEffect(() => { player.playbackRate = speed; }, [player, speed]);
  // Start once the file is ready (a play() before that is dropped on the web).
  const autoplayed = useRef(false);
  useEffect(() => {
    if (state === "readyToPlay" && !autoplayed.current) { autoplayed.current = true; player.play(); }
  }, [state, player]);

  const pos = ended ? total : clampPos(currentTime, total);
  const sent = useRef({ started: false, finished: false });
  useEffect(() => {
    for (const kind of videoEvents(sent.current, { playing: isPlaying, pos, total })) {
      sendAppEvent({ kind, entityId: video.id, from, surface: Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "web" });
    }
  }, [isPlaying, pos, total, video.id, from]);

  const offline = state === "error";
  const loading = state === "loading" && !isPlaying;
  const ci = chapterAt(chapters, pos);
  const fills = segmentFill(chapters, total, pos);
  const seek = (p: number) => { setEnded(false); player.currentTime = clampPos(p, total); };
  const toggle = () => {
    if (pos >= total - 0.25) { seek(0); player.play(); return; }
    if (isPlaying) player.pause(); else player.play();
  };
  const retry = () => { player.replace(videoUrl(video.file)); player.play(); };
  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const goTry = () => router.push(screenHref(TRY[video.id], info.cta));
  const speedText = `${speed}×`;

  return (
    <Screen>
      <ScrollPage bottom={56}>
        <Stage>
          <StageHeader title={info.head} close={t("close")} onClose={close} />
          <Frame label={`${info.title}, ${chapters[ci]!.title}`}
            media={<FrameVideo player={player} />}
            caption={cc && !offline && !loading ? chapters[ci]!.caption : undefined}
            overlay={offline ? (
              <Overlay solid>
                <Glyph name="cloud" size={28} tint={board.player.cloud} />
                <OverlayText>{t("offline")}</OverlayText>
                <OverlayText dim>{t("offlineSub")}</OverlayText>
                <Pill on onPress={retry} label={t("retry")}><PillText on>{t("retry")}</PillText></Pill>
              </Overlay>
            ) : loading ? <Overlay><OverlayText dim>{t("loading")}</OverlayText></Overlay>
              : !isPlaying ? <Overlay><BigPlay label={t("play")} onPress={toggle} /></Overlay> : undefined} />
          <Scrub fills={fills} labels={chapters.map((c, i) => t("chapter", { n: i + 1, title: c.title }))} onGo={(i) => seek(chapters[i]!.at)} knob={knobX(chapters, total, pos, BAR)} now={Math.round(pos)} max={total} text={clock(pos)} label={t("position")} />
          <Times pos={clock(pos)} chapter={chapters[ci]!.title} total={clock(total)} />
          <Transport cc={t("captions")} ccOn={cc && !offline} onCc={() => setCc((c) => !c)} speed={speedText} onSpeed={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as 1) + 1) % SPEEDS.length]!)} playing={isPlaying && !offline} onToggle={toggle}
            onBack={() => seek(pos - 10)} onForward={() => seek(pos + 10)} labels={{ play: t("play"), pause: t("pause"), back: t("back10"), forward: t("fwd10"), speed: t("speed", { speed: speedText }) }} />
        </Stage>

        <Section pt={18} px={20}>
          <VideoInfo topic={info.topic} length={clock(total)} title={info.title} sub={info.sub} />
        </Section>
        <Section delay={40} pt={18} px={16}>
          <SettingsCard>
            <SpeedLine label={t("speedTitle")} value={speedText} />
            <Segmented options={SPEEDS.map((s) => `${s}×`)} value={SPEEDS.indexOf(speed as 1)} onChange={(i) => setSpeed(SPEEDS[i]!)} label={t("speedTitle")} />
            <SetRow first icon="speaker" tone="slate" label={t("captions")} sub={cc ? t("ccOn") : t("ccOff")} control={<Switch value={cc} onChange={setCc} label={t("captions")} />} />
          </SettingsCard>
        </Section>
        <Section delay={70} pt={20} px={16}>
          <SectionHeader title={t("chapters")} />
          <Card>
            {chapters.map((c, i) => (
              <ChapterRow key={c.title} first={i === 0} time={clock(c.at)} title={c.title} current={i === ci} onPress={() => { seek(c.at); player.play(); }}
                status={i === ci ? <Status tone={isPlaying ? "ok" : "mute"} shape={isPlaying ? "live" : "pause"} plain>{isPlaying ? t("playing") : t("paused")}</Status> : i < ci ? <Status tone="mute" shape="check" plain>{t("watched")}</Status> : undefined} />
            ))}
          </Card>
        </Section>
        <Section delay={100} pt={20} px={16}><Button size="lg" block label={info.cta} onPress={goTry} /></Section>
      </ScrollPage>
    </Screen>
  );
}
